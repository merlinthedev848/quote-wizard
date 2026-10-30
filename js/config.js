/**
 * @file config.js
 * @description Central configuration, rates matrix, station databases, and market multipliers.
 */

export const ILR_STATIONS = [
  { name: "Heart London", reach: 1800000 },
  { name: "Capital London", reach: 1600000 },
  { name: "LBC London", reach: 1400000 },
  { name: "Kiss FM London", reach: 1100000 },
  { name: "Magic London", reach: 950000 },
  { name: "Smooth London", reach: 850000 },
  { name: "Absolute Radio (National)", reach: 2200000 },
  { name: "TalkSport (National)", reach: 2900000 },
  { name: "Classic FM (National)", reach: 4500000 },
  { name: "Heart West Midlands", reach: 750000 },
  { name: "Clyde 1 (Glasgow)", reach: 650000 },
  { name: "Free Radio (Birmingham)", reach: 400000 },
  { name: "Wave 105 (South Coast)", reach: 390000 },
  { name: "Key 103 / Hits Radio (Manchester)", reach: 500000 },
  { name: "Metro Radio (Newcastle)", reach: 350000 },
  { name: "Radio City (Liverpool)", reach: 320000 },
  { name: "Hallam FM (Sheffield)", reach: 280000 },
  { name: "Forth 1 (Edinburgh)", reach: 250000 },
  { name: "Downtown Radio (Belfast)", reach: 230000 },
  { name: "Signal 1 (Stoke)", reach: 190000 },
  { name: "KMFM (Kent)", reach: 160000 },
  { name: "Pirate FM (Cornwall)", reach: 150000 },
  { name: "Lincs FM (Lincolnshire)", reach: 130000 },
  { name: "TFM (Tees Valley)", reach: 110000 },
  { name: "Wessex FM", reach: 450000 },
  { name: "Isle of Wight Radio", reach: 40000 }
].sort((a, b) => b.reach - a.reach);

export const CURRENCY_SYMBOLS = {
  GBP: "£",
  USD: "$",
  EUR: "€"
};

/**
 * International market rate premiums (applied before currency conversion).
 * US SAG-AFTRA and EU market rates reflect regional pricing standards.
 */
export const MARKET_MULTIPLIERS = {
  GBP: 1.0,
  USD: 2.5,
  EUR: 1.5
};

export const RATES = {
  tv_commercial: {
    equity: { bsf: 220 },
    agency: { bsf: 350 }
  },
  radio_generic: {
    equity: { bsf: 180 },
    agency: { bsf: 250 }
  },
  radio_ilr: {
    equity: { bsf: 180 },
    agency: { bsf: 250 }
  },
  cinema: {
    equity: { bsf: 220 },
    agency: { bsf: 350 }
  },
  trailers_promos: {
    equity: { bsf: 180 },
    agency: { bsf: 250 }
  },
  voice_god: {
    equity: { ratePerHour: 200 },
    agency: { ratePerHour: 300 }
  },
  corporate_video: {
    equity: { perWord: 0.20 },
    agency: { perWord: 0.30 }
  },
  explainer_video: {
    equity: { bsf: 180, perWord: 0.20 },
    agency: { bsf: 250, perWord: 0.35 }
  },
  elearning: {
    equity: { perWord: 0.15 },
    agency: { perWord: 0.25 }
  },
  elt_educational: {
    equity: {
      A_half_solo: 298, A_full_solo: 504, A_half_group: 252, A_full_group: 421,
      B_half_solo: 286, B_full_solo: 484, B_half_group: 285, B_full_group: 480,
      C_half_solo: 326, C_full_solo: 575, C_half_group: 326, C_full_group: 575,
      D_half_solo: 377, D_full_solo: 676, D_half_group: 377, D_full_group: 676,
      A_half: 298, A_full: 504, B_half: 286, B_full: 484, C_half: 326, C_full: 575, D_half: 377, D_full: 676
    },
    agency: {
      A_half_solo: 350, A_full_solo: 600, A_half_group: 300, A_full_group: 500,
      B_half_solo: 380, B_full_solo: 650, B_half_group: 350, B_full_group: 600,
      C_half_solo: 420, C_full_solo: 750, C_half_group: 400, C_full_group: 700,
      D_half_solo: 480, D_full_solo: 850, D_half_group: 480, D_full_group: 850,
      A_half: 350, A_full: 600, B_half: 380, B_full: 650, C_half: 420, C_full: 750, D_half: 480, D_full: 850
    }
  },
  medical_narration: {
    equity: { perWord: 0.25 },
    agency: { perWord: 0.35 }
  },
  psa: {
    equity: { flat: 200 },
    agency: { flat: 300 }
  },
  museum_exhibition: {
    equity: { perWord: 0.15 },
    agency: { perWord: 0.25 }
  },
  documentary_narration: {
    equity: { perWord: 0.18, minFloor: 200, studentMinFloor: 110 },
    agency: { perWord: 0.25, minFloor: 275, studentMinFloor: 140 }
  },
  audio_drama_fiction: {
    equity: { perWord: 0.12, minFloor: 150, studentMinFloor: 100 },
    agency: { perWord: 0.16, minFloor: 200, studentMinFloor: 125 }
  },
  animation_character: {
    equity: { ratePerHour: 220, studentMinFloor: 110 },
    agency: { ratePerHour: 300, studentMinFloor: 135 }
  },
  video_games: {
    equity: { ratePerHour: 300, ratePerHourHeadcam: 350 },
    agency: { ratePerHour: 350, ratePerHourHeadcam: 420 }
  },
  audiobooks: {
    equity: { ratePerFH: 150 },
    agency: { ratePerFH: 250 }
  },
  ivr_basic: {
    equity: { min: 120, perWord: 0.20 },
    agency: { min: 180, perWord: 0.30 }
  },
  telephony_bundles: {
    equity: { ratePerPrompt: 8 },
    agency: { ratePerPrompt: 12 }
  },
  digital_ads: {
    equity: { bsf: 180 },
    agency: { bsf: 280 }
  },
  social_organic: {
    equity: { ratePerMinute: 80 },
    agency: { ratePerMinute: 120 }
  },
  podcast_ads: {
    equity: { bsf: 150 },
    agency: { bsf: 220 }
  },
  podcast_intro: {
    equity: { flat: 120 },
    agency: { flat: 200 }
  },
  ai_dataset: {
    equity: { ratePerHour: 350 },
    agency: { ratePerHour: 600 }
  },
  text_to_speech: {
    equity: { bsf: 500 },
    agency: { bsf: 1000 }
  },
  adr_dubbing: {
    equity: { ratePerHour: 180 },
    agency: { ratePerHour: 250 }
  },
  transport_pa: {
    equity: { ratePerPrompt: 25 },
    agency: { ratePerPrompt: 45 }
  }
};

/**
 * Modern Equity & Voice Fairy digital impressions scaling tiers for Online & VOD ads.
 */
export const DIGITAL_IMPRESSIONS_TIERS = {
  "duration_based": { name: "Duration / Term-Based Buyout", isTerm: true },
  "1.5m": { name: "Online / VOD: Up to 1.5M views", equity: 450, agency: 550 },
  "3m": { name: "Online / VOD: Up to 3M views", equity: 900, agency: 1100 },
  "10m": { name: "Online / VOD: Up to 10M views", equity: 3000, agency: 3600 },
  "15m": { name: "Online / VOD: Up to 15M views", equity: 4500, agency: 5400 },
  "21m": { name: "Online / VOD: Up to 21M views", equity: 6150, agency: 7200 },
  "37m": { name: "Online / VOD: Up to 37M views", equity: 8550, agency: 9800 },
  "50m": { name: "Online / VOD: Up to 50M views", equity: 10500, agency: 12500 },
  "100m": { name: "Online / VOD: Up to 100M views", equity: 15450, agency: 18000 },
  "unlimited_1yr": { name: "Online: 1 Year Unlimited views", equity: 1600, agency: 2200 }
};

/**
 * Standard Equity UK TV Ratings (TVRs) schedule points for TV commercials.
 */
export const TVR_TIERS = {
  "standard": { name: "Standard Reach Buyout (Local, Regional, National, Global)", isStandard: true },
  "1": { name: "1 UK National TVR (£322.23)", fee: 322.23 },
  "10": { name: "10 UK National TVRs (£522.30)", fee: 522.30 },
  "25": { name: "25 UK National TVRs (£855.75)", fee: 855.75 },
  "50": { name: "50 UK National TVRs (£1,411.50)", fee: 1411.50 },
  "75": { name: "75 UK National TVRs (£1,967.25)", fee: 1967.25 },
  "100": { name: "100 UK National TVRs (£2,523.00)", fee: 2523.00 },
  "200": { name: "200 UK National TVRs (£4,746.00)", fee: 4746.00 },
  "500": { name: "500 UK National TVRs (£7,680.00)", fee: 7680.00 }
};

export const API_ENDPOINTS = {
  FRANKFURTER_FX: "https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR",
  FRANKFURTER_FX_FALLBACK: "https://open.er-api.com/v6/latest/GBP",
  PERFEX_BETA_SUBMIT: "https://accounts.chriskendall.media/ckm_quote_wizard/api/submit_beta_quote",
  SUPPORT_EMAIL: "chris@chriskendall.media"
};

/**
 * Speaking pace modes (Words Per Minute) and studio performance multipliers.
 * Dramatic / acted scripts with pauses require ~20-25% more recording & performance time per word.
 */
export const PACING_MODES = {
  standard: { wpm: 150, label: "Standard Narration (150 wpm — Corporate / Natural)", timeFactor: 1.0 },
  dramatic: { wpm: 115, label: "Dramatic / Acted with Pauses (115 wpm — Story / Short Film)", timeFactor: 1.20 },
  deliberate: { wpm: 130, label: "Slow / Deliberate (130 wpm — Documentary / Educational)", timeFactor: 1.10 },
  upbeat: { wpm: 170, label: "Fast / Upbeat Commercial (170 wpm — Promo / Ad)", timeFactor: 1.0 }
};
