import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { useMyRoles } from "@/hooks/useMyRoles";
import { ago } from "@/lib/inbox";
import { loadChatPeople, loadChatThreads, loadThreadMessages, markChatRead, openDirectChat, sendChatMessage, type ChatMessage, type ChatPerson, type ChatThread } from "@/lib/chat";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { userId, isClient, isStaff, has } = useMyRoles();
  const base = isClient && !isStaff ? "/portal/chat" : has("resident") && !isStaff ? "/residents/chat" : "/app/chat";
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadList = useCallback(async () => {
    if (!userId) return;
    const [nextThreads, nextPeople] = await Promise.all([loadChatThreads(userId), loadChatPeople()]);
    setThreads(nextThreads);
    setPeople(nextPeople);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadList().catch((e) => toast.error((e as Error).message)); }, [loadList]);
  useEffect(() => {
    if (!threadId || !userId) { setMessages([]); return; }
    let live = true;
    const load = async () => {
      const rows = await loadThreadMessages(threadId);
      if (!live) return;
      setMessages(rows);
      await markChatRead(threadId, userId);
      loadList();
    };
    load().catch((e) => toast.error((e as Error).message));
    const timer = window.setInterval(() => load().catch(() => undefined), 12000);
    return () => { live = false; window.clearInterval(timer); };
  }, [threadId, userId, loadList]);

  const selected = threads.find((thread) => thread.id === threadId) ?? null;
  const filteredPeople = useMemo(() => people.filter((person) => `${person.display_name} ${person.subtitle}`.toLowerCase().includes(search.toLowerCase())), [people, search]);

  const start = async (person: ChatPerson) => {
    try {
      const id = await openDirectChat(person.user_id);
      setPickerOpen(false);
      await loadList();
      navigate(`${base}/${id}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const send = async ({ text }: { text: string }) => {
    if (!threadId || !userId || !text.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(threadId, userId, text);
      setMessages(await loadThreadMessages(threadId));
      await markChatRead(threadId, userId);
      await loadList();
    } catch (e) { toast.error((e as Error).message); }
    setSending(false);
  };

  return (
    <AppShell eyebrow="Chat">
      <Seo title="Chat — Site 99" description="Private conversations with the Site 99 team and clients." path="/app/chat" noindex />
      <PageHeader eyebrow="Chat" title="Conversations." lede="One private thread for every person you work with." actions={
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New chat</Button></DialogTrigger>
          <DialogContent className="deck max-w-lg border-rule bg-paper text-ink">
            <DialogHeader><DialogTitle>Start a chat</DialogTitle></DialogHeader>
            <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" className="field w-full pl-10" /></label>
            <div className="max-h-80 divide-y divide-rule overflow-y-auto">
              {filteredPeople.map((person) => <button key={person.user_id} onClick={() => start(person)} className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-paper-sunken focus-ring"><span className="grid h-9 w-9 place-items-center rounded-full bg-acc-violet-soft text-xs font-bold text-acc-violet">{person.display_name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.display_name}</span><span className="block truncate text-xs text-ink-faint">{person.subtitle}</span></span><StatusChip value={person.person_kind} tone={person.person_kind === "client" ? "blue" : "neutral"} /></button>)}
              {!filteredPeople.length && <p className="py-8 text-center text-sm text-ink-soft">No people found.</p>}
            </div>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid min-h-[620px] overflow-hidden rounded-lg border border-rule bg-paper-raised lg:grid-cols-[320px_1fr]">
        <aside className={cn("border-rule lg:border-r", threadId && "hidden lg:block")}>
          <div className="border-b border-rule px-4 py-3 eyebrow text-ink-faint">People · {threads.length}</div>
          {loading ? <p className="p-4 text-sm text-ink-soft">Loading…</p> : threads.length === 0 ? <div className="p-8 text-center"><Users className="mx-auto h-6 w-6 text-ink-faint" /><p className="mt-2 text-sm text-ink-soft">No conversations yet.</p></div> : threads.map((thread) => (
            <button key={thread.id} onClick={() => navigate(`${base}/${thread.id}`)} className={cn("flex w-full gap-3 border-b border-rule px-4 py-4 text-left focus-ring", thread.id === threadId ? "bg-acc-violet-soft" : "hover:bg-paper-sunken")}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-sunken text-xs font-bold">{thread.person.display_name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{thread.person.display_name}</span>{thread.unread > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1 text-[10px] font-bold text-paper">{thread.unread}</span>}</span><span className="mt-1 block truncate text-xs text-ink-soft">{thread.lastMessage?.body ?? thread.person.subtitle}</span><span className="mt-1 block text-[10px] text-ink-faint">{thread.lastMessage ? ago(thread.lastMessage.created_at) : thread.person.person_kind}</span></span>
            </button>
          ))}
        </aside>

        <section className={cn("flex min-h-[620px] flex-col", !threadId && "hidden lg:flex")}>
          {selected && <div className="flex items-center gap-3 border-b border-rule px-4 py-3"><Button variant="ghost" size="sm" className="lg:hidden" onClick={() => navigate(base)}>Back</Button><div><div className="font-semibold">{selected.person.display_name}</div><div className="text-xs text-ink-faint">{selected.person.subtitle} · {selected.person.person_kind}</div></div></div>}
          {!selected ? <ConversationEmptyState icon={<MessageCircle className="h-8 w-8" />} title="Choose a conversation" description="Open a person from the list, or start a new chat." /> : <>
            <Conversation className="min-h-0 flex-1"><ConversationContent className="gap-4 p-5">{messages.length === 0 && <ConversationEmptyState title="No messages yet" description={`Say hello to ${selected.person.display_name}.`} />}{messages.map((message) => { const mine = message.sender_id === userId; return <Message key={message.id} from={mine ? "user" : "assistant"}><MessageContent className={mine ? "bg-signal text-paper" : ""}><p className="whitespace-pre-wrap">{message.body}</p></MessageContent><span className={cn("text-[10px] text-ink-faint", mine && "ml-auto")}>{new Date(message.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></Message>; })}</ConversationContent><ConversationScrollButton /></Conversation>
            <div className="border-t border-rule p-4"><PromptInput onSubmit={send} className="border-rule bg-paper"><PromptInputTextarea placeholder={`Message ${selected.person.display_name}…`} /><PromptInputFooter className="justify-end"><PromptInputSubmit status={sending ? "submitted" : undefined} disabled={sending} /></PromptInputFooter></PromptInput></div>
          </>}
        </section>
      </div>
    </AppShell>
  );
}
