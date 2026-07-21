import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Columns,
  Filter,
  FolderKanban,
  List,
  LocateFixed,
  Map as MapIcon,
  Loader2,
  Pencil,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { usePlan } from "@/core/hooks/usePlan";
import { toast } from "@/components/ui/use-toast";
import BrowseFilters from "@/components/browse/BrowseFilters";
import BrowsePresetsBar from "@/components/browse/BrowsePresetsBar";
import SaveToProjectModal from "@/components/browse/SaveToProjectModal";
import StartProjectModal from "@/components/browse/StartProjectModal";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { storeBrowseCompareSelection } from "@/lib/browseCompare";
import { loadBrowseHandoff, looksLikePlaceQuery } from "@/lib/browseHandoff";
import { getCurrentPosition } from "@/lib/geolocation";
import { getPropertyByAddress } from "@/core/propertyService";
import SharePropertyButton from "@/components/SharePropertyButton";

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
      background:${selected ? "#047857" : "#0f172a"};
      color:#fff;
      font:700 11px/1 system-ui,sans-serif;
      padding:6px 8px;
      border-radius:999px;
      box-shadow:0 2px 8px rgba(0,0,0,.28);
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

function FitBoundsToRing({ ring, token }) {
  const map = useMap();
  useEffect(() => {
    if (!ring || ring.length < 3 || !token) return;
    const bounds = L.latLngBounds(ring.map(([lat, lng]) => [lat, lng]));
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14, animate: true });
  }, [ring, token, map]);
  return null;
}

function highlightIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:#10b981;border:3px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
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

const FREEHAND_SAMPLE_PX = 6;
const FREEHAND_MIN_POINTS = 8;
const FREEHAND_MIN_SPAN_PX = 48;

function freehandTooSmall(points, map) {
  if (!points || points.length < FREEHAND_MIN_POINTS) return true;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lat, lng] of points) {
    const p = map.latLngToContainerPoint(L.latLng(lat, lng));
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return Math.hypot(maxX - minX, maxY - minY) < FREEHAND_MIN_SPAN_PX;
}

/** Freehand drag/touch stroke → closed polygon ring. */
function DrawInteraction({
  active,
  draftPoints,
  resetKey,
  onPointsChange,
  onStrokeComplete,
  onStrokeReject,
}) {
  const map = useMap();
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);
  const lastPxRef = useRef(null);
  const activeRef = useRef(active);
  const onPointsChangeRef = useRef(onPointsChange);
  const onStrokeCompleteRef = useRef(onStrokeComplete);
  const onStrokeRejectRef = useRef(onStrokeReject);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onPointsChangeRef.current = onPointsChange;
  }, [onPointsChange]);
  useEffect(() => {
    onStrokeCompleteRef.current = onStrokeComplete;
  }, [onStrokeComplete]);
  useEffect(() => {
    onStrokeRejectRef.current = onStrokeReject;
  }, [onStrokeReject]);

  useEffect(() => {
    drawingRef.current = false;
    pointsRef.current = [];
    lastPxRef.current = null;
  }, [active, resetKey]);

  useEffect(() => {
    if (!active) return undefined;

    const prevent = (e) => {
      const oe = e?.originalEvent;
      if (oe) {
        L.DomEvent.preventDefault(oe);
        L.DomEvent.stopPropagation(oe);
      }
    };

    const appendSample = (latlng) => {
      const pt = [latlng.lat, latlng.lng];
      const px = map.latLngToContainerPoint(latlng);
      if (lastPxRef.current) {
        const dx = px.x - lastPxRef.current.x;
        const dy = px.y - lastPxRef.current.y;
        if (dx * dx + dy * dy < FREEHAND_SAMPLE_PX * FREEHAND_SAMPLE_PX) return;
      }
      lastPxRef.current = px;
      pointsRef.current = [...pointsRef.current, pt];
      onPointsChangeRef.current?.(pointsRef.current);
    };

    const onDown = (e) => {
      if (!activeRef.current) return;
      if (e.originalEvent?.button != null && e.originalEvent.button !== 0) return;
      prevent(e);
      drawingRef.current = true;
      pointsRef.current = [];
      lastPxRef.current = null;
      appendSample(e.latlng);
    };

    const onMove = (e) => {
      if (!drawingRef.current) return;
      prevent(e);
      appendSample(e.latlng);
    };

    const finishStroke = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const pts = pointsRef.current;
      if (freehandTooSmall(pts, map)) {
        pointsRef.current = [];
        lastPxRef.current = null;
        onPointsChangeRef.current?.([]);
        onStrokeRejectRef.current?.();
        return;
      }
      onStrokeCompleteRef.current?.(pts);
      pointsRef.current = [];
      lastPxRef.current = null;
    };

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", finishStroke);
    map.on("mouseleave", finishStroke);
    document.addEventListener("mouseup", finishStroke);
    document.addEventListener("touchend", finishStroke);

    return () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", finishStroke);
      map.off("mouseleave", finishStroke);
      document.removeEventListener("mouseup", finishStroke);
      document.removeEventListener("touchend", finishStroke);
      drawingRef.current = false;
    };
  }, [active, map]);

  if (!active || draftPoints.length === 0) return null;
  const closed =
    draftPoints.length > 2 ? [...draftPoints, draftPoints[0]] : draftPoints;
  return (
    <Polyline
      positions={closed}
      pathOptions={{ color: "#047857", weight: 2.5, dashArray: "6 6" }}
    />
  );
}

function DrawModeMapBehavior({ active }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    if (active) {
      map.doubleClickZoom.disable();
      map.dragging.disable();
      map.boxZoom.disable();
      el.style.cursor = "crosshair";
      el.style.touchAction = "none";
    } else {
      map.doubleClickZoom.enable();
      map.dragging.enable();
      map.boxZoom.enable();
      el.style.cursor = "";
      el.style.touchAction = "";
    }
    return () => {
      map.doubleClickZoom.enable();
      map.dragging.enable();
      map.boxZoom.enable();
      el.style.cursor = "";
      el.style.touchAction = "";
    };
  }, [active, map]);
  return null;
}

export default function BrowseProperties() {
  const { isAuthenticated } = useAuth();
  const { maxCompareCount, isPremium } = usePlan();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState("for_sale");
  const [view, setView] = useState("split");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [scoreMeta, setScoreMeta] = useState(null);
  const [placeQuery, setPlaceQuery] = useState("");
  /** Skip autocomplete when query was set by GPS / programmatic focus. */
  const [suppressSuggestQuery, setSuppressSuggestQuery] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(5);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [flyToken, setFlyToken] = useState(0);
  const [fitToken, setFitToken] = useState(0);
  const [properties, setProperties] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [compareIds, setCompareIds] = useState(() => new Set());
  const [startProjectOpen, setStartProjectOpen] = useState(false);
  const [saveProjectOpen, setSaveProjectOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [drawResetKey, setDrawResetKey] = useState(0);
  const [polygon, setPolygon] = useState(null); // closed ring [[lat,lng],...]
  const [areaLabel, setAreaLabel] = useState("");
  const [highlight, setHighlight] = useState(null); // { lat, lng, address }
  const debounceRef = useRef(null);
  const skipNextMoveFetch = useRef(false);
  const listRef = useRef(null);
  const polygonRef = useRef(null);
  const handoffDone = useRef(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const skipNextFilterFetch = useRef(true);

  const requireAuth = (message) => {
    const redirect = encodeURIComponent(
      `${window.location.pathname}${window.location.search || ""}`
    );
    toast({
      title: "Sign in required",
      description: message,
    });
    navigate(`/login?redirect=${redirect}`);
  };

  const propertyKey = (p) => p.id || p.formatted_address || `${p.lat},${p.lng},${p.address}`;

  const selectedProperties = useMemo(
    () => (properties || []).filter((p) => compareIds.has(propertyKey(p))),
    [properties, compareIds]
  );

  const toggleCompare = (p) => {
    if (!isAuthenticated) {
      requireAuth("Sign in or create an account to compare properties.");
      return;
    }
    const key = propertyKey(p);
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      if (next.size >= maxCompareCount) {
        toast({
          title: "Compare limit reached",
          description: isPremium
            ? `You can compare up to ${maxCompareCount} properties.`
            : `Free plan: compare up to ${maxCompareCount}. Upgrade to compare up to 4.`,
        });
        return prev;
      }
      next.add(key);
      return next;
    });
  };

  const runCompare = async () => {
    if (!isAuthenticated) {
      requireAuth("Sign in or create an account to compare properties.");
      return;
    }
    if (selectedProperties.length < 1) {
      toast({ title: "Select properties", description: "Check one or more listings in the list first." });
      return;
    }
    if (selectedProperties.length > maxCompareCount) {
      toast({
        title: "Too many selected",
        description: `Your plan allows up to ${maxCompareCount} in a compare session.`,
      });
      return;
    }
    try {
      await api.projects.validateCompare(selectedProperties.length);
    } catch (e) {
      toast({ title: "Compare limit", description: e?.message || "Plan limit exceeded." });
      return;
    }
    storeBrowseCompareSelection(selectedProperties);
    setCompareIds(new Set());
    navigate(createPageUrl("Compare"));
  };

  const runStartProject = () => {
    if (!isAuthenticated) {
      requireAuth("Sign in or create an account to start a project.");
      return;
    }
    setStartProjectOpen(true);
  };

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
    if (!bootstrapped) return;
    if (skipNextFilterFetch.current) {
      skipNextFilterFetch.current = false;
      return;
    }
    const ring = polygonRef.current;
    if (ring?.length >= 3) {
      const cover = polygonCoverCircle(ring);
      if (cover) {
        fetchBrowse({ lat: cover.lat, lng: cover.lng, radius: cover.radius, polygon: ring });
        return;
      }
    }
    fetchBrowse({ polygon: null });
  }, [mode, filters, bootstrapped]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyDrawnRing = useCallback(
    (ring) => {
      if (!ring || ring.length < FREEHAND_MIN_POINTS) {
        setError("Drag a larger area to search — tiny strokes are ignored.");
        setDraftPoints([]);
        return;
      }
      setPolygon(ring);
      setAreaLabel("");
      setDraftPoints([]);
      setDrawMode(false);
      setError("");
      const cover = polygonCoverCircle(ring);
      if (cover) {
        setCenter({ lat: cover.lat, lng: cover.lng });
        setRadius(cover.radius);
        skipNextMoveFetch.current = true;
        fetchBrowse({ lat: cover.lat, lng: cover.lng, radius: cover.radius, polygon: ring });
      }
    },
    [fetchBrowse]
  );

  /** Place boundary / handoff ring — no freehand min-point requirement. */
  const applyBoundaryRing = useCallback(
    (ring, label = "") => {
      if (!ring || ring.length < 3) return false;
      setPolygon(ring);
      setAreaLabel(label || "");
      setDraftPoints([]);
      setDrawMode(false);
      setHighlight(null);
      setError("");
      const cover = polygonCoverCircle(ring);
      if (cover) {
        setCenter({ lat: cover.lat, lng: cover.lng });
        setRadius(cover.radius);
        skipNextMoveFetch.current = true;
        setFitToken((t) => t + 1);
        fetchBrowse({ lat: cover.lat, lng: cover.lng, radius: cover.radius, polygon: ring });
      }
      return true;
    },
    [fetchBrowse]
  );

  const rejectStroke = useCallback(() => {
    setDraftPoints([]);
    setError("Drag a larger area to search — tiny strokes are ignored.");
  }, []);

  const clearDrawnArea = () => {
    setPolygon(null);
    setAreaLabel("");
    setDraftPoints([]);
    setDrawMode(false);
    fetchBrowse({ polygon: null });
  };

  const startDraw = () => {
    setDrawMode(true);
    setDraftPoints([]);
    setDrawResetKey((k) => k + 1);
    setPolygon(null);
    setAreaLabel("");
    setError("");
  };

  const clearHandoffParams = useCallback(() => {
    const keys = ["lat", "lng", "zoom", "highlightAddress", "area", "q"];
    if (!keys.some((k) => searchParams.has(k))) return;
    const next = new URLSearchParams(searchParams);
    keys.forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Home / header search handoff: property focus or place boundary.
  useEffect(() => {
    if (handoffDone.current) return;
    handoffDone.current = true;

    const handoff = loadBrowseHandoff({ consume: true });
    const latParam = Number(searchParams.get("lat"));
    const lngParam = Number(searchParams.get("lng"));
    const zoomParam = Number(searchParams.get("zoom"));
    const highlightAddress = (searchParams.get("highlightAddress") || "").trim();
    const wantsArea = searchParams.get("area") === "1";
    const qParam = (searchParams.get("q") || "").trim();

    const focusProperty = (lat, lng, address, z = 16) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      const zoomLevel = Number.isFinite(z) && z > 0 ? z : 16;
      // Wider radius for “current location” / area zooms; tighter for a single home pin.
      const browseRadius = zoomLevel <= 15 ? 4 : 2.5;
      if (address) setHighlight({ lat, lng, address });
      else setHighlight(null);
      setPolygon(null);
      setAreaLabel("");
      setDrawMode(false);
      skipNextMoveFetch.current = true;
      setCenter({ lat, lng });
      setZoom(zoomLevel);
      setRadius(browseRadius);
      setFlyToken((t) => t + 1);
      fetchBrowse({ lat, lng, radius: browseRadius, polygon: null });
      return true;
    };

    (async () => {
      try {
        if (handoff?.type === "boundary" && Array.isArray(handoff.ring) && handoff.ring.length >= 3) {
          if (handoff.label) setPlaceQuery(handoff.label.split(",")[0] || handoff.label);
          applyBoundaryRing(handoff.ring, handoff.label || "");
          clearHandoffParams();
          return;
        }

        if (handoff?.type === "property") {
          const lat = Number(handoff.lat);
          const lng = Number(handoff.lng);
          if (focusProperty(lat, lng, handoff.address, handoff.zoom)) {
            clearHandoffParams();
            return;
          }
        }

        if (Number.isFinite(latParam) && Number.isFinite(lngParam)) {
          focusProperty(
            latParam,
            lngParam,
            highlightAddress || handoff?.address || "",
            Number.isFinite(zoomParam) ? zoomParam : 16
          );
          clearHandoffParams();
          return;
        }

        if (wantsArea || qParam) {
          const query = qParam || placeQuery;
          if (query && api.geo?.boundary) {
            setLoading(true);
            try {
              const boundary = await api.geo.boundary(query);
              if (boundary?.ring?.length >= 3) {
                setPlaceQuery(boundary.label?.split(",")[0] || query);
                applyBoundaryRing(boundary.ring, boundary.label || query);
              } else if (Number.isFinite(boundary?.lat) && Number.isFinite(boundary?.lng)) {
                skipNextMoveFetch.current = true;
                setCenter({ lat: boundary.lat, lng: boundary.lng });
                setZoom(12);
                setFlyToken((t) => t + 1);
                setRadius(6);
                await fetchBrowse({
                  lat: boundary.lat,
                  lng: boundary.lng,
                  radius: 6,
                  polygon: null,
                });
              } else {
                setError("Could not find that place.");
                await fetchBrowse({ polygon: null });
              }
            } catch (err) {
              setError(err?.message || "Place search failed.");
              await fetchBrowse({ polygon: null });
            } finally {
              setLoading(false);
            }
            clearHandoffParams();
            return;
          }
        }

        // Default map load
        await fetchBrowse({ polygon: null });
        clearHandoffParams();
      } finally {
        setBootstrapped(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusMapOnCoords = useCallback(
    (lat, lng, address, zoomLevel = 16, browseRadius = 2.5) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (address) setHighlight({ lat, lng, address });
      else setHighlight(null);
      setPolygon(null);
      setAreaLabel("");
      setDrawMode(false);
      setDraftPoints([]);
      skipNextMoveFetch.current = true;
      setCenter({ lat, lng });
      setZoom(zoomLevel);
      setRadius(browseRadius);
      setFlyToken((t) => t + 1);
      fetchBrowse({ lat, lng, radius: browseRadius, polygon: null });
      return true;
    },
    [fetchBrowse]
  );

  const runPlaceSearch = async (e, queryOverride) => {
    e?.preventDefault?.();
    const q = (queryOverride ?? placeQuery).trim();
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      if (!api.geo?.boundary) {
        setError("Place search is unavailable.");
        return;
      }
      const boundary = await api.geo.boundary(q);
      if (boundary?.ring?.length >= 3) {
        const label = boundary.label || q;
        setPlaceQuery(label.split(",")[0] || label);
        setSuppressSuggestQuery(label.split(",")[0] || label);
        applyBoundaryRing(boundary.ring, label);
        return;
      }
      if (Number.isFinite(boundary?.lat) && Number.isFinite(boundary?.lng)) {
        setPolygon(null);
        setAreaLabel("");
        setDraftPoints([]);
        setDrawMode(false);
        setHighlight(null);
        setPlaceQuery(boundary.label?.split(",")[0] || q);
        setSuppressSuggestQuery(boundary.label?.split(",")[0] || q);
        skipNextMoveFetch.current = true;
        setCenter({ lat: boundary.lat, lng: boundary.lng });
        setZoom(12);
        setFlyToken((t) => t + 1);
        setRadius(6);
        await fetchBrowse({ lat: boundary.lat, lng: boundary.lng, radius: 6, polygon: null });
        return;
      }
      setError("Could not find that place. Try a city and state (e.g. Austin, TX).");
    } catch (err) {
      setError(err?.message || "Place search failed.");
    } finally {
      setLoading(false);
    }
  };

  const focusOnPropertyAddress = async (address) => {
    const q = (address || "").trim();
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const data = await getPropertyByAddress(q);
      const lat = Number(data?.lat);
      const lng = Number(data?.lng);
      const label =
        data?.formatted_address ||
        [data?.address, data?.city, data?.state, data?.zip].filter(Boolean).join(", ") ||
        q;
      setPlaceQuery(label);
      setSuppressSuggestQuery(label);
      if (!focusMapOnCoords(lat, lng, label, 16, 2.5)) {
        // Property found but no coords — fall back to place boundary.
        await runPlaceSearch(null, q);
      }
    } catch (err) {
      if (looksLikePlaceQuery(q)) {
        setLoading(false);
        await runPlaceSearch(null, q);
        return;
      }
      setError(err?.message || "Could not find that address.");
    } finally {
      setLoading(false);
    }
  };

  const submitBrowseSearch = async (e) => {
    e?.preventDefault?.();
    const q = placeQuery.trim();
    if (!q) return;
    if (looksLikePlaceQuery(q)) {
      await runPlaceSearch(null, q);
      return;
    }
    await focusOnPropertyAddress(q);
  };

  const onBrowseSuggestion = async (address, suggestion) => {
    const q = (address || "").trim();
    if (!q) return;
    setPlaceQuery(q);
    setSuppressSuggestQuery(q);
    const kind = suggestion?.kind;
    if (kind === "place" || (kind !== "property" && looksLikePlaceQuery(q))) {
      await runPlaceSearch(null, q);
      return;
    }
    await focusOnPropertyAddress(q);
  };

  const useCurrentLocation = async () => {
    if (locating || loading) return;
    setError("");
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      setPolygon(null);
      setAreaLabel("");
      setDraftPoints([]);
      setDrawMode(false);
      setHighlight({ lat, lng, address: "Current location" });
      setPlaceQuery("Current location");
      setSuppressSuggestQuery("Current location");
      skipNextMoveFetch.current = true;
      setCenter({ lat, lng });
      setZoom(14);
      setRadius(4);
      setFlyToken((t) => t + 1);
      setView("map");
      await fetchBrowse({ lat, lng, radius: 4, polygon: null });
    } catch (err) {
      const message = err?.message || "Could not get your location.";
      setError(message);
      toast({
        title: "Location unavailable",
        description: message,
      });
    } finally {
      setLocating(false);
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
          <form onSubmit={submitBrowseSearch} className="flex-1 flex gap-2 min-w-0">
            <AddressAutocompleteInput
              value={placeQuery}
              onChange={(next) => {
                setSuppressSuggestQuery("");
                setPlaceQuery(next);
              }}
              onSelect={onBrowseSuggestion}
              suppressQuery={suppressSuggestQuery}
              placeholder="City, neighborhood, ZIP, or address…"
              ariaLabel="Search city, neighborhood, ZIP, or address"
              icon="search"
              showKindBadge
              inputClassName="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#10b981]"
            />
            <button
              type="submit"
              disabled={loading || locating}
              className="px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-sm font-bold shrink-0 disabled:opacity-60"
            >
              Search
            </button>
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating || loading}
              title="Use current location to search nearby homes (only when you tap)"
              aria-label="Use current location to search nearby homes"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shrink-0 disabled:opacity-60"
            >
              {locating ? (
                <Loader2 size={14} className="animate-spin text-[#10b981]" />
              ) : (
                <LocateFixed size={14} className="text-[#10b981]" />
              )}
              <span className="hidden sm:inline">{locating ? "Locating…" : "My location"}</span>
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
                  onClick={() => {
                    setDraftPoints([]);
                    setDrawResetKey((k) => k + 1);
                    setError("");
                  }}
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
                    setDrawResetKey((k) => k + 1);
                    setError("");
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

            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
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
                className={`px-2.5 py-1.5 rounded-lg ${view === "split" ? "bg-white shadow" : ""}`}
                aria-label="Split view"
              >
                <Filter size={14} />
              </button>
            </div>
          </div>
        </div>
        {drawMode && (
          <p className="max-w-[1600px] mx-auto mt-2 text-[11px] text-slate-500 font-medium">
            Drag on the map to draw a search area. Release to close the shape — filters apply only
            inside it.
          </p>
        )}
        {polygon && !drawMode && (
          <p className="max-w-[1600px] mx-auto mt-2 text-[11px] text-[#059669] font-semibold">
            {areaLabel
              ? `Area: ${areaLabel.split(",").slice(0, 3).join(",")} — filters apply inside this boundary. Clear area to browse the full map.`
              : "Custom search area active — pan is locked to this shape. Clear area to browse the full map again."}
          </p>
        )}
        {highlight?.address && !polygon && (
          <p className="max-w-[1600px] mx-auto mt-2 text-[11px] text-[#059669] font-semibold">
            Focused on {highlight.address}
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
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <MapController center={center} zoom={zoom} flyToken={flyToken} />
              <FitBoundsToRing ring={polygon} token={fitToken} />
              <MapMoveWatcher onMoveEnd={onMapMoveEnd} enabled={!drawMode && !polygon} />
              <DrawModeMapBehavior active={drawMode} />
              <DrawInteraction
                active={drawMode}
                draftPoints={draftPoints}
                resetKey={drawResetKey}
                onPointsChange={setDraftPoints}
                onStrokeComplete={applyDrawnRing}
                onStrokeReject={rejectStroke}
              />
              {polygon && (
                <Polygon
                  positions={polygon}
                  pathOptions={{
                    color: "#047857",
                    weight: 2,
                    fillColor: "#059669",
                    fillOpacity: 0.14,
                  }}
                />
              )}
              {highlight &&
                Number.isFinite(highlight.lat) &&
                Number.isFinite(highlight.lng) && (
                  <Marker
                    position={[highlight.lat, highlight.lng]}
                    icon={highlightIcon()}
                    zIndexOffset={1000}
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
            <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10 space-y-3">
              <div>
                <h1 className="text-lg font-bold text-[#1a2234]">
                  {mode === "for_sale" ? "Homes for sale" : "Off-market estimates"}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Results sync with map markers
                  {polygon ? " inside the active area" : ""}. Select homes to compare or start a
                  project.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runCompare}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a2234] hover:bg-[#243050] text-white text-xs font-bold"
                >
                  <Columns size={14} />
                  Compare properties
                  {compareIds.size > 0 ? ` (${compareIds.size})` : ""}
                </button>
                <button
                  type="button"
                  onClick={runStartProject}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <FolderKanban size={14} />
                  Start project
                </button>
                {compareIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthenticated) {
                        requireAuth("Sign in to save properties to a project.");
                        return;
                      }
                      setSaveProjectOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#10b981]/40 bg-[#10b981]/10 text-xs font-bold text-[#059669]"
                  >
                    Save selected ({compareIds.size})
                  </button>
                )}
              </div>
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
                  const key = propertyKey(p);
                  const selected = selectedId === p.id;
                  const checked = compareIds.has(key);
                  const atLimit = !checked && compareIds.size >= maxCompareCount;
                  return (
                    <li
                      key={key}
                      id={`browse-card-${p.id}`}
                      className={`p-4 hover:bg-slate-50 transition relative ${selected ? "bg-emerald-50/60" : ""}`}
                      onMouseEnter={() => setSelectedId(p.id)}
                    >
                      <label
                        className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer ${
                          checked
                            ? "bg-[#10b981] border-[#10b981] text-white"
                            : atLimit
                              ? "border-slate-200 bg-slate-100 cursor-not-allowed opacity-60"
                              : "border-slate-300 bg-white hover:border-[#10b981]"
                        }`}
                        title={
                          atLimit
                            ? `Compare limit: ${maxCompareCount} on your plan`
                            : "Select for compare"
                        }
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={atLimit && !checked}
                          onChange={() => toggleCompare(p)}
                        />
                        {checked ? (
                          <span className="text-[11px] font-bold leading-none">✓</span>
                        ) : null}
                      </label>
                      <div className="flex gap-3 pr-8">
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
                              className="inline-flex items-center px-3 py-1.5 min-h-9 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold"
                            >
                              Score this home
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                storeBrowseCompareSelection([p]);
                                navigate(createPageUrl("Compare"));
                              }}
                              className="inline-flex items-center px-3 py-1.5 min-h-9 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-white"
                            >
                              Compare
                            </button>
                            <SharePropertyButton property={p} variant="compact" stopPropagation />
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

      <StartProjectModal
        open={startProjectOpen}
        onClose={() => setStartProjectOpen(false)}
        seedProperties={selectedProperties}
      />
      <SaveToProjectModal
        open={saveProjectOpen}
        onClose={() => setSaveProjectOpen(false)}
        properties={selectedProperties}
        onSaved={(projectId) => {
          toast({
            title: "Saved to project",
            description: "Open Project detail from the toast link or Projects nav.",
          });
          navigate(`${createPageUrl("ProjectDetail")}?id=${encodeURIComponent(projectId)}`);
          setCompareIds(new Set());
        }}
      />
    </div>
  );
}
