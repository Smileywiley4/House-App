import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Bath,
  BarChart3,
  BedDouble,
  CalendarDays,
  ChevronRight,
  Info,
  Map as MapIcon,
  Ruler,
  Search,
  Star,
} from "lucide-react";
import { DEMO_PROPERTY } from "@/core/demoProperty";
import PropertyLocationMap from "@/components/PropertyLocationMap";
import BrowseDemoMap from "@/components/browse/BrowseDemoMap";
import PropertyAddressSearchForm from "@/components/PropertyAddressSearchForm";
import { ForSaleBadge } from "@/components/ForSaleBadge";
import { AdSlot } from "@/components/AdSlot";
import TrustBadges from "@/components/trust/TrustBadges";
import { PRODUCT_DISCLAIMER } from "@/core/companyConfig";
import { brand } from "@/design-tokens";

function evaluateDemoHref(property) {
  const params = new URLSearchParams({
    address: property.address,
    city: property.city,
    state: property.state,
    price: String(property.price),
    beds: String(property.bedrooms),
    baths: String(property.bathrooms),
    sqft: String(property.sqft),
    year: String(property.year_built),
  });
  return `${createPageUrl("Evaluate")}?${params.toString()}`;
}

function formatCompactPrice(n) {
  if (n == null) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${Math.round(num).toLocaleString()}`;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="relative bg-[#14192E] px-6 py-16 md:py-20 text-center">
        {/* Decorative layer only — keep overflow off the hero so address suggestions are not clipped */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-10"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, #106B49 0%, transparent 60%), radial-gradient(circle at 70% 20%, #106B49 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-6">
            <img
              src="/logo/propurty-logotype-horizontal-dark.svg"
              alt="Propurty"
              className="h-10 md:h-12 w-auto"
              width={280}
              height={64}
            />
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Find your dream home.
            <br />
            <span className="text-[#106B49]">Score it mathematically.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 md:mb-10">
            Browse the map, score what matters to you, and compare homes with a weighted score — not just a gut feeling.
          </p>
          <PropertyAddressSearchForm variant="hero" className="max-w-xl mx-auto" />
        </div>
      </div>

      {/* Above-the-fold for guests after sign-out — labeled AdSense/placeholder; paid plans: null via showAds */}
      <div className="max-w-5xl mx-auto w-full px-6 py-3 bg-[#F8F7F4]">
        <AdSlot format="leaderboard" className="min-h-[90px]" />
      </div>

      <TrustBadges />

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#106B49] mb-2">Live preview</p>
            <h2 className="font-heading text-2xl font-bold text-[#14192E]">See how scoring works</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Same Evaluate layout you get after searching an address — property score out of 100, importance vs. property
              sliders, then save and compare.
            </p>
          </div>
          <Link
            to={createPageUrl("About")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#106B49] hover:text-[#0C4F37] shrink-0"
          >
            Full methodology <ChevronRight size={16} />
          </Link>
        </div>

        <EvaluateDemoPreview property={DEMO_PROPERTY} />

        <BrowseDemoPreview property={DEMO_PROPERTY} />
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-4">
        <AdSlot format="rectangle" className="min-h-[250px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center font-heading text-2xl font-bold text-[#14192E] mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: MapIcon,
              title: "Browse the map",
              desc: "Open Search to explore listings on a map and list view, or jump straight in with an address on this page.",
            },
            {
              icon: Star,
              title: "Score what matters",
              desc: "Set importance weights and rate 30+ categories — schools, roof quality, commute, and more — then get a score out of 100.",
            },
            {
              icon: BarChart3,
              title: "Compare side by side",
              desc: "Save scores and compare homes mathematically so you tour the ones that actually fit.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-[#106B49]/10 flex items-center justify-center mb-5">
                <Icon className="text-[#106B49]" size={22} />
              </div>
              <h3 className="font-bold text-[#14192E] text-lg mb-2">{title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={createPageUrl("BrowseProperties")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#106B49] text-white font-semibold rounded-xl hover:bg-[#0C4F37] transition-colors"
          >
            <Search size={16} /> Open Search <ChevronRight size={16} />
          </Link>
          <Link
            to={createPageUrl("Compare")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#14192E] text-white font-semibold rounded-xl hover:bg-[#2A3150] transition-colors"
          >
            Compare properties <ChevronRight size={16} />
          </Link>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed flex items-start justify-center gap-2">
          <Info size={14} className="shrink-0 mt-0.5" aria-hidden />
          {PRODUCT_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

/** Static dual-slider row matching Evaluate CategorySlider visuals (non-interactive). */
function DemoCategoryCard({ category }) {
  const importancePct = category.importance * 10;
  const scorePct = category.score * 10;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="font-semibold text-[#14192E] text-sm">{category.label}</h3>
        {category.scoreSource === "auto" && (
          <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md">
            auto-filled
          </span>
        )}
        {category.scoreSource === "manual" && (
          <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
            rated
          </span>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-600 font-medium">Importance to You</span>
            <span className="font-bold text-[#0C4F37]">{category.importance}/10</span>
          </div>
          <div
            className="h-2 rounded-full"
            style={{
              background: `linear-gradient(to right, #0C4F37 ${importancePct}%, #e2e8f0 ${importancePct}%)`,
            }}
            aria-hidden
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>Not Important</span>
            <span>Very Important</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-600 font-medium">Property Score</span>
            <span className="font-bold text-[#14192E]">{category.score}/10</span>
          </div>
          <div
            className="h-2 rounded-full"
            style={{
              background: `linear-gradient(to right, #14192E ${scorePct}%, #e2e8f0 ${scorePct}%)`,
            }}
            aria-hidden
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Evaluate-shaped demo: navy header, score summary bar, map, facts, category cards. */
function EvaluateDemoPreview({ property }) {
  const fmt = (n) => n?.toLocaleString() ?? "—";
  const percentage = property.demoScore ?? 0;
  const scoreBarColor =
    percentage >= 70 ? brand.success : percentage >= 40 ? brand.gold : brand.danger;
  const summaryFacts = [
    property.bedrooms != null ? `${property.bedrooms} bd` : null,
    property.bathrooms != null ? `${property.bathrooms} ba` : null,
    property.sqft != null ? `${fmt(property.sqft)} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const facts = [
    { label: "Bedrooms", value: property.bedrooms, icon: BedDouble },
    { label: "Bathrooms", value: property.bathrooms, icon: Bath },
    { label: "Living area", value: property.sqft != null ? `${fmt(property.sqft)} sq ft` : null, icon: Ruler },
    { label: "Year built", value: property.year_built, icon: CalendarDays },
  ].filter((f) => f.value != null);

  return (
    <div className="rounded-2xl shadow-sm border border-slate-100 overflow-hidden bg-[#F8F7F4]">
      <div className="bg-[#E8A33D]/10 border-b border-[#E8A33D]/20 px-5 py-2.5 text-center">
        <span className="text-xs font-semibold text-[#8a6d2b]">
          Example Evaluate screen — not a live MLS feed
        </span>
      </div>

      {/* Evaluate header */}
      <div className="relative overflow-hidden bg-[#14192E] px-6 py-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-2xl font-bold text-white">{property.address}</h3>
              <ForSaleBadge onMarket={property.on_market} listingSource={property.listing_source} />
            </div>
            <p className="text-slate-400">
              {property.city}, {property.state}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#E8A33D]">${fmt(property.price)}</div>
            {summaryFacts && <div className="text-xs text-slate-400">{summaryFacts}</div>}
          </div>
        </div>
      </div>

      {/* Score summary — matches Evaluate */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#14192E]">
                {percentage}
                <span className="text-xl text-slate-600"> / 100</span>
              </div>
              <div className="text-xs text-slate-600 mt-1">{property.demoScoreLabel || "Property Score"}</div>
            </div>
            <div className="hidden sm:block h-12 w-px bg-slate-100" />
            <div className="text-sm text-slate-500">
              <span className="font-semibold text-[#14192E]">{property.demoRatedCount}</span>
              {" of "}
              <span className="font-semibold text-[#14192E]">{property.demoVisibleCount}</span> rated
            </div>
            <div className="flex-1 min-w-[8rem] max-w-xs">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, background: scoreBarColor }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pt-6">
        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
          <PropertyLocationMap property={property} className="h-52 md:h-64" />
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          {facts.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3">
              <Icon size={16} className="mb-2 text-[#106B49]" aria-hidden />
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        <div>
          <h4 className="text-lg font-bold text-[#14192E]">Scoring categories</h4>
          <p className="mt-0.5 text-sm text-slate-500">
            {property.demoRatedCount} of {property.demoVisibleCount} categories rated.
          </p>
        </div>
        {(property.demoCategories || []).map((cat) => (
          <DemoCategoryCard key={cat.id} category={cat} />
        ))}
        <p className="text-sm text-slate-500">{property.description}</p>
        <Link
          to={evaluateDemoHref(property)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#0C4F37] hover:bg-[#065f46] text-white font-semibold rounded-xl transition-colors text-base"
        >
          <Star size={18} />
          Try scoring this example
        </Link>
      </div>
    </div>
  );
}

/** Browse-shaped demo: map + list rows with brand price pills. */
function BrowseDemoPreview({ property }) {
  const neighbors = property.demoBrowseNeighbors || [];
  const listings = [property, ...neighbors];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#106B49] mb-2">Also on Search</p>
          <h3 className="font-heading text-xl font-bold text-[#14192E]">Browse map &amp; list</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            Search shows homes as map pins and list cards — tap Score this home to open Evaluate.
          </p>
        </div>
        <Link
          to={createPageUrl("BrowseProperties")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#106B49] hover:text-[#0C4F37] shrink-0"
        >
          Open Search <ChevronRight size={16} />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="bg-[#E8A33D]/10 border-b border-[#E8A33D]/20 px-5 py-2.5 text-center">
          <span className="text-xs font-semibold text-[#8a6d2b]">
            Example Search layout — sample pins, not live inventory
          </span>
        </div>

        <div className="grid lg:grid-cols-2">
          {/* Live Leaflet + Positron mock — same tiles/pins as BrowseProperties */}
          <div className="relative min-h-[220px] border-b lg:border-b-0 lg:border-r border-slate-100 overflow-hidden">
            <BrowseDemoMap listings={listings} className="h-full min-h-[220px] w-full" />
            <p className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-[#0C4F37]/90 shadow-sm">
              Brand-green pins · same map style as Search
            </p>
          </div>

          <ul className="divide-y divide-slate-100">
            {listings.map((p, index) => (
              <li key={p.address} className={`p-4 ${index === 0 ? "bg-[#E4F2EC]/60" : "hover:bg-slate-50"}`}>
                <div className="flex gap-3">
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-semibold">
                    {index === 0 ? (
                      <span className="text-[#106B49] px-2 text-center leading-snug">Example home</span>
                    ) : (
                      "No photo"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold text-[#14192E]">{formatCompactPrice(p.price)}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {[
                        p.bedrooms != null ? `${p.bedrooms} bds` : null,
                        p.bathrooms != null ? `${p.bathrooms} ba` : null,
                        p.sqft != null ? `${Number(p.sqft).toLocaleString()} sqft` : null,
                        p.property_type,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 truncate">
                      {[p.address, p.city, p.state].filter(Boolean).join(", ")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        to={evaluateDemoHref(p)}
                        className="inline-flex items-center px-3 py-1.5 min-h-9 rounded-lg bg-[#0C4F37] hover:bg-[#065f46] text-white text-xs font-bold"
                      >
                        Score this home
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
