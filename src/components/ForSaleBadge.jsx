import { Tag } from "lucide-react";

/**
 * Badge for properties that are publicly listed for sale.
 * Use when property.on_market === true; optionally show listing_source.
 */
export function ForSaleBadge({ onMarket, listingSource, className = "" }) {
  if (!onMarket) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#106B49]/15 text-[#0C4F37] border border-[#106B49]/30 ${className}`}
      title={listingSource ? `Listed via ${listingSource}` : "Listed for sale"}
    >
      <Tag size={12} />
      For Sale
      {listingSource && <span className="opacity-80">· {listingSource}</span>}
    </span>
  );
}

/**
 * Muted badge for off-market (not currently for sale).
 */
export function OffMarketBadge({ show = false, className = "" }) {
  if (!show) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 ${className}`}>
      Off market
    </span>
  );
}
