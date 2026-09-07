import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex items-center px-6 md:px-16 py-16">
      <Seo title="Reset password — Site 99" description="Set a new password." path="/reset-password" noindex />
      <div className="w-full max-w-sm">
        <div className="eyebrow text-signal mb-4">Reset password</div>
        <h1 className="display text-4xl leading-[0.9] mb-10">Set a new one.</h1>
        <form onSubmit={submit} className="space-y-8">
          <div>
            <label htmlFor="new-password" className="eyebrow text-ink-faint">
              New password
            </label>
            <input
              id="new-password"
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-3 w-full bg-transparent border-b border-rule-strong focus:border-signal outline-none py-3 text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper px-8 py-4 rounded-sm eyebrow hover:bg-signal transition-colors disabled:opacity-50 focus-ring"
          >
            {loading ? "…" : "Update password →"}
          </button>
        </form>
      </div>
    </div>
  );
}
