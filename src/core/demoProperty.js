/** Sample property for homepage demo — no API required. Mirrors Evaluate + Browse UI. */
export const DEMO_PROPERTY = {
  address: '1842 Maple Ridge Dr',
  city: 'Austin',
  state: 'TX',
  zip: '78704',
  price: 549000,
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1840,
  year_built: 2008,
  property_type: 'Single Family',
  on_market: true,
  listing_source: 'demo',
  lat: 30.2458,
  lng: -97.7694,
  description:
    'Example listing for demonstration. Search any real address to pull live property details.',
  /** Matches Evaluate score summary: percentage / 100 */
  demoScore: 82,
  demoScoreLabel: 'Property Score',
  demoRatedCount: 5,
  demoVisibleCount: 5,
  /**
   * Sample categories — real labels from Evaluate. Values illustrate
   * Importance (green) + Property Score (navy) dual sliders.
   */
  demoCategories: [
    { id: 'schools', label: 'Schools', importance: 9, score: 8, scoreSource: 'auto' },
    { id: 'highway_access', label: 'Highway Access', importance: 7, score: 8, scoreSource: 'manual' },
    { id: 'roof_quality', label: 'Roof Quality', importance: 8, score: 7, scoreSource: 'manual' },
  ],
  /** Extra browse-list neighbors for the map/list preview (fictional coords near demo). */
  demoBrowseNeighbors: [
    {
      address: '1901 Barton Hills Blvd',
      city: 'Austin',
      state: 'TX',
      price: 625000,
      bedrooms: 4,
      bathrooms: 3,
      sqft: 2200,
      on_market: true,
      lat: 30.2512,
      lng: -97.7768,
    },
    {
      address: '412 S Lamar Blvd',
      city: 'Austin',
      state: 'TX',
      price: 489000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1650,
      on_market: true,
      lat: 30.2555,
      lng: -97.7631,
    },
  ],
};
