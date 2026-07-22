import { useEffect, useState } from "react";
import { Bell, Mail, Megaphone } from "lucide-react";
import { api } from "@/api";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

/**
 * Email preferences:
 * - marketing_opt_in: product/promotional emails (default ON at signup; US-style Terms consent)
 * - preset_digest_opt_in: weekly listing digest (default OFF)
 */
export default function NotificationSettings({ user, onUpdated }) {
  const [marketingOn, setMarketingOn] = useState(Boolean(user?.marketing_opt_in));
  const [digestOn, setDigestOn] = useState(Boolean(user?.preset_digest_opt_in));
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [savingDigest, setSavingDigest] = useState(false);

  useEffect(() => {
    setMarketingOn(Boolean(user?.marketing_opt_in));
  }, [user?.marketing_opt_in, user?.id]);

  useEffect(() => {
    setDigestOn(Boolean(user?.preset_digest_opt_in));
  }, [user?.preset_digest_opt_in, user?.id]);

  const saveMarketing = async (next) => {
    setMarketingOn(next);
    setSavingMarketing(true);
    try {
      const updated = await api.auth.updateMe({ marketing_opt_in: next });
      onUpdated?.(updated);
      toast({
        title: next ? "Marketing emails on" : "Marketing emails off",
        description: next
          ? "You may receive product updates and promotions."
          : "You won't receive marketing emails. Service and billing messages may still arrive.",
      });
    } catch (err) {
      setMarketingOn(!next);
      toast({
        title: "Couldn't update",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingMarketing(false);
    }
  };

  const saveDigest = async (next) => {
    setDigestOn(next);
    setSavingDigest(true);
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
      setDigestOn(!next);
      toast({
        title: "Couldn't update",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingDigest(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#106B49]/10 text-[#0C4F37]">
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">Email preferences</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Control marketing and digest emails. Account, security, and billing messages are not controlled here.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone size={14} className="text-[#0C4F37] shrink-0" />
            Marketing emails
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Product updates, new features, and promotions. On by default when you create an account; turn off anytime
            (or delete your account).
          </p>
        </div>
        <Switch
          checked={marketingOn}
          disabled={savingMarketing || !user?.id}
          onCheckedChange={saveMarketing}
          aria-label="Marketing emails"
          className="data-[state=checked]:bg-[#106B49]"
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mail size={14} className="text-[#0C4F37] shrink-0" />
            Weekly preset digest
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            One email and in-app notice per week (not real-time). Example: &ldquo;3 new listings
            match your &lsquo;Move-in ready, 2+ beds&rsquo; preset this week.&rdquo; Off by default.
          </p>
        </div>
        <Switch
          checked={digestOn}
          disabled={savingDigest || !user?.id}
          onCheckedChange={saveDigest}
          aria-label="Weekly preset digest"
          className="data-[state=checked]:bg-[#106B49]"
        />
      </div>
    </div>
  );
}
