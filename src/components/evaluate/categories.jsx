
export const MANDATORY_CATEGORIES = [
  { id: "hospital_distance", label: "Distance to Hospital" },
  { id: "highway_access", label: "Highway Access" },
  { id: "schools", label: "Schools" },
];

// Neighborhood categories — auto-added to score sheet
export const NEIGHBORHOOD_CATEGORIES = [
  { id: "neighborhood_safety", label: "Neighborhood Safety", neighborhood: true },
  { id: "longterm_neighborhood_value", label: "Long-Term Neighborhood Value", neighborhood: true },
  { id: "public_transportation", label: "Public Transportation Access", neighborhood: true },
  { id: "local_construction", label: "Local Construction (Disruption)", neighborhood: true },
  { id: "location_lifestyle", label: "Location for Lifestyle", neighborhood: true },
  { id: "location_investment", label: "Location for Investment", neighborhood: true },
];

export const OPTIONAL_CATEGORIES = [
  { id: "bedroom_count", label: "Bedroom Count" },
  { id: "bathroom_count", label: "Bathroom Count" },
  { id: "front_yard", label: "Front Yard" },
  { id: "back_yard", label: "Back Yard" },
  { id: "garage_storage", label: "Garage / Storage" },
  { id: "renovation_potential", label: "Renovation Potential" },
  { id: "renovation_costs", label: "Renovation Costs" },
  { id: "living_room_space", label: "Living Room Space" },
  { id: "motivated_seller", label: "Motivated Seller?" },
  { id: "parking", label: "Parking" },
  { id: "outdoor_entertainment", label: "Outdoor Entertainment Space" },
  { id: "appliances_included", label: "Appliances Included" },
  { id: "livable_layout", label: "Livable Layout" },
  { id: "landscaping_maturity", label: "Landscaping Maturity" },
  { id: "irrigation_issues", label: "Irrigation Issues" },
  { id: "home_construction_stability", label: "Home Construction Stability" },
  { id: "electrical_issues", label: "Electrical Issues" },
  { id: "plumbing_issues", label: "Plumbing Issues" },
  { id: "sewer_line_age", label: "Sewer Line Age" },
  { id: "insulation", label: "Insulation (Attic, Crawlspace, etc.)" },
  { id: "hvac", label: "HVAC" },
  { id: "fireplace", label: "Fireplace" },
  { id: "roof_quality", label: "Roof Quality" },
  { id: "siding_defects", label: "Siding Defects" },
];
