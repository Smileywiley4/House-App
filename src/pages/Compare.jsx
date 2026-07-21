import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ChevronLeft,
  Trophy,
  LayoutGrid,
  Columns,
  Table,
  Lock,
  FolderPlus,
  Plus,
  X,
  Search,
  MapPin,
  Send,
} from "lucide-react";
import { api } from "@/api";
import { usePlan } from "@/core/hooks/usePlan";
import { getPropertyByAddress } from "@/core/propertyService";
import ShareComparison from "@/components/ShareComparison";
import SharePropertyButton from "@/components/SharePropertyButton";
import RequireAuth from "@/components/RequireAuth";
import SaveToProjectModal from "@/components/browse/SaveToProjectModal";
import SendForScoringModal from "@/components/shares/SendForScoringModal";
import ExportTourPacketButton from "@/components/ExportTourPacketButton";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import PaywallModal from "@/components/PaywallModal";
import { browseListingToCompareRow, loadBrowseCompareSelection } from "@/lib/browseCompare";
import { compareScoreToTourItem } from "@/lib/tourPacketPdf";
import { toast } from "@/components/ui/use-toast";

const VIEW_MODES = [
  { id: "columns", label: "Side by Side", icon: Columns },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "table", label: "Table", icon: Table },
];

function propertyDataToCompareRow(data) {
  const address =
    data.formatted_address ||
    [data.address, data.city, data.state, data.zip].filter(Boolean).join(", ") ||
    "Unknown";
  return {
    id: `search-${address}-${Date.now()}`,
    property_address: address,
    scores: [],
    percentage: 0,
    weighted_total: 0,
    max_possible: 0,
    _browseSnapshot: data,
    _fromSearch: true,
  };
}

export default function Compare() {
  return (
    <RequireAuth message="Sign in to compare properties side by side">
      <CompareInner />
    </RequireAuth>
  );
}

function CompareInner() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("columns");
  /** Slot ids: property score id, or null for an empty slot */
  const [slots, setSlots] = useState([null, null]);
  const [addSlotIndex, setAddSlotIndex] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const { maxCompareCount, isPremium, isRealtor } = usePlan();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const incoming = loadBrowseCompareSelection({ consume: true }).map(browseListingToCompareRow);
      const data = await api.entities.PropertyScore.list("-created_date");
      if (cancelled) return;
      const merged = [...incoming];
      for (const s of data || []) {
        if (!merged.some((m) => m.id === s.id || m.property_address === s.property_address)) {
          merged.push(s);
        }
      }
      setScores(merged);
      if (incoming.length) {
        const ids = incoming.slice(0, maxCompareCount).map((s) => s.id);
        // Pad to at least 2 slots so empty add targets remain available
        while (ids.length < Math.min(2, maxCompareCount)) ids.push(null);
        setSlots(ids);
        toast({
          title: "Compare ready",
          description: `${incoming.slice(0, maxCompareCount).length} listing${
            incoming.length === 1 ? "" : "s"
          } loaded from Search Properties.`,
        });
      } else {
        const initial = (data || []).slice(0, Math.min(2, maxCompareCount)).map((s) => s.id);
        while (initial.length < Math.min(2, maxCompareCount)) initial.push(null);
        setSlots(initial);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [maxCompareCount]);

  const comparing = slots.map((id) => (id ? scores.find((s) => s.id === id) : null)).filter(Boolean);
  const sorted = [...comparing].sort((a, b) => b.percentage - a.percentage);
  const winner = sorted[0];
  const filledCount = slots.filter(Boolean).length;

  const allCategories = [];
  const seen = new Set();
  comparing.forEach((p) => {
    (p.scores || []).forEach((cat) => {
      if (!seen.has(cat.category_id)) {
        seen.add(cat.category_id);
        allCategories.push({ id: cat.category_id, label: cat.category_label });
      }
    });
  });

  const getScore = (property, catId) => property.scores?.find((s) => s.category_id === catId);
  const scoreColor = (pct) => (pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444");

  const saveSnapshots = comparing.map((c) => c._browseSnapshot).filter(Boolean);

  const usedIds = new Set(slots.filter(Boolean));
  const availableScores = scores.filter((s) => !usedIds.has(s.id));

  const addEmptySlot = () => {
    if (slots.length >= maxCompareCount) {
      if (!isPremium) setPaywallOpen(true);
      return;
    }
    setSlots((prev) => [...prev, null]);
    setAddSlotIndex(slots.length);
  };

  const clearSlot = (index) => {
    setSlots((prev) => prev.map((id, i) => (i === index ? null : id)));
    if (addSlotIndex === index) setAddSlotIndex(null);
  };

  const assignToSlot = (index, scoreRow) => {
    setScores((prev) => {
      if (prev.some((s) => s.id === scoreRow.id)) return prev;
      return [scoreRow, ...prev];
    });
    setSlots((prev) => prev.map((id, i) => (i === index ? scoreRow.id : id)));
    setAddSlotIndex(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="relative overflow-hidden bg-[#1a2234] px-6 py-6 sticky top-[112px] sm:top-14 z-30">
        <div className="absolute inset-0 bg-[#1a2234]/80" />
        <div className="relative max-w-6xl mx-auto">
          <Link
            to={createPageUrl("SavedProperties")}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition"
          >
            <ChevronLeft size={16} /> Back to Properties
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-xl font-bold text-white">Compare</h1>

            <div className="flex items-center gap-2 flex-wrap">
              {comparing.length >= 1 && (
                <ExportTourPacketButton
                  items={comparing.map(compareScoreToTourItem)}
                  title="Compare · Tour packet"
                  filename="tour-packet-compare.pdf"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
                />
              )}
              {saveSnapshots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSaveOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/15"
                >
                  <FolderPlus size={14} /> Save to project
                </button>
              )}
              {isRealtor && saveSnapshots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSendOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#10b981]/20 text-[#6ee7b7] hover:bg-[#10b981]/30"
                >
                  <Send size={14} /> Send to client for scoring
                </button>
              )}
              <ShareComparison scores={comparing} />
              <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                {VIEW_MODES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setViewMode(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === id ? "bg-[#10b981] text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison slots */}
          <div className="flex gap-2 mt-4 flex-wrap items-center">
            {slots.map((id, index) => {
              const score = id ? scores.find((s) => s.id === id) : null;
              const isAdding = addSlotIndex === index;
              if (score) {
                return (
                  <div
                    key={`slot-${index}-${id}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border bg-[#10b981] border-[#10b981] text-white"
                  >
                    <span className="truncate max-w-[10rem]">{score.property_address?.split(",")[0]}</span>
                    <SharePropertyButton
                      property={{
                        property_address: score.property_address,
                        formatted_address: score.property_address,
                        lat: score.lat,
                        lng: score.lng,
                      }}
                      variant="icon"
                      label=""
                      stopPropagation
                    />
                    <button
                      type="button"
                      onClick={() => clearSlot(index)}
                      className="ml-0.5 opacity-70 hover:opacity-100 min-h-7 min-w-7 inline-flex items-center justify-center"
                      aria-label="Clear slot"
                      title="Clear slot"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => setAddSlotIndex(isAdding ? null : index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed transition-all ${
                    isAdding
                      ? "border-[#10b981] text-[#10b981] bg-[#10b981]/10"
                      : "border-white/30 text-slate-300 hover:border-[#10b981]/50 hover:text-white"
                  }`}
                >
                  <Plus size={12} className="inline mr-1" />
                  Add property
                </button>
              );
            })}

            {slots.length < maxCompareCount ? (
              <button
                type="button"
                onClick={addEmptySlot}
                className="w-8 h-8 rounded-lg border border-white/25 text-slate-300 hover:border-[#10b981] hover:text-[#10b981] flex items-center justify-center transition-all"
                title={`Add slot (${slots.length}/${maxCompareCount})`}
                aria-label="Add comparison slot"
              >
                <Plus size={16} />
              </button>
            ) : !isPremium ? (
              <button
                type="button"
                onClick={() => setPaywallOpen(true)}
                className="w-8 h-8 rounded-lg border border-white/10 text-slate-600 flex items-center justify-center cursor-pointer"
                title="Upgrade to compare up to 4"
                aria-label="Upgrade for more slots"
              >
                <Lock size={14} />
              </button>
            ) : null}
          </div>

          {addSlotIndex != null && slots[addSlotIndex] == null && (
            <AddPropertyPanel
              availableScores={availableScores}
              onPick={(row) => assignToSlot(addSlotIndex, row)}
              onClose={() => setAddSlotIndex(null)}
            />
          )}

          {maxCompareCount === 2 && filledCount >= 2 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[#c9a84c]">
              <Lock size={12} />
              Comparing more than 2 is a{" "}
              <Link to={createPageUrl("Pricing")} className="underline font-semibold">
                Premium feature
              </Link>{" "}
              (up to 4)
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {comparing.length < 2 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-semibold text-[#1a2234] mb-2">
              {filledCount === 0 ? "Add properties to compare" : "Add at least one more property"}
            </p>
            <p className="text-sm mb-6">
              Use an empty slot above to search an address, pick a saved score, or browse listings.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {slots.map((id, index) =>
                id ? null : (
                  <button
                    key={`cta-${index}`}
                    type="button"
                    onClick={() => setAddSlotIndex(index)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a2234] text-white text-sm font-semibold hover:bg-[#243050]"
                  >
                    <Plus size={14} /> Fill slot {index + 1}
                  </button>
                )
              )}
              <Link
                to={createPageUrl("BrowseProperties")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-[#1a2234] text-sm font-semibold hover:bg-white"
              >
                Browse listings
              </Link>
            </div>
          </div>
        ) : (
          <>
            {viewMode === "columns" && (
              <ColumnsView
                comparing={sorted}
                winner={winner}
                allCategories={allCategories}
                getScore={getScore}
                scoreColor={scoreColor}
              />
            )}
            {viewMode === "cards" && (
              <CardsView comparing={sorted} winner={winner} scoreColor={scoreColor} />
            )}
            {viewMode === "table" && (
              <TableView
                comparing={sorted}
                winner={winner}
                allCategories={allCategories}
                getScore={getScore}
                scoreColor={scoreColor}
              />
            )}
          </>
        )}
      </div>

      <SaveToProjectModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        properties={saveSnapshots}
        onSaved={() => {
          toast({ title: "Saved to project", description: "Properties added to your project folder." });
        }}
      />

      <SendForScoringModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        property={saveSnapshots[0] || {}}
        onSent={() =>
          toast({ title: "Sent for scoring", description: "Your client will see this in Shared homes." })
        }
      />

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        featureName="Comparing more than 2 properties"
      />
    </div>
  );
}

function AddPropertyPanel({ availableScores, onPick, onClose }) {
  const [address, setAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = async (addressOverride) => {
    const q = (addressOverride ?? address).trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const data = await getPropertyByAddress(q);
      onPick(propertyDataToCompareRow(data));
    } catch (err) {
      setError(err?.message || "Could not load property");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mt-3 p-4 rounded-xl bg-white/10 border border-white/15 text-left">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white">Add property to this slot</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="flex gap-2"
      >
        <AddressAutocompleteInput
          value={address}
          onChange={setAddress}
          onSelect={runSearch}
          placeholder="Search address..."
          inputClassName="w-full pl-9 pr-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-[#10b981]"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-3 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-xs font-semibold disabled:opacity-60 flex items-center gap-1"
        >
          {searching ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Search size={12} />
          )}
          Search
        </button>
      </form>
      {error && <p className="text-red-300 text-xs mt-2">{error}</p>}

      {availableScores.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">Saved scores</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {availableScores.slice(0, 12).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className="px-2.5 py-1 rounded-md text-[11px] border border-white/20 text-slate-200 hover:border-[#10b981]/50 hover:text-white"
              >
                {s.property_address?.split(",")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs">
        <Link
          to={createPageUrl("BrowseProperties")}
          className="inline-flex items-center gap-1.5 text-[#10b981] hover:underline font-medium"
        >
          <MapPin size={12} /> Browse listings to compare
        </Link>
      </div>
    </div>
  );
}

/* ─── COLUMNS VIEW ─── */
function ColumnsView({ comparing, winner, allCategories, getScore, scoreColor }) {
  return (
    <div>
      <div
        className="grid gap-4 mb-6"
        style={{ gridTemplateColumns: `200px repeat(${comparing.length}, 1fr)` }}
      >
        <div />
        {comparing.map((p) => {
          const isWinner = p.id === winner?.id;
          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border p-5 text-center shadow-sm ${
                isWinner ? "border-[#10b981]" : "border-slate-100"
              }`}
            >
              {isWinner && (
                <div className="flex items-center justify-center gap-1 text-[#10b981] text-xs font-bold mb-2">
                  <Trophy size={12} /> Top Pick <span className="text-[#c9a84c]">✦</span>
                </div>
              )}
              <div className="text-sm font-bold text-[#1a2234] leading-tight">
                {p.property_address?.split(",")[0]}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {p.property_address?.split(",").slice(1).join(",").trim()}
              </div>
              <div className="mt-3 text-3xl font-bold" style={{ color: scoreColor(p.percentage) }}>
                {p.percentage}%
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${p.percentage}%`, backgroundColor: scoreColor(p.percentage) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {allCategories.map((cat, i) => (
          <div
            key={cat.id}
            className={`grid gap-4 rounded-xl p-4 ${
              i % 2 === 0 ? "bg-white border border-slate-100" : "bg-slate-50"
            }`}
            style={{ gridTemplateColumns: `200px repeat(${comparing.length}, 1fr)` }}
          >
            <div className="flex items-center">
              <span className="text-sm font-semibold text-[#1a2234]">{cat.label}</span>
            </div>
            {comparing.map((p) => {
              const s = getScore(p, cat.id);
              if (!s) return <div key={p.id} className="text-center text-slate-300 text-sm">—</div>;
              const best = comparing.every((op) => {
                const os = getScore(op, cat.id);
                if (!os) return true;
                return s.score >= os.score;
              });
              return (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <div className={`text-xl font-bold ${best ? "text-[#10b981]" : "text-[#1a2234]"}`}>
                    {s.score}
                    <span className="text-xs text-slate-400">/10</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CARDS VIEW ─── */
function CardsView({ comparing, winner, scoreColor }) {
  const cols =
    comparing.length >= 4
      ? "md:grid-cols-4"
      : comparing.length === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-2";

  return (
    <div className={`grid gap-5 ${cols}`}>
      {comparing.map((p) => {
        const isWinner = p.id === winner?.id;
        return (
          <div
            key={p.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              isWinner ? "border-[#10b981]" : "border-slate-100"
            }`}
          >
            <div className={`px-6 py-5 ${isWinner ? "bg-[#10b981]/5" : ""}`}>
              {isWinner && (
                <div className="flex items-center gap-1 text-[#10b981] text-xs font-bold mb-1">
                  <Trophy size={12} /> Top Pick
                </div>
              )}
              <h3 className="font-bold text-[#1a2234] text-base">{p.property_address?.split(",")[0]}</h3>
              <p className="text-slate-400 text-xs">
                {p.property_address?.split(",").slice(1).join(",").trim()}
              </p>
              <div className="flex items-end gap-2 mt-3">
                <span className="text-4xl font-bold" style={{ color: scoreColor(p.percentage) }}>
                  {p.percentage}%
                </span>
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${p.percentage}%`, backgroundColor: scoreColor(p.percentage) }}
                />
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 space-y-2">
              {(p.scores || []).map((cat) => (
                <div
                  key={cat.category_id}
                  className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
                >
                  <span className="text-xs text-slate-600">{cat.category_label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#10b981]"
                        style={{ width: `${(cat.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#1a2234] w-8 text-right">{cat.score}/10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TABLE VIEW ─── */
function TableView({ comparing, winner, allCategories, getScore, scoreColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wide w-48">
              Category
            </th>
            {comparing.map((p) => {
              const isWinner = p.id === winner?.id;
              return (
                <th key={p.id} className={`px-5 py-4 text-center ${isWinner ? "bg-[#10b981]/5" : ""}`}>
                  {isWinner && (
                    <div className="flex items-center justify-center gap-1 text-[#10b981] text-[10px] font-bold mb-1">
                      <Trophy size={10} />
                      Top Pick
                    </div>
                  )}
                  <div className="text-xs font-bold text-[#1a2234] leading-tight">
                    {p.property_address?.split(",")[0]}
                  </div>
                  <div className="text-2xl font-bold mt-1" style={{ color: scoreColor(p.percentage) }}>
                    {p.percentage}%
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {allCategories.map((cat, i) => (
            <tr key={cat.id} className={`border-b border-slate-50 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
              <td className="px-5 py-3 font-medium text-[#1a2234] text-xs">{cat.label}</td>
              {comparing.map((p) => {
                const s = getScore(p, cat.id);
                if (!s)
                  return (
                    <td key={p.id} className="px-5 py-3 text-center text-slate-300 text-xs">
                      —
                    </td>
                  );
                const best = comparing.every((op) => {
                  const os = getScore(op, cat.id);
                  return !os || s.score >= os.score;
                });
                return (
                  <td key={p.id} className="px-5 py-3 text-center">
                    <span className={`text-sm font-bold ${best ? "text-[#10b981]" : "text-slate-600"}`}>
                      {s.score}/10
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-[#1a2234]">
            <td className="px-5 py-4 text-xs font-bold text-white">TOTAL SCORE</td>
            {comparing.map((p) => (
              <td key={p.id} className="px-5 py-4 text-center">
                <span className="text-lg font-bold" style={{ color: scoreColor(p.percentage) }}>
                  {p.percentage}%
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
