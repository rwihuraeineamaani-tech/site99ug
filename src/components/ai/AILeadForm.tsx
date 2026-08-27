import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const field =
  "w-full rounded-none border border-white/15 bg-black px-4 py-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white transition-colors";

export const AILeadForm = ({ idPrefix = "ai" }: { idPrefix?: string }) => {
  const [form, setForm] = useState({ name: "", company: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.from("ai_leads").insert({ ...form });
      if (error) throw error;
      supabase.functions.invoke("send-ai-lead-notification", { body: { ...form } }).catch(() => {});
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Could not send. Email us at info@site99ug.com");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-none border border-white/25 bg-black p-8">
        <span className="tech text-[11px] uppercase tracking-[0.24em] text-white/50">Received</span>
        <p className="mt-3 text-xl font-semibold">We'll be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-none border border-white/15 bg-black p-6 md:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-name`} className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">
            Name
          </label>
          <input id={`${idPrefix}-name`} required value={form.name} onChange={update("name")} className={`mt-2 ${field}`} placeholder="Your name" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-company`} className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">
            Company
          </label>
          <input id={`${idPrefix}-company`} value={form.company} onChange={update("company")} className={`mt-2 ${field}`} placeholder="Business name" />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-email`} className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">
          Email
        </label>
        <input id={`${idPrefix}-email`} type="email" required value={form.email} onChange={update("email")} className={`mt-2 ${field}`} placeholder="you@company.com" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-message`} className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">
          What would you like to automate?
        </label>
        <textarea id={`${idPrefix}-message`} rows={4} value={form.message} onChange={update("message")} className={`mt-2 ${field} resize-none`} placeholder="Short description" />
      </div>
      <button
        type="submit"
        disabled={sending}
        className="mt-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Request a Demo"}
      </button>
    </form>
  );
};
