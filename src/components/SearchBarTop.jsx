import PropertyAddressSearchForm from "@/components/PropertyAddressSearchForm";

/**
 * Sticky header search (hidden on Home — hero search lives there instead).
 */
export default function SearchBarTop() {
  return (
    <div className="w-full max-w-sm sm:max-w-2xl mx-auto">
      <PropertyAddressSearchForm variant="header" />
    </div>
  );
}
