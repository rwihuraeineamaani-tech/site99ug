import { useEffect, useState } from "react";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadChatThreads } from "@/lib/chat";

export function useChatUnread() {
  const { userId } = useMyRoles();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadChatThreads(userId).then((rows) => live && setUnread(rows.reduce((sum, row) => sum + row.unread, 0))).catch(() => undefined);
    const timer = window.setInterval(() => {
      loadChatThreads(userId).then((rows) => live && setUnread(rows.reduce((sum, row) => sum + row.unread, 0))).catch(() => undefined);
    }, 30000);
    return () => { live = false; window.clearInterval(timer); };
  }, [userId]);
  return unread;
}
