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
      A_half: 220, A_full: 367,
      B_half: 259, B_full: 435,
      C_half: 299, C_full: 527,
      D_half: 352, D_full: 631
    },
    agency: {
      A_half: 300, A_full: 500,
      B_half: 350, B_full: 600,
      C_half: 400, C_full: 700,
      D_half: 480, D_full: 850
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
  video_games: {
    equity: { ratePerHour: 200 },
    agency: { ratePerHour: 300 }
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

export const API_ENDPOINTS = {
  FRANKFURTER_FX: "https://api.frankfurter.app/latest?from=GBP&to=USD,EUR",
  PERFEX_BETA_SUBMIT: "https://accounts.chriskendall.media/ckm_quote_wizard/api/submit_beta_quote",
  SUPPORT_EMAIL: "chris@chriskendall.media"
};
