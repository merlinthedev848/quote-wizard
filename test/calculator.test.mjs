/**
 * @file calculator.test.mjs
 * @description Automated test suite for the Quote Wizard calculation engine and currency conversion.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateSingleItemQuote,
  calculateFullQuote,
  convertAmount,
  formatCurrency,
  ilrRateFromReach
} from "../js/calculator.js";
import { RATES, ILR_STATIONS, MARKET_MULTIPLIERS } from "../js/config.js";
import { renderDynamicVariables, escapeHtml } from "../js/templates.js";

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
    inputs: { elt_band: "A", elt_format: "solo", elt_session: "half" }
  });
  // Equity 2026 Band A Solo Half Day = 298
  assert.equal(quote.total, 298);
});

it("calculates ELT Educational Band A Group Full Day (Equity 2026-2027)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "elt_educational",
    pricingStandard: "equity",
    inputs: { elt_band: "A", elt_format: "group", elt_session: "full" }
  });
  // Equity 2026 Band A Group Full Day = 421
  assert.equal(quote.total, 421);
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

it("calculates E-Learning sliding scale (5000 words - Agency)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "elearning",
    pricingStandard: "agency",
    inputs: { words: 5000 }
  });
  // 5000w @ £0.20/w = 1000
  assert.equal(quote.total, 1000);
});

it("calculates E-Learning sliding scale (5000 words - Equity Union)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "elearning",
    pricingStandard: "equity",
    inputs: { words: 5000 }
  });
  // 5000w @ £0.15/w = 750
  assert.equal(quote.total, 750);
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
    inputs: { hours: 3, game_capture: "standard", game_tier: "1.8" }
  });
  // 3 hrs @ £300/hr = 900 + 200% BSF buyout (£600) = 1500 (matches Equity example)
  assert.equal(quote.total, 1500);
});

it("calculates Video Game session with Headcam capture (+£50/hr)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "video_games",
    pricingStandard: "equity",
    inputs: { hours: 3, game_capture: "headcam", game_tier: "1.8" }
  });
  // 3 hrs @ £350/hr = 1050 + 200% BSF buyout (£700) = 1750
  assert.equal(quote.total, 1750);
});

it("calculates Audiobook Narration with custom PFH rate", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "audiobooks",
    pricingStandard: "agency",
    inputs: { hours: 8, hourly_rate: 200 }
  });
  // 8 hrs @ £200/PFH = 1600
  assert.equal(quote.total, 1600);
});

// --------------------------------------------------------------------------
// 5. TVR SCHEDULE & DIGITAL ONLINE / VOD IMPRESSIONS (Voice Fairy / Equity)
// --------------------------------------------------------------------------
it("calculates TV Commercial by Equity TVR points (50 TVRs)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "tv_commercial",
    pricingStandard: "equity",
    inputs: { bsf: 220, tvr_tier: "50" }
  });
  // BSF 220 + 50 TVRs (1411.50) = 1631.50
  assert.equal(quote.total, 1631.50);
  assert.equal(quote.lines.length, 2);
});

it("calculates Digital Online & VOD ads by Impression Tier (1.5M views - Equity £450)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "digital_ads",
    pricingStandard: "equity",
    inputs: { digital_model: "impressions", impression_tier: "1.5m" }
  });
  // Matches updated Equity / Voice Fairy online guideline (£450)
  assert.equal(quote.total, 450);
});

it("calculates Digital Online & VOD ads by Impression Tier (10M views - Equity £3,000)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "digital_ads",
    pricingStandard: "equity",
    inputs: { digital_model: "impressions", impression_tier: "10m" }
  });
  // Matches updated Equity / Voice Fairy online guideline (£3,000)
  assert.equal(quote.total, 3000);
});

it("calculates Digital Online & VOD ads by Impression Tier (50M views - Agency £12,500)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "digital_ads",
    pricingStandard: "agency",
    inputs: { digital_model: "impressions", impression_tier: "50m" }
  });
  assert.equal(quote.total, 12500);
});

// --------------------------------------------------------------------------
// 6. BUNDLED CART & ADD-ONS
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
// 7. SCRIPT PARSER & DURATION ESTIMATION (150 WPM)
// --------------------------------------------------------------------------
it("accurately counts script words, characters and estimates read-time", () => {
  const sampleScript = `
    Welcome to our 2026 global keynote presentation. 
    Today, we are announcing our next generation studio audio system.
    Engineered with precision, built for creators worldwide.
  `;
  const trimmed = sampleScript.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const chars = sampleScript.length;
  const minutes = Math.floor(words / 150);
  const seconds = Math.round(((words % 150) / 150) * 60);

  assert.equal(words, 24);
  assert.equal(minutes, 0);
  assert.equal(seconds, 10); // (24 / 150) * 60 = 9.6 -> 10 seconds

  // Test with a 375-word script (2.5 minutes = 2m 30s)
  const repeatedWords = new Array(375).fill("word").join(" ");
  const repCount = repeatedWords.trim().split(/\s+/).filter(Boolean).length;
  const repMin = Math.floor(repCount / 150);
  const repSec = Math.round(((repCount % 150) / 150) * 60);
  assert.equal(repCount, 375);
  assert.equal(repMin, 2);
  assert.equal(repSec, 30);
});

// --------------------------------------------------------------------------
// 8. CURRENCY CONVERSION & FORMATTING
// --------------------------------------------------------------------------
it("converts amounts correctly for USD with SAG-AFTRA 2.5x multiplier", () => {
  const rates = { GBP: 1, USD: 1.30, EUR: 1.20 };
  const gbpVal = 100;
  // 100 * 2.5 * 1.30 = 325
  const usdVal = convertAmount(gbpVal, "USD", rates);
  assert.equal(usdVal, 325);
  assert.equal(formatCurrency(gbpVal, "USD", rates), "$325.00");
});

it("supports 1.0x Direct FX conversion when waiveIntlMultiplier is true for indie/student projects", () => {
  const rates = { GBP: 1, USD: 1.30, EUR: 1.20 };
  const gbpVal = 150;
  // 150 * 1.0 * 1.20 = 180 EUR (no 1.5x commercial EU broadcast premium)
  const eurVal = convertAmount(gbpVal, "EUR", rates, true);
  assert.equal(eurVal, 180);
  assert.equal(formatCurrency(gbpVal, "EUR", rates, true), "€180.00");
});

// --------------------------------------------------------------------------
// 9. CREATIVE STORYTELLING, DOCUMENTARY, ANIMATION & STUDENT/INDIE TIERS
// --------------------------------------------------------------------------
it("calculates Audio Drama / Short Film for a 15-min Student/Indie Dramatic script (Giulia scenario)", () => {
  // 15 mins raw read (~2250 words) with dramatic pauses (+20% timeFactor) at 45% student concession (0.55x)
  const quoteEquity = calculateSingleItemQuote({
    subcategory: "audio_drama_fiction",
    pricingStandard: "equity",
    inputs: { words: 2250, drama_tier: "0.55", drama_pacing: "dramatic" }
  });
  // 2250 * 0.12 * 1.20 * 0.55 = 178.20 (above £100 student studio floor)
  assert.equal(quoteEquity.total, 178.2);

  const quoteAgency = calculateSingleItemQuote({
    subcategory: "audio_drama_fiction",
    pricingStandard: "agency",
    inputs: { words: 2250, drama_tier: "0.55", drama_pacing: "dramatic" }
  });
  // 2250 * 0.16 * 1.20 * 0.55 = 237.60 (above £125 student studio floor)
  assert.equal(quoteAgency.total, 237.6);
});

it("enforces minimum studio call floor on short Student Audio Drama / Short Film scripts", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "audio_drama_fiction",
    pricingStandard: "agency",
    inputs: { words: 300, drama_tier: "0.55", drama_pacing: "standard" }
  });
  // 300 * 0.16 * 1.0 * 0.55 = 26.40 -> Floored at £125 studio minimum so talent time is protected
  assert.equal(quote.total, 125);
});

it("calculates Documentary Narration for National TV / SVOD (2.5x)", () => {
  const quote = calculateSingleItemQuote({
    subcategory: "documentary_narration",
    pricingStandard: "agency",
    inputs: { words: 1500, doc_usage: "2.5" }
  });
  // 1500 * 0.25 * 2.5 = 937.50
  assert.equal(quote.total, 937.5);
});

it("calculates Animation & Character Voice with Student/Indie floor protection", () => {
  const studentAnim = calculateSingleItemQuote({
    subcategory: "animation_character",
    pricingStandard: "equity",
    inputs: { hours: 1, anim_tier: "0.55" }
  });
  // 1 * 220 * 0.55 = 121 (above £110 student minimum floor)
  assert.equal(studentAnim.total, 121);

  const seriesAnim = calculateSingleItemQuote({
    subcategory: "animation_character",
    pricingStandard: "agency",
    inputs: { hours: 2, anim_tier: "1.75" }
  });
  // 2 * 300 * 1.75 = 1050
  assert.equal(seriesAnim.total, 1050);
});

// --------------------------------------------------------------------------
// 10. FULL 28-CATEGORY MATRIX, SCHEMA PARITY & XSS SANITIZATION AUDIT
// --------------------------------------------------------------------------
it("verifies all 28 subcategories calculate positive quotes and render Step 3 templates in Agency & Equity modes", () => {
  const subcategories = Object.keys(RATES);
  assert.equal(subcategories.length, 28);

  for (const sub of subcategories) {
    for (const std of ["agency", "equity"]) {
      const quote = calculateSingleItemQuote({
        subcategory: sub,
        pricingStandard: std,
        inputs: {}
      });
      assert.ok(Number.isFinite(quote.total) && quote.total > 0, `Invalid total for ${sub} (${std}): ${quote.total}`);
      assert.ok(Array.isArray(quote.lines) && quote.lines.length > 0, `Empty breakdown lines for ${sub} (${std})`);

      const html = renderDynamicVariables(sub, std, {}, "");
      assert.ok(typeof html === "string" && html.length > 20, `Empty template HTML for ${sub} (${std})`);
    }
  }
});

it("verifies schema parity between data/rates.json and js/config.js RATES", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ratesJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/rates.json"), "utf8"));
  assert.deepEqual(Object.keys(ratesJson).sort(), Object.keys(RATES).sort());
});

it("sanitizes unsafe HTML payloads in escapeHtml", () => {
  const malicious = `<script>alert("xss")</script><img src=x onerror='steal()'>`;
  const escaped = escapeHtml(malicious);
  assert.ok(!escaped.includes("<script>"));
  assert.ok(escaped.includes("&lt;script&gt;"));
  assert.ok(escaped.includes("&#039;steal()&#039;"));
});

console.log(`\nTest Summary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}

