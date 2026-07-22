/**
 * Shared “answers → Importance (1–10)” mapping for scoring categories.
 * Used by the full onboarding quiz and the per-category Evaluate mini-quiz.
 *
 * Score side is never touched — this module only produces importance weights.
 */

/** @typedef {{ id: string, label: string, importance: number }} AnswerOption */
/** @typedef {{ id: string, prompt: string, options: AnswerOption[] }} QuizQuestion */
/** @typedef {{ categoryId: string, label: string, questions: QuizQuestion[] }} CategoryQuizBank */

/** Standard 4-option importance ladder reused across categories. */
export const IMPORTANCE_LADDER = /** @type {AnswerOption[]} */ ([
  { id: "dealbreaker", label: "Must-have — dealbreaker if it’s wrong", importance: 10 },
  { id: "high", label: "Really matters in my decision", importance: 8 },
  { id: "some", label: "Nice to have, not a dealbreaker", importance: 5 },
  { id: "low", label: "Barely matters / not relevant", importance: 2 },
]);

/**
 * Per-category question bank. Mini-quiz uses questions[0..2];
 * full onboarding picks one lead question per ONBOARDING_CATEGORY_IDS entry.
 * @type {Record<string, CategoryQuizBank>}
 */
export const CATEGORY_QUIZ_BANK = {
  schools: {
    categoryId: "schools",
    label: "Schools",
    questions: [
      {
        id: "schools_household",
        prompt: "Will school quality meaningfully affect who lives in this home?",
        options: [
          { id: "kids_now", label: "Yes — kids in school (or soon)", importance: 10 },
          { id: "future", label: "Maybe later / resale for families", importance: 7 },
          { id: "unlikely", label: "Unlikely — no school-age kids planned", importance: 3 },
          { id: "ignore", label: "I won’t weigh schools at all", importance: 1 },
        ],
      },
      {
        id: "schools_tradeoff",
        prompt: "Would you pay more or stretch commute for a better district?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "schools_walkability",
        prompt: "How much do nearby schools / kid amenities matter day-to-day?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  highway_access: {
    categoryId: "highway_access",
    label: "Highway Access",
    questions: [
      {
        id: "highway_commute",
        prompt: "How often will someone in your household drive major highways?",
        options: [
          { id: "daily", label: "Daily commute depends on it", importance: 10 },
          { id: "few", label: "A few times a week", importance: 7 },
          { id: "rare", label: "Rarely — local driving is fine", importance: 4 },
          { id: "avoid", label: "I’d rather avoid highway noise/access", importance: 2 },
        ],
      },
      {
        id: "highway_time",
        prompt: "Is saving drive time a top priority for this search?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "highway_flex",
        prompt: "Could you live somewhere slower to reach for other tradeoffs?",
        options: [
          { id: "no", label: "No — access is non-negotiable", importance: 9 },
          { id: "maybe", label: "Maybe, for the right home", importance: 5 },
          { id: "yes", label: "Yes — I’m flexible", importance: 3 },
          { id: "prefer_away", label: "Prefer quieter / farther from highways", importance: 2 },
        ],
      },
    ],
  },
  public_transportation: {
    categoryId: "public_transportation",
    label: "Public Transportation",
    questions: [
      {
        id: "transit_use",
        prompt: "Will anyone regularly use buses, trains, or light rail?",
        options: [
          { id: "primary", label: "Yes — primary or frequent commute", importance: 10 },
          { id: "backup", label: "Sometimes as a backup", importance: 6 },
          { id: "visitor", label: "Only for guests / rare trips", importance: 3 },
          { id: "never", label: "We won’t use transit", importance: 1 },
        ],
      },
      {
        id: "transit_carfree",
        prompt: "How important is living near a stop without needing a car?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "transit_future",
        prompt: "Does future transit access matter for resale or lifestyle?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  neighborhood_safety: {
    categoryId: "neighborhood_safety",
    label: "Neighborhood Safety",
    questions: [
      {
        id: "safety_feel",
        prompt: "How much does neighborhood safety drive your shortlist?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "safety_walk",
        prompt: "Do you need to feel comfortable walking at night nearby?",
        options: [
          { id: "essential", label: "Essential", importance: 10 },
          { id: "prefer", label: "Strong preference", importance: 8 },
          { id: "nice", label: "Nice but not required", importance: 5 },
          { id: "low", label: "Not a big factor", importance: 2 },
        ],
      },
      {
        id: "safety_research",
        prompt: "Will you dig into crime / safety data before offering?",
        options: [
          { id: "always", label: "Always — deep research", importance: 9 },
          { id: "glance", label: "A quick check is enough", importance: 6 },
          { id: "vibe", label: "I’ll go by vibe / realtor input", importance: 4 },
          { id: "skip", label: "I rarely check", importance: 2 },
        ],
      },
    ],
  },
  location_lifestyle: {
    categoryId: "location_lifestyle",
    label: "Location for Lifestyle",
    questions: [
      {
        id: "lifestyle_fit",
        prompt: "How important is the neighborhood vibe matching your day-to-day life?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "lifestyle_amenities",
        prompt: "Cafés, parks, gyms, dining nearby — how much do they matter?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "lifestyle_trade",
        prompt: "Would you sacrifice square footage for a better location?",
        options: [
          { id: "yes", label: "Yes, readily", importance: 9 },
          { id: "sometimes", label: "Sometimes", importance: 6 },
          { id: "rarely", label: "Rarely", importance: 3 },
          { id: "no", label: "No — home first, location second", importance: 2 },
        ],
      },
    ],
  },
  hospital_distance: {
    categoryId: "hospital_distance",
    label: "Distance to Hospital",
    questions: [
      {
        id: "hospital_need",
        prompt: "Is proximity to a hospital important for your household?",
        options: [
          { id: "critical", label: "Critical (health / peace of mind)", importance: 10 },
          { id: "prefer", label: "Prefer nearby, not required", importance: 6 },
          { id: "resale", label: "Only for resale / general convenience", importance: 4 },
          { id: "no", label: "Not something I weigh", importance: 1 },
        ],
      },
      {
        id: "hospital_time",
        prompt: "How far is “too far” for emergency care access?",
        options: [
          { id: "close", label: "Under ~15 minutes matters a lot", importance: 9 },
          { id: "moderate", label: "30 minutes is fine", importance: 5 },
          { id: "far_ok", label: "Distance rarely worries me", importance: 2 },
          { id: "unsure", label: "Not sure yet", importance: 5 },
        ],
      },
      {
        id: "hospital_priority",
        prompt: "Relative to schools or commute, where does hospital access rank?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  livable_layout: {
    categoryId: "livable_layout",
    label: "Livable Layout",
    questions: [
      {
        id: "layout_flow",
        prompt: "How picky are you about floor-plan flow and livability?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "layout_fix",
        prompt: "Open vs closed layout — does getting it right matter a lot?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "layout_fix",
        prompt: "Would awkward layout make you walk away from an otherwise good home?",
        options: [
          { id: "yes", label: "Yes — dealbreaker", importance: 10 },
          { id: "often", label: "Often", importance: 8 },
          { id: "fix", label: "I’d renovate around it", importance: 5 },
          { id: "no", label: "I can live with almost any layout", importance: 2 },
        ],
      },
    ],
  },
  appliances_included: {
    categoryId: "appliances_included",
    label: "Kitchen / Appliances",
    questions: [
      {
        id: "kitchen_cook",
        prompt: "How much does the kitchen (and included appliances) matter to you?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "kitchen_gather",
        prompt: "Is the kitchen a gathering hub you’ll use daily?",
        options: [
          { id: "daily", label: "Yes — daily cooking / hosting", importance: 9 },
          { id: "often", label: "Often", importance: 7 },
          { id: "sometimes", label: "Sometimes", importance: 4 },
          { id: "rare", label: "Rarely cook at home", importance: 2 },
        ],
      },
      {
        id: "kitchen_upgrade",
        prompt: "Would you buy a home just to redo the kitchen later?",
        options: [
          { id: "no", label: "No — kitchen needs to work now", importance: 9 },
          { id: "maybe", label: "Maybe if price reflects it", importance: 6 },
          { id: "yes", label: "Yes — I’m fine renovating", importance: 3 },
          { id: "na", label: "Kitchen is low priority", importance: 2 },
        ],
      },
    ],
  },
  back_yard: {
    categoryId: "back_yard",
    label: "Back Yard",
    questions: [
      {
        id: "yard_use",
        prompt: "How important is outdoor / backyard space?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "yard_pets_kids",
        prompt: "Pets, kids, or gardening — do they need a yard?",
        options: [
          { id: "must", label: "Must have", importance: 10 },
          { id: "strong", label: "Strong preference", importance: 8 },
          { id: "nice", label: "Nice to have", importance: 5 },
          { id: "no", label: "Not needed", importance: 2 },
        ],
      },
      {
        id: "yard_size",
        prompt: "Would a small patio-only outdoor space be enough?",
        options: [
          { id: "no", label: "No — need real yard", importance: 9 },
          { id: "maybe", label: "Maybe", importance: 5 },
          { id: "yes", label: "Yes — patio is fine", importance: 3 },
          { id: "none", label: "Outdoor space barely matters", importance: 1 },
        ],
      },
    ],
  },
  parking: {
    categoryId: "parking",
    label: "Parking",
    questions: [
      {
        id: "parking_cars",
        prompt: "How many cars / parking spots does your household need?",
        options: [
          { id: "two_plus_secure", label: "2+ secure spots (garage preferred)", importance: 10 },
          { id: "two", label: "Two spots matter", importance: 8 },
          { id: "one", label: "One reliable spot is enough", importance: 5 },
          { id: "flex", label: "Street / flexible is fine", importance: 2 },
        ],
      },
      {
        id: "parking_deal",
        prompt: "Is bad parking a dealbreaker?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "parking_guests",
        prompt: "How much does guest parking matter?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  garage_storage: {
    categoryId: "garage_storage",
    label: "Garage / Storage",
    questions: [
      {
        id: "garage_need",
        prompt: "How important is a garage or dedicated storage?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "garage_use",
        prompt: "Cars, tools, hobbies — what drives garage need most?",
        options: [
          { id: "cars", label: "Vehicle protection", importance: 9 },
          { id: "stuff", label: "Storage / hobbies", importance: 7 },
          { id: "both", label: "Both equally", importance: 8 },
          { id: "low", label: "Neither is a big need", importance: 2 },
        ],
      },
      {
        id: "garage_flex",
        prompt: "Could you accept no garage for the right home?",
        options: [
          { id: "no", label: "No", importance: 9 },
          { id: "hard", label: "Only reluctantly", importance: 7 },
          { id: "yes", label: "Yes", importance: 4 },
          { id: "prefer_none", label: "I don’t want a garage", importance: 2 },
        ],
      },
    ],
  },
  roof_quality: {
    categoryId: "roof_quality",
    label: "Roof Quality",
    questions: [
      {
        id: "roof_worry",
        prompt: "How much do roof age / condition factor into your offer?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "roof_budget",
        prompt: "Would an upcoming roof replacement scare you off?",
        options: [
          { id: "yes", label: "Yes — avoid those homes", importance: 9 },
          { id: "price", label: "Only if price doesn’t reflect it", importance: 6 },
          { id: "ok", label: "I’m fine budgeting for it", importance: 4 },
          { id: "ignore", label: "I rarely think about roofs", importance: 2 },
        ],
      },
      {
        id: "roof_inspect",
        prompt: "Will you prioritize inspection findings on the roof?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  hoa_cost: {
    categoryId: "hoa_cost",
    label: "HOA Cost",
    questions: [
      {
        id: "hoa_ok",
        prompt: "How do you feel about HOA fees and rules?",
        options: [
          { id: "avoid", label: "Prefer no HOA", importance: 9 },
          { id: "low_fee", label: "OK if fees stay low", importance: 7 },
          { id: "amenities", label: "Fine if amenities justify it", importance: 5 },
          { id: "ok", label: "HOA is fine / expected", importance: 3 },
        ],
      },
      {
        id: "hoa_budget",
        prompt: "How carefully will you weigh monthly HOA against mortgage?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "hoa_rules",
        prompt: "Do HOA rules (pets, rentals, exterior) matter a lot?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  property_tax_cost: {
    categoryId: "property_tax_cost",
    label: "Property Tax Cost",
    questions: [
      {
        id: "tax_budget",
        prompt: "How carefully do you budget for property taxes?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "tax_trade",
        prompt: "Would lower taxes make you accept a less ideal home?",
        options: [
          { id: "yes", label: "Yes", importance: 8 },
          { id: "somewhat", label: "Somewhat", importance: 6 },
          { id: "no", label: "No — other factors win", importance: 3 },
          { id: "unsure", label: "Not sure yet", importance: 5 },
        ],
      },
      {
        id: "tax_research",
        prompt: "Will tax history / assessment be part of every comparison?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  bedroom_count: {
    categoryId: "bedroom_count",
    label: "Bedroom Count",
    questions: [
      {
        id: "beds_need",
        prompt: "How firm is your bedroom-count requirement?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "beds_flex",
        prompt: "Could you go one bedroom under for the right home?",
        options: [
          { id: "no", label: "No", importance: 10 },
          { id: "hard", label: "Only if everything else is perfect", importance: 7 },
          { id: "yes", label: "Yes", importance: 4 },
          { id: "over", label: "I prefer more beds than I need", importance: 6 },
        ],
      },
      {
        id: "beds_office",
        prompt: "Do you need a dedicated office / guest room?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  bathroom_count: {
    categoryId: "bathroom_count",
    label: "Bathroom Count",
    questions: [
      {
        id: "baths_need",
        prompt: "How important is bathroom count for your household?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "baths_share",
        prompt: "Is sharing one bathroom a hard no?",
        options: [
          { id: "hard_no", label: "Hard no", importance: 10 },
          { id: "prefer_two", label: "Strongly prefer 2+", importance: 8 },
          { id: "ok", label: "One is OK for now", importance: 4 },
          { id: "flex", label: "Very flexible", importance: 2 },
        ],
      },
      {
        id: "baths_ensuite",
        prompt: "Does a primary ensuite matter?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  overall_living_space: {
    categoryId: "overall_living_space",
    label: "Overall Living Space",
    questions: [
      {
        id: "sqft_priority",
        prompt: "How much does total square footage drive your search?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "sqft_trade",
        prompt: "Location vs size — which usually wins?",
        options: [
          { id: "size", label: "Size / space", importance: 9 },
          { id: "balance", label: "Balance both", importance: 5 },
          { id: "location", label: "Location over size", importance: 3 },
          { id: "unsure", label: "Still figuring it out", importance: 5 },
        ],
      },
      {
        id: "sqft_feel",
        prompt: "Do you need the home to feel spacious (not just meet a number)?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  living_room_space: {
    categoryId: "living_room_space",
    label: "Living Room Space",
    questions: [
      {
        id: "lr_gather",
        prompt: "How important is a comfortable main living / gathering space?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "lr_host",
        prompt: "Do you host often enough that living-room size matters?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "lr_flex",
        prompt: "Could a smaller living room work if other rooms are great?",
        options: [
          { id: "no", label: "No", importance: 9 },
          { id: "maybe", label: "Maybe", importance: 5 },
          { id: "yes", label: "Yes", importance: 3 },
          { id: "na", label: "Living room isn’t a focus", importance: 2 },
        ],
      },
    ],
  },
  outdoor_entertainment: {
    categoryId: "outdoor_entertainment",
    label: "Outdoor Entertainment",
    questions: [
      {
        id: "outdoor_host",
        prompt: "How important is outdoor entertaining space (patio, deck, pool)?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "outdoor_season",
        prompt: "Will you use outdoor space most of the year?",
        options: [
          { id: "year", label: "Yes — year-round", importance: 9 },
          { id: "season", label: "Seasonally", importance: 6 },
          { id: "rare", label: "Rarely", importance: 3 },
          { id: "no", label: "Not a priority", importance: 1 },
        ],
      },
      {
        id: "outdoor_pool",
        prompt: "Pool / outdoor kitchen interest?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  location_investment: {
    categoryId: "location_investment",
    label: "Location for Investment",
    questions: [
      {
        id: "invest_goal",
        prompt: "Is appreciation / investment potential a primary goal?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "invest_vs_live",
        prompt: "Live-in comfort vs investment upside — which leads?",
        options: [
          { id: "invest", label: "Investment first", importance: 9 },
          { id: "both", label: "Both equally", importance: 6 },
          { id: "live", label: "Live-in first", importance: 3 },
          { id: "unsure", label: "Still deciding", importance: 5 },
        ],
      },
      {
        id: "invest_research",
        prompt: "Will you compare comps / growth trends for every shortlist home?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  longterm_neighborhood_value: {
    categoryId: "longterm_neighborhood_value",
    label: "Long-Term Neighborhood Value",
    questions: [
      {
        id: "ltv_hold",
        prompt: "How long do you plan to hold this home?",
        options: [
          { id: "long", label: "10+ years — neighborhood trajectory matters a lot", importance: 9 },
          { id: "mid", label: "5–10 years", importance: 7 },
          { id: "short", label: "Under 5 years", importance: 5 },
          { id: "flip", label: "Short / opportunistic", importance: 4 },
        ],
      },
      {
        id: "ltv_area",
        prompt: "How much does “where the neighborhood is headed” matter?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "ltv_stability",
        prompt: "Prefer established areas vs up-and-coming?",
        options: [
          { id: "established", label: "Established / stable", importance: 7 },
          { id: "either", label: "Either if the numbers work", importance: 5 },
          { id: "upc", label: "Up-and-coming OK", importance: 6 },
          { id: "na", label: "Not a focus", importance: 2 },
        ],
      },
    ],
  },
  local_construction: {
    categoryId: "local_construction",
    label: "Local Construction",
    questions: [
      {
        id: "const_noise",
        prompt: "How sensitive are you to nearby construction / disruption?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "const_avoid",
        prompt: "Would active nearby builds knock a home off your list?",
        options: [
          { id: "yes", label: "Yes", importance: 9 },
          { id: "maybe", label: "Maybe", importance: 5 },
          { id: "no", label: "No — temporary is fine", importance: 2 },
          { id: "plus", label: "New development can be a plus", importance: 3 },
        ],
      },
      {
        id: "const_future",
        prompt: "Do future development plans around the home matter?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
  fireplace: {
    categoryId: "fireplace",
    label: "Fireplace",
    questions: [
      {
        id: "fireplace_want",
        prompt: "How much does having a fireplace matter in your search?",
        options: IMPORTANCE_LADDER,
      },
      {
        id: "fireplace_deal",
        prompt: "Would you skip a home that has no fireplace?",
        options: [
          { id: "must", label: "Yes — must-have", importance: 10 },
          { id: "prefer", label: "Strong preference", importance: 7 },
          { id: "nice", label: "Nice bonus only", importance: 4 },
          { id: "no", label: "Doesn’t matter", importance: 1 },
        ],
      },
      {
        id: "fireplace_type",
        prompt: "Do wood / gas / electric fireplace type differences matter to you?",
        options: IMPORTANCE_LADDER,
      },
    ],
  },
};

/**
 * Category IDs that Browse / Google autoscore can score automatically.
 * Deep priority quiz may only generate questions for these (never invent unscorable cats).
 * Keep in sync with `GoogleAutoScore` SCOREABLE_IDS.
 */
export const AUTOSCORE_CATEGORY_IDS = Object.freeze([
  "hospital_distance",
  "highway_access",
  "schools",
  "neighborhood_safety",
  "public_transportation",
  "location_lifestyle",
  "location_investment",
  "longterm_neighborhood_value",
  "bedroom_count",
  "bathroom_count",
  "overall_living_space",
  "property_tax_cost",
  "hoa_cost",
  "garage_storage",
  "fireplace",
]);

export const AUTOSCORE_CATEGORY_ID_SET = new Set(AUTOSCORE_CATEGORY_IDS);

/** Categories included in the full onboarding quiz (one lead question each). */
export const ONBOARDING_CATEGORY_IDS = [
  "schools",
  "highway_access",
  "neighborhood_safety",
  "location_lifestyle",
  "appliances_included",
  "livable_layout",
  "back_yard",
  "parking",
];

/**
 * @param {string} categoryId
 * @returns {CategoryQuizBank | null}
 */
export function getCategoryQuiz(categoryId) {
  return CATEGORY_QUIZ_BANK[categoryId] || null;
}

/**
 * Mini-quiz: 2–3 questions for a single category.
 * @param {string} categoryId
 * @param {number} [maxQuestions=3]
 * @returns {QuizQuestion[]}
 */
export function getMiniQuizQuestions(categoryId, maxQuestions = 3) {
  const bank = getCategoryQuiz(categoryId);
  if (!bank) return [];
  return bank.questions.slice(0, Math.max(2, Math.min(maxQuestions, bank.questions.length)));
}

/**
 * Full onboarding: one plain-language lead question per key category.
 * @returns {{ categoryId: string, label: string, question: QuizQuestion }[]}
 */
export function getFullOnboardingQuestions() {
  return ONBOARDING_CATEGORY_IDS.map((categoryId) => {
    const bank = CATEGORY_QUIZ_BANK[categoryId];
    return {
      categoryId,
      label: bank.label,
      question: bank.questions[0],
    };
  }).filter((row) => row.question);
}

/**
 * Map selected option id(s) for one category → Importance 1–10.
 * Averages when multiple mini-quiz answers are provided.
 * Optional `supplementalQuestions` lets AI deep-quiz options (not in the static bank) score.
 * @param {string} categoryId
 * @param {string | string[]} optionIds
 * @param {{ categoryId?: string, question?: QuizQuestion, options?: AnswerOption[] }[]} [supplementalQuestions]
 * @returns {number | null}
 */
export function importanceFromAnswers(categoryId, optionIds, supplementalQuestions = []) {
  const ids = Array.isArray(optionIds) ? optionIds.filter(Boolean) : [optionIds].filter(Boolean);
  if (!ids.length) return null;
  const scores = [];

  const bank = getCategoryQuiz(categoryId);
  if (bank) {
    for (const q of bank.questions) {
      for (const opt of q.options) {
        if (ids.includes(opt.id)) scores.push(opt.importance);
      }
    }
  }

  for (const row of supplementalQuestions || []) {
    if (row?.categoryId && row.categoryId !== categoryId) continue;
    const opts = row?.question?.options || row?.options || [];
    for (const opt of opts) {
      if (opt?.id && ids.includes(opt.id) && Number.isFinite(Number(opt.importance))) {
        scores.push(Number(opt.importance));
      }
    }
  }

  if (!scores.length) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.max(1, Math.min(10, Math.round(avg)));
}

/**
 * @param {Record<string, string | string[]>} answersByCategory — categoryId → option id(s)
 * @param {{ categoryId?: string, question?: QuizQuestion, options?: AnswerOption[] }[]} [supplementalQuestions]
 * @returns {Record<string, number>}
 */
export function weightsFromFullAnswers(answersByCategory, supplementalQuestions = []) {
  /** @type {Record<string, number>} */
  const weights = {};
  for (const [categoryId, optionIds] of Object.entries(answersByCategory || {})) {
    const n = importanceFromAnswers(categoryId, optionIds, supplementalQuestions);
    if (n != null) weights[categoryId] = n;
  }
  return weights;
}

/**
 * Static deep-quiz fallback: one lead question per autoscore category not already answered.
 * Used when AI is unavailable or the user is gated — still only scoreable categories.
 * @param {string[]} [excludeCategoryIds]
 * @param {number} [maxQuestions=8]
 * @returns {{ categoryId: string, label: string, question: QuizQuestion, source: 'bank' }[]}
 */
export function getDeepFallbackQuestions(excludeCategoryIds = [], maxQuestions = 8) {
  const exclude = new Set(excludeCategoryIds || []);
  const out = [];
  for (const categoryId of AUTOSCORE_CATEGORY_IDS) {
    if (exclude.has(categoryId)) continue;
    const bank = getCategoryQuiz(categoryId);
    if (!bank?.questions?.[0]) continue;
    out.push({
      categoryId,
      label: bank.label,
      question: bank.questions[0],
      source: "bank",
    });
    if (out.length >= maxQuestions) break;
  }
  return out;
}

/**
 * Normalize / validate AI-generated deep questions — drop anything not in AUTOSCORE_CATEGORY_IDS.
 * @param {unknown} rawQuestions
 * @param {string[]} [excludeCategoryIds]
 * @param {number} [maxQuestions=8]
 * @returns {{ categoryId: string, label: string, question: QuizQuestion, source: 'ai' }[]}
 */
export function normalizeDeepAiQuestions(rawQuestions, excludeCategoryIds = [], maxQuestions = 8) {
  const exclude = new Set(excludeCategoryIds || []);
  const list = Array.isArray(rawQuestions) ? rawQuestions : [];
  /** @type {{ categoryId: string, label: string, question: QuizQuestion, source: 'ai' }[]} */
  const out = [];
  const seen = new Set();

  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const categoryId = String(row.categoryId || row.category_id || "").trim();
    if (!AUTOSCORE_CATEGORY_ID_SET.has(categoryId)) continue;
    if (exclude.has(categoryId) || seen.has(categoryId)) continue;

    const bank = getCategoryQuiz(categoryId);
    const label = String(row.label || bank?.label || categoryId).trim() || categoryId;
    const prompt = String(row.prompt || row.question || "").trim();
    const rawOpts = Array.isArray(row.options) ? row.options : [];
    /** @type {AnswerOption[]} */
    const options = [];
    for (let i = 0; i < rawOpts.length; i++) {
      const opt = rawOpts[i];
      if (!opt || typeof opt !== "object") continue;
      const importance = Math.max(1, Math.min(10, Math.round(Number(opt.importance))));
      if (!Number.isFinite(importance)) continue;
      const id = String(opt.id || `ai_${categoryId}_${i}`).trim() || `ai_${categoryId}_${i}`;
      const optLabel = String(opt.label || "").trim();
      if (!optLabel) continue;
      options.push({ id, label: optLabel, importance });
    }
    if (!prompt || options.length < 2) continue;

    out.push({
      categoryId,
      label,
      question: {
        id: String(row.id || `deep_${categoryId}`).trim() || `deep_${categoryId}`,
        prompt,
        options: options.slice(0, 4),
      },
      source: "ai",
    });
    seen.add(categoryId);
    if (out.length >= maxQuestions) break;
  }
  return out;
}

/**
 * Merge quiz weights into a full weight map (missing categories stay at defaultImportance).
 * @param {Record<string, number>} quizWeights
 * @param {string[]} [categoryIds]
 * @param {number} [defaultImportance=5]
 */
export function mergeWeights(quizWeights, categoryIds = ONBOARDING_CATEGORY_IDS, defaultImportance = 5) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const id of categoryIds) {
    out[id] = quizWeights[id] != null ? quizWeights[id] : defaultImportance;
  }
  for (const [id, w] of Object.entries(quizWeights || {})) {
    out[id] = w;
  }
  return out;
}

export const PRIORITY_QUIZ_EVENT = "pp:show-priority-quiz";

/**
 * Ask the global host to open the full priority quiz.
 * Guests may take the signup-style quiz (weights → localStorage); account presets still require auth.
 * @param {{ trigger?: 'signup' | 'project' | 'client' | 'retake', projectId?: string, projectName?: string, force?: boolean }} detail
 */
export function requestPriorityQuiz(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRIORITY_QUIZ_EVENT, { detail }));
}
