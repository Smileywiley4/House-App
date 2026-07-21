import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Star, BarChart3, ChevronRight, Home as HomeIcon, Info, Search } from "lucide-react";
import { DEMO_PROPERTY } from "@/core/demoProperty";
import AIPropertyInsights from "@/components/ai/AIPropertyInsights";
import PropertyLocationMap from "@/components/PropertyLocationMap";
import PropertyAddressSearchForm from "@/components/PropertyAddressSearchForm";
import { ForSaleBadge } from "@/components/ForSaleBadge";
import { AdSlot } from "@/components/AdSlot";
import { PremiumGate } from "@/components/PremiumGate";
import TrustBadges from "@/components/trust/TrustBadges";
import { PRODUCT_DISCLAIMER } from "@/core/companyConfig";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="relative bg-[#14192E] px-6 py-16 md:py-20 text-center">
        {/* Decorative layer only — keep overflow off the hero so address suggestions are not clipped */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-10"
          aria-hidden
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #106B49 0%, transparent 60%), radial-gradient(circle at 70% 20%, #106B49 0%, transparent 50%)" }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HomeIcon className="text-[#106B49]" size={28} />
            <span className="text-[#106B49] font-semibold tracking-widest text-sm uppercase">Propurty</span>
            <span className="text-[#E8A33D] text-xs">✦</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Find Your Dream Home.<br />
            <span className="text-[#106B49]">Score It Mathematically.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 md:mb-10">
            Search any property, rate what matters to you, and compare homes with a weighted score — not just a gut feeling.
          </p>
          <PropertyAddressSearchForm variant="hero" className="max-w-xl mx-auto" />
        </div>
      </div>

      <TrustBadges />

      <div className="max-w-5xl mx-auto px-6 py-4">
        <AdSlot format="leaderboard" className="min-h-[90px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#106B49] mb-2">Live preview</p>
            <h2 className="text-2xl font-bold text-[#14192E]">See how scoring works</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Example listing below — search a real address on the home page or with the header bar on any other page.
            </p>
          </div>
          <Link
            to={createPageUrl("About")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#106B49] hover:text-[#0C4F37] shrink-0"
          >
            Full methodology <ChevronRight size={16} />
          </Link>
        </div>
        <PropertyCard property={DEMO_PROPERTY} isDemo demoScore={DEMO_PROPERTY.demoScore} demoScoreLabel={DEMO_PROPERTY.demoScoreLabel} />
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-4">
        <AdSlot format="rectangle" className="min-h-[250px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-[#14192E] mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Search, title: "Search Any Property", desc: "Enter an address on the home page or use the sticky header search on every other page to pull up details and amenities." },
            { icon: Star, title: "Score What Matters", desc: "Set importance weights for 30+ categories — from roof quality to school ratings — then score the property." },
            { icon: BarChart3, title: "Compare Mathematically", desc: "Get a weighted score for each property and compare them side-by-side to make confident decisions." }
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
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
            to={createPageUrl("Compare")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#106B49] text-white font-semibold rounded-xl hover:bg-[#0C4F37] transition-colors"
          >
            Compare properties <ChevronRight size={16} />
          </Link>
          <Link
            to={createPageUrl("SavedProperties")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#14192E] text-white font-semibold rounded-xl hover:bg-[#2A3150] transition-colors"
          >
            View My Saved Properties <ChevronRight size={16} />
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

function PropertyCard({ property, isDemo = false, demoScore, demoScoreLabel }) {
  const fmt = (n) => n?.toLocaleString() ?? "—";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {isDemo && (
        <div className="bg-[#E8A33D]/10 border-b border-[#E8A33D]/20 px-5 py-2.5 text-center">
          <span className="text-xs font-semibold text-[#8a6d2b]">Example listing for demonstration — not a live MLS feed</span>
        </div>
      )}
      <PropertyLocationMap property={property} />

      <div className="p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-[#14192E]">{property.address}</h2>
              <ForSaleBadge onMarket={property.on_market} listingSource={property.listing_source} />
            </div>
            <p className="text-slate-500">{property.city}, {property.state} {property.zip}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#106B49]">${fmt(property.price)}</div>
            <div className="text-sm text-slate-400 flex items-center gap-1 justify-end">
              {isDemo ? "Example price" : "Est. List Price"} <span className="text-[#E8A33D] text-xs">✦</span>
            </div>
            {demoScore != null && (
              <div className="mt-2 inline-flex flex-col items-end">
                <span className="text-2xl font-bold text-[#14192E]">{demoScore}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">{demoScoreLabel || "Example score"}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Bedrooms", value: property.bedrooms },
            { label: "Bathrooms", value: property.bathrooms },
            { label: "Sq Ft", value: fmt(property.sqft) },
            { label: "Year Built", value: property.year_built },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#14192E]">{value}</div>
              <div className="text-xs text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <p className="text-slate-600 leading-relaxed mb-6 text-sm">{property.description}</p>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "🏥 Nearest Hospital", value: property.nearby_hospitals },
            { label: "🛣️ Highway Access", value: property.nearby_highways },
            { label: "🎓 Nearest School", value: property.nearby_schools },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#14192E]/3 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-1">{label}</div>
              <div className="text-sm font-medium text-[#14192E]">{value || "—"}</div>
            </div>
          ))}
        </div>

        {!isDemo && (
          <PremiumGate featureName="AI Property Insights">
            <AIPropertyInsights property={property} />
          </PremiumGate>
        )}

        <Link
          to={createPageUrl("Evaluate") + `?address=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}&state=${encodeURIComponent(property.state)}&price=${property.price}&beds=${property.bedrooms}&baths=${property.bathrooms}&sqft=${property.sqft}&year=${property.year_built}`}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#0C4F37] hover:bg-[#065f46] text-white font-semibold rounded-xl transition-colors text-base mt-4"
        >
          <Star size={18} />
          {isDemo ? "Try scoring this example" : "Score This Property"}
        </Link>
      </div>
    </div>
  );
}
