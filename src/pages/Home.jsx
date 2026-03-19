import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, MapPin, Star, BarChart3, ChevronRight, Home as HomeIcon, LogIn } from "lucide-react";
import { getPropertyByAddress } from "@/core/propertyService";
import AIPropertyInsights from "@/components/ai/AIPropertyInsights";
import { ForSaleBadge } from "@/components/ForSaleBadge";
import { AdSlot } from "@/components/AdSlot";
import { PremiumGate } from "@/components/PremiumGate";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPropertyByAddress(address);
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not load property. Try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Hero */}
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-20 text-center">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #10b981 0%, transparent 60%), radial-gradient(circle at 70% 20%, #10b981 0%, transparent 50%)" }} />
        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HomeIcon className="text-[#10b981]" size={28} />
            <span className="text-[#10b981] font-semibold tracking-widest text-sm uppercase">HomeScore</span>
            <span className="text-[#c9a84c] text-xs">✦</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Find Your Dream Home.<br />
            <span className="text-[#10b981]">Score It Mathematically.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10">
            Search any property, rate what matters to you, and compare homes with a weighted score — not just a gut feeling.
          </p>
          <form onSubmit={handleSearch} className="flex gap-3 max-w-xl mx-auto">
            <div className="flex-1 relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter a property address..."
                className="w-full pl-11 pr-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-[#c9a84c] focus:bg-white/15 transition-all text-base"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>
      </div>

      {/* Ad: free users only */}
      <div className="max-w-5xl mx-auto px-6 py-4">
        <AdSlot format="leaderboard" className="min-h-[90px]" />
      </div>

      {/* Result */}
      {error && (
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-center text-red-600 text-sm bg-red-50 rounded-xl py-3 px-4">{error}</p>
        </div>
      )}
      {result && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <PropertyCard property={result} />
        </div>
      )}

      {/* Feature Highlights */}
      {!result && (
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-center text-3xl font-bold text-[#1a2234] mb-14">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: Search, title: "Search Any Property", desc: "Enter any address to instantly pull up property details, location data, and proximity to key amenities." },
              { icon: Star, title: "Score What Matters", desc: "Set importance weights for 30+ categories — from roof quality to school ratings — then score the property." },
              { icon: BarChart3, title: "Compare Mathematically", desc: "Get a weighted score for each property and compare them side-by-side to make confident decisions." }
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-xl bg-[#10b981]/10 flex items-center justify-center mb-6">
                  <Icon className="text-[#10b981]" size={26} />
                </div>
                <h3 className="font-bold text-[#1a2234] text-xl mb-3">{title}</h3>
                <p className="text-slate-500 leading-relaxed text-base">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <AuthAwareLink />
          </div>
        </div>
      )}
    </div>
  );
}

function AuthAwareLink() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return (
      <Link
        to={createPageUrl("Compare")}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a2234] text-white font-semibold rounded-xl hover:bg-[#243050] transition-colors"
      >
        View My Saved Properties <ChevronRight size={16} />
      </Link>
    );
  }
  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-2 px-6 py-3 bg-[#10b981] text-white font-semibold rounded-xl hover:bg-[#059669] transition-colors"
    >
      <LogIn size={16} />
      Sign In to Save & Compare Properties
    </Link>
  );
}

function PropertyCard({ property }) {
  const { isAuthenticated } = useAuth();
  const fmt = (n) => n?.toLocaleString() ?? "—";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Map placeholder */}
      <div className="relative h-56 bg-slate-100 overflow-hidden">
        <iframe
          title="map"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(property.address + " " + property.city + " " + property.state)}&output=embed&z=15`}
          allowFullScreen
        />
      </div>

      <div className="p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-[#1a2234]">{property.address}</h2>
              <ForSaleBadge onMarket={property.on_market} listingSource={property.listing_source} />
            </div>
            <p className="text-slate-500">{property.city}, {property.state} {property.zip}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#10b981]">${fmt(property.price)}</div>
            <div className="text-sm text-slate-400 flex items-center gap-1 justify-end">Est. List Price <span className="text-[#c9a84c] text-xs">✦</span></div>
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
              <div className="text-2xl font-bold text-[#1a2234]">{value}</div>
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
            <div key={label} className="bg-[#1a2234]/3 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-1">{label}</div>
              <div className="text-sm font-medium text-[#1a2234]">{value || "—"}</div>
            </div>
          ))}
        </div>

        <PremiumGate featureName="AI Property Insights">
          <AIPropertyInsights property={property} />
        </PremiumGate>

        {isAuthenticated ? (
          <Link
            to={createPageUrl("Evaluate") + `?address=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}&state=${encodeURIComponent(property.state)}&price=${property.price}&beds=${property.bedrooms}&baths=${property.bathrooms}&sqft=${property.sqft}&year=${property.year_built}`}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-base mt-4"
          >
            <Star size={18} />
            Score This Property
          </Link>
        ) : (
          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-base mt-4"
          >
            <LogIn size={18} />
            Sign In to Score & Save
          </Link>
        )}
      </div>
    </div>
  );
}