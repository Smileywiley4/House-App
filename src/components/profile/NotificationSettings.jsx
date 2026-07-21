import { useEffect, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { api } from "@/api";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

/**
 * Opt-in weekly digest when new listings match saved presets / browse alerts.
 * Default OFF — stored on profiles.preset_digest_opt_in.
 */
export default function NotificationSettings({ user, onUpdated }) {
  const [optIn, setOptIn] = useState(Boolean(user?.preset_digest_opt_in));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOptIn(Boolean(user?.preset_digest_opt_in));
  }, [user?.preset_digest_opt_in, user?.id]);

  const save = async (next) => {
    setOptIn(next);
    setSaving(true);
    try {
      const updated = await api.auth.updateMe({ preset_digest_opt_in: next });
      onUpdated?.(updated);
      toast({
        title: next ? "Weekly digest on" : "Weekly digest off",
        description: next
          ? "We'll email and notify you in-app once a week when listings match your presets."
          : "You won't receive weekly preset digests.",
      });
    } catch (err) {
      setOptIn(!next);
      toast({
        title: "Couldn't update",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10b981]/10 text-[#059669]">
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Weekly summary when new listings match your saved presets or browse alerts. Off by
            default — turn on only if you want it.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mail size={14} className="text-[#059669] shrink-0" />
            Weekly preset digest
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            One email and in-app notice per week (not real-time). Example: &ldquo;3 new listings
            match your &lsquo;Move-in ready, 2+ beds&rsquo; preset this week.&rdquo;
          </p>
        </div>
        <Switch
          checked={optIn}
          disabled={saving || !user?.id}
          onCheckedChange={save}
          aria-label="Weekly preset digest"
          className="data-[state=checked]:bg-[#10b981]"
        />
      </div>
    </div>
  );
}
