import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Bookmark, ChevronLeft, Plus, Save, BarChart3, LogIn, Columns, X, Send } from "lucide-react";
import { api } from "@/api";
import CategorySlider from "@/components/evaluate/CategorySlider.jsx";
import CategoryPicker, { MANDATORY_CATEGORIES } from "@/components/evaluate/CategoryPicker.jsx";
import AIAutoScore from "@/components/ai/AIAutoScore.jsx";
import ExplainScore from "@/components/ai/ExplainScore.jsx";
import GamifiedWalkthrough from "@/components/ai/GamifiedWalkthrough.jsx";
import GoogleAutoScore from "@/components/evaluate/GoogleAutoScore.jsx";
import PropertyLocationMap from "@/components/PropertyLocationMap";
import PropertyOverview from "@/components/property/PropertyOverview";
import { PremiumFeatureGroup } from "@/components/PremiumGate";
import { NEIGHBORHOOD_CATEGORIES } from "@/components/evaluate/categories";
import PresetPicker from "@/components/presets/PresetPicker";
import SendForScoringModal from "@/components/shares/SendForScoringModal";
import SharePropertyButton from "@/components/SharePropertyButton";
import { useAuth } from "@/lib/AuthContext";
import { usePlan } from "@/core/hooks/usePlan";
import { readCurrentProperty } from "@/core/currentProperty";
import { storeBrowseCompareSelection } from "@/lib/browseCompare";
import { PROPERTY_SCORE_DISCLAIMER } from "@/core/companyConfig";

export default function Evaluate() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { isRealtor } = usePlan();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [sendOpen, setSendOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnStatus, setReturnStatus] = useState("");

  const readParam = (key) => {
    const v = params.get(key);
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s || s === "null" || s === "undefined") return null;
    return s;
  };

  const shareId = readParam("shareId");
  const routeAddress = readParam("address") || "Unknown Address";
  const enrichedProperty = readCurrentProperty(routeAddress) || {};
  const property = {
    ...enrichedProperty,
    address: enrichedProperty.address || routeAddress,
    city: enrichedProperty.city || readParam("city") || "",
    state: enrichedProperty.state || readParam("state") || "",
    price: enrichedProperty.price ?? readParam("price"),
    beds: enrichedProperty.bedrooms ?? readParam("beds"),
    baths: enrichedProperty.bathrooms ?? readParam("baths"),
    sqft: enrichedProperty.sqft ?? readParam("sqft"),
    year: enrichedProperty.year_built ?? readParam("year"),
    lat: enrichedProperty.lat ?? (readParam("lat") ? Number(readParam("lat")) : null),
    lng: enrichedProperty.lng ?? (readParam("lng") ? Number(readParam("lng")) : null),
  };
  const summaryFacts = [
    property.beds != null ? `${property.beds}bd` : null,
    property.baths != null ? `${property.baths}ba` : null,
    property.sqft != null ? `${Number(property.sqft).toLocaleString()} sqft` : null,
    property.year != null ? `Built ${property.year}` : null,
  ].filter(Boolean).join(" · ");
  const propertyFactCategories = [
    property.beds != null ? { id: "bedroom_count", label: "Bedroom Count" } : null,
    property.baths != null ? { id: "bathroom_count", label: "Bathroom Count" } : null,
    property.sqft != null ? { id: "overall_living_space", label: "Overall Living Space" } : null,
    property.annual_taxes != null && property.tax_assessment != null
      ? { id: "property_tax_cost", label: "Property Tax Cost" }
      : null,
    property.hoa_fee != null ? { id: "hoa_cost", label: "HOA Cost" } : null,
    property.features?.garage != null ? { id: "garage_storage", label: "Garage / Storage" } : null,
    property.features?.fireplace != null ? { id: "fireplace", label: "Fireplace" } : null,
  ].filter(Boolean);
  const saleCount = property.sale_history?.length || 0;
  const propertyEvidence = {
    bedroom_count: property.beds != null ? `${property.beds} recorded bedroom${Number(property.beds) === 1 ? "" : "s"}` : null,
    bathroom_count: property.baths != null ? `${property.baths} recorded bathroom${Number(property.baths) === 1 ? "" : "s"}` : null,
    overall_living_space: property.sqft != null ? `${Number(property.sqft).toLocaleString()} sq ft total living area` : null,
    property_tax_cost: property.annual_taxes != null
      ? `$${Number(property.annual_taxes).toLocaleString()} annual taxes${property.tax_assessment != null ? ` on a $${Number(property.tax_assessment).toLocaleString()} assessment` : ""}`
      : null,
    hoa_cost: property.hoa_fee != null ? `$${Number(property.hoa_fee).toLocaleString()} recorded monthly HOA fee` : null,
    garage_storage: property.features?.garage != null
      ? property.features.garage
        ? `Garage recorded${property.features.garageSpaces ? ` · ${property.features.garageSpaces} spaces` : ""}`
        : "No garage recorded"
      : null,
    parking: property.features?.garage ? `Garage recorded${property.features.garageSpaces ? ` · ${property.features.garageSpaces} spaces` : ""}` : null,
    fireplace: property.features?.fireplace != null ? (property.features.fireplace ? "Fireplace recorded" : "No fireplace recorded") : null,
    hvac: property.features?.heatingType || property.features?.coolingType
      ? [property.features.heatingType, property.features.coolingType].filter(Boolean).join(" · ")
      : null,
    roof_quality: property.features?.roofType ? `${property.features.roofType} roof recorded; condition requires inspection` : null,
    home_construction_stability: property.year != null ? `Built ${property.year}; age alone does not establish condition` : null,
    outdoor_entertainment: property.features?.pool ? "Pool recorded in property data" : null,
    location_investment: saleCount >= 2 ? `${saleCount} recorded sales available for trend scoring` : null,
    longterm_neighborhood_value: saleCount >= 2 ? `${saleCount} recorded sales available as one value signal` : null,
  };

  const withUnratedDefaults = (c) => ({
    ...c,
    importance: c.importance ?? 5,
    score: c.score ?? 5,
    importanceRated: Boolean(c.importanceRated),
    scoreRated: Boolean(c.scoreRated),
    scoreSource: c.scoreSource ?? null,
  });

  const [activeCategories, setActiveCategories] = useState(() => {
    const mandatory = MANDATORY_CATEGORIES.map(c => withUnratedDefaults(c));
    const neighborhood = NEIGHBORHOOD_CATEGORIES.map(c => withUnratedDefaults(c));
    const propertyFacts = propertyFactCategories.map(c => withUnratedDefaults(c));
    return [...mandatory, ...neighborhood, ...propertyFacts];
  });
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetStatus, setPresetStatus] = useState("");
  const [presetRefreshKey, setPresetRefreshKey] = useState(0);

  /** Category counts as rated when property-score side was set (manual or auto). */
  const SAVE_RATED_THRESHOLD = 0.7;
  const visibleCount = activeCategories.length;
  const ratedCount = activeCategories.filter((c) => c.scoreRated).length;
  const ratedRatio = visibleCount > 0 ? ratedCount / visibleCount : 0;
  const canSaveScore = visibleCount > 0 && ratedRatio >= SAVE_RATED_THRESHOLD;
  const minRatedNeeded = Math.ceil(visibleCount * SAVE_RATED_THRESHOLD);
  const saveGateMessage = !canSaveScore
    ? `Rate at least ${minRatedNeeded} of ${visibleCount} categories (${Math.round(SAVE_RATED_THRESHOLD * 100)}%) before saving. Currently ${ratedCount} rated.`
    : "";

  useEffect(() => {
    if (!isAuthenticated) return;
    api.auth.me().then(u => {
      const saved = u?.default_weights || {};
      if (Object.keys(saved).length > 0) {
        setActiveCategories(prev => prev.map(c => {
          if (saved[c.id] === undefined) return c;
          return {
            ...c,
            importance: saved[c.id],
            importanceRated: true,
          };
        }));
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  // Recipient opened Evaluate via share link → mark Viewed
  useEffect(() => {
    if (!shareId || !isAuthenticated) return;
    api.shares?.markViewed?.(shareId).catch(() => {});
  }, [shareId, isAuthenticated]);

  const addCategory = (cat) => {
    if (activeCategories.find(c => c.id === cat.id)) return;
    setActiveCategories(prev => [...prev, withUnratedDefaults(cat)]);
  };

  const removeCategory = (id) => {
    setActiveCategories(prev => prev.filter(c => c.id !== id));
  };

  const updateImportance = (id, val) => {
    setActiveCategories(prev => prev.map(c =>
      c.id === id ? { ...c, importance: val, importanceRated: true } : c
    ));
  };

  const updateScore = (id, val) => {
    setActiveCategories(prev => prev.map(c =>
      c.id === id ? { ...c, score: val, scoreRated: true, scoreSource: "manual" } : c
    ));
  };

  const applyAutoScores = (scores) => {
    setActiveCategories(prev => prev.map(cat => {
      const s = scores.find(x => x.id === cat.id);
      if (!s) return cat;
      return {
        ...cat,
        score: Math.min(10, Math.max(1, Math.round(Number(s.score)))),
        scoreRated: true,
        scoreSource: "auto",
      };
    }));
  };

  const weightedTotal = activeCategories.reduce((sum, c) => sum + c.importance * c.score, 0);
  const maxPossible = activeCategories.reduce((sum, c) => sum + c.importance * 10, 0);
  const percentage = maxPossible > 0 ? Math.round((weightedTotal / maxPossible) * 100) : 0;

  const sendToCompare = () => {
    const auto_scores = {};
    for (const c of activeCategories) {
      if (c?.id != null) auto_scores[c.id] = Number(c.score) || 0;
    }
    storeBrowseCompareSelection([
      {
        address: property.address,
        city: property.city,
        state: property.state,
        zip: "",
        price: property.price,
        bedrooms: property.beds,
        bathrooms: property.baths,
        sqft: property.sqft,
        year_built: property.year,
        lot_size: property.lot_size,
        annual_taxes: property.annual_taxes,
        tax_assessment: property.tax_assessment,
        hoa_fee: property.hoa_fee,
        listing_status: property.listing_status,
        features: property.features || {},
        sale_history: property.sale_history || [],
        formatted_address: [property.address, property.city, property.state].filter(Boolean).join(", "),
        auto_scores,
        overall_percentage: percentage,
      },
    ]);
    navigate(createPageUrl("Compare"));
  };

  const saveScore = async () => {
    if (!canSaveScore) {
      setSaveError(saveGateMessage);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await api.entities.PropertyScore.create({
        property_address: `${property.address}, ${property.city}, ${property.state}`,
        scores: activeCategories.map(c => ({
          category_id: c.id,
          category_label: c.label,
          importance: c.importance,
          score: c.score
        })),
        weighted_total: weightedTotal,
        max_possible: maxPossible,
        percentage
      });
      setSaved(true);
    } catch (error) {
      setSaveError(error?.message || "Could not save this score. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const returnToRealtor = async () => {
    if (!shareId || !isAuthenticated) return;
    setReturning(true);
    setReturnStatus("");
    try {
      const scores = {
        percentage,
        weighted_total: weightedTotal,
        max_possible: maxPossible,
        categories: activeCategories.map((c) => ({
          category_id: c.id,
          category_label: c.label,
          importance: c.importance,
          score: c.score,
        })),
      };
      await api.shares.returnScores(shareId, { scores });
      setReturnStatus("Sent back to realtor");
    } catch (error) {
      setReturnStatus(error?.message || "Could not send scores back");
    } finally {
      setReturning(false);
    }
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name || !isAuthenticated) return;
    setSavingPreset(true);
    setPresetStatus("");
    try {
      await api.entities.Preset.create({
        name,
        weights: Object.fromEntries(activeCategories.map(category => [category.id, category.importance])),
        filters: {
          categories: activeCategories.map(category => ({
            id: category.id,
            label: category.label,
            custom: Boolean(category.custom),
            mandatory: Boolean(category.mandatory),
            neighborhood: Boolean(category.neighborhood),
          })),
        },
      });
      setPresetName("");
      setShowPresetForm(false);
      setPresetStatus("Preset saved");
      setPresetRefreshKey(value => value + 1);
    } catch (error) {
      setPresetStatus(error?.message || "Could not save this preset.");
    } finally {
      setSavingPreset(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-6">
        <div className="absolute inset-0 bg-[#1a2234]/75" />
        <div className="relative max-w-4xl mx-auto">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-4">
            <ChevronLeft size={16} /> Back to Search
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{property.address}</h1>
              <p className="text-slate-400">{property.city}, {property.state}</p>
            </div>
            {property.price && (
              <div className="text-right">
                <div className="text-2xl font-bold text-[#c9a84c]">${Number(property.price).toLocaleString()}</div>
                {summaryFacts && <div className="text-xs text-slate-400">{summaryFacts}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score Summary */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
            <div className={`text-4xl font-bold ${canSaveScore ? "text-[#1a2234]" : "text-slate-400"}`}>
              {percentage}<span className="text-xl text-slate-400"> / 100</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {canSaveScore ? "Property Score" : "Provisional score"}
            </div>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <div className="text-sm text-slate-500">
            <span className="font-semibold text-[#1a2234]">{ratedCount}</span>
            {" of "}
            <span className="font-semibold text-[#1a2234]">{visibleCount}</span> rated
            </div>
            <div className="flex-1 max-w-xs">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    background: percentage >= 70 ? "#22c55e" : percentage >= 40 ? "#c9a84c" : "#ef4444"
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAuthenticated && (
              <PresetPicker
                activeCategories={activeCategories}
                onLoadPreset={(next) => setActiveCategories(
                  next.map((c) => withUnratedDefaults({
                    ...c,
                    // Presets only restore importance weights — keep score rating state from current.
                    importanceRated: true,
                    scoreRated: Boolean(c.scoreRated),
                    scoreSource: c.scoreSource ?? null,
                  }))
                )}
                refreshKey={presetRefreshKey}
              />
            )}
            {isAuthenticated && isRealtor && (
              <button
                type="button"
                onClick={() => setSendOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-[#10b981]/40 text-[#059669] hover:bg-[#10b981]/10 font-semibold rounded-xl transition-colors text-sm"
              >
                <Send size={15} /> Send to client for scoring
              </button>
            )}
            {shareId && isAuthenticated && (
              <button
                type="button"
                onClick={returnToRealtor}
                disabled={returning || activeCategories.length === 0 || !canSaveScore}
                title={!canSaveScore ? saveGateMessage : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a2234] hover:bg-[#243050] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {returning ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                {returning ? "Sending…" : "Send back to realtor"}
              </button>
            )}
            <SharePropertyButton
              property={{
                address: property.address,
                city: property.city,
                state: property.state,
                lat: property.lat,
                lng: property.lng,
                formatted_address: [property.address, property.city, property.state].filter(Boolean).join(", "),
              }}
              variant="onDark"
            />
            <button
              onClick={sendToCompare}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2234] hover:bg-[#243050] text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <Columns size={15} /> Compare
            </button>
            {isLoadingAuth ? (
              <span className="flex items-center gap-2 px-4 py-2 text-slate-400 text-sm min-w-[8rem] justify-center">
                <span className="w-4 h-4 border-2 border-[#10b981]/30 border-t-[#10b981] rounded-full animate-spin" aria-hidden />
              </span>
            ) : isAuthenticated ? (
              saved ? (
                <Link
                  to={createPageUrl("SavedProperties")}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-xl text-sm"
                >
                  <BarChart3 size={15} /> View Comparison
                </Link>
              ) : (
                <span className="relative group/save inline-flex flex-col items-stretch">
                  <button
                    type="button"
                    onClick={saveScore}
                    disabled={saving || !canSaveScore}
                    title={!canSaveScore ? saveGateMessage : undefined}
                    aria-describedby={!canSaveScore ? "save-score-gate" : undefined}
                    className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#10b981]"
                  >
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                    {saving ? "Saving..." : "Save Score"}
                  </button>
                  {!canSaveScore && (
                    <span
                      id="save-score-gate"
                      role="tooltip"
                      className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg bg-[#1a2234] px-3 py-2 text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/save:opacity-100 group-focus-within/save:opacity-100"
                    >
                      {saveGateMessage}
                    </span>
                  )}
                </span>
              )
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <LogIn size={15} /> Sign In to Save
              </Link>
            )}
          </div>
          {saveError && <p className="w-full text-sm text-red-600 font-medium">{saveError}</p>}
          {!canSaveScore && isAuthenticated && !saved && (
            <p className="w-full text-sm text-slate-500">{saveGateMessage}</p>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400 max-w-2xl">
          {PROPERTY_SCORE_DISCLAIMER}
        </p>
        </div>
      </div>

      <PropertyOverview property={property} />

      <div className="max-w-4xl mx-auto px-6 pt-6">
        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
          <PropertyLocationMap property={property} className="h-52 md:h-64" />
        </div>
      </div>

      {/* Google Auto-Score (free, deterministic) */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <GoogleAutoScore
          address={`${property.address}, ${property.city}, ${property.state}`}
          property={property}
          categories={activeCategories}
          onApplyScores={applyAutoScores}
        />
      </div>

      {/* Premium scoring toolkit */}
      <div className="max-w-4xl mx-auto px-6 pt-4">
        <PremiumFeatureGroup>
          <div className="space-y-4">
          <GamifiedWalkthrough propertyAddress={property.address} />
          <ExplainScore
            propertyAddress={property.address}
            percentage={percentage}
            categories={activeCategories}
          />
          <AIAutoScore
            property={property}
            categories={activeCategories}
            onApplyScores={applyAutoScores}
          />
          </div>
        </PremiumFeatureGroup>
      </div>

      {/* Categories */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1a2234]">Scoring Categories</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {visibleCount > 0
                ? `${ratedCount} of ${visibleCount} categories rated.`
                : "Choose the factors that matter for this property."}
            </p>
            {visibleCount > 0 && (
              <div className="mt-2 max-w-xs">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#10b981] transition-all duration-300"
                    style={{ width: `${Math.min(100, ratedRatio * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setShowPresetForm(true);
                  setPresetStatus("");
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1a2234] transition-colors hover:bg-slate-50"
              >
                <Bookmark size={16} /> Save Preset
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1a2234] transition-colors hover:bg-slate-50"
              >
                <LogIn size={16} /> Sign In to Save Preset
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a2234] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#243050]"
            >
              <Plus size={16} /> Add Categories
            </button>
          </div>
        </div>

        {showPresetForm && isAuthenticated && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
            <Bookmark size={17} className="hidden shrink-0 text-[#10b981] sm:block" />
            <input
              autoFocus
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  savePreset();
                }
              }}
              maxLength={80}
              placeholder="Preset name, e.g. Family Home"
              className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm outline-none ring-[#10b981]/30 focus:ring-2"
            />
            <button
              type="button"
              onClick={savePreset}
              disabled={!presetName.trim() || savingPreset}
              className="rounded-lg bg-[#10b981] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#059669] disabled:opacity-40"
            >
              {savingPreset ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPresetForm(false);
                setPresetName("");
              }}
              aria-label="Cancel saving preset"
              className="inline-flex h-9 w-9 items-center justify-center self-end rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 sm:self-auto"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {presetStatus && (
          <p className={`text-sm font-medium ${presetStatus === "Preset saved" ? "text-[#059669]" : "text-red-600"}`}>
            {presetStatus}
          </p>
        )}

        {activeCategories.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm font-medium mb-1">No categories added yet</p>
            <p className="text-xs">Use Add Categories above to start scoring this property.</p>
          </div>
        )}

        {activeCategories.filter(c => !c.custom).length > 0 && (
          <>
            {activeCategories.filter(c => !c.custom).map(cat => (
              <CategorySlider
                key={cat.id}
                category={cat}
                evidence={propertyEvidence[cat.id]}
                onImportanceChange={updateImportance}
                onScoreChange={updateScore}
                onRemove={removeCategory}
                showImportanceHelp={isAuthenticated}
              />
            ))}
          </>
        )}

        {activeCategories.filter(c => c.custom).length > 0 && (
          <>
            <div className="mt-6 mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Custom Categories</span>
            </div>
            {activeCategories.filter(c => c.custom).map(cat => (
              <CategorySlider
                key={cat.id}
                category={cat}
                evidence={propertyEvidence[cat.id]}
                onImportanceChange={updateImportance}
                onScoreChange={updateScore}
                onRemove={removeCategory}
                showImportanceHelp={isAuthenticated}
              />
            ))}
          </>
        )}

      </div>

      {showPicker && (
        <CategoryPicker
          activeIds={activeCategories.map(c => c.id)}
          onAdd={addCategory}
          onRemove={removeCategory}
          onClose={() => setShowPicker(false)}
        />
      )}

      {returnStatus && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-[#1a2234] text-white text-sm font-semibold px-4 py-2.5 shadow-lg">
          {returnStatus}
        </div>
      )}

      <SendForScoringModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        property={{
          ...property,
          address: property.address,
          city: property.city,
          state: property.state,
          price: property.price,
          bedrooms: property.beds,
          bathrooms: property.baths,
          sqft: property.sqft,
          year_built: property.year,
          lat: property.lat,
          lng: property.lng,
          image_url: property.image_url || property.primary_photo,
          street_view_url: property.street_view_url,
          photos: property.photos || property.images,
        }}
      />
    </div>
  );
}