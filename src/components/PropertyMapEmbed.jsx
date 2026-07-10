import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GOOGLE_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY;

function buildAddressQuery({ address, city, state, zip }) {
  return [address, city, state, zip].filter(Boolean).join(", ");
}

function googleEmbedSrc(query) {
  const params = new URLSearchParams({
    key: GOOGLE_EMBED_KEY,
    q: query,
    zoom: "15",
  });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

async function geocodeAddress(query) {
  const params = new URLSearchParams({ format: "json", limit: "1", q: query });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.[0];
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

function OsmMap({ lat, lng }) {
  const center = useMemo(() => [lat, lng], [lat, lng]);
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full z-0"
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Marker position={center} />
    </MapContainer>
  );
}

/**
 * Property location map — Google Maps Embed API when VITE_GOOGLE_MAPS_EMBED_KEY is set,
 * otherwise OpenStreetMap via Leaflet (no API key required).
 */
export default function PropertyMapEmbed({ address, city, state, zip, lat, lng, className = "h-56" }) {
  const query = buildAddressQuery({ address, city, state, zip });
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const [coords, setCoords] = useState(hasCoords ? { lat, lng } : null);
  const [loading, setLoading] = useState(!hasCoords && !GOOGLE_EMBED_KEY);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (GOOGLE_EMBED_KEY || hasCoords) {
      setCoords(hasCoords ? { lat, lng } : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    geocodeAddress(query)
      .then((result) => {
        if (cancelled) return;
        if (result) setCoords(result);
        else setError("Map unavailable for this address.");
      })
      .catch(() => {
        if (!cancelled) setError("Map unavailable for this address.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, lat, lng, hasCoords]);

  if (GOOGLE_EMBED_KEY) {
    return (
      <div className={`relative bg-slate-100 overflow-hidden ${className}`}>
        <iframe
          title="Property location map"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={googleEmbedSrc(query)}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  return (
    <div className={`relative bg-slate-100 overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
          Loading map…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-500">
          {error}
        </div>
      )}
      {coords && !loading && <OsmMap lat={coords.lat} lng={coords.lng} />}
    </div>
  );
}
