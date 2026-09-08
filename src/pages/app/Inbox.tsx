import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, StatusChip } from "@/components/system";
import { DeckStrip } from "@/components/deck";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMyRoles, TEAM_ROLES, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";
import { useInbox, inboxChanged } from "@/hooks/useInbox";
import { KIND_LABEL, KIND_TONE, ago, markRead, type InboxFilter, type InboxMessage } from "@/lib/inbox";
import { refCode } from "@/lib/contentFlow";
import { Mail, Send, CornerDownRight } from "lucide-react";

type Person = { user_id: string; display_name: string | null; email: string };

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "waiting", label: "Waiting on you" },
  { key: "brief", label: "Briefs" },
  { key: "announcement", label: "Announcements" },
  { key: "message", label: "Messages" },
];

export default function InboxPage() {
  const { userId, displayName } = useMyRoles();
  const { loading, messages, read, waiting, unread, reload, markLocalRead } = useInbox();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  // Composer
  const [audience, setAudience] = useState<"person" | "role" | "everyone">("person");
  const [toUser, setToUser] = useState("");
  const [toRole, setToRole] = useState<StaffRole>("creative");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<InboxMessage | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, email");
      if (!cancelled) setPeople(((data as unknown as Person[]) ?? []).filter((p) => p.user_id !== userId));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const nameOf = (id: string | null) => {
    if (!id) return "Site 99";
    if (id === userId) return "You";
    const p = people.find((x) => x.user_id === id);
    return p?.display_name || p?.email || "A team mate";
  };

  const threads = useMemo(() => {
    const byParent = new Map<string, InboxMessage[]>();
    messages.forEach((m) => {
      if (!m.parent_id) return;
      byParent.set(m.parent_id, [...(byParent.get(m.parent_id) ?? []), m]);
    });
    return byParent;
  }, [messages]);

  const shown = useMemo(() => {
    const roots = messages.filter((m) => !m.parent_id);
    if (filter === "all" || filter === "waiting") return filter === "waiting" ? [] : roots;
    if (filter === "unread") return roots.filter((m) => !read.has(m.id) && m.author !== userId);
    if (filter === "message") return roots.filter((m) => m.kind === "message" || m.kind === "client_message");
    return roots.filter((m) => m.kind === filter);
  }, [messages, filter, read, userId]);

  const openItem = async (m: InboxMessage) => {
    const next = open === m.id ? null : m.id;
    setOpen(next);
    if (next && !read.has(m.id) && userId) {
      markLocalRead([m.id]);
      await markRead(userId, [m.id]);
    }
  };

  const markAll = async () => {
    if (!userId) return;
    const ids = messages.filter((m) => !read.has(m.id)).map((m) => m.id);
    markLocalRead(ids);
    await markRead(userId, ids);
    toast.success("Inbox cleared.");
  };

  const send = async () => {
    if (!userId) return;
    if (!subject.trim()) return toast.error("Give it a subject.");
    if (audience === "person" && !toUser) return toast.error("Pick who it's for.");
    setSending(true);
    const { error } = await supabase.from("inbox_messages").insert({
      kind: "message",
      subject: subject.trim(),
      body: body.trim() || null,
      author: userId,
      audience: replyTo ? replyTo.audience : audience,
      target_user: replyTo ? (replyTo.author ?? null) : audience === "person" ? toUser : null,
      target_role: replyTo ? replyTo.target_role : audience === "role" ? toRole : null,
      parent_id: replyTo?.id ?? null,
    } as never);
    setSending(false);
    if (error) return toast.error(error.message);
    setSubject("");
    setBody("");
    setReplyTo(null);
    toast.success("Sent.");
    reload();
    inboxChanged();
  };

  const startReply = (m: InboxMessage) => {
    setReplyTo(m);
    setSubject(m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`);
    document.getElementById("compose")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const field =
    "w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-ring";

  return (
    <AppShell eyebrow="Inbox">
      <Seo
        title="Inbox · Site 99"
        description="Briefs, announcements, client messages and everything waiting on you."
        path="/app/inbox"
      />

      <PageHeader
        eyebrow="Inbox"
        title="Everything for you."
        lede={
          loading
            ? "Loading…"
            : `${unread} unread · ${waiting.length} thing${waiting.length === 1 ? "" : "s"} waiting on you`
        }
      />

      <DeckStrip
        figures={[
          { label: "Unread", value: unread, tone: unread ? "signal" : "quiet" },
          { label: "Waiting on you", value: waiting.length, tone: waiting.length ? "signal" : "quiet" },
          { label: "In the inbox", value: messages.filter((m) => !m.parent_id).length, tone: "quiet" },
        ]}
      />

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "press rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide focus-ring",
              filter === f.key
                ? "border-signal bg-signal text-paper"
                : "border-rule text-ink-soft hover:text-ink hover:bg-paper-sunken"
            )}
          >
            {f.label}
            {f.key === "unread" && unread > 0 ? ` · ${unread}` : ""}
            {f.key === "waiting" && waiting.length > 0 ? ` · ${waiting.length}` : ""}
          </button>
        ))}
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={markAll} disabled={!unread}>
            Mark all read
          </Button>
        </div>
      </div>

      {/* Waiting on you */}
      {(filter === "all" || filter === "waiting") && waiting.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="eyebrow text-ink-faint">Waiting on you</div>
          {waiting.slice(0, filter === "waiting" ? 50 : 6).map(({ item, why }) => (
            <Link
              key={`${item.id}-${why}`}
              to="/app/content"
              className="block rounded-lg border border-signal/40 bg-signal/[0.05] px-4 py-3 card-lift focus-ring"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="eyebrow text-[9px] text-signal mb-1">
                    {refCode(item.ref_no)} · {item.stage}
                  </div>
                  <div className="text-sm truncate">{item.title}</div>
                  <div className="text-[11px] text-ink-soft">{why}</div>
                </div>
                <StatusChip tone="warn" value="Your move" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Messages */}
      {filter !== "waiting" && (
        <div className="mt-6 space-y-2">
          {!loading && shown.length === 0 && (
            <div className="rounded-lg border border-rule bg-paper-raised px-4 py-10 text-center">
              <Mail className="mx-auto h-6 w-6 text-ink-faint" />
              <div className="mt-2 text-sm text-ink-soft">Nothing here yet.</div>
            </div>
          )}
          {shown.map((m) => {
            const unopened = !read.has(m.id) && m.author !== userId;
            const replies = threads.get(m.id) ?? [];
            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg border bg-paper-raised px-4 py-3 transition-colors",
                  unopened ? "border-signal/50" : "border-rule"
                )}
              >
                <button type="button" onClick={() => openItem(m)} className="w-full text-left focus-ring rounded-md">
                  <div className="flex items-start gap-3">
                    {unopened && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-signal" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StatusChip tone={KIND_TONE[m.kind]} value={KIND_LABEL[m.kind]} />
                        <span className="text-[11px] text-ink-faint">
                          {nameOf(m.author)} · {ago(m.created_at)}
                          {m.audience === "everyone" ? " · everyone" : ""}
                          {m.audience === "role" && m.target_role
                            ? ` · ${ROLE_LABELS[m.target_role as StaffRole] ?? m.target_role}`
                            : ""}
                        </span>
                      </div>
                      <div className={cn("text-sm", unopened ? "font-semibold" : "")}>{m.subject}</div>
                      {open !== m.id && m.body && (
                        <div className="mt-0.5 text-[12px] text-ink-soft truncate">{m.body}</div>
                      )}
                    </div>
                  </div>
                </button>

                {open === m.id && (
                  <div className="mt-3 border-t border-rule pt-3">
                    {m.body && <p className="text-sm text-ink-soft whitespace-pre-wrap">{m.body}</p>}
                    {replies.map((r) => (
                      <div key={r.id} className="mt-3 flex gap-2 rounded-md bg-paper-sunken px-3 py-2">
                        <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-ink-faint">
                            {nameOf(r.author)} · {ago(r.created_at)}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{r.body || r.subject}</div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.link_path && (
                        <Link to={m.link_path}>
                          <Button size="sm" variant="outline">
                            Open it
                          </Button>
                        </Link>
                      )}
                      {m.author && m.author !== userId && (
                        <Button size="sm" variant="ghost" onClick={() => startReply(m)}>
                          Reply
                        </Button>
                      )}
                      {m.author === userId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await supabase.from("inbox_messages").delete().eq("id", m.id);
                            reload();
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compose */}
      <div id="compose" className="mt-10 rounded-xl border border-rule bg-paper-raised p-4">
        <div className="eyebrow text-ink-faint mb-3">{replyTo ? "Replying" : "New message"}</div>
        {replyTo && (
          <div className="mb-3 flex items-center gap-2 text-[12px] text-ink-soft">
            To {nameOf(replyTo.author)} · {replyTo.subject}
            <button type="button" className="text-signal focus-ring rounded" onClick={() => setReplyTo(null)}>
              cancel
            </button>
          </div>
        )}
        {!replyTo && (
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as typeof audience)}
              className={field}
            >
              <option value="person">One person</option>
              <option value="role">A department</option>
              <option value="everyone">Everyone</option>
            </select>
            {audience === "person" && (
              <select value={toUser} onChange={(e) => setToUser(e.target.value)} className={field}>
                <option value="">Who is it for?</option>
                {people.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.display_name || p.email}
                  </option>
                ))}
              </select>
            )}
            {audience === "role" && (
              <select value={toRole} onChange={(e) => setToRole(e.target.value as StaffRole)} className={field}>
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className={cn(field, "mb-3")}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Write it out, ${displayName?.split(" ")[0] ?? "team"}…`}
          rows={4}
          className={cn(field, "mb-3 resize-y")}
        />
        <Button onClick={send} disabled={sending} className="gap-2">
          <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </AppShell>
  );
}
