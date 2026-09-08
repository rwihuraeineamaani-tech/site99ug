import { useEffect, useState } from "react";
import { AppShell } from "@/components/system/AppShell";
import { DeckPanel } from "@/components/deck";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles, ROLE_LABELS, StaffRole } from "@/hooks/useMyRoles";
import { ThemeMode, THEME_LABELS, readTheme, setTheme } from "@/lib/theme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tab = "profile" | "appearance" | "account" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Settings() {
  const { userId, email, displayName, title, roles, departments, reload } = useMyRoles();
  const [tab, setTab] = useState<Tab>("profile");

  // Profile
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Appearance
  const [theme, setThemeState] = useState<ThemeMode>(readTheme());
  const [savingTheme, setSavingTheme] = useState(false);

  // Security
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Payment PIN
  const [hasPin, setHasPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);


  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("display_name, title, theme, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancel) return;
      const row = data as { display_name: string | null; title: string | null; theme: string | null; created_at: string } | null;
      setName(row?.display_name ?? displayName ?? "");
      setJob(row?.title ?? "");
      setJoined(row?.created_at ?? null);
      if (row?.theme === "dark" || row?.theme === "light" || row?.theme === "system") {
        setThemeState(row.theme);
        setTheme(row.theme);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [userId, displayName]);

  const saveProfile = async () => {
    if (!userId) return;
    if (!name.trim()) {
      toast.error("Please put in your name.");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("team_members")
      .update({ display_name: name.trim(), title: job.trim() || null })
      .eq("user_id", userId);
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved.");
    reload();
  };

  const pickTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    setTheme(mode);
    if (!userId) return;
    setSavingTheme(true);
    const { error } = await supabase.from("team_members").update({ theme: mode }).eq("user_id", userId);
    setSavingTheme(false);
    if (error) toast.error("Saved on this device only: " + error.message);
  };

  const savePin = async () => {
    if (!/^\d{6}$/.test(newPin)) {
      toast.error("The PIN has to be six digits.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("The two PINs don't match.");
      return;
    }
    setSavingPin(true);
    const { error } = await supabase.rpc("set_payment_pin", {
      _pin: newPin,
      _current_pin: currentPin || undefined,
    });
    setSavingPin(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setHasPin(true);
    toast.success("Payment PIN saved.");
  };


  const changePassword = async () => {
    if (newPw.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("The two new passwords don't match.");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({
      password: newPw,
      // Lovable Cloud asks for the current password on a signed-in change.
      current_password: currentPw,
    } as unknown as { password: string });
    setSavingPw(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    toast.success("Password changed.");
  };

  const changeEmail = async () => {
    const next = newEmail.trim().toLowerCase();
    if (!next.includes("@")) {
      toast.error("Please put in a valid email address.");
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/app/settings` }
    );
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewEmail("");
    toast.success("Check the new inbox and click the link to confirm.");
  };

  const shown = name || displayName || email || "You";
  const roleNames = roles
    .map((r) => ROLE_LABELS[r as StaffRole])
    .filter(Boolean)
    .join(" · ");
  const openDepartments = Object.entries(departments)
    .filter(([, v]) => v)
    .map(([k]) => k[0].toUpperCase() + k.slice(1))
    .join(" · ");

  return (
    <AppShell eyebrow="Settings">
      <div className="max-w-3xl">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-acc-violet-soft text-acc-violet grid place-items-center display text-lg">
            {initialsOf(shown) || "S9"}
          </div>
          <div className="min-w-0">
            <h1 className="display text-2xl md:text-3xl truncate">{shown}</h1>
            <p className="text-sm text-ink-soft truncate">{title || "Team member"}</p>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 eyebrow text-[10px] focus-ring transition-colors",
                tab === t.id
                  ? "border-signal/60 bg-acc-violet-soft text-signal"
                  : "border-rule text-ink-soft hover:text-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "profile" && (
          <DeckPanel index="01" title="Your profile" hint="How you appear across the system">
            <div className="surface rounded-xl p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="job">Job title</Label>
                <Input
                  id="job"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="e.g. Creative Director"
                />
              </div>
              <div className="grid gap-1 pt-1 text-sm">
                <span className="eyebrow text-[10px] text-ink-faint">Email</span>
                <span className="text-ink-soft">{email ?? "—"}</span>
              </div>
              <div className="grid gap-1 text-sm">
                <span className="eyebrow text-[10px] text-ink-faint">Your access</span>
                <span className="text-ink-soft">{roleNames || "No roles yet"}</span>
                <span className="text-xs text-ink-faint">
                  Access levels are set by an admin — ask a managing director or founder to change yours.
                </span>
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </DeckPanel>
        )}

        {tab === "appearance" && (
          <DeckPanel index="02" title="Appearance" hint="Only the signed-in system changes">
            <div className="surface rounded-xl p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                {(["dark", "light", "system"] as ThemeMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => pickTheme(m)}
                    className={cn(
                      "rounded-xl border p-4 text-left focus-ring transition-colors",
                      theme === m ? "border-signal bg-acc-violet-soft" : "border-rule hover:border-rule-strong"
                    )}
                  >
                    <div className="text-sm font-medium">{THEME_LABELS[m]}</div>
                    <div className="text-xs text-ink-faint mt-1">
                      {m === "dark"
                        ? "Control-room dark, the default"
                        : m === "light"
                        ? "Bright, easier in daylight"
                        : "Follows your phone or computer"}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-faint">
                {savingTheme ? "Saving…" : "Remembered on your account, so it follows you to any device."}
              </p>
            </div>
          </DeckPanel>
        )}

        {tab === "account" && (
          <DeckPanel index="03" title="Account details">
            <div className="surface rounded-xl p-5 grid gap-4 text-sm">
              <div className="grid gap-1">
                <span className="eyebrow text-[10px] text-ink-faint">Email</span>
                <span className="text-ink-soft">{email ?? "—"}</span>
              </div>
              <div className="grid gap-1">
                <span className="eyebrow text-[10px] text-ink-faint">Roles</span>
                <span className="text-ink-soft">{roleNames || "No roles yet"}</span>
              </div>
              <div className="grid gap-1">
                <span className="eyebrow text-[10px] text-ink-faint">On the team since</span>
                <span className="text-ink-soft">
                  {joined ? new Date(joined).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="eyebrow text-[10px] text-ink-faint">Areas you can open</span>
                <span className="text-ink-soft">{openDepartments || "—"}</span>
              </div>
              <p className="text-xs text-ink-faint">
                Need more access? Ask a managing director or founder — they can change it under Team &amp; access.
              </p>
            </div>
          </DeckPanel>
        )}

        {tab === "security" && (
          <>
            <DeckPanel index="04" title="Change password">
              <div className="surface rounded-xl p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cpw">Current password</Label>
                  <Input id="cpw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="npw">New password</Label>
                  <Input id="npw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rpw">Confirm new password</Label>
                  <Input id="rpw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                </div>
                <Button onClick={changePassword} disabled={savingPw}>
                  {savingPw ? "Changing…" : "Change password"}
                </Button>
              </div>
            </DeckPanel>

            <DeckPanel index="05" title="Change email address">
              <div className="surface rounded-xl p-5 space-y-4">
                <p className="text-sm text-ink-soft">
                  You sign in with <span className="text-ink">{email ?? "—"}</span>. A confirmation link goes to the
                  new address; until you click it, the old one keeps working.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="nem">New email address</Label>
                  <Input
                    id="nem"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@site99.co"
                  />
                </div>
                <Button onClick={changeEmail} disabled={savingEmail}>
                  {savingEmail ? "Sending…" : "Send confirmation"}
                </Button>
              </div>
            </DeckPanel>
          </>
        )}
      </div>
    </AppShell>
  );
}
