import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Simple rename dialog used for presets, projects, and visit folders.
 * Caller handles persistence via onSave(trimmedName).
 */
export default function RenameDialog({
  open,
  onOpenChange,
  title = "Rename",
  description,
  label = "Name",
  initialValue = "",
  confirmLabel = "Save",
  onSave,
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue(initialValue || "");
      setError("");
      setSaving(false);
    }
  }, [open, initialValue]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const next = (value || "").trim();
    if (!next) {
      setError("Name is required");
      return;
    }
    if (next === (initialValue || "").trim()) {
      onOpenChange?.(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave?.(next);
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message || "Could not rename");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-xs font-bold text-slate-600" htmlFor="rename-input">
              {label}
            </label>
            <input
              id="rename-input"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#106B49]/30 focus:border-[#106B49]"
              maxLength={200}
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !(value || "").trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : null}
              {confirmLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
