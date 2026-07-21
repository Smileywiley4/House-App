import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Camera,
  CircleDollarSign,
  Home,
  ImageOff,
  MapPin,
  Ruler,
} from "lucide-react";
import { createPageUrl } from "@/utils";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function money(value) {
  return value == null ? null : `$${Number(value).toLocaleString()}`;
}

function number(value) {
  return value == null ? null : Number(value).toLocaleString();
}

function date(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function labelize(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export default function PropertyOverview({ property }) {
  const [imageFailed, setImageFailed] = useState(false);
  const streetViewUrl =
    apiBaseUrl && property.lat != null && property.lng != null
      ? `${apiBaseUrl}/api/property/street-view?lat=${encodeURIComponent(property.lat)}&lng=${encodeURIComponent(property.lng)}`
      : null;

  const facts = [
    { label: "Property type", value: property.property_type, icon: Home },
    { label: "Bedrooms", value: property.beds ?? property.bedrooms, icon: BedDouble },
    { label: "Bathrooms", value: property.baths ?? property.bathrooms, icon: Bath },
    { label: "Living area", value: property.sqft != null ? `${number(property.sqft)} sq ft` : null, icon: Ruler },
    { label: "Lot size", value: property.lot_size != null ? `${number(property.lot_size)} sq ft` : null, icon: MapPin },
    { label: "Year built", value: property.year ?? property.year_built, icon: CalendarDays },
    { label: "Annual taxes", value: money(property.annual_taxes), icon: CircleDollarSign },
    { label: "Tax assessment", value: money(property.tax_assessment), icon: CircleDollarSign },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  const features = Object.entries(property.features || {}).filter(([, value]) => value !== false && value != null);
  const history = useMemo(() => {
    const rows = [...(property.listing_history || []), ...(property.sale_history || [])];
    const seen = new Set();
    return rows.filter((row) => {
      const key = `${row.date}-${row.event}-${row.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 6);
  }, [property.listing_history, property.sale_history]);

  return (
    <section className="max-w-4xl mx-auto px-6 pt-6 space-y-5" aria-label="Property details">
      <div className="relative min-h-64 md:min-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        {streetViewUrl && !imageFailed ? (
          <img
            src={streetViewUrl}
            alt={`Street View near ${property.formatted_address || property.address}`}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <ImageOff size={32} />
            <p className="text-sm font-medium">Exterior imagery is unavailable</p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-slate-950/80 to-transparent px-5 pb-4 pt-16 text-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {property.listing_status && (
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-900">
                  {property.listing_status}
                </span>
              )}
              {property.days_on_market != null && (
                <span className="text-xs text-white/80">{property.days_on_market} days on market</span>
              )}
            </div>
          </div>
          {!imageFailed && streetViewUrl && <span className="text-xs text-white/75">Google Street View</span>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          {facts.length > 0 && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
              {facts.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <Icon size={16} className="mb-2 text-brand" aria-hidden />
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          )}

          {(features.length > 0 || property.hoa_fee != null) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Property features</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {property.hoa_fee != null && (
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    HOA {money(property.hoa_fee)}/mo
                  </span>
                )}
                {features.slice(0, 10).map(([key, value]) => (
                  <span key={key} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    {labelize(key)}{value === true ? "" : `: ${value}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Price and sale history</h2>
              <div className="mt-3 divide-y divide-slate-100">
                {history.map((row, index) => (
                  <div key={`${row.date}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-slate-800">{row.event || "Property event"}</div>
                      <div className="text-xs text-slate-500">{date(row.date)}</div>
                    </div>
                    {row.price != null && <div className="font-semibold text-slate-900">{money(row.price)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Photos from your visit</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Save private walkthrough photos and share them with your realtor from Property Visits.
            </p>
            <Link
              to={`${createPageUrl("PropertyVisits")}?address=${encodeURIComponent(
                property.formatted_address || [property.address, property.city, property.state].filter(Boolean).join(", "),
              )}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-hover px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              <Camera size={16} /> Manage visit photos
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-500">
            {property.data_sources?.length > 0 && (
              <p><span className="font-semibold text-slate-700">Sources:</span> {property.data_sources.join(", ")}</p>
            )}
            {property.data_updated_at && <p>Listing data checked {date(property.data_updated_at)}.</p>}
            {property.mls_name && (
              <p>{property.mls_name}{property.mls_number ? ` #${property.mls_number}` : ""}</p>
            )}
            <p className="mt-2">Verify price, taxes, dimensions, and availability with the listing agent or public records before making a decision.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
