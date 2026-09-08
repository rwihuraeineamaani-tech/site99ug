import { useCallback, useEffect, useState } from "react";
import { useMyRoles } from "@/hooks/useMyRoles";
import { useMyAssignments } from "@/hooks/useMyAssignments";
import {
  buildWaiting,
  loadInboxMessages,
  loadWaitingRaw,
  type InboxMessage,
  type WaitingJob,
} from "@/lib/inbox";

const FOUNDER_ROLES = ["admin", "founder", "managing_director", "creative_director"] as const;

/** Lets any corner of the app know something landed. */
const CHANGED = "site99:inbox-changed";
export const inboxChanged = () => window.dispatchEvent(new Event(CHANGED));

export type InboxState = {
  loading: boolean;
  messages: InboxMessage[];
  read: Set<string>;
  waiting: WaitingJob[];
  unread: number;
  reload: () => void;
  markLocalRead: (ids: string[]) => void;
};

/**
 * The signed-in person's inbox: stored messages plus the live "waiting on you" jobs.
 * Pass `messagesOnly` when you just need the unread badge.
 */
export function useInbox(messagesOnly = false): InboxState {
  const { userId, isStaff, has } = useMyRoles();
  const { isContact: amContact, isHandler: amHandler } = useMyAssignments();
  const isFounder = has(...FOUNDER_ROLES);

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [waiting, setWaiting] = useState<WaitingJob[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId || !isStaff) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const box = await loadInboxMessages(userId);
        if (cancelled) return;
        setMessages(box.messages);
        setRead(box.read);
        if (!messagesOnly) {
          const raw = await loadWaitingRaw(userId);
          if (cancelled) return;
          setWaiting(buildWaiting({ userId, ...raw, isFounder, amContact, amHandler }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isStaff, messagesOnly, isFounder, amContact, amHandler, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(CHANGED, onChange);
    return () => window.removeEventListener(CHANGED, onChange);
  }, [reload]);

  const markLocalRead = useCallback((ids: string[]) => {
    setRead((cur) => {
      const next = new Set(cur);
      ids.forEach((i) => next.add(i));
      return next;
    });
  }, []);

  const unread = messages.filter((m) => !read.has(m.id) && m.author !== userId).length;

  return { loading, messages, read, waiting, unread, reload, markLocalRead };
}
