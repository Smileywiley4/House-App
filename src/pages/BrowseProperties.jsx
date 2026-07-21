import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Filter, List, Map as MapIcon, Loader2, Pencil, Search, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import BrowseFilters from "@/components/browse/BrowseFilters";
import BrowsePresetsBar from "@/components/browse/BrowsePresetsBar";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const DEFAULT_CENTER = { lat: 40.7608, lng: -111.891 };
const DEFAULT_ZOOM = 12;

function formatPrice(n) {
  if (n == null || n === "") return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${Math.round(num).toLocaleString()}`;
}

function evaluateHref(p) {
  const params = new URLSearchParams();
  const address = p.formatted_address || [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");
  if (address) params.set("address", address);
  if (p.city) params.set("city", p.city);
  if (p.state) params.set("state", p.state);
  if (p.price != null) params.set("price", String(p.price));
  if (p.bedrooms != null) params.set("beds", String(p.bedrooms));
  if (p.bathrooms != null) params.set("baths", String(p.bathrooms));
  if (p.sqft != null) params.set("sqft", String(p.sqft));
  if (p.year_built != null) params.set("year", String(p.year_built));
  return `${createPageUrl("Evaluate")}?${params.toString()}`;
}

function coverSrc(p) {
  if (p.cover_photo) return p.cover_photo;
  if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && API_BASE) {
    return `${API_BASE}/api/property/street-view?lat=${p.lat}&lng=${p.lng}`;
  }
  return null;
}

function priceIcon(price, selected) {
  const label = formatPrice(price);
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${selected ? "#059669" : "#1a2234"};
      color:#fff;
      font:700 11px/1 system-ui,sans-serif;
      padding:6px 8px;
      border-radius:999px;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
      white-space:nowrap;
      border:2px solid #fff;
    ">${label}</div>`,
    iconSize: [54, 28],
    iconAnchor: [27, 28],
  });
}

/** Ray-casting point-in-polygon. ring = [[lat, lng], ...] */
export function pointInPolygon(lat, lng, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Covering circle for RentCast (centroid + max vertex distance). */
export function polygonCoverCircle(ring) {
  if (!ring?.length) return null;
  const lat = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lng = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  let max = 0;
  for (const [plat, plng] of ring) {
    max = Math.max(max, haversineMiles(lat, lng, plat, plng));
  }
  return {
    lat,
    lng,
    radius: Math.max(1, Math.min(25, max * 1.15 + 0.25)),
  };
}

function MapController({ center, zoom, flyToken }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { duration: 0.6 });
  }, [center, zoom, flyToken, map]);
  return null;
}

function MapMoveWatcher({ onMoveEnd, enabled }) {
  useMapEvents({
    moveend: (e) => {
      if (!enabled) return;
      const map = e.target;
      const c = map.getCenter();
      const bounds = map.getBounds();
      const ne = bounds.getNorthEast();
      const R = 3958.8;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(ne.lat - c.lat);
      const dLng = toRad(ne.lng - c.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(c.lat)) * Math.cos(toRad(ne.lat)) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
      onMoveEnd?.({
        lat: c.lat,
        lng: c.lng,
        radius: Math.max(1, Math.min(25, dist * 0.85)),
        zoom: map.getZoom(),
      });
    },
  });
  return null;
}

function DrawInteraction({ active, draftPoints, onAddPoint, onFinish }) {
  useMapEvents({
    click: (e) => {
      if (!active) return;
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
    dblclick: (e) => {
      if (!active) return;
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      onFinish();
    },
  });

  useEffect(() => {
    // Leaflet fires dblclick zoom by default — disable while drawing.
  }, [active]);

  if (!active || draftPoints.length === 0) return null;
  return (
    <>
      <Polyline
        positions={draftPoints}
        pathOptions={{ color: "#10b981", weight: 2, dashArray: "6 6" }}
      />
      {draftPoints.map((pt, idx) => (
        <CircleMarker
          key={`${pt[0]}-${pt[1]}-${idx}`}
          center={pt}
          radius={5}
          pathOptions={{ color: "#059669", fillColor: "#10b981", fillOpacity: 1, weight: 2 }}
        />
      ))}
    </>
  );
}

function DisableDblClickZoom({ active }) {
  const map = useMap();
  useEffect(() => {
    if (active) {
      map.doubleClickZoom.disable();
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    }
    return () => {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    };
  }, [active, map]);
  return null;
}

async function geocodePlace(query) {
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    q: `${query}, USA`,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.[0];
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name };
}

export default function BrowseProperties() {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState("for_sale");
  const [view, setView] = useState("split");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [scoreMeta, setScoreMeta] = useState(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(5);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [flyToken, setFlyToken] = useState(0);
  const [properties, setProperties] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [polygon, setPolygon] = useState(null); // closed ring [[lat,lng],...]
  const debounceRef = useRef(null);
  const skipNextMoveFetch = useRef(false);
  const listRef = useRef(null);
  const polygonRef = useRef(null);

  useEffect(() => {
    polygonRef.current = polygon;
  }, [polygon]);

  const filterByPolygon = useCallback((list, ring) => {
    if (!ring || ring.length < 3) return list || [];
    return (list || []).filter((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return pointInPolygon(lat, lng, ring);
    });
  }, []);

  const fetchBrowse = useCallback(
    async (opts = {}) => {
      const lat = opts.lat ?? center.lat;
      const lng = opts.lng ?? center.lng;
      const r = opts.radius ?? radius;
      const ring = opts.polygon !== undefined ? opts.polygon : polygonRef.current;
      setLoading(true);
      setError("");
      try {
        const result = await api.property.browse({
          mode,
          latitude: lat,
          longitude: lng,
          radius: r,
          filters,
          limit: ring ? 100 : 50,
          offset: 0,
        });
        let list = result?.properties || [];
        if (ring?.length >= 3) {
          list = filterByPolygon(list, ring);
        }
        setProperties(list);
        setTotal(ring ? list.length : result?.total ?? list.length);
        setScoreMeta(result?.score_meta || null);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Could not load properties for this area.");
        setProperties([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [center.lat, center.lng, radius, mode, filters, filterByPolygon]
  );

  useEffect(() => {
    const ring = polygonRef.current;
    if (ring?.length >= 3) {
      const cover = polygonCoverCircle(ring);
      if (cover) {
        fetchBrowse({ lat: cover.lat, lng: cover.lng, radius: cover.radius, polygon: ring });
        return;
      }
    }
    fetchBrowse({ polygon: null });
  }, [mode, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleFetch = useCallback(
    (next) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchBrowse({ ...next, polygon: null });
      }, 450);
    },
    [fetchBrowse]
  );

  const onMapMoveEnd = useCallback(
    (payload) => {
      if (drawMode || polygonRef.current) return;
      if (skipNextMoveFetch.current) {
        skipNextMoveFetch.current = false;
        return;
      }
      setCenter({ lat: payload.lat, lng: payload.lng });
      setRadius(payload.radius);
      setZoom(payload.zoom);
      scheduleFetch(payload);
    },
    [scheduleFetch, drawMode]
  );

  const finishDrawing = useCallback(() => {
    setDraftPoints((pts) => {
      if (pts.length < 3) {
        setError("Draw at least 3 points to close a search area.");
        return pts;
      }
      const ring = [...pts];
      setPolygon(ring);
      setDrawMode(false);
      const cover = polygonCoverCircle(ring);
      if (cover) {
        setCenter({ lat: cover.lat, lng: cover.lng });
        setRadius(cover.radius);
        skipNextMoveFetch.current = true;
        fetchBrowse({ lat: cover.lat, lng: cover.lng, radius: cover.radius, polygon: ring });
      }
      return [];
    });
  }, [fetchBrowse]);

  const clearDrawnArea = () => {
    setPolygon(null);
    setDraftPoints([]);
    setDrawMode(false);
    fetchBrowse({ polygon: null });
  };

  const startDraw = () => {
    setDrawMode(true);
    setDraftPoints([]);
    setPolygon(null);
    setError("");
  };

  const runPlaceSearch = async (e) => {
    e?.preventDefault?.();
    const q = placeQuery.trim();
    if (!q) return;
    setLoading(true);
    try {
      const hit = await geocodePlace(q);
      if (!hit) {
        setError("Could not find that place. Try a city and state (e.g. Austin, TX).");
        return;
      }
      setPolygon(null);
      setDraftPoints([]);
      setDrawMode(false);
      skipNextMoveFetch.current = true;
      setCenter({ lat: hit.lat, lng: hit.lng });
      setZoom(12);
      setFlyToken((t) => t + 1);
      setRadius(6);
      await fetchBrowse({ lat: hit.lat, lng: hit.lng, radius: 6, polygon: null });
    } catch (err) {
      setError(err?.message || "Place search failed.");
    } finally {
      setLoading(false);
    }
  };

  const markers = useMemo(
    () =>
      (properties || []).filter(
        (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
      ),
    [properties]
  );

  const layoutClass =
    view === "list"
      ? "grid-cols-1"
      : view === "map"
        ? "grid-cols-1"
        : "lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)]";

  const activeScoreMins =
    filters?.score_mins && typeof filters.score_mins === "object"
      ? Object.keys(filters.score_mins).length
      : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f7f7f5] flex flex-col">
      {isAuthenticated && (
        <BrowsePresetsBar
          filters={filters}
          onApplyFilters={setFilters}
          mode={mode}
          center={center}
          radius={radius}
          placeQuery={placeQuery}
        />
      )}
      <div className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-3 lg:flex-row lg:items-center">
          <form onSubmit={runPlaceSearch} className="flex-1 flex gap-2 min-w-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="City, neighborhood, ZIP…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#10b981]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-sm font-bold shrink-0"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setMode("for_sale")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  mode === "for_sale" ? "bg-white shadow text-[#1a2234]" : "text-slate-500"
                }`}
              >
                For sale
              </button>
              <button
                type="button"
                onClick={() => setMode("off_market")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  mode === "off_market" ? "bg-white shadow text-[#1a2234]" : "text-slate-500"
                }`}
              >
                Off-market est.
              </button>
            </div>

            {!drawMode ? (
              <button
                type="button"
                onClick={startDraw}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={14} /> Draw
              </button>
            ) : (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={finishDrawing}
                  disabled={draftPoints.length < 3}
                  className="px-3 py-2 rounded-xl bg-[#10b981] text-white text-xs font-bold disabled:opacity-50"
                >
                  Finish
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPoints((p) => p.slice(0, -1))}
                  disabled={!draftPoints.length}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawMode(false);
                    setDraftPoints([]);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            )}

            {polygon && !drawMode && (
              <button
                type="button"
                onClick={clearDrawnArea}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#10b981]/40 bg-[#10b981]/10 text-xs font-bold text-[#059669]"
              >
                Clear area
              </button>
            )}

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <SlidersHorizontal size={14} /> Filters
              {activeScoreMins > 0 && (
                <span className="ml-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[#10b981] text-[10px] text-white flex items-center justify-center">
                  {activeScoreMins}
                </span>
              )}
            </button>

            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 lg:hidden">
              <button
                type="button"
                onClick={() => setView("map")}
                className={`px-2.5 py-1.5 rounded-lg ${view === "map" ? "bg-white shadow" : ""}`}
                aria-label="Map view"
              >
                <MapIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-2.5 py-1.5 rounded-lg ${view === "list" ? "bg-white shadow" : ""}`}
                aria-label="List view"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("split")}
                className={`px-2.5 py-1.5 rounded-lg hidden sm:inline-flex ${view === "split" ? "bg-white shadow" : ""}`}
                aria-label="Split view"
              >
                <Filter size={14} />
              </button>
            </div>
          </div>
        </div>
        {drawMode && (
          <p className="max-w-[1600px] mx-auto mt-2 text-[11px] text-slate-500 font-medium">
            Click the map to add corners. Double-click or press <span className="font-bold text-slate-700">Finish</span>{" "}
            to close the area — filters apply only inside your shape.
          </p>
        )}
        {polygon && !drawMode && (
          <p className="max-w-[1600px] mx-auto mt-2 text-[11px] text-[#059669] font-semibold">
            Custom search area active — pan is locked to this shape. Clear area to browse the full map again.
          </p>
        )}
        {scoreMeta?.score_filter_applied && (
          <p className="max-w-[1600px] mx-auto mt-2 text-[11px] text-slate-500">
            Auto-score filter applied
            {scoreMeta.cache_hits != null
              ? ` · ${scoreMeta.cache_hits} cached, ${scoreMeta.live_lookups || 0} live lookups`
              : ""}
            {scoreMeta.scores_unavailable
              ? " · location scores unavailable for this area (try again later or clear score filters)"
              : ""}
          </p>
        )}
      </div>

      <div className={`flex-1 max-w-[1600px] w-full mx-auto grid ${layoutClass} min-h-0`}>
        {(view === "split" || view === "map") && (
          <div className={`relative min-h-[45vh] lg:min-h-0 ${view === "map" ? "h-[calc(100vh-8rem)]" : "lg:h-[calc(100vh-8rem)]"}`}>
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={zoom}
              className="h-full w-full z-0"
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapController center={center} zoom={zoom} flyToken={flyToken} />
              <MapMoveWatcher onMoveEnd={onMapMoveEnd} enabled={!drawMode && !polygon} />
              <DisableDblClickZoom active={drawMode} />
              <DrawInteraction
                active={drawMode}
                draftPoints={draftPoints}
                onAddPoint={(pt) => setDraftPoints((prev) => [...prev, pt])}
                onFinish={finishDrawing}
              />
              {polygon && (
                <Polygon
                  positions={polygon}
                  pathOptions={{
                    color: "#10b981",
                    weight: 2,
                    fillColor: "#10b981",
                    fillOpacity: 0.12,
                  }}
                />
              )}
              {markers.map((p) => (
                <Marker
                  key={p.id || `${p.lat},${p.lng},${p.address}`}
                  position={[Number(p.lat), Number(p.lng)]}
                  icon={priceIcon(p.price, selectedId === p.id)}
                  eventHandlers={{
                    click: () => {
                      if (drawMode) return;
                      setSelectedId(p.id);
                      document.getElementById(`browse-card-${p.id}`)?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    },
                  }}
                />
              ))}
            </MapContainer>
            <div className="absolute top-3 left-3 z-[500] bg-[#1a2234]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              {loading
                ? "Updating…"
                : `${properties.length} shown${!polygon && total > properties.length ? ` of ${total}` : ""}${
                    polygon ? " in area" : ""
                  }`}
            </div>
          </div>
        )}

        {(view === "split" || view === "list") && (
          <div
            ref={listRef}
            className={`bg-white border-l border-slate-200 overflow-y-auto ${
              view === "list" ? "h-[calc(100vh-8rem)]" : "max-h-[55vh] lg:max-h-none lg:h-[calc(100vh-8rem)]"
            }`}
          >
            <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h1 className="text-lg font-bold text-[#1a2234]">
                {mode === "for_sale" ? "Homes for sale" : "Off-market estimates"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Licensed listing &amp; property data via RentCast. Draw a custom area or drag the map. Score any home to
                compare.
              </p>
            </div>

            {error && (
              <p className="mx-4 mt-3 text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {loading && properties.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                <Loader2 className="animate-spin" size={18} /> Loading homes…
              </div>
            ) : properties.length === 0 ? (
              <p className="text-sm text-slate-500 p-8 text-center">
                No homes matched these filters in this area. Zoom out, redraw, or clear filters.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {properties.map((p) => {
                  const img = coverSrc(p);
                  const selected = selectedId === p.id;
                  return (
                    <li
                      key={p.id || p.formatted_address}
                      id={`browse-card-${p.id}`}
                      className={`p-4 hover:bg-slate-50 transition ${selected ? "bg-emerald-50/60" : ""}`}
                      onMouseEnter={() => setSelectedId(p.id)}
                    >
                      <div className="flex gap-3">
                        <div className="w-32 h-24 rounded-xl overflow-hidden bg-slate-200 shrink-0 relative">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-semibold">
                              No photo
                            </div>
                          )}
                          {!p.on_market && (
                            <span className="absolute top-1 left-1 text-[9px] font-bold bg-slate-900/80 text-white px-1.5 py-0.5 rounded">
                              Est.
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-bold text-[#1a2234]">
                            {p.on_market ? formatPrice(p.price) : `Est. ${formatPrice(p.price)}`}
                          </div>
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
                            {p.formatted_address || [p.address, p.city, p.state].filter(Boolean).join(", ")}
                          </div>
                          {p.hoa_fee != null && Number(p.hoa_fee) > 0 && (
                            <div className="text-[10px] text-amber-700 mt-1 font-semibold">
                              HOA ${Number(p.hoa_fee).toLocaleString()}/mo
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Link
                              to={evaluateHref(p)}
                              className="inline-flex px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold"
                            >
                              Score this home
                            </Link>
                            <Link
                              to={`${createPageUrl("QuickCompare")}?address=${encodeURIComponent(
                                p.formatted_address || p.address || ""
                              )}`}
                              className="inline-flex px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-white"
                            >
                              Add to compare
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-[#1a2234]">Filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <BrowseFilters filters={filters} onChange={setFilters} />
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setFilters({})}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#10b981] text-white text-sm font-bold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
