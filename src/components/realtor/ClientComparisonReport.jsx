import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, Mail, Share2, X } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { APP_NAME } from "@/core/constants";
import { canUseWebShare, mailtoShareHref } from "@/lib/propertyShare";

function formatPrice(price) {
  if (price == null || price === "") return "—";
  const n = Number(price);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString()}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function scoreColor(score) {
  if (score == null) return "#94a3b8";
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#c9a84c";
  return "#ef4444";
}

function buildReportUrl(contactUserId) {
  const path = createPageUrl("RealtorPortal");
  const qs = new URLSearchParams({ client: contactUserId, report: "1" });
  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return `${origin}${path}?${qs.toString()}`;
}

function buildCsv(rows) {
  const header = ["Address", "Price", "Score", "Date scored"];
  const lines = [header.join(",")];
  for (const row of rows) {
    const cells = [
      `"${String(row.address || "").replace(/"/g, '""')}"`,
      row.price != null ? String(row.price) : "",
      row.score != null ? String(row.score) : "",
      row.date_scored ? new Date(row.date_scored).toISOString().slice(0, 10) : "",
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

/**
 * Realtor-only comparison of every property a contact scored via shared scorecards.
 */
export default function ClientComparisonReport({ contactUserId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!contactUserId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.shares.clientReport(contactUserId);
      setReport(data);
    } catch (e) {
      setReport(null);
      setError(e?.message || "Could not load comparison report");
    } finally {
      setLoading(false);
    }
  }, [contactUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const clientName = useMemo(() => {
    const c = report?.client;
    if (!c) return "Client";
    return c.full_name || c.email || c.username || "Client";
  }, [report]);

  const reportUrl = useMemo(
    () => (contactUserId ? buildReportUrl(contactUserId) : ""),
    [contactUserId],
  );

  const copyLink = async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the link and copy manually.");
    }
  };

  const downloadCsv = () => {
    const rows = report?.properties || [];
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `client-comparison-${(clientName || "client").replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareNative = async () => {
    if (!canUseWebShare() || !reportUrl) return;
    try {
      await navigator.share({
        title: `${clientName} — comparison report`,
        text: `${clientName}'s scored homes on ${APP_NAME}`,
        url: reportUrl,
      });
    } catch {
      /* user cancelled */
    }
  };

  const mailtoHref = mailtoShareHref({
    subject: `${clientName} — home comparison report (${APP_NAME})`,
    body: `${clientName}'s scored homes:\n${reportUrl}\n\n(Requires your Realtor Portal login.)`,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-[#1a2234] px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Client comparison report</h2>
            <p className="text-slate-400 text-sm mt-0.5">{clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
          >
            {copied ? <Check size={13} className="text-[#10b981]" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!report?.properties?.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40"
          >
            <Download size={13} /> Export CSV
          </button>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
          >
            <Mail size={13} /> Email
          </a>
          {canUseWebShare() && (
            <button
              type="button"
              onClick={shareNative}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
            >
              <Share2 size={13} /> Share
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-[#10b981]" size={28} />
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 text-center py-10">{error}</p>
          ) : !report?.properties?.length ? (
            <p className="text-sm text-slate-500 text-center py-10">
              No scored homes yet. Share a property for scoring — when they return scores, they appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="pb-3 pr-3 font-semibold">Address</th>
                    <th className="pb-3 pr-3 font-semibold whitespace-nowrap">Price</th>
                    <th className="pb-3 pr-3 font-semibold whitespace-nowrap">Score</th>
                    <th className="pb-3 font-semibold whitespace-nowrap">Date scored</th>
                  </tr>
                </thead>
                <tbody>
                  {report.properties.map((row) => (
                    <tr key={row.share_id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 pr-3 font-medium text-[#1a2234]">{row.address}</td>
                      <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">
                        {formatPrice(row.price)}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <span
                          className="font-bold tabular-nums"
                          style={{ color: scoreColor(row.score) }}
                        >
                          {row.score != null ? `${row.score}` : "—"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(row.date_scored)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-4">
                {report.count} propert{report.count === 1 ? "y" : "ies"} · Sorted by score ·
                Realtor-only link
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
