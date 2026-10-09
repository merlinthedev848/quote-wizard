/**
 * @file booking_dryrun.test.mjs
 * @description Comprehensive dry-run test suite for shopping cart multi-item bundling,
 * Availability Enquiry (Mailto) generation, and Official Quote Registration (Perfex CRM).
 */

import assert from "node:assert/strict";
import {
  calculateSingleItemQuote,
  calculateFullQuote,
  convertAmount,
  formatCurrency
} from "../js/calculator.js";
import {
  buildEnquiryMailtoPayload,
  buildPerfexPayload,
  generateFormattedSummaryText
} from "../js/app.js";
import { RATES, TVR_TIERS, DIGITAL_IMPRESSIONS_TIERS, API_ENDPOINTS, MARKET_MULTIPLIERS } from "../js/config.js";

console.log("▶ Starting Shopping Cart & Booking Pathways Dry-Run Test Suite...\n");

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
// 1. ULTRA-GRANULAR SHOPPING CART MULTI-ITEM BUNDLE
// --------------------------------------------------------------------------
it("calculates a multi-item bundle with TV Commercial, E-Learning, and IVR", () => {
  const appState = {
    pricingStandard: "agency",
    currency: "GBP",
    exchangeRates: { GBP: 1, USD: 1.27, EUR: 1.17 },
    selectedCategory: "corporate",
    selectedSubcategory: "corporate_video",
    inputs: { words: 500, corp_usage: "1.0" }, // Active item: 500w @ £0.30 = £150
    selectedStations: [],
    isCurrentItemInCart: false,
    cart: [
      {
        id: 101,
        category: "broadcast",
        subcategory: "tv_commercial",
        inputs: { bsf: 350, reach: "6.0", duration: "1.0" }, // 350 * 6 = £2,100
        stations: []
      },
      {
        id: 102,
        category: "corporate",
        subcategory: "elearning",
        inputs: { words: 3000 }, // 3000w @ £0.20 = £600
        stations: []
      },
      {
        id: 103,
        category: "specialty",
        subcategory: "telephony_bundles",
        inputs: { prompts: 20, langs: 2, ivr_membership: "ama" }, // 20 * 2 * £12 * 0.8 = £384
        stations: []
      }
    ]
  };

  const extrasForm = {
    editing: { enabled: true, hours: 2, rate: 50 }, // +£100
    remote: { enabled: true, system: 100 }, // +£100
    urgent: { enabled: true } // +20% rush surcharge
  };

  const quote = calculateFullQuote(appState, extrasForm);

  // Cart total = 2100 + 600 + 384 = 3084
  // Active item total = 150
  // Base Services total = 3234
  // Extras = 100 + 100 = 200
  // Subtotal = 3434
  // Urgent 20% = 686.80
  // Total = 4120.80
  assert.equal(quote.subtotal, 3434);
  assert.equal(quote.total, 4120.80);

  // Check that all lines have granular tags
  assert.ok(quote.lines.length >= 6);
  assert.ok(quote.lines.some(l => l.isCartItem && l.name.includes("TV Commercial")));
  assert.ok(quote.lines.some(l => l.isCartItem && l.name.includes("E-Learning")));
  assert.ok(quote.lines.some(l => l.isCartItem && l.name.includes("Telephony Bundle")));
  assert.ok(quote.lines.some(l => l.name.includes("Add-on: Audio Editing")));
  assert.ok(quote.lines.some(l => l.name.includes("Add-on: Directed Remote Session")));
  assert.ok(quote.lines.some(l => l.name.includes("Surcharge: 24-Hour Urgent Delivery")));
});

// --------------------------------------------------------------------------
// 2. DRY RUN: AVAILABILITY ENQUIRY PATHWAY (Mailto URL & Structured Body)
// --------------------------------------------------------------------------
it("generates correct Mailto URL and project details for Availability Enquiry", () => {
  const appState = {
    pricingStandard: "equity",
    currency: "GBP",
    exchangeRates: { GBP: 1, USD: 1.27, EUR: 1.17 },
    selectedCategory: "specialty",
    selectedSubcategory: "digital_ads",
    inputs: { digital_model: "impressions", impression_tier: "1.5m" }, // £450
    selectedStations: [],
    isCurrentItemInCart: false,
    cart: []
  };

  const quote = calculateFullQuote(appState, {});
  assert.equal(quote.total, 450);

  const mockFormData = {
    name: "Sarah Connor",
    email: "sarah@cyberdyne.co.uk",
    company: "Cyberdyne Systems",
    phone: "+44 7700 900123",
    date: "2026-11-15",
    time: "10:00 AM",
    project: "Cyberdyne Online Campaign",
    message: "Need voiceover recorded with SourceConnect remote direction."
  };

  const result = buildEnquiryMailtoPayload({
    state: appState,
    quote,
    formData: mockFormData
  });

  // Verify recipient
  assert.equal(result.recipient, API_ENDPOINTS.SUPPORT_EMAIL);

  // Verify Subject
  assert.ok(result.subject.includes("Cyberdyne Online Campaign"));
  assert.ok(result.subject.includes("£450.00"));

  // Verify Body content
  assert.ok(result.body.includes("Sarah Connor"));
  assert.ok(result.body.includes("Cyberdyne Systems"));
  assert.ok(result.body.includes("sarah@cyberdyne.co.uk"));
  assert.ok(result.body.includes("2026-11-15"));
  assert.ok(result.body.includes("10:00 AM"));
  assert.ok(result.body.includes("Need voiceover recorded with SourceConnect remote direction."));
  assert.ok(result.body.includes("Union Agreement: Confirmed official Equity contract will be utilized."));
  assert.ok(result.body.includes("ESTIMATED TOTAL: £450.00"));

  // Verify Mailto URL format
  assert.ok(result.mailtoUrl.startsWith(`mailto:${API_ENDPOINTS.SUPPORT_EMAIL}?subject=`));
  assert.ok(result.mailtoUrl.includes("body="));
});

// --------------------------------------------------------------------------
// 3. DRY RUN: REGISTRATION & OFFICIAL ESTIMATE PATHWAY (Perfex CRM Payload)
// --------------------------------------------------------------------------
it("builds valid Perfex CRM API payload for official quote registration", () => {
  const appState = {
    pricingStandard: "agency",
    currency: "USD",
    exchangeRates: { GBP: 1, USD: 1.30, EUR: 1.20 },
    selectedCategory: "broadcast",
    selectedSubcategory: "tv_commercial",
    inputs: { bsf: 350, reach: "6.0", duration: "1.0" }, // 350 * 6 = 2100 GBP
    selectedStations: [],
    isCurrentItemInCart: false,
    cart: []
  };

  const quote = calculateFullQuote(appState, {});
  assert.equal(quote.total, 2100);

  const mockRegData = {
    company: "Acme Global Studios",
    website: "https://acmeglobal.com",
    companyPhone: "+1 555 123 4567",
    address: "742 Evergreen Terrace",
    city: "Los Angeles",
    regionState: "CA",
    zip: "90210",
    country: "244", // United States
    firstName: "Alex",
    lastName: "Murphy",
    email: "alex.murphy@acmeglobal.com",
    contactPhone: "+1 555 987 6543"
  };

  const payload = buildPerfexPayload({
    state: appState,
    quote,
    formData: mockRegData
  });

  // Verify Client Structure
  assert.equal(payload.client.company, "Acme Global Studios");
  assert.equal(payload.client.website, "https://acmeglobal.com");
  assert.equal(payload.client.address, "742 Evergreen Terrace");
  assert.equal(payload.client.city, "Los Angeles");
  assert.equal(payload.client.state, "CA");
  assert.equal(payload.client.zip, "90210");
  assert.equal(payload.client.country, "244");
  assert.equal(payload.client.firstname, "Alex");
  assert.equal(payload.client.lastname, "Murphy");
  assert.equal(payload.client.email, "alex.murphy@acmeglobal.com");

  // Verify Estimate Structure
  assert.equal(payload.estimate.currency, "USD");
  assert.equal(payload.estimate.currency_multiplier, 2.5); // SAG-AFTRA 2.5x
  assert.equal(payload.estimate.subtotal, 2100);
  assert.equal(payload.estimate.total, 2100);
  assert.equal(payload.estimate.project_name, "Voiceover Quote");
  assert.ok(Array.isArray(payload.estimate.items));
  assert.equal(payload.estimate.items.length, quote.lines.length);

  // Verify line item attributes
  const firstItem = payload.estimate.items[0];
  assert.ok(firstItem.description);
  assert.equal(firstItem.qty, 1);
  assert.ok(typeof firstItem.rate === "number");
});

console.log(`\nDry-Run Summary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
