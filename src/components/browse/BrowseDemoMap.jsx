import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/lib/assets/MarkerCluster.css";
import "react-leaflet-cluster/lib/assets/MarkerCluster.Default.css";
import { brand } from "@/design-tokens";

const BRAND_PIN = brand.primary;
const BRAND_PIN_SELECTED = brand.primaryHover;

/** Extra nearby dots so the demo can show a brand-green cluster (not listed in the side panel). */
const MAP_ONLY_FILLERS = [
  { lat: 30.2421, lng: -97.7602, price: 515000 },
  { lat: 30.2618, lng: -97.7715, price: 575000 },
  { lat: 30.2489, lng: -97.7812, price: 532000 },
  { lat: 30.2385, lng: -97.7688, price: 498000 },
];

function formatPrice(n) {
  if (n == null || n === "") return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${Math.round(num).toLocaleString()}`;
}

function demoPinIcon({ price, selected }) {
  const label = formatPrice(price);
  if (!selected) {
    const size = 9;
    return L.divIcon({
      className: "browse-map-pin",
      html: `<div role="img" aria-label="Property priced ${label}" style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${BRAND_PIN};
        border:2px solid #fff;
        box-shadow:0 1px 3px rgba(15,23,42,.28);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  return L.divIcon({
    className: "browse-map-pin",
    html: `<div role="img" aria-label="Property priced ${label}" style="
      background:${BRAND_PIN_SELECTED};
      color:#fff;
      font:700 10px/1 system-ui,sans-serif;
      padding:4px 7px;
      border-radius:999px;
      box-shadow:0 1px 4px rgba(15,23,42,.22);
      white-space:nowrap;
      border:1.5px solid #fff;
    ">${label}</div>`,
    iconSize: [48, 22],
    iconAnchor: [24, 22],
  });
}

function createBrowseClusterIcon(cluster) {
  const count = cluster.getChildCount();
  let size = 34;
  if (count >= 50) size = 46;
  else if (count >= 10) size = 40;
  return L.divIcon({
    html: `<div class="browse-map-cluster-inner" style="width:${size}px;height:${size}px" aria-label="${count} properties">${count}</div>`,
    className: "browse-map-cluster",
    iconSize: L.point(size, size),
  });
}

/**
 * Small live Leaflet mock for Home Browse preview — same Positron tiles,
 * brand-green pins/clusters, and thin search boundary as BrowseProperties.
 */
export default function BrowseDemoMap({ listings, className = "h-full min-h-[220px] w-full" }) {
  const markers = useMemo(() => {
    const listed = (listings || []).filter(
      (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    );
    return [...listed, ...MAP_ONLY_FILLERS];
  }, [listings]);

  const center = useMemo(() => {
    if (!markers.length) return [30.2458, -97.7694];
    const lat = markers.reduce((s, p) => s + Number(p.lat), 0) / markers.length;
    const lng = markers.reduce((s, p) => s + Number(p.lng), 0) / markers.length;
    return [lat, lng];
  }, [markers]);

  if (!markers.length) {
    return <div className={`bg-[#E8EEE9] ${className}`} aria-hidden />;
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      className={`browse-map-muted z-0 ${className}`}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      attributionControl={false}
      keyboard={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {/* Thin search-area ring — matches Browse polygon stroke weight */}
      <Circle
        center={center}
        radius={900}
        pathOptions={{
          color: BRAND_PIN_SELECTED,
          weight: 1.5,
          fillColor: BRAND_PIN,
          fillOpacity: 0.04,
          opacity: 0.9,
        }}
      />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={48}
        spiderfyOnMaxZoom={false}
        disableClusteringAtZoom={15}
        iconCreateFunction={createBrowseClusterIcon}
      >
        {markers.map((p, i) => (
          <Marker
            key={p.address || `${p.lat},${p.lng}`}
            position={[Number(p.lat), Number(p.lng)]}
            icon={demoPinIcon({ price: p.price, selected: i === 0 })}
            interactive={false}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
