import { useEffect, useState } from "react";
import StaffFileForm from "@/components/people/StaffFileForm";
import { uploadAvatar } from "@/lib/staffProfile";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/system/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles, ROLE_LABELS, StaffRole } from "@/hooks/useMyRoles";
import { ThemeMode, THEME_LABELS, readTheme, setTheme } from "@/lib/theme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  BellRing,
  ExternalLink,
  Gauge,
  ListChecks,
  LogOut,
  Palette,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  UserCircle,
  Wallet,
} from "lucide-react";
import { usePushNotifications, type PushPreferences } from "@/hooks/usePushNotifications";

type Tab = "profile" | "file" | "appearance" | "notifications" | "account" | "security";

const TABS: { id: Tab; label: string; hint: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", hint: "Name, title, phone & bio", icon: UserCircle },
  { id: "file", label: "Staff file", hint: "ID, next of kin, bank, documents", icon: FileText },
  { id: "appearance", label: "Appearance", hint: "Theme & menu density", icon: Palette },
  { id: "notifications", label: "Notifications", hint: "Push alerts on this device", icon: BellRing },
  { id: "account", label: "Account", hint: "Email, access & quick links", icon: User },
  { id: "security", label: "Security", hint: "Password, PIN & sessions", icon: ShieldCheck },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-xl p-5 space-y-4">
      <div>
        <h2 className="display text-lg">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
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
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Appearance
  const [theme, setThemeState] = useState<ThemeMode>(readTheme());
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [savingTheme, setSavingTheme] = useState(false);

  // Security
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

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
        .select("display_name, title, theme, created_at, phone, bio, nav_density")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancel) return;
      const row = data as {
        display_name: string | null;
        title: string | null;
        theme: string | null;
        created_at: string;
        phone: string | null;
        bio: string | null;
        nav_density: string | null;
      } | null;
      setName(row?.display_name ?? displayName ?? "");
      setJob(row?.title ?? "");
      setPhone(row?.phone ?? "");
      setBio(row?.bio ?? "");
      setJoined(row?.created_at ?? null);
      if (row?.theme === "dark" || row?.theme === "light" || row?.theme === "system") {
        setThemeState(row.theme);
        setTheme(row.theme);
      }
      if (row?.nav_density === "compact" || row?.nav_density === "comfortable") {
        setDensity(row.nav_density);
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
      .update({
        display_name: name.trim(),
        title: job.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
      })
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

  const pickDensity = async (mode: "comfortable" | "compact") => {
    setDensity(mode);
    if (!userId) return;
    const { error } = await supabase.from("team_members").update({ nav_density: mode }).eq("user_id", userId);
    if (error) toast.error("Saved on this device only: " + error.message);
    else toast.success("Menu density saved.");
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

  const signOutOthers = async () => {
    setSigningOutOthers(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSigningOutOthers(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Every other device has been signed out. This one stays signed in.");
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

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <AppShell eyebrow="Settings">
      <div className="max-w-5xl">
        {/* Header card */}
        <div className="surface flex items-center gap-4 rounded-2xl p-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-acc-violet-soft text-acc-violet display text-lg">
            {initialsOf(shown) || "S9"}
          </div>
          <div className="min-w-0">
            <h1 className="display truncate text-2xl md:text-3xl">{shown}</h1>
            <p className="truncate text-sm text-ink-soft">{title || "Team member"}</p>
            <p className="truncate text-xs text-ink-faint">{email ?? ""}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6 md:flex-row">
          {/* Vertical tabs on desktop, pills on mobile */}
          <nav className="no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:w-56 md:shrink-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2.5 rounded-full border px-4 py-1.5 text-left focus-ring transition-colors md:rounded-xl md:px-3 md:py-2.5",
                    tab === t.id
                      ? "border-signal/60 bg-acc-violet-soft text-signal"
                      : "border-rule text-ink-soft hover:text-ink"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.label}</span>
                    <span className="hidden truncate text-[11px] text-ink-faint md:block">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 space-y-6">
            <div className="md:hidden">
              <h2 className="display text-xl">{activeTab.label}</h2>
              <p className="text-xs text-ink-faint">{activeTab.hint}</p>
            </div>

            {tab === "file" && userId && (
              <div className="space-y-4">
                <Section title="Profile photo" hint="Shown to the team on People and in chat.">
                  <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await uploadAvatar(userId, f); toast.success("Photo updated"); } catch (err) { toast.error((err as Error).message); } }} />
                </Section>
                <StaffFileForm userId={userId} mode="self" canEditEmployment={has("hr", "managing_director", "founder", "admin")} />
              </div>
            )}
            {tab === "profile" && (
              <Section title="Your profile" hint="How you appear across the system">
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
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +256 700 000 000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio">Short bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A line or two about what you do"
                    rows={3}
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
                    Access is set only by the System Administrator. Your job title is shown publicly; these access names are private.
                  </span>
                </div>
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </Section>
            )}

            {tab === "appearance" && (
              <>
                <Section title="Theme" hint="Only the signed-in system changes">
                  <div className="grid gap-3 sm:grid-cols-3">
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
                        <div className="mt-1 text-xs text-ink-faint">
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
                </Section>

                <Section title="Menu density" hint="How much room the sidebar menu takes">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["comfortable", "compact"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => pickDensity(m)}
                        className={cn(
                          "rounded-xl border p-4 text-left focus-ring transition-colors",
                          density === m ? "border-signal bg-acc-violet-soft" : "border-rule hover:border-rule-strong"
                        )}
                      >
                        <div className="text-sm font-medium capitalize">{m}</div>
                        <div className="mt-1 text-xs text-ink-faint">
                          {m === "comfortable" ? "Roomy spacing, the default" : "Tighter rows, more items on screen"}
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {tab === "notifications" && (
              <Section title="Push notifications" hint="Work alerts on this phone or computer">
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
              </Section>
            )}

            {tab === "account" && (
              <>
                <Section title="Account details">
                  <div className="grid gap-4 text-sm">
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
                </Section>

                <Section title="Quick links" hint="Jump straight to your work">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      to="/app/kpi"
                      className="flex items-center gap-3 rounded-xl border border-rule p-4 transition-colors hover:border-signal/50 focus-ring"
                    >
                      <Gauge className="h-5 w-5 shrink-0 text-acc-violet" />
                      <span>
                        <span className="block text-sm font-medium">My KPI</span>
                        <span className="block text-xs text-ink-faint">Your targets, earnings and progress</span>
                      </span>
                    </Link>
                    <Link
                      to="/app/todo"
                      className="flex items-center gap-3 rounded-xl border border-rule p-4 transition-colors hover:border-signal/50 focus-ring"
                    >
                      <ListChecks className="h-5 w-5 shrink-0 text-acc-violet" />
                      <span>
                        <span className="block text-sm font-medium">To-Do</span>
                        <span className="block text-xs text-ink-faint">Everything waiting on you</span>
                      </span>
                    </Link>
                  </div>
                </Section>
              </>
            )}

            {tab === "security" && (
              <>
                <Section title="Change password">
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
                </Section>

                <Section title="Change email address">
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
                </Section>

                {(canSeeFinance || has("admin", "founder", "managing_director")) && (
                  <Section title="Payment PIN">
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
                  </Section>
                )}

                <Section title="Signed-in devices" hint="Where this account is currently logged in">
                  <div className="flex items-start gap-3">
                    <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-acc-violet" />
                    <p className="text-sm text-ink-soft">
                      If you have signed in on a shared or lost device, sign out everywhere else in one tap. This
                      device stays signed in; every other phone or computer is logged out and will need the password
                      again.
                    </p>
                  </div>
                  <Button variant="outline" onClick={signOutOthers} disabled={signingOutOthers}>
                    <LogOut className="h-4 w-4" />
                    {signingOutOthers ? "Signing out…" : "Sign out of all other devices"}
                  </Button>
                </Section>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
