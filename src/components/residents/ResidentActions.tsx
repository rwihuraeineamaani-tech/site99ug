import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Printer, Target, Trash2, TrendingUp, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyRoles } from "@/hooks/useMyRoles";
import type { ResidentRecord } from "@/pages/app/Residents";

type Member = { user_id: string; display_name: string | null; email: string };

export default function ResidentActions({
  resident,
  members,
  canInvoices,
  hasSigned,
  onChanged,
}: {
  resident: ResidentRecord;
  members: Member[];
  canInvoices: boolean;
  hasSigned: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { isLeadership, canSeeFinance, has } = useMyRoles();
  const canArchive = isLeadership || has("admin");
  const canDelete = has("founder", "admin");
  const canHandler = isLeadership || canSeeFinance;
  const [dialog, setDialog] = useState<"handler" | "delete" | null>(null);
  const [handler, setHandler] = useState(resident.handler_user_id ?? "");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const archived = !!resident.archived_at;
  const blocked = canInvoices || hasSigned;

  const archive = async () => {
    const { error } = await supabase.rpc("archive_resident", { _id: resident.id, _archive: !archived });
    if (error) return toast.error(error.message);
    toast.success(archived ? "Client is back on the active list." : "Client archived. Their history is kept.");
    onChanged();
  };

  const saveHandler = async () => {
    if (!handler) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_client_handler", { _resident_id: resident.id, _user_id: handler });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Handler updated.");
    setDialog(null);
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_resident", { _id: resident.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${resident.name} deleted.`);
    navigate("/app/residents", { replace: true });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <MoreHorizontal className="h-4 w-4" /> actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{resident.name}</DropdownMenuLabel>
          {canHandler && (
            <DropdownMenuItem onClick={() => setDialog("handler")}>
              <UserRound className="h-4 w-4 mr-2" /> change handler
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => navigate(`/app/residents/${resident.id}/strategy`)}>
            <Target className="h-4 w-4 mr-2" /> strategy & goals
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/app/sales?resident=${resident.id}`)}>
            <TrendingUp className="h-4 w-4 mr-2" /> open in sales
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> print summary
          </DropdownMenuItem>
          {(canArchive || canDelete) && <DropdownMenuSeparator />}
          {canArchive && (
            <DropdownMenuItem onClick={archive}>
              {archived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              {archived ? "restore client" : "archive client"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem className="text-signal focus:text-signal" onClick={() => { setTyped(""); setDialog("delete"); }}>
              <Trash2 className="h-4 w-4 mr-2" /> delete client
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "handler"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change handler</DialogTitle>
            <DialogDescription>Each client has exactly one handler. Their KPI pay follows this choice.</DialogDescription>
          </DialogHeader>
          <select className="field text-sm" value={handler} onChange={(e) => setHandler(e.target.value)}>
            <option value="">Pick a person</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>
            ))}
          </select>
          <DialogFooter>
            <Button onClick={saveHandler} disabled={!handler || busy}>{busy ? "Saving…" : "save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {resident.name}?</DialogTitle>
            <DialogDescription>
              {blocked
                ? "This client has invoices or a signed contract, so deleting would lose money history. Archive them instead."
                : "This removes the client and everything linked to them. It cannot be undone. Type their name to confirm."}
            </DialogDescription>
          </DialogHeader>
          {blocked ? (
            <DialogFooter>
              {canArchive && !archived && (
                <Button onClick={() => { setDialog(null); archive(); }}>archive instead</Button>
              )}
            </DialogFooter>
          ) : (
            <>
              <input className="field text-sm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={resident.name} />
              <DialogFooter>
                <Button variant="destructive" disabled={typed.trim() !== resident.name || busy} onClick={remove}>
                  {busy ? "Deleting…" : "delete for good"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
