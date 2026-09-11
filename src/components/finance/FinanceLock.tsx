import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, ShieldCheck } from "lucide-react";

/** How long one PIN entry keeps finance edits open. */
const WINDOW_MS = 5 * 60 * 1000;

type LockState = {
  /** Ask for the PIN if the window has closed. Resolves true once finance edits are open. */
  require: () => Promise<boolean>;
  /** Milliseconds left in the current window, 0 when locked. */
  msLeft: number;
  unlocked: boolean;
  lock: () => void;
  /** null while we are still checking whether this person has set a PIN. */
  hasPin: boolean | null;
  /** Opens the PIN box straight away. */
  openPin: () => void;
};

const Ctx = createContext<LockState | null>(null);

/** Use around any finance edit: `if (!(await require())) return;` */
export function useFinanceLock(): LockState {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  // Outside a provider nothing is gated — keeps components usable in isolation.
  return { require: async () => true, msLeft: 0, unlocked: false, lock: () => {}, hasPin: true, openPin: () => {} };
}

export function FinanceLockProvider({ children }: { children: ReactNode }) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const [hasPin, setHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (alive) setHasPin(false);
        return;
      }
      const { data } = await supabase.from("payment_pins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
      if (alive) setHasPin(!!data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const msLeft = Math.max(0, until - now);
  const unlocked = msLeft > 0;

  const require = useCallback(async () => {
    if (Date.now() < until) {
      setUntil(Date.now() + WINDOW_MS); // each successful action keeps it open
      return true;
    }
    setPin("");
    setError(null);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
    });
  }, [until]);

  const finish = (ok: boolean) => {
    setOpen(false);
    pending.current?.(ok);
    pending.current = null;
  };

  const submit = async () => {
    if (!/^\d{6}$/.test(pin)) {
      setError("The PIN is six digits.");
      return;
    }
    setChecking(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setChecking(false);
      setError("You are signed out.");
      return;
    }
    const { data, error: err } = await supabase.rpc("check_payment_pin", { _user_id: auth.user.id, _pin: pin });
    setChecking(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data) {
      setError("That PIN is not right. Three wrong tries locks it for fifteen minutes.");
      return;
    }
    setUntil(Date.now() + WINDOW_MS);
    finish(true);
  };

  const value = useMemo<LockState>(
    () => ({
      require,
      msLeft,
      unlocked,
      lock: () => setUntil(0),
      hasPin,
      openPin: () => {
        setPin("");
        setError(null);
        setOpen(true);
      },
    }),
    [require, msLeft, unlocked, hasPin]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : finish(false))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Type your PIN</DialogTitle>
            <DialogDescription>
              Your six-digit finance PIN keeps this open for five minutes, then it asks again. Set or change it under My
              settings.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••"
            className="text-center tracking-[0.5em]"
          />
          {error && <p className="text-sm text-signal">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => finish(false)}>
              Cancel
            </Button>
            <Button disabled={checking} onClick={submit}>
              {checking ? "Checking…" : "Unlock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

/** Small countdown shown in the finance page header. */
export function FinanceLockChip() {
  const { msLeft, unlocked, lock } = useFinanceLock();
  const secs = Math.ceil(msLeft / 1000);
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  if (!unlocked)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-sunken px-2.5 py-1 text-[11px] text-ink-faint">
        <Lock className="h-3 w-3" /> Finance edits locked
      </span>
    );

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-acc-lime/50 bg-acc-lime/10 px-2.5 py-1 text-[11px] text-acc-lime">
      <ShieldCheck className="h-3 w-3" />
      <span className="num">Open {label}</span>
      <button type="button" onClick={lock} className="press underline underline-offset-2">
        Lock now
      </button>
    </span>
  );
}

export default FinanceLockProvider;
