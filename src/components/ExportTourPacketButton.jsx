import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/api";
import {
  downloadTourPacketPdf,
  enrichTourItemsWithLibrary,
} from "@/lib/tourPacketPdf";
import { toast } from "@/components/ui/use-toast";

/**
 * Export a print-friendly multi-page tour packet PDF for a set of properties.
 * @param {{
 *   items: Array<object>,
 *   title?: string,
 *   filename?: string,
 *   disabled?: boolean,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function ExportTourPacketButton({
  items,
  title = "Tour packet",
  filename,
  disabled = false,
  className = "",
  label = "Export tour packet",
}) {
  const [busy, setBusy] = useState(false);
  const count = Array.isArray(items) ? items.length : 0;
  const canExport = count >= 1 && !disabled && !busy;

  const onClick = async () => {
    if (!canExport) return;
    setBusy(true);
    try {
      const enriched = await enrichTourItemsWithLibrary(items, api.library || {});
      await downloadTourPacketPdf(enriched, { title, filename });
      toast({
        title: "Tour packet ready",
        description: `${enriched.length} propert${enriched.length === 1 ? "y" : "ies"} exported to PDF.`,
      });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e?.message || "Could not build the tour packet PDF.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (count < 1) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canExport}
      className={
        className ||
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold disabled:opacity-50"
      }
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      {busy ? "Building PDF…" : label}
    </button>
  );
}
