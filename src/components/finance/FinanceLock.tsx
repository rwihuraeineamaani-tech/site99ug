import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, ShieldCheck } from "lucide-react";

/** How long one PIN entry keeps finance edits open. */
const WINDOW_MS = 5 * 60 * 1000;
/** The open window follows the person across every finance page in this tab. */
const STORE_KEY = "site99:finance-unlock-until";

function readUntil() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeUntil(value: number) {
  try {
    if (value > Date.now()) sessionStorage.setItem(STORE_KEY, String(value));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* private browsing — the window just stays on this page */
  }
}

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
  const [until, setUntilState] = useState(() => readUntil());
  const setUntil = useCallback((value: number) => {
    setUntilState(value);
    writeUntil(value);
  }, []);
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

  const checkPin = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setHasPin(false);
      return;
    }
    const { data } = await supabase.from("payment_pins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    setHasPin(!!data);
  }, []);

  useEffect(() => {
    void checkPin();
    // Someone may set their PIN in another tab, then come back here.
    const onFocus = () => void checkPin();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkPin]);

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
  const { msLeft, unlocked, lock, hasPin, openPin } = useFinanceLock();
  const secs = Math.ceil(msLeft / 1000);
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  if (!unlocked)
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper-sunken px-2.5 py-1 text-[11px] text-ink-faint">
        <Lock className="h-3 w-3" /> Finance buttons locked
        {hasPin === false ? (
          <Link to="/app/settings?tab=security" className="press underline underline-offset-2" data-finance-allow>
            Set up your PIN
          </Link>
        ) : (
          <button type="button" onClick={openPin} className="press underline underline-offset-2" data-finance-allow>
            Unlock with PIN
          </button>
        )}
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

/**
 * Wraps a finance page. The numbers stay readable, but every button stays
 * disabled until the six-digit PIN is typed.
 */
export function FinanceGate({ children }: { children: ReactNode }) {
  const { unlocked, hasPin, openPin } = useFinanceLock();

  return (
    <>
      {!unlocked && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-paper-sunken px-4 py-3">
          <Lock className="h-4 w-4 text-ink-faint" />
          <p className="text-sm text-ink-faint flex-1 min-w-[12rem]">
            {hasPin === false
              ? "You have not set a finance PIN yet. Set one to make changes here."
              : "Type your six-digit PIN to make changes. It stays open for five minutes."}
          </p>
          {hasPin === false ? (
            <Button asChild size="sm" data-finance-allow>
              <Link to="/app/settings?tab=security">Set up your PIN</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={openPin} data-finance-allow>
              Unlock with PIN
            </Button>
          )}
        </div>
      )}
      <div className={unlocked ? undefined : "finance-locked"}>{children}</div>
    </>
  );
}

export default FinanceLockProvider;
