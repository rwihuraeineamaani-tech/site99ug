import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { BellRing, ExternalLink, Smartphone, Trash2 } from "lucide-react";
import { usePushNotifications, type PushPreferences } from "@/hooks/usePushNotifications";

type Tab = "profile" | "appearance" | "notifications" | "account" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
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
  const { userId, email, displayName, title, roles, departments, reload, canSeeFinance, has } = useMyRoles();
  const [params, setParams] = useSearchParams();
  const urlTab = params.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(
    urlTab && TABS.some((t) => t.id === urlTab) ? urlTab : "profile"
  );
  const setTab = (next: Tab) => {
    setTabState(next);
    setParams({ tab: next }, { replace: true });
  };

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
  const push = usePushNotifications(userId);


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
      const { data: pinRow } = await supabase.from("payment_pins").select("user_id").eq("user_id", userId).maybeSingle();
      if (!cancel) setHasPin(!!pinRow);
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

        <nav className="no-scrollbar -mx-1 mt-6 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 py-1.5 eyebrow text-[10px] focus-ring transition-colors sm:min-h-0",
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

        {tab === "notifications" && (
          <DeckPanel index="03" title="Push notifications" hint="Work alerts on this phone or computer">
            <div className="surface rounded-xl p-4 sm:p-5 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-acc-violet-soft text-acc-violet"><BellRing className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{push.status === "enabled" ? "Notifications are on" : "Stay ahead of your work"}</div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {push.status === "open-in-new-tab" ? "Open Site 99 in its own browser tab to enable notifications." : push.status === "denied" ? "Notifications are blocked. Allow them in this browser’s site settings." : push.status === "unsupported" ? "This browser does not support web notifications." : push.status === "not-configured" ? "Web push needs to be enabled on the messaging connection." : push.status === "enabled" ? `${push.devices.length} active device${push.devices.length === 1 ? "" : "s"}.` : "Choose which work alerts should reach this device."}
                  </p>
                </div>
                {push.status === "open-in-new-tab" ? <Button asChild variant="outline"><a href={window.location.href} target="_blank" rel="noreferrer">Open tab <ExternalLink /></a></Button> : push.status === "enabled" ? <Button variant="outline" onClick={push.disable} disabled={push.busy}>Turn off here</Button> : <Button onClick={push.enable} disabled={push.busy || ["unsupported", "not-configured"].includes(push.status)}>{push.busy ? "Working…" : "Enable notifications"}</Button>}
              </div>

              <div className="divide-y divide-rule rounded-lg border border-rule">
                {([
                  ["tasks_enabled", "Tasks & deadlines", "Assignments, overdue work, calendar reminders, shoots and Sales follow-ups"],
                  ["approvals_enabled", "Approvals", "New requests, reminders, escalations and decisions"],
                  ["communications_enabled", "Messages & briefs", "Direct messages, briefs, replies and announcements"],
                  ["finance_enabled", "Finance alerts", "Cash requests, invoices, payment runs and second approvals"],
                ] as [keyof PushPreferences, string, string][]).map(([key, label, description]) => (
                  <label key={key} className="flex min-h-16 items-center gap-4 px-3 py-3 sm:px-4">
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-ink-faint">{description}</span></span>
                    <Switch checked={push.preferences[key]} onCheckedChange={(checked) => push.updatePreference(key, checked)} aria-label={label} />
                  </label>
                ))}
              </div>

              {push.status === "enabled" && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={push.sendTest}>Send test</Button></div>}
              {push.devices.length > 0 && <div><div className="eyebrow mb-2 text-[10px] text-ink-faint">Connected devices</div><div className="divide-y divide-rule rounded-lg border border-rule">{push.devices.map((device) => <div key={device.id} className="flex min-h-14 items-center gap-3 px-3 py-2"><Smartphone className="h-4 w-4 text-ink-faint" /><div className="min-w-0 flex-1"><div className="truncate text-sm">{device.device_label || "Browser"}</div><div className="text-[10px] text-ink-faint">Last active {new Date(device.last_seen_at).toLocaleString()}</div></div><Button variant="ghost" size="icon-sm" aria-label="Remove device" onClick={() => push.removeDevice(device.id)}><Trash2 /></Button></div>)}</div></div>}
            </div>
          </DeckPanel>
        )}

        {tab === "account" && (
          <DeckPanel index="04" title="Account details">
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
            <DeckPanel index="05" title="Change password">
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

            <DeckPanel index="06" title="Change email address">
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

            {(canSeeFinance || has("admin", "founder", "managing_director")) && (
              <DeckPanel index="07" title="Payment PIN">
                <div className="surface rounded-xl p-5 space-y-4">
                  <p className="text-sm text-ink-soft">
                    Money only leaves an account when this six-digit PIN is typed in. Anything at or above the agreed
                    limit also needs a second PIN from a founder or the managing director. Three wrong tries locks it
                    for fifteen minutes. {hasPin ? "You already have a PIN set." : "You have not set one yet."}
                  </p>
                  {hasPin && (
                    <div className="space-y-1.5">
                      <Label htmlFor="cpin">Current PIN</Label>
                      <Input
                        id="cpin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={currentPin}
                        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="npin">New PIN</Label>
                    <Input
                      id="npin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rpin">Confirm new PIN</Label>
                    <Input
                      id="rpin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  <Button onClick={savePin} disabled={savingPin}>
                    {savingPin ? "Saving…" : hasPin ? "Change PIN" : "Set PIN"}
                  </Button>
                  <p className="text-xs text-ink-faint">Never share it. Nobody, including us, can read it back.</p>
                </div>
              </DeckPanel>
            )}
          </>

        )}
      </div>
    </AppShell>
  );
}
