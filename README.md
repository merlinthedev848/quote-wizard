# Chris Kendall Voiceover — Quote Estimator Wizard (v2.0)

An interactive, multi-step voiceover pricing estimation engine and client booking portal designed for [Chris Kendall Voiceover](https://chriskendallvo.com/). Aligned with UK Equity Union minimums and commercial Agency industry standards.

---

## Architecture & Design Overview

```
quote-wizard/
├── js/
│   ├── api.js           # Resilient FX & Perfex CRM HTTP client
│   ├── app.js           # Main UI coordinator, event delegation & ticker animations
│   ├── calculator.js    # Pure mathematical rate calculation engine & FX converters
│   ├── config.js        # Rates matrices, RAJAR station lists, constants & endpoints
│   ├── state.js         # Reactive central store with subscriber pattern
│   ├── templates.js     # Sanitized dynamic HTML template builders
│   └── toast.js         # Non-blocking accessible notification toast manager
├── data/
│   ├── ilr_stations.json # UK Independent Local Radio stations & reach database
│   └── rates.json        # Base session fees & rate metrics
├── test/
│   └── calculator.test.mjs # Automated unit test suite
├── index.html           # Accessible semantic multi-step wizard markup
├── styles.css           # Neo-Brutalist design system matching chriskendallvo.com
├── server.js            # Hardened static HTTP server with streaming & security headers
├── package.json         # Project manifest & npm scripts
└── README.md            # System documentation & developer guide
```

---

## Key Features

- **Multi-Category Pricing Model**: 20+ specialized voiceover categories including Commercial Broadcast (TV, Radio, Cinema), Corporate Narration, E-Learning, IVR / Telephony, Video Games (AAA/Indie), Audiobooks (PFH), and AI Voice Models.
- **Dual Rate Standards**: Instant toggle between UK Equity Union Minimums and Commercial Agency standard rates.
- **Dynamic Multi-Currency**: Real-time FX conversion (`GBP`, `USD`, `EUR`) via Frankfurter API with 1-hour `localStorage` caching and international market premiums (SAG-AFTRA 2.5×, EMA 1.5×).
- **Interactive Multi-Item Cart**: Bundle multiple voiceover services into a unified quotation.
- **Dual Booking Pathways**:
  1. **Official PDF Estimate**: Direct API dispatch to Perfex CRM beta staging table.
  2. **Studio Availability Enquiry**: Formatted `mailto:` workflow with automated project summaries.
- **Accessible & Responsive**: Fully keyboard navigable (`Tab`, `Enter`, `Space`), screen-reader friendly with `aria-live` price counters, and fluid mobile/desktop Neo-Brutalist layouts.

---

## Quick Start & Running Locally

### Prerequisites
- Node.js (v18.0+ recommended)

### Run the Server
```bash
npm start
```
The server will start at `http://localhost:8082/`.

### Run Automated Tests
```bash
npm test
```
Executes the test suite covering rate calculations, renewals, sliding scales, discounts, and currency multipliers.

---

## Testing & Verification

The test suite in [`test/calculator.test.mjs`](file:///C:/Users/chris.kendall/.gemini/antigravity/scratch/quote-wizard/test/calculator.test.mjs) verifies:
- RAJAR UK ILR station reach tiers.
- TV Commercial 1st year buyouts and multi-year usage renewal calculations.
- E-Learning word count sliding scales.
- Narration minimum fee floors (£150).
- Telephony industry discounts (AMA / EMA -20%).
- Video game session hour blocks and AAA production tiers.
- Multi-currency market multipliers (USD SAG-AFTRA 2.5×, EUR EMA 1.5×).
