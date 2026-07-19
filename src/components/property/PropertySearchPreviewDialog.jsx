import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bath,
  BedDouble,
  CalendarDays,
  Columns3,
  Home,
  MapPin,
  Ruler,
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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function money(value) {
  return value == null ? null : `$${Number(value).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  if (!property) return null;

  const streetViewUrl =
    apiBaseUrl && property.lat != null && property.lng != null
      ? `${apiBaseUrl}/api/property/street-view?lat=${encodeURIComponent(property.lat)}&lng=${encodeURIComponent(property.lng)}`
      : null;
  const status = property.listing_status || (property.on_market ? "Active" : "Off market");
  const primaryPrice = property.price;
  const secondaryPrice = property.last_sale_price;
  const details = [
    { icon: Home, label: property.property_type },
    { icon: CalendarDays, label: property.year_built ? `Built in ${property.year_built}` : null },
    { icon: Ruler, label: property.lot_size ? `${Number(property.lot_size).toLocaleString()} sq ft lot` : null },
    { icon: MapPin, label: property.county ? `${property.county} County` : null },
  ].filter(item => item.label);

  const scoreProperty = () => {
    saveCurrentProperty(property);
    onOpenChange(false);
    navigate(evaluationUrl(property));
  };

  const addToCompare = () => {
    saveCurrentProperty(property);
    sessionStorage.setItem("compareProperty", JSON.stringify({ property }));
    onOpenChange(false);
    navigate(createPageUrl("QuickCompare"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl gap-0 overflow-y-auto border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
        <DialogTitle className="sr-only">
          {property.formatted_address || property.address}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Property preview with facts and actions to score or compare.
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
          <div className="p-5 sm:p-7">
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
                {primaryPrice != null ? (
                  <>
                    <div className="text-3xl font-black text-slate-950">{money(primaryPrice)}</div>
                    <div className="text-xs text-slate-500">Current listing price</div>
                  </>
                ) : secondaryPrice != null ? (
                  <>
                    <div className="text-2xl font-black text-slate-950">{money(secondaryPrice)}</div>
                    <div className="text-xs text-slate-500">
                      Last recorded sale{property.last_sale_date ? ` · ${formatDate(property.last_sale_date)}` : ""}
                    </div>
                  </>
                ) : (
                  <div className="text-sm font-semibold text-slate-500">No active listing price</div>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 py-4">
              {[
                { icon: BedDouble, value: property.bedrooms, label: "beds" },
                { icon: Bath, value: property.bathrooms, label: "baths" },
                { icon: Ruler, value: property.sqft ? Number(property.sqft).toLocaleString() : null, label: "sq ft" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <Icon className="mx-auto mb-1 text-emerald-600" size={18} />
                  <div className="text-lg font-bold text-slate-950">{value ?? "—"}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {details.length > 0 && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {details.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700">
                    <Icon size={15} className="text-slate-500" />
                    {label}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              {property.annual_taxes != null && <span>Annual taxes: <strong className="text-slate-700">{money(property.annual_taxes)}</strong></span>}
              {property.hoa_fee != null && <span>HOA: <strong className="text-slate-700">{money(property.hoa_fee)}/mo</strong></span>}
              {property.data_updated_at && <span>Data checked {formatDate(property.data_updated_at)}</span>}
            </div>
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
              onClick={addToCompare}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
            >
              <Columns3 size={17} /> Add to Compare
            </button>
            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              Property data may be incomplete or delayed. Verify material facts with an agent or public records.
            </p>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
