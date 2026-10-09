/**
 * @file calculator.test.mjs
 * @description Automated test suite for the Quote Wizard calculation engine and currency conversion.
 */

import assert from "node:assert/strict";
import {
  calculateSingleItemQuote,
  calculateFullQuote,
  convertAmount,
  formatCurrency,
  ilrRateFromReach
} from "../js/calculator.js";
import { RATES, ILR_STATIONS, MARKET_MULTIPLIERS } from "../js/config.js";

console.log("▶ Starting Quote Wizard Test Suite...\n");

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${description}`);
    console.error(`    ${err.message}\n`);
    failed++;
  }
}

// --------------------------------------------------------------------------
// 1. ILR RATE TIERS (Equity 8-Band Global & Bauer Matrix)
// --------------------------------------------------------------------------
it("calculates ILR station rate tiers correctly by reach", () => {
  assert.equal(ilrRateFromReach(40000), 31);    // Band 1: 0 - 250k
  assert.equal(ilrRateFromReach(280000), 44);   // Band 2: 250,001 - 500k
  assert.equal(ilrRateFromReach(650000), 56);   // Band 3: 500,001 - 750k
  assert.equal(ilrRateFromReach(850000), 78);   // Band 4: 750,001 - 1M
  assert.equal(ilrRateFromReach(1800000), 109); // Band 5: 1M - 2.5M
  assert.equal(ilrRateFromReach(2900000), 234); // Band 6: 2.5M - 3.5M
  assert.equal(ilrRateFromReach(4500000), 349); // Band 7: 3.5M - 5M
  assert.equal(ilrRateFromReach(6000000), 890); // Band 8: 5M+
});

// --------------------------------------------------------------------------
// 2. COMMERCIAL BROADCAST PRICING
// --------------------------------------------------------------------------
it("calculates TV Commercial (National Buyout, 3 Months)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "tv_commercial",
    pricingStandard: "agency",
    inputs: { bsf: 350, reach: "6.0", duration: "1.0" }
  });
  // 350 * 6.0 = 2100
  assert.equal(quote.total, 2100);
  assert.equal(quote.lines.length, 2);
});

it("calculates TV Commercial (National Buyout, 1 Year Renewal)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "tv_commercial",
    pricingStandard: "agency",
    inputs: { bsf: 350, reach: "6.0", duration: "3.0" }
  });
  // reachCost = 2100; renewalFee = 2100 * (3.0 - 1.0) * 0.35 = 2100 * 0.70 = 1470
  // total = 2100 + 1470 = 3570
  assert.equal(quote.total, 3570);
  assert.equal(quote.lines.length, 3);
});

it("calculates Cinema Commercial with multiple spots", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "cinema",
    pricingStandard: "equity",
    inputs: { bsf: 220, reach: "2.5", spots: 3 }
  });
  // 1st spot: 220 * 2.5 = 550
  // extra spots (2): 550 * 0.5 * 2 = 550
  // total = 1100
  assert.equal(quote.total, 1100);
});

// --------------------------------------------------------------------------
// 3. CORPORATE, ELT & NARRATION PRICING
// --------------------------------------------------------------------------
it("calculates ELT Educational Band A Solo Half Day (Equity 2026-2027)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "elt_educational",
    pricingStandard: "equity",
    inputs: { elt_band: "A", elt_session: "half" }
  });
  // Equity 2026 Band A Solo Half Day = 298
  assert.equal(quote.total, 298);
});

it("calculates E-Learning sliding scale (1500 words)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "elearning",
    pricingStandard: "agency",
    inputs: { words: 1500 }
  });
  // 1500w @ £0.30/w = 450
  assert.equal(quote.total, 450);
});

it("calculates E-Learning sliding scale (5000 words)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "elearning",
    pricingStandard: "agency",
    inputs: { words: 5000 }
  });
  // 5000w @ £0.20/w = 1000
  assert.equal(quote.total, 1000);
});

it("applies £150 minimum floor to corporate video", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "corporate_video",
    pricingStandard: "agency",
    inputs: { words: 200, corp_usage: "1.0" }
  });
  // 200 * 0.30 = 60 -> Floored at 150
  assert.equal(quote.total, 150);
});

// --------------------------------------------------------------------------
// 4. SPECIALTY & TELEPHONY PRICING
// --------------------------------------------------------------------------
it("calculates IVR Basic with AMA discount", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "ivr_basic",
    pricingStandard: "agency",
    inputs: { words: 200, ivr_membership: "ama" }
  });
  // 180 + (100 * 0.30) = 210 * 0.80 = 168
  assert.equal(quote.total, 168);
});

it("calculates AAA Video Game session with 200% Equity buyout (3 hours)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "video_games",
    pricingStandard: "equity",
    inputs: { hours: 3, game_tier: "1.8" }
  });
  // 3 hrs @ £300/hr = 900 + 200% BSF buyout (£600) = 1500 (matches Equity example)
  assert.equal(quote.total, 1500);
});

// --------------------------------------------------------------------------
// 5. BUNDLED CART & ADD-ONS
// --------------------------------------------------------------------------
it("calculates full quote with cart items, extras, and 24h urgent surcharge", () => {
  const appState = {
    pricingStandard: "agency",
    selectedSubcategory: "explainer_video",
    inputs: { words: 150, corp_usage: "1.0" }, // 250
    selectedStations: [],
    isCurrentItemInCart: false,
    cart: [
      {
        subcategory: "podcast_intro",
        inputs: {},
        stations: []
      } // 200
    ]
  };

  const extrasForm = {
    editing: { enabled: true, hours: 2, rate: 50 }, // +100
    urgent: { enabled: true } // +20%
  };

  const quote = calculateFullQuote(appState, extrasForm);
  // Base = 250 (explainer) + 200 (podcast intro) = 450
  // Extras = 100 (editing)
  // Subtotal = 550
  // Urgent 20% = 110
  // Total = 660
  assert.equal(quote.subtotal, 550);
  assert.equal(quote.total, 660);
});

// --------------------------------------------------------------------------
// 6. CURRENCY CONVERSION & FORMATTING
// --------------------------------------------------------------------------
it("converts amounts correctly for USD with SAG-AFTRA 2.5x multiplier", () => {
  const rates = { GBP: 1, USD: 1.30, EUR: 1.20 };
  const gbpVal = 100;
  // 100 * 2.5 * 1.30 = 325
  const usdVal = convertAmount(gbpVal, "USD", rates);
  assert.equal(usdVal, 325);
  assert.equal(formatCurrency(gbpVal, "USD", rates), "$325.00");
});

console.log(`\nTest Summary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
