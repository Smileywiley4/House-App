import { ExternalLink } from 'lucide-react';
import PropertyMapEmbed from '@/components/PropertyMapEmbed';

function buildQuery(property) {
  return [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ');
}

function googleMapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Wrapper around PropertyMapEmbed — accepts a property object + optional "Open in Google Maps" chip. */
export default function PropertyLocationMap({ property, className = 'h-56' }) {
  const query = buildQuery(property);
  const mapsUrl = googleMapsSearchUrl(query);

  return (
    <div className={`relative ${className} overflow-hidden`}>
      <PropertyMapEmbed
        address={property.address}
        city={property.city}
        state={property.state}
        zip={property.zip}
        lat={property.lat}
        lng={property.lng}
        className="h-full w-full"
      />
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 z-[500] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-xs font-semibold text-[#1a2234] shadow-md hover:bg-white transition-colors"
      >
        Google Maps
        <ExternalLink size={12} aria-hidden />
      </a>
    </div>
  );
}
