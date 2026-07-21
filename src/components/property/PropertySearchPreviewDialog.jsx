import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bath,
  BedDouble,
  CalendarDays,
  CircleDollarSign,
  Columns3,
  Home,
  Map as MapIcon,
  MapPin,
  Ruler,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import PropertyLocationMap from "@/components/PropertyLocationMap";
import { saveCurrentProperty } from "@/core/currentProperty";
import { createPageUrl } from "@/utils";
import { storeBrowseCompareSelection } from "@/lib/browseCompare";
import { browsePropertyUrl, storePropertyHandoff } from "@/lib/browseHandoff";
import SharePropertyButton from "@/components/SharePropertyButton";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function money(value) {
  return value == null ? null : `$${Number(value).toLocaleString()}`;
}

function number(value) {
  return value == null ? null : Number(value).toLocaleString();
}

function formatDate(value) {
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

function evaluationUrl(property) {
  const params = new URLSearchParams();
  params.set("address", property.address || property.formatted_address || "");
  if (property.city) params.set("city", property.city);
  if (property.state) params.set("state", property.state);
  if (property.price != null) params.set("price", property.price);
  if (property.bedrooms != null) params.set("beds", property.bedrooms);
  if (property.bathrooms != null) params.set("baths", property.bathrooms);
  if (property.sqft != null) params.set("sqft", property.sqft);
  if (property.year_built != null) params.set("year", property.year_built);
  if (property.lat != null) params.set("lat", property.lat);
  if (property.lng != null) params.set("lng", property.lng);
  return `${createPageUrl("Evaluate")}?${params.toString()}`;
}

export default function PropertySearchPreviewDialog({ property, open, onOpenChange }) {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);

  const history = useMemo(() => {
    if (!property) return [];
    const rows = [...(property.listing_history || []), ...(property.sale_history || [])];
    const seen = new Set();
    return rows
      .filter((row) => {
        const key = `${row.date}-${row.event}-${row.price}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 6);
  }, [property]);

  if (!property) return null;

  const streetViewUrl =
    apiBaseUrl && property.lat != null && property.lng != null
      ? `${apiBaseUrl}/api/property/street-view?lat=${encodeURIComponent(property.lat)}&lng=${encodeURIComponent(property.lng)}`
      : null;
  const status = property.listing_status || (property.on_market ? "Active" : "Off market");
  const primaryPrice = property.price;
  const priceLabel = property.price_label
    || (property.list_price != null
      ? "Current listing price"
      : property.last_list_price != null
        ? "Last listed price"
        : property.estimated_value != null
          ? "Estimated value"
          : property.last_sale_price != null
            ? "Last recorded sale"
            : null);
  const displayPrice = primaryPrice ?? property.last_list_price ?? property.estimated_value ?? property.last_sale_price;

  const facts = [
    { label: "Property type", value: property.property_type, icon: Home },
    { label: "Year built", value: property.year_built, icon: CalendarDays },
    { label: "Lot size", value: property.lot_size != null ? `${number(property.lot_size)} sq ft` : null, icon: MapPin },
    { label: "County", value: property.county ? `${property.county} County` : null, icon: MapPin },
    { label: "Annual taxes", value: money(property.annual_taxes), icon: CircleDollarSign },
    { label: "Tax assessment", value: money(property.tax_assessment), icon: CircleDollarSign },
    { label: "HOA", value: property.hoa_fee != null ? `${money(property.hoa_fee)}/mo` : null, icon: CircleDollarSign },
    { label: "Days on market", value: property.days_on_market, icon: CalendarDays },
    { label: "Listed", value: formatDate(property.listed_date), icon: CalendarDays },
    { label: "MLS", value: property.mls_name ? `${property.mls_name}${property.mls_number ? ` #${property.mls_number}` : ""}` : null, icon: Home },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

  const features = Object.entries(property.features || {}).filter(([, value]) => value !== false && value != null);

  const nearby = [
    property.nearby_schools && { label: "Schools", value: property.nearby_schools },
    property.nearby_hospitals && { label: "Hospitals", value: property.nearby_hospitals },
    property.nearby_highways && { label: "Highways", value: property.nearby_highways },
  ].filter(Boolean);

  const scoreProperty = () => {
    saveCurrentProperty(property);
    onOpenChange(false);
    navigate(evaluationUrl(property));
  };

  const viewOnMap = () => {
    saveCurrentProperty(property);
    storePropertyHandoff(property);
    onOpenChange(false);
    navigate(browsePropertyUrl(property));
  };

  const addToCompare = () => {
    saveCurrentProperty(property);
    storeBrowseCompareSelection([property]);
    onOpenChange(false);
    navigate(createPageUrl("Compare"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl gap-0 overflow-y-auto border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
        <DialogTitle className="sr-only">
          {property.formatted_address || property.address}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Property preview with listing facts and actions to score or compare.
        </DialogDescription>

        <div className="relative h-60 bg-slate-200 sm:h-80">
          {streetViewUrl && !imageFailed ? (
            <img
              src={streetViewUrl}
              alt={`Street view of ${property.formatted_address || property.address}`}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <PropertyLocationMap property={property} className="h-full w-full" />
          )}
          <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow">
            {status}
          </span>
          {streetViewUrl && !imageFailed && (
            <span className="absolute bottom-3 left-4 rounded-md bg-slate-950/70 px-2 py-1 text-[11px] font-medium text-white">
              Street View
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_19rem]">
          <div className="space-y-5 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  {property.property_type || "Property"}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
                  {property.address || property.formatted_address}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {[property.city, property.state, property.zip].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="sm:text-right">
                {displayPrice != null ? (
                  <>
                    <div className="text-3xl font-black text-slate-950">{money(displayPrice)}</div>
                    <div className="text-xs text-slate-500">{priceLabel || "Price"}</div>
                    {property.estimated_value != null && property.price == null && property.last_list_price == null && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        Range {money(property.estimated_value_low)} – {money(property.estimated_value_high)}
                      </div>
                    )}
                    {property.last_sale_price != null && displayPrice !== property.last_sale_price && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        Last sale {money(property.last_sale_price)}
                        {property.last_sale_date ? ` · ${formatDate(property.last_sale_date)}` : ""}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm font-semibold text-slate-500">No price on record</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 py-4">
              {[
                { icon: BedDouble, value: property.bedrooms, label: "beds" },
                { icon: Bath, value: property.bathrooms, label: "baths" },
                { icon: Ruler, value: property.sqft ? number(property.sqft) : null, label: "sq ft" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <Icon className="mx-auto mb-1 text-emerald-600" size={18} />
                  <div className="text-lg font-bold text-slate-950">{value ?? "—"}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {property.description && (
              <p className="text-sm leading-6 text-slate-600">{property.description}</p>
            )}

            {facts.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
                    <Icon size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                      <span className="font-medium text-slate-800">{value}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {features.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {features.slice(0, 14).map(([key, value]) => (
                    <span key={key} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {labelize(key)}{value === true ? "" : `: ${value}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Price and sale history</h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {history.map((row, index) => (
                    <div key={`${row.date}-${index}`} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                      <div>
                        <div className="font-medium text-slate-800">{row.event || "Property event"}</div>
                        <div className="text-xs text-slate-500">{formatDate(row.date)}</div>
                      </div>
                      {row.price != null && <div className="font-semibold text-slate-900">{money(row.price)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nearby.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Nearby</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  {nearby.map((item) => (
                    <p key={item.label}>
                      <span className="font-semibold text-slate-800">{item.label}: </span>
                      {item.value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {property.listing_agent?.name && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <UserRound size={16} className="mt-0.5 text-emerald-600" />
                <div>
                  <div className="font-semibold text-slate-900">{property.listing_agent.name}</div>
                  {property.listing_agent.office && (
                    <div className="text-xs text-slate-500">{property.listing_agent.office}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <h3 className="text-lg font-bold text-slate-950">What would you like to do?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Score this home in detail, or make it Property 1 and search for another home side by side.
            </p>
            <button
              type="button"
              onClick={scoreProperty}
              className="mt-5 flex w-full items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Score This Property <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={viewOnMap}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              <MapIcon size={17} /> View on map
            </button>
            <button
              type="button"
              onClick={addToCompare}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
            >
              <Columns3 size={17} /> Add to Compare
            </button>
            <SharePropertyButton property={property} variant="sidebar" />

            <div className="mt-5 space-y-1.5 text-[11px] leading-5 text-slate-500">
              {property.data_sources?.length > 0 && (
                <p>
                  <span className="font-semibold text-slate-700">Sources: </span>
                  {property.data_sources.join(", ")}
                </p>
              )}
              {property.data_updated_at && <p>Data checked {formatDate(property.data_updated_at)}.</p>}
              <p>
                Property facts come from licensed records and public listing information. We do not scrape private listing
                galleries. Verify material facts with an agent or public records before deciding.
              </p>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
