/* ==========================================================================
   APP.JS - CK MEDIA VOICEOVER QUOTE ESTIMATOR LOGIC
   ========================================================================== */

// --------------------------------------------------------------------------
// STATION REACH DATA (RAJAR UK)
// --------------------------------------------------------------------------
const ILR_STATIONS = [
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

// --------------------------------------------------------------------------
// APPLICATION STATE
// --------------------------------------------------------------------------
const state = {
  currentStep: 1,
  selectedCategory: null,     // 'broadcast' | 'corporate' | 'specialty'
  selectedSubcategory: null,  // e.g., 'tv_commercial', 'explainer_video'
  selectedPathway: null,      // 'estimate' | 'enquiry'
  pricingStandard: 'agency',  // 'agency' | 'equity'
  theme: 'dark',
  ilrSearchQuery: '',
  selectedStations: [],       // Array of station names
  inputs: {},                 // Step 3 inputs cache
  currency: 'GBP',            // Active display currency
  // Seeded with approximate rates — overwritten by live fetch on load
  exchangeRates: { GBP: 1, USD: 1.27, EUR: 1.17 },
  cart: [],
  isCurrentItemInCart: false
};

// Currency symbols map
const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€' };

// International market rate premiums (applied BEFORE currency conversion)
// US SAG-AFTRA / EU market rates are significantly higher than UK agency rates
const MARKET_MULTIPLIERS = {
  GBP: 1.0,   // UK agency baseline
  USD: 2.5,   // US market (SAG-AFTRA / American commercial rates)
  EUR: 1.5    // European market premium over UK
};

// --------------------------------------------------------------------------
// CONSTANTS & FORMULAS (EQUITY VS AGENCY)
// --------------------------------------------------------------------------
const RATES = {
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

// --------------------------------------------------------------------------
// INITIALIZATION & DOM EVENTS
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initWizard();
  initStandardToggle();
  initExtrasHandlers();
  initFormSubmit();
  initCurrencySwitcher();
  fetchExchangeRates();
});

// --------------------------------------------------------------------------
// LIVE CURRENCY CONVERSION
// --------------------------------------------------------------------------
function fetchExchangeRates() {
  const rateInfo = document.getElementById("currency-rate-info");
  if (rateInfo) {
    rateInfo.textContent = "";
    rateInfo.className = "currency-rate-info";
  }
  
  fetch("https://api.frankfurter.app/latest?from=GBP&to=USD,EUR")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      state.exchangeRates.GBP = 1;
      state.exchangeRates.USD = parseFloat(data.rates.USD);
      state.exchangeRates.EUR = parseFloat(data.rates.EUR);
      
      if (rateInfo) {
        rateInfo.textContent = `1 GBP = $${state.exchangeRates.USD.toFixed(4)} / €${state.exchangeRates.EUR.toFixed(4)}`;
        rateInfo.className = "currency-rate-info";
      }
      updateQuote();
    })
    .catch(err => {
      console.warn("Exchange rate fetch failed, using approximate rates:", err);
      // Seeded approximate rates remain active — show nothing to the user
      if (rateInfo) {
        rateInfo.textContent = "";
      }
      updateQuote();
    });
}

function initCurrencySwitcher() {
  const btns = document.querySelectorAll(".currency-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      state.currency = btn.dataset.currency;
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // International projects always use Agency rates
      enforceCurrencyRateRule();
      updateQuote();
    });
  });
}

function enforceCurrencyRateRule() {
  const btnEquity = document.getElementById("btn-std-equity");
  const intlNotice = document.getElementById("intl-agency-notice");
  const multiplier = MARKET_MULTIPLIERS[state.currency];
  
  const p1 = document.getElementById("union-notice-p1");
  const p2 = document.getElementById("union-notice-p2");
  const warningText = document.getElementById("panel-union-warning-text");

  if (state.currency === 'USD') {
    if (p1) p1.innerHTML = `Union rates are strictly regulated minimums. Selecting this option requires you to sign an official <strong>SAG-AFTRA contract</strong>.`;
    if (p2) p2.innerHTML = `I confirm this project is union-compliant and will utilize an official SAG-AFTRA contract. *`;
    if (warningText) warningText.textContent = "SAG-AFTRA";
    // US project — union option becomes SAG-AFTRA
    if (btnEquity) {
      btnEquity.disabled = false;
      btnEquity.style.opacity = "";
      btnEquity.style.cursor = "";
    }
    if (intlNotice) {
      intlNotice.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> US Market &mdash; Agency or SAG-AFTRA &nbsp;&bull;&nbsp; &times;${multiplier} market premium applied`;
      intlNotice.style.display = "flex";
    }
  } else if (state.currency === 'EUR') {
    if (p1) p1.innerHTML = `Union rates are strictly regulated minimums. Selecting this option requires you to sign an official <strong>EMA contract</strong>.`;
    if (p2) p2.innerHTML = `I confirm this project is union-compliant and will utilize an official EMA contract. *`;
    if (warningText) warningText.textContent = "EMA";
    // European project — union option becomes EMA
    if (btnEquity) {
      btnEquity.disabled = false;
      btnEquity.style.opacity = "";
      btnEquity.style.cursor = "";
    }
    if (intlNotice) {
      intlNotice.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> EU Market &mdash; Agency or EMA rates &nbsp;&bull;&nbsp; &times;${multiplier} market premium applied`;
      intlNotice.style.display = "flex";
    }
  } else {
    if (p1) p1.innerHTML = `Union rates are strictly regulated minimums. Selecting this option requires you to sign an official <strong>Equity Form of Engagement contract</strong>.`;
    if (p2) p2.innerHTML = `I confirm this project is union-compliant and will utilize an official Equity Form of Engagement contract. *`;
    if (warningText) warningText.textContent = "Equity";
    // GBP — restore UK Equity label
    if (btnEquity) {
      btnEquity.disabled = false;
      btnEquity.style.opacity = "";
      btnEquity.style.cursor = "";
    }
    if (intlNotice) {
      intlNotice.textContent = "";
      intlNotice.style.display = "none";
    }
  }
}

function convertAmount(gbpAmount) {
  const marketMultiplier = MARKET_MULTIPLIERS[state.currency] || 1.0;
  const fxRate = state.exchangeRates[state.currency] || 1;
  // Apply market premium first, then convert to target currency
  return gbpAmount * marketMultiplier * fxRate;
}

function formatCurrency(gbpAmount) {
  const symbol = CURRENCY_SYMBOLS[state.currency] || '£';
  const converted = convertAmount(gbpAmount);
  return `${symbol}${converted.toFixed(2)}`;
}

// Pricing Standard Toggle Management
function initStandardToggle() {
  const btnAgency = document.getElementById("btn-std-agency");
  const btnEquity = document.getElementById("btn-std-equity");
  
  if (btnAgency && btnEquity) {
    btnAgency.addEventListener("click", () => {
      if (state.pricingStandard !== 'agency') {
        state.pricingStandard = 'agency';
        btnAgency.classList.add("active");
        btnEquity.classList.remove("active");
        updateDefaultPricingValues();
        updateQuote();
      }
    });
    
    btnEquity.addEventListener("click", () => {
      if (state.pricingStandard !== 'equity') {
        state.pricingStandard = 'equity';
        btnEquity.classList.add("active");
        btnAgency.classList.remove("active");
        updateDefaultPricingValues();
        updateQuote();
      }
    });
  }
}

// Update DOM sliders dynamically when standard changes
function updateDefaultPricingValues() {
  const sub = state.selectedSubcategory;
  const std = state.pricingStandard;
  if (!sub) return;
  
  const standardRates = RATES[sub][std];
  if (!standardRates) return;
  
  const bsfInput = document.getElementById("input-bsf");
  if (bsfInput) {
    const defaultBsf = standardRates.bsf;
    if (defaultBsf) {
      bsfInput.value = defaultBsf;
      state.inputs.bsf = defaultBsf;
      const disp = document.getElementById("disp-bsf");
      if (disp) disp.textContent = "£" + defaultBsf;
    }
  }
  
  const hourlyRateInput = document.getElementById("input-hourly-rate");
  if (hourlyRateInput) {
    const defaultHourly = standardRates.ratePerHour;
    if (defaultHourly) {
      hourlyRateInput.value = defaultHourly;
      state.inputs.hourly_rate = defaultHourly;
      const disp = document.getElementById("disp-hourly-rate");
      if (disp) disp.textContent = "£" + defaultHourly;
    }
  }
}

// --------------------------------------------------------------------------
// WIZARD NAVIGATION & STEP FLOW
// --------------------------------------------------------------------------
function initWizard() {
  // Category selections (Step 1)
  const categoryCards = document.querySelectorAll(".card-selector[data-category]");
  categoryCards.forEach(card => {
    card.addEventListener("click", () => {
      categoryCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      state.selectedCategory = card.dataset.category;
      
      // Reset Step 2 subcategory selection
      const activeRadio = document.querySelector('input[name="subcategory"]:checked');
      if (activeRadio) activeRadio.checked = false;
      state.selectedSubcategory = null;
      updateNavButtons();
    });
  });

  // Subcategory radio selections (Step 2)
  const subRadios = document.querySelectorAll('input[name="subcategory"]');
  subRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      state.selectedSubcategory = radio.value;
      updateNavButtons();
    });
  });

  // Next / Prev button triggers
  document.querySelectorAll('[data-action="next"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateWizard(1);
    });
  });

  document.querySelectorAll('[data-action="prev"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateWizard(-1);
    });
  });

  // Direct dot click navigation
  document.querySelectorAll(".step-dot").forEach(dot => {
    dot.addEventListener("click", () => {
      const stepNum = parseInt(dot.dataset.step);
      if (stepNum < state.currentStep || dot.classList.contains("completed") || dot.classList.contains("active")) {
        setStep(stepNum);
      }
    });
  });
  
  // Pathway Selection (Step 5)
  const pathwayCards = document.querySelectorAll(".card-selector[data-pathway]");
  pathwayCards.forEach(card => {
    card.addEventListener("click", () => {
      pathwayCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      state.selectedPathway = card.dataset.pathway;
      updateNavButtons();
      
      // Auto-advance to Step 6 for better UX
      setTimeout(() => {
        navigateWizard(1);
      }, 250);
    });
  });
  
  updateNavButtons();
}

function setStep(stepNum) {
  state.currentStep = stepNum;
  
  // Show active step container, hide others
  document.querySelectorAll(".step-content").forEach((c, index) => {
    c.classList.toggle("active", (index + 1) === stepNum);
  });
  
  // Update timeline dots
  document.querySelectorAll(".step-dot").forEach((dot) => {
    const s = parseInt(dot.dataset.step);
    dot.classList.toggle("active", s === stepNum);
    dot.classList.toggle("completed", s < stepNum);
  });
  
  // Progress bar fill width
  const progressFill = document.getElementById("progress-bar-fill");
  if (progressFill) {
    const width = ((stepNum - 1) / 5) * 100;
    progressFill.style.width = `${width}%`;
  }
  
  // Dynamic behavior for specific steps
  if (stepNum === 2) {
    document.querySelectorAll(".subcategory-panel").forEach(p => {
      p.style.display = p.dataset.branch === state.selectedCategory ? "block" : "none";
    });
  } else if (stepNum === 3) {
    buildDynamicVariables();
  } else if (stepNum === 6) {
    const pathwayEstimateForm = document.getElementById("pathway-estimate-form");
    const pathwayEnquiryForm = document.getElementById("pathway-enquiry-form");
    const unionComplianceContainer = document.getElementById("union-compliance-container");
    const btnSubmit = document.getElementById("btn-submit-quote");
    
    // Union compliance warning
    if (unionComplianceContainer) {
      unionComplianceContainer.style.display = state.pricingStandard === 'equity' ? "block" : "none";
    }

    if (state.selectedPathway === "estimate") {
      pathwayEstimateForm.style.display = "block";
      pathwayEnquiryForm.style.display = "none";
      if (btnSubmit) {
        const btnText = btnSubmit.querySelector(".btn-text");
        const btnIcon = btnSubmit.querySelector(".action-icon");
        if (btnText) btnText.textContent = "Get Official Quote";
        if (btnIcon) btnIcon.innerHTML = `<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>`;
      }
    } else {
      pathwayEstimateForm.style.display = "none";
      pathwayEnquiryForm.style.display = "block";
      if (btnSubmit) {
        const btnText = btnSubmit.querySelector(".btn-text");
        const btnIcon = btnSubmit.querySelector(".action-icon");
        if (btnText) btnText.textContent = "Send Request";
        if (btnIcon) btnIcon.innerHTML = `<path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path>`;
      }
    }
    
    const finalActionsContainer = document.getElementById("final-actions-container");
    if (finalActionsContainer) {
      finalActionsContainer.style.display = "block";
    }
  }
  
  updateNavButtons();
  updateQuote();
}

function navigateWizard(direction) {
  const targetStep = state.currentStep + direction;
  if (targetStep >= 1 && targetStep <= 6) {
    setStep(targetStep);
  }
}

function updateNavButtons() {
  const step1Btn = document.querySelector('#step-1 [data-action="next"]');
  if (step1Btn) step1Btn.disabled = !state.selectedCategory;
  
  const step2Btn = document.querySelector('#step-2 [data-action="next"]');
  if (step2Btn) step2Btn.disabled = !state.selectedSubcategory;
  
  const step5Btn = document.getElementById("btn-step-5-next");
  if (step5Btn) step5Btn.disabled = !state.selectedPathway;
}

// --------------------------------------------------------------------------
// DYNAMIC FIELDS INJECTION (STEP 3)
// --------------------------------------------------------------------------
function buildDynamicVariables() {
  const container = document.getElementById("dynamic-variables-container");
  if (!container) return;
  
  saveInputs();
  container.innerHTML = ""; 
  const sub = state.selectedSubcategory;
  
  let fieldsHTML = "";
  
  switch(sub) {
    case "tv_commercial":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="200" max="600" step="50" value="${state.inputs.bsf || (state.pricingStandard === 'equity' ? 220 : 350)}"/>
            <span class="slider-value-display" id="disp-bsf">£${state.inputs.bsf || (state.pricingStandard === 'equity' ? 220 : 350)}</span>
          </div>
          <span class="field-hint">Standard BSF ranges: Equity minimum £220, Agency market rate £350.</span>
        </div>
        
        <div class="var-field-group">
          <label for="input-reach">Media Reach / Market</label>
          <select id="input-reach">
            <option value="1.0" ${state.inputs.reach === "1.0" ? "selected" : ""}>Local / Regional (100% Buyout)</option>
            <option value="2.5" ${state.inputs.reach === "2.5" ? "selected" : ""}>Multi-Regional / Small Satellite (250% Buyout)</option>
            <option value="6.0" ${state.inputs.reach === "6.0" ? "selected" : ""}>National Campaign - UK & Ireland (600% Buyout)</option>
            <option value="12.0" ${state.inputs.reach === "12.0" ? "selected" : ""}>Worldwide / Global Broadcast (1200% Buyout)</option>
          </select>
        </div>
        
        <div class="var-field-group">
          <label for="input-duration">Campaign Duration</label>
          <select id="input-duration">
            <option value="1.0" ${state.inputs.duration === "1.0" ? "selected" : ""}>3 Months (1.0x)</option>
            <option value="1.8" ${state.inputs.duration === "1.8" ? "selected" : ""}>6 Months (1.8x)</option>
            <option value="3.0" ${state.inputs.duration === "3.0" ? "selected" : ""}>1 Year / 12 Months (3.0x)</option>
            <option value="10.0" ${state.inputs.duration === "10.0" ? "selected" : ""}>Perpetuity / In Perpetuity Buyout (10.0x)</option>
          </select>
        </div>
      `;
      break;
      
    case "radio_generic":
    case "cinema": {
      const standardBsf = sub === "cinema" ? (state.pricingStandard === 'equity' ? 220 : 350) : (state.pricingStandard === 'equity' ? 180 : 250);
      fieldsHTML = `
        <div class="var-field-group">
          <label>Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="500" step="50" value="${state.inputs.bsf || standardBsf}"/>
            <span class="slider-value-display" id="disp-bsf">£${state.inputs.bsf || standardBsf}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-reach">${sub === "cinema" ? "Cinema Scale" : "Radio Network"}</label>
          <select id="input-reach">
            <option value="1.0" ${state.inputs.reach === "1.0" ? "selected" : ""}>Local Commercial (1.0x)</option>
            <option value="2.5" ${state.inputs.reach === "2.5" ? "selected" : ""}>Regional Broadcast (2.5x)</option>
            <option value="6.0" ${state.inputs.reach === "6.0" ? "selected" : ""}>National Broadcast (6.0x)</option>
          </select>
        </div>
        
        <div class="var-field-group">
          <label for="input-spots">Number of Spots / Scripts</label>
          <input type="number" id="input-spots" min="1" max="20" value="${state.inputs.spots || 1}"/>
          <span class="field-hint">First spot at full buyout; subsequent spots discounted by 50%.</span>
        </div>
      `;
      break;
    }
      
    case "radio_ilr":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="400" step="25" value="${state.inputs.bsf || (state.pricingStandard === 'equity' ? 180 : 250)}"/>
            <span class="slider-value-display" id="disp-bsf">£${state.inputs.bsf || (state.pricingStandard === 'equity' ? 180 : 250)}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label>Select Target ILR Stations (RAJAR)</label>
          <input type="text" id="ilr-search" placeholder="Type station name to filter..." value="${state.ilrSearchQuery}"/>
          
          <div class="station-list-container" id="station-list">
            <!-- Populated dynamically -->
          </div>
          <span class="field-hint">Select all stations that will broadcast the commercial. Listener reach maps to specific Equity Spot fee schedules.</span>
        </div>
        
        <div class="var-field-group">
          <label for="input-spots">Number of Spots</label>
          <input type="number" id="input-spots" min="1" max="50" value="${state.inputs.spots || 1}"/>
        </div>
        
        <div class="var-field-group">
          <label>Campaign Duration / Usage</label>
          <select id="input-duration">
            <option value="1.0" ${state.inputs.duration === "1.0" ? "selected" : ""}>Up to 13 Weeks (3 Months) - Base</option>
            <option value="1.5" ${state.inputs.duration === "1.5" ? "selected" : ""}>Up to 26 Weeks (6 Months) - 1.5x Multiplier</option>
            <option value="2.5" ${state.inputs.duration === "2.5" ? "selected" : ""}>Up to 52 Weeks (1 Year) - 2.5x Multiplier</option>
          </select>
        </div>
      `;
      break;
      
    case "trailers_promos":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="400" step="25" value="${state.inputs.bsf || (state.pricingStandard === 'equity' ? 180 : 250)}"/>
            <span class="slider-value-display" id="disp-bsf">£${state.inputs.bsf || (state.pricingStandard === 'equity' ? 180 : 250)}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-promo-usage">Distribution Channel</label>
          <select id="input-promo-usage">
            <option value="1.0" ${state.inputs.promo_usage === "1.0" ? "selected" : ""}>Single Channel / Local Station (1.0x)</option>
            <option value="2.0" ${state.inputs.promo_usage === "2.0" ? "selected" : ""}>Multi-Channel / Regional Network (2.0x)</option>
            <option value="3.0" ${state.inputs.promo_usage === "3.0" ? "selected" : ""}>National Network / Main Broadcast (3.0x)</option>
            <option value="4.0" ${state.inputs.promo_usage === "4.0" ? "selected" : ""}>VOD / Streaming Platforms (Netlfix, Prime, etc.) (4.0x)</option>
          </select>
        </div>
      `;
      break;
      
    case "voice_god":
    case "adr_dubbing": {
      let stdHourRate = state.pricingStandard === 'equity' ? 200 : 300;
      if (sub === "adr_dubbing") {
        stdHourRate = state.pricingStandard === 'equity' ? 180 : 250;
      }
      
      fieldsHTML = `
        <div class="var-field-group">
          <label>Estimated Session / Recording Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="0.5" max="8" step="0.5" value="${state.inputs.hours || 1}"/>
            <span class="slider-value-display" id="disp-hours">${state.inputs.hours || 1} hr</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label>Base Hourly Rate (£)</label>
          <div class="slider-container">
            <input type="range" id="input-hourly-rate" min="150" max="500" step="25" value="${state.inputs.hourly_rate || stdHourRate}"/>
            <span class="slider-value-display" id="disp-hourly-rate">£${state.inputs.hourly_rate || stdHourRate}</span>
          </div>
        </div>
      `;
      break;
    }
      
    case "corporate_video":
    case "medical_narration":
    case "museum_exhibition": {
      fieldsHTML = `
        <div class="var-field-group">
          <label>Estimated Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="100" max="5000" step="100" value="${state.inputs.words || 500}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="50" max="50000" step="1" value="${state.inputs.words || 500}" placeholder="Type count"/>
          </div>
          <span class="field-hint">A typical narration script reads at approximately 150 words per minute.</span>
        </div>
      `;
      
      if (sub === "corporate_video") {
        fieldsHTML += `
          <div class="var-field-group">
            <label for="input-corp-usage">Project Distribution (Usage Buyout)</label>
            <select id="input-corp-usage">
              <option value="1.0" ${state.inputs.corp_usage === "1.0" ? "selected" : ""}>Internal Corporate Use Only (Included / 1.0x)</option>
              <option value="2.0" ${state.inputs.corp_usage === "2.0" ? "selected" : ""}>External Use - Website / Social organic (2.0x)</option>
              <option value="4.0" ${state.inputs.corp_usage === "4.0" ? "selected" : ""}>Paid Promotion / YouTube Ads (4.0x)</option>
            </select>
          </div>
        `;
      }
      break;
    }
      
    case "explainer_video":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="50" max="3000" step="50" value="${state.inputs.words || 300}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="50" max="3000" step="1" value="${state.inputs.words || 300}" placeholder="Type count"/>
          </div>
          <span class="field-hint">A standard explainer video reads at approx. 150 words per minute.</span>
        </div>
        
        <div class="var-field-group">
          <label for="input-corp-usage">Distribution Usage</label>
          <select id="input-corp-usage">
            <option value="1.0" ${state.inputs.corp_usage === "1.0" ? "selected" : ""}>Internal Corporate / Company-wide (1.0x)</option>
            <option value="1.5" ${state.inputs.corp_usage === "1.5" ? "selected" : ""}>External Web / Organic YouTube &amp; Socials (1.5x)</option>
            <option value="3.0" ${state.inputs.corp_usage === "3.0" ? "selected" : ""}>Paid Placement / YouTube Ads / Web Pre-rolls (3.0x)</option>
          </select>
        </div>
      `;
      break;
      
    case "elearning":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Estimated Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="100" max="25000" step="100" value="${state.inputs.words || 1000}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="1" max="99999" step="1" value="${state.inputs.words || 1000}" placeholder="Type count"/>
          </div>
          <span class="field-hint">Rate card: 0–999w @ £0.60/w &nbsp;|&nbsp; 1000–2000w @ £0.30/w &nbsp;|&nbsp; 2001w+ @ £0.20/w (Equity-aligned).</span>
        </div>
      `;
      break;
      
    case "elt_educational":
      fieldsHTML = `
        <div class="var-field-group">
          <label for="input-elt-band">Educational Complexity (Band)</label>
          <select id="input-elt-band">
            <option value="A" ${state.inputs.elt_band === "A" ? "selected" : ""}>Band A: Generic readings, single voice</option>
            <option value="B" ${state.inputs.elt_band === "B" ? "selected" : ""}>Band B: Educational dialogues, teaching material</option>
            <option value="C" ${state.inputs.elt_band === "C" ? "selected" : ""}>Band C: Specialized scientific or technical tests</option>
            <option value="D" ${state.inputs.elt_band === "D" ? "selected" : ""}>Band D: Character acting, dramatic educational scripts</option>
          </select>
        </div>
        
        <div class="var-field-group">
          <label for="input-elt-session">Session Length</label>
          <select id="input-elt-session">
            <option value="half" ${state.inputs.elt_session === "half" ? "selected" : ""}>Half Day Session (Up to 3 hours)</option>
            <option value="full" ${state.inputs.elt_session === "full" ? "selected" : ""}>Full Day Session (Up to 6 hours)</option>
          </select>
        </div>
      `;
      break;
      
    case "psa":
      fieldsHTML = `
        <div class="var-field-group">
          <label for="input-corp-usage">Campaign Scale</label>
          <select id="input-corp-usage">
            <option value="1.0" ${state.inputs.corp_usage === "1.0" ? "selected" : ""}>Local / Regional drive (1.0x)</option>
            <option value="2.5" ${state.inputs.corp_usage === "2.5" ? "selected" : ""}>National broadcast / Large Charity drive (2.5x)</option>
          </select>
        </div>
      `;
      break;
      
    case "video_games":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Estimated Session Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="1" max="8" step="1" value="${state.inputs.hours || 3}"/>
            <span class="slider-value-display" id="disp-hours">${state.inputs.hours || 3} hr</span>
          </div>
          <span class="field-hint">Union-compliant standard is a 3-hour minimum block booking.</span>
        </div>
        
        <div class="var-field-group">
          <label for="input-game-tier">Production Scale (Tier)</label>
          <select id="input-game-tier">
            <option value="1.0" ${state.inputs.game_tier === "1.0" ? "selected" : ""}>Indie / Crowdfunded Studio (No Buyout / 1.0x)</option>
            <option value="1.8" ${state.inputs.game_tier === "1.8" ? "selected" : ""}>AAA Title / Major Global Franchise (1.8x Buyout)</option>
          </select>
        </div>
      `;
      break;
      
    case "audiobooks":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Finished Audio Hours (PFH)</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="1" max="25" step="1" value="${state.inputs.hours || 6}"/>
            <span class="slider-value-display" id="disp-hours">${state.inputs.hours || 6} FH</span>
          </div>
          <span class="field-hint">Charged Per Finished Hour (PFH) which includes standard studio preparation and editing.</span>
        </div>
      `;
      break;
      
    case "ivr_basic":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="10" max="1000" step="10" value="${state.inputs.words || 100}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="1" max="9999" step="1" value="${state.inputs.words || 100}" placeholder="Type count"/>
          </div>
          <span class="field-hint">Enter exact word count or use the slider to estimate.</span>
        </div>
        <div class="var-field-group">
          <label for="input-ivr-membership">Industry Membership</label>
          <select id="input-ivr-membership">
            <option value="none" ${(state.inputs.ivr_membership || 'none') === 'none' ? 'selected' : ''}>No Membership (Standard Rate)</option>
            <option value="ama" ${state.inputs.ivr_membership === 'ama' ? 'selected' : ''}>AMA Member — American Media Association (−20%)</option>
            <option value="ema" ${state.inputs.ivr_membership === 'ema' ? 'selected' : ''}>EMA Member — European Media Association (−20%)</option>
          </select>
          <span class="field-hint">AMA &amp; EMA members are entitled to reduced IVR rates per industry agreement.</span>
        </div>
      `;
      break;
      
    case "telephony_bundles":
      fieldsHTML = `
        <div class="var-field-group">
          <label for="input-prompts">Number of Prompts</label>
          <input type="number" id="input-prompts" min="1" max="500" value="${state.inputs.prompts || 15}"/>
        </div>
        <div class="var-field-group">
          <label for="input-langs">Number of Languages / Versions</label>
          <input type="number" id="input-langs" min="1" max="10" value="${state.inputs.langs || 1}"/>
        </div>
        <div class="var-field-group">
          <label for="input-ivr-membership">Industry Membership</label>
          <select id="input-ivr-membership">
            <option value="none" ${(state.inputs.ivr_membership || 'none') === 'none' ? 'selected' : ''}>No Membership (Standard Rate)</option>
            <option value="ama" ${state.inputs.ivr_membership === 'ama' ? 'selected' : ''}>AMA Member — American Media Association (−20%)</option>
            <option value="ema" ${state.inputs.ivr_membership === 'ema' ? 'selected' : ''}>EMA Member — European Media Association (−20%)</option>
          </select>
          <span class="field-hint">AMA &amp; EMA members are entitled to reduced IVR rates per industry agreement.</span>
        </div>
      `;
      break;
      
    case "digital_ads":
    case "podcast_ads": {
      const defaultAdBsf = sub === "digital_ads" ? (state.pricingStandard === 'equity' ? 180 : 280) : (state.pricingStandard === 'equity' ? 150 : 220);
      fieldsHTML = `
        <div class="var-field-group">
          <label>Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="400" step="25" value="${state.inputs.bsf || defaultAdBsf}"/>
            <span class="slider-value-display" id="disp-bsf">£${state.inputs.bsf || defaultAdBsf}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-duration">Campaign Duration</label>
          <select id="input-duration">
            <option value="1.5" ${state.inputs.duration === "1.5" ? "selected" : ""}>13 Weeks / 3 Months (1.5x BSF)</option>
            <option value="2.5" ${state.inputs.duration === "2.5" ? "selected" : ""}>26 Weeks / 6 Months (2.5x BSF)</option>
            <option value="4.5" ${state.inputs.duration === "4.5" ? "selected" : ""}>52 Weeks / 12 Months (4.5x BSF)</option>
          </select>
        </div>
      `;
      break;
    }
      
    case "social_organic":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Duration of Video (Minutes)</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="0.5" max="15" step="0.5" value="${state.inputs.hours || 2}"/>
            <span class="slider-value-display" id="disp-hours">${state.inputs.hours || 2} min</span>
          </div>
        </div>
      `;
      break;
      
    case "podcast_intro":
      fieldsHTML = `<div class="badge-notice">Standard flat fee project. No advanced settings needed for intros/outros. Proceed to extras!</div>`;
      break;
      
    case "ai_dataset":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Recording Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="1" max="40" step="1" value="${state.inputs.hours || 5}"/>
            <span class="slider-value-display" id="disp-hours">${state.inputs.hours || 5} hr</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-game-tier">AI Buyout Licensing Scope</label>
          <select id="input-game-tier">
            <option value="1.0" ${state.inputs.game_tier === "1.0" ? "selected" : ""}>Internal Research & Testing (1.0x)</option>
            <option value="10.0" ${state.inputs.game_tier === "10.0" ? "selected" : ""}>Full Commercial AI Voice Deployment (10.0x Buyout Premium)</option>
          </select>
        </div>
      `;
      break;
      
    case "text_to_speech":
      fieldsHTML = `
        <div class="var-field-group">
          <label>Total Script Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="500" max="25000" step="500" value="${state.inputs.words || 2500}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="1" max="999999" step="1" value="${state.inputs.words || 2500}" placeholder="Type count"/>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-duration">Licensing Duration (Synthetic Playback)</label>
          <select id="input-duration">
            <option value="3.0" ${state.inputs.duration === "3.0" ? "selected" : ""}>1 Year (3.0x)</option>
            <option value="8.0" ${state.inputs.duration === "8.0" ? "selected" : ""}>3 Years (8.0x)</option>
            <option value="15.0" ${state.inputs.duration === "15.0" ? "selected" : ""}>In Perpetuity Buyout (15.0x)</option>
          </select>
        </div>
      `;
      break;
      
    case "transport_pa":
      fieldsHTML = `
        <div class="var-field-group">
          <label for="input-prompts">Number of Audio Announcements</label>
          <input type="number" id="input-prompts" min="1" max="200" value="${state.inputs.prompts || 10}"/>
        </div>
      `;
      break;
      
    default:
      fieldsHTML = `<p>No extra options needed for this subcategory.</p>`;
  }
  
  container.innerHTML = fieldsHTML;
  attachInputListeners();
  
  if (sub === "radio_ilr") {
    renderILRStations();
  }
  
  updateQuote();
}

function attachInputListeners() {
  const sliders = document.querySelectorAll('#dynamic-variables-container input[type="range"]');
  sliders.forEach(slider => {
    slider.addEventListener("input", (e) => {
      const disp = document.getElementById(slider.id.replace("input", "disp"));
      if (disp) {
        let suffix = "";
        if (slider.id.includes("words")) suffix = " w";
        else if (slider.id.includes("hours")) {
          suffix = state.selectedSubcategory === "audiobooks" ? " FH" : 
                   state.selectedSubcategory === "social_organic" ? " min" : " hr";
        }
        disp.textContent = (slider.id.includes("bsf") || slider.id.includes("hourly-rate") ? "£" : "") + e.target.value + suffix;
      }
      // Sync paired number input if present
      const numInput = document.getElementById(slider.id + "-num");
      if (numInput) numInput.value = e.target.value;
      saveInputs();
      updateQuote();
    });
  });
  
  // Bidirectional sync: number input → slider
  const wordNumInput = document.getElementById("input-words-num");
  if (wordNumInput) {
    wordNumInput.addEventListener("input", (e) => {
      const slider = document.getElementById("input-words");
      if (slider) {
        const val = parseInt(e.target.value) || 0;
        const clamped = Math.min(Math.max(val, parseInt(slider.min) || 0), parseInt(slider.max) || 99999);
        slider.value = clamped;
      }
      // Update state.inputs.words directly from the number input (allows values beyond slider max)
      state.inputs.words = parseInt(e.target.value) || 0;
      updateQuote();
    });
  }
  
  const selectsAndNumbers = document.querySelectorAll('#dynamic-variables-container select, #dynamic-variables-container input[type="number"]:not(#input-words-num)');
  selectsAndNumbers.forEach(input => {
    input.addEventListener("input", () => {
      saveInputs();
      updateQuote();
    });
  });
  
  const ilrSearch = document.getElementById("ilr-search");
  if (ilrSearch) {
    ilrSearch.addEventListener("input", (e) => {
      state.ilrSearchQuery = e.target.value;
      renderILRStations();
    });
  }
}

function renderILRStations() {
  const listContainer = document.getElementById("station-list");
  if (!listContainer) return;
  
  const query = state.ilrSearchQuery.toLowerCase();
  const filtered = ILR_STATIONS.filter(s => s.name.toLowerCase().includes(query));
  
  if (filtered.length === 0) {
    listContainer.innerHTML = '<span class="breakdown-empty">No matching stations found.</span>';
    return;
  }
  
  listContainer.innerHTML = filtered.map(station => {
    const isChecked = state.selectedStations.includes(station.name);
    return `
      <label class="station-item">
        <input type="checkbox" class="ilr-checkbox" value="${station.name}" ${isChecked ? "checked" : ""}/>
        <span class="station-name-text">${station.name}</span>
        <span class="station-info-meta">${station.reach.toLocaleString()} Reach</span>
      </label>
    `;
  }).join("");
  
  listContainer.querySelectorAll(".ilr-checkbox").forEach(box => {
    box.addEventListener("change", () => {
      if (box.checked) {
        if (!state.selectedStations.includes(box.value)) {
          state.selectedStations.push(box.value);
        }
      } else {
        state.selectedStations = state.selectedStations.filter(s => s !== box.value);
      }
      updateQuote();
    });
  });
}

function saveInputs() {
  state.isCurrentItemInCart = false;
  
  const bsfInput = document.getElementById("input-bsf");
  if (bsfInput) state.inputs.bsf = parseFloat(bsfInput.value);
  
  const hoursInput = document.getElementById("input-hours");
  if (hoursInput) state.inputs.hours = parseFloat(hoursInput.value);
  
  const hourlyRateInput = document.getElementById("input-hourly-rate");
  if (hourlyRateInput) state.inputs.hourly_rate = parseFloat(hourlyRateInput.value);
  
  const reachSelect = document.getElementById("input-reach");
  if (reachSelect) state.inputs.reach = reachSelect.value;
  
  const durationSelect = document.getElementById("input-duration");
  if (durationSelect) state.inputs.duration = durationSelect.value;
  
  const spotsInput = document.getElementById("input-spots");
  if (spotsInput) state.inputs.spots = parseInt(spotsInput.value) || 1;
  
  const promoUsageSelect = document.getElementById("input-promo-usage");
  if (promoUsageSelect) state.inputs.promo_usage = promoUsageSelect.value;
  
  const corpUsageSelect = document.getElementById("input-corp-usage");
  if (corpUsageSelect) state.inputs.corp_usage = corpUsageSelect.value;
  
  const wordsInput = document.getElementById("input-words");
  if (wordsInput) state.inputs.words = parseInt(wordsInput.value) || 0;
  
  const eltBandSelect = document.getElementById("input-elt-band");
  if (eltBandSelect) state.inputs.elt_band = eltBandSelect.value;
  
  const eltSessionSelect = document.getElementById("input-elt-session");
  if (eltSessionSelect) state.inputs.elt_session = eltSessionSelect.value;
  
  const gameTierSelect = document.getElementById("input-game-tier");
  if (gameTierSelect) state.inputs.game_tier = gameTierSelect.value;
  
  const promptsInput = document.getElementById("input-prompts");
  if (promptsInput) state.inputs.prompts = parseInt(promptsInput.value) || 0;

  const langsInput = document.getElementById("input-langs");
  if (langsInput) state.inputs.langs = parseInt(langsInput.value) || 1;

  const ivrMemberSelect = document.getElementById("input-ivr-membership");
  if (ivrMemberSelect) state.inputs.ivr_membership = ivrMemberSelect.value;
}


// --------------------------------------------------------------------------
// EXTRAS / ADD-ONS TOGGLES (STEP 4)
// --------------------------------------------------------------------------
function initExtrasHandlers() {
  const extras = ["editing", "remote", "studio", "urgent", "revisions", "script-prep"];
  
  extras.forEach(pref => {
    const check = document.getElementById(`extra-${pref}`);
    const fields = document.getElementById(`${pref}-fields`);
    
    if (check && fields) {
      check.addEventListener("change", () => {
        fields.style.display = check.checked ? "block" : "none";
        updateQuote();
      });
    }
  });
  
  const extraInputs = document.querySelectorAll('.extra-fields input, .extra-fields select');
  extraInputs.forEach(input => {
    input.addEventListener("input", updateQuote);
  });
  
  // Clipboard copy summary button
  const btnCopy = document.getElementById("btn-success-copy");
  const toast = document.getElementById("copy-success-toast");
  if (btnCopy && toast) {
    btnCopy.addEventListener("click", () => {
      const summaryText = generateSummaryText();
      navigator.clipboard.writeText(summaryText).then(() => {
        toast.className = "toast-show";
        setTimeout(() => {
          toast.className = "toast-hidden";
        }, 2000);
      }).catch(err => {
        console.error("Clipboard copy failed: ", err);
      });
    });
  }
}

// Helper to determine reach rate per spot in ILR
function ilrRateFromReach(reach) {
  if (reach <= 50000)   return 24;
  if (reach <= 100000)  return 36;
  if (reach <= 200000)  return 48;
  if (reach <= 300000)  return 60;
  if (reach <= 500000)  return 72;
  if (reach <= 1000000) return 96;
  if (reach <= 2000000) return 140;  // e.g. Heart London, Capital
  if (reach <= 3000000) return 180;  // e.g. Absolute Radio, TalkSport
  return 240;                         // 3M+ e.g. Classic FM (4.5M)
}

// --------------------------------------------------------------------------
// ESTIMATOR ENGINE - PRICING CALCULATOR
// --------------------------------------------------------------------------
function calculateBaseQuote() {
  const sub = state.selectedSubcategory;
  const std = state.pricingStandard;
  
  if (!sub) return { total: 0, lines: [] };
  
  let baseCost = 0;
  const lines = [];
  const standardRates = RATES[sub][std];
  
  switch(sub) {
    case "tv_commercial": {
      const bsf = parseFloat(state.inputs.bsf) || standardRates.bsf;
      const reach = parseFloat(state.inputs.reach) || 1.0;
      const duration = parseFloat(state.inputs.duration) || 1.0;
      
      // Correct formula: reach buyout is applied to BSF for Year 1
      // Duration beyond initial 3 months adds a renewal fee (not a full stack)
      const reachCost = bsf * reach;          // e.g. £350 × 6 = £2,100 national
      const renewalMultiplier = duration;      // 1.0 = 3mo, 1.8 = 6mo, 3.0 = 1yr, 10.0 = perpetuity
      const renewalFee = duration > 1.0 ? reachCost * (renewalMultiplier - 1.0) * 0.35 : 0;
      // Renewal adds 35% of reach cost per additional duration unit (industry standard)
      baseCost = reachCost + renewalFee;
      
      const reachLabel = reach === 1.0 ? "Local/Regional" : reach === 2.5 ? "Multi-Regional" : reach === 6.0 ? "National" : "Worldwide";
      const durLabel = duration === 1.0 ? "3 Months" : duration === 1.8 ? "6 Months" : duration === 3.0 ? "1 Year" : "Perpetuity";
      
      lines.push({
        name: `TV Commercial Session Fee: £${bsf.toFixed(2)}`,
        price: bsf
      });
      lines.push({
        name: `Reach Buyout: ${reachLabel} (×${reach})`,
        price: reachCost - bsf
      });
      if (renewalFee > 0) {
        lines.push({
          name: `Usage Renewal: ${durLabel} (+${((renewalMultiplier - 1.0) * 35).toFixed(0)}% of reach cost)`,
          price: renewalFee
        });
      }
      baseCost = reachCost + renewalFee;
      break;
    }
      
    case "radio_generic":
    case "cinema": {
      const bsf = parseFloat(state.inputs.bsf) || standardRates.bsf;
      const reach = parseFloat(state.inputs.reach) || 1.0;
      const spots = state.inputs.spots || 1;
      
      let firstSpotCost = bsf * reach;
      let extraSpotsCost = (bsf * reach * 0.5) * (spots - 1);
      baseCost = firstSpotCost + extraSpotsCost;
      
      const reachLabel = reach === 1.0 ? "Local" : reach === 2.5 ? "Regional" : "National";
      lines.push({
        name: `${sub === "cinema" ? "Cinema" : "Radio Generic"} BSF: £${bsf.toFixed(2)}\nReach: ${reachLabel} (×${reach})\nSpots: ${spots} (1st spot full, others 50% off)`,
        price: baseCost
      });
      break;
    }
      
    case "radio_ilr": {
      const bsf = parseFloat(state.inputs.bsf) || standardRates.bsf;
      const spots = state.inputs.spots || 1;
      
      if (state.selectedStations.length === 0) {
        baseCost = bsf;
        lines.push({
          name: `Radio Specific ILR (Base BSF, no stations selected yet)`,
          price: baseCost
        });
      } else {
        let stationSubtotal = 0;
        const stationDetails = [];
        
        state.selectedStations.forEach(name => {
          const station = ILR_STATIONS.find(s => s.name === name);
          if (station) {
            const reachRate = ilrRateFromReach(station.reach);
            const stationCost = reachRate * spots;
            stationSubtotal += stationCost;
            stationDetails.push(`- ${name} (${station.reach.toLocaleString()} reach): £${reachRate} × ${spots} spots = £${stationCost.toFixed(2)}`);
          }
        });
        
        const duration = parseFloat(state.inputs.duration) || 1.0;
        const durationLabel = duration === 1.0 ? "Up to 13 Weeks" : duration === 1.5 ? "Up to 26 Weeks" : "Up to 52 Weeks";
        
        baseCost = (bsf + stationSubtotal) * duration;
        lines.push({
          name: `Radio ILR Session BSF: £${bsf.toFixed(2)}\nTargeted Stations Usage:\n${stationDetails.join("\n")}\nDuration: ${durationLabel} (×${duration})`,
          price: baseCost
        });
      }
      break;
    }
      
    case "trailers_promos": {
      const bsf = parseFloat(state.inputs.bsf) || standardRates.bsf;
      const promoUsage = parseFloat(state.inputs.promo_usage) || 1.0;
      baseCost = bsf * promoUsage;
      
      const useLabel = promoUsage === 1.0 ? "Single Channel/Local" : promoUsage === 2.0 ? "Multi-Channel/Regional" : promoUsage === 3.0 ? "National Network" : "VOD/Streaming";
      lines.push({
        name: `Trailers/Promos BSF: £${bsf.toFixed(2)}\nUsage: ${useLabel} (×${promoUsage})`,
        price: baseCost
      });
      break;
    }
      
    case "voice_god":
    case "adr_dubbing": {
      const hours = state.inputs.hours || 1.0;
      const hourlyRate = state.inputs.hourly_rate || standardRates.ratePerHour;
      
      baseCost = hours * hourlyRate;
      lines.push({
        name: `${state.selectedSubcategory.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Session:\n${hours} hr(s) @ £${hourlyRate}/hr`,
        price: baseCost
      });
      break;
    }
      
    case "corporate_video":
    case "medical_narration":
    case "museum_exhibition": {
      const words = state.inputs.words || 500;
      const ratePerWord = standardRates.perWord;
      
      let calculatedBase = words * ratePerWord;
      
      // Minimum fee logic (e.g. £150 min for narration)
      if (calculatedBase < 150) calculatedBase = 150;
      
      let multiplier = 1.0;
      let mulText = "";
      
      if (sub === "corporate_video") {
        multiplier = parseFloat(state.inputs.corp_usage) || 1.0;
        if (multiplier > 1.0) {
          const corpUseLabel = multiplier === 2.0 ? "External (Web/Social)" : "Paid Promotion";
          mulText = `\nBuyout: ${corpUseLabel} (×${multiplier})`;
        }
      }
      
      baseCost = calculatedBase * multiplier;
      const subName = state.selectedSubcategory.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      lines.push({
        name: `${subName}:\n${words} words @ £${ratePerWord.toFixed(2)}/word (Min £150)${mulText}`,
        price: baseCost
      });
      break;
    }
      
    case "explainer_video": {
      const bsf = standardRates.bsf;
      const perWord = standardRates.perWord;
      const words = state.inputs.words || 300;
      const usageMult = parseFloat(state.inputs.corp_usage) || 1.0;
      
      let wordsCost = bsf;
      if (words > 150) {
        wordsCost += (words - 150) * perWord;
      }
      baseCost = wordsCost * usageMult;
      
      const usageText = usageMult === 1.0 ? "Internal Use" : usageMult === 1.5 ? "External Web" : "Paid Digital Ads";
      lines.push({
        name: `Explainer Video (Word Rate):\n${words} words (Base 150w flat £${bsf.toFixed(2)} + £${perWord}/word after)\nUsage: ${usageText} (×${usageMult})`,
        price: baseCost
      });
      break;
    }
      
    case "elearning": {
      const words = state.inputs.words || 1000;
      
      // Unified sliding scale (matches Equity rate card regardless of union status)
      let wordRate = 0.60;
      if (words > 2000) {
        wordRate = 0.20;
      } else if (words >= 1000) {
        wordRate = 0.30;
      }
      
      baseCost = words * wordRate;
      lines.push({
        name: `E-Learning Course:\n${words} words @ £${wordRate.toFixed(2)}/word\n(0–999w: £0.60 | 1000–2000w: £0.30 | 2000w+: £0.20)`,
        price: baseCost
      });
      break;
    }
      
    case "elt_educational": {
      const band = state.inputs.elt_band || "A";
      const session = state.inputs.elt_session || "half";
      const key = `${band}_${session}`;
      baseCost = standardRates[key] || 0;
      
      lines.push({
        name: `ELT Session (Band ${band}, ${session === 'half' ? 'Half Day' : 'Full Day'} booking)`,
        price: baseCost
      });
      break;
    }
      
    case "psa": {
      const flatRate = standardRates.flat;
      const scale = parseFloat(state.inputs.corp_usage) || 1.0;
      baseCost = flatRate * scale;
      
      lines.push({
        name: `Public Service Announcement:\nBase BSF £${flatRate.toFixed(2)} × Scale (${scale === 1.0 ? 'Local' : 'National'} - ×${scale})`,
        price: baseCost
      });
      break;
    }
      
    case "video_games": {
      const hours = state.inputs.hours || 3;
      const bsfPerHour = standardRates.ratePerHour;
      const tierMult = parseFloat(state.inputs.game_tier) || 1.0;
      
      baseCost = (hours * bsfPerHour) * tierMult;
      const tierName = tierMult === 1.0 ? "Indie / Crowdfunded" : "AAA Franchise";
      
      lines.push({
        name: `Video Game Session:\n${hours} hr(s) @ £${bsfPerHour}/hr\nStudio Scale: ${tierName} (×${tierMult})`,
        price: baseCost
      });
      break;
    }
      
    case "audiobooks": {
      const finishedHours = state.inputs.hours || 6;
      const ratePerFH = standardRates.ratePerFH;
      baseCost = finishedHours * ratePerFH;
      
      lines.push({
        name: `Audiobook Narration:\n${finishedHours} Finished Hour(s) (FH) @ £${ratePerFH}/FH`,
        price: baseCost
      });
      break;
    }
      
    case "ivr_basic": {
      const minFee = standardRates.min;
      const perWord = standardRates.perWord;
      const words = state.inputs.words || 100;
      const ivrMembership = state.inputs.ivr_membership || 'none';
      
      // AMA / EMA members receive discounted IVR rates
      const memberDiscount = (ivrMembership === 'ama' || ivrMembership === 'ema') ? 0.80 : 1.0; // 20% off
      
      let calculated = minFee;
      if (words > 100) {
        calculated += (words - 100) * perWord;
      }
      calculated *= memberDiscount;
      baseCost = calculated;
      
      const memberLabel = ivrMembership === 'ama' ? ' [AMA Member −20%]' : ivrMembership === 'ema' ? ' [EMA Member −20%]' : '';
      lines.push({
        name: `IVR Telephony${memberLabel}:\n${words} words (Flat £${(minFee * memberDiscount).toFixed(2)} for 100w + £${(perWord * memberDiscount).toFixed(2)}/word after)`,
        price: baseCost
      });
      break;
    }
      
    case "telephony_bundles": {
      const prompts = state.inputs.prompts || 10;
      const languages = state.inputs.langs || 1;
      const ratePerPrompt = standardRates.ratePerPrompt;
      const ivrMembership = state.inputs.ivr_membership || 'none';
      const memberDiscount = (ivrMembership === 'ama' || ivrMembership === 'ema') ? 0.80 : 1.0;
      
      baseCost = prompts * languages * ratePerPrompt * memberDiscount;
      const memberLabel = ivrMembership === 'ama' ? ' [AMA Member −20%]' : ivrMembership === 'ema' ? ' [EMA Member −20%]' : '';
      lines.push({
        name: `Telephony Bundle${memberLabel}:\n${prompts} prompts × ${languages} language(s) @ £${(ratePerPrompt * memberDiscount).toFixed(2)}/prompt`,
        price: baseCost
      });
      break;
    }
      
    case "digital_ads":
    case "podcast_ads": {
      const bsf = parseFloat(state.inputs.bsf) || standardRates.bsf;
      const duration = parseFloat(state.inputs.duration) || 1.5;
      baseCost = bsf * duration;
      
      const weeksText = duration === 1.5 ? "13 Weeks (1.5x BSF)" : duration === 2.5 ? "26 Weeks (2.5x BSF)" : "52 Weeks (4.5x BSF)";
      lines.push({
        name: `${sub === "digital_ads" ? "Digital Placement" : "Podcast Commercial"} BSF: £${bsf.toFixed(2)}\nUsage: ${weeksText}`,
        price: baseCost
      });
      break;
    }
      
    case "social_organic": {
      const minutes = state.inputs.hours || 2;
      const ratePerMinute = standardRates.ratePerMinute;
      baseCost = minutes * ratePerMinute;
      
      lines.push({
        name: `Organic Social Video:\n${minutes} min(s) @ £${ratePerMinute}/min`,
        price: baseCost
      });
      break;
    }
      
    case "podcast_intro": {
      baseCost = standardRates.flat;
      lines.push({
        name: `Podcast Intro / Outro Flat Rate Package`,
        price: baseCost
      });
      break;
    }
      
    case "ai_dataset": {
      const hours = state.inputs.hours || 5;
      const ratePerHour = standardRates.ratePerHour;
      const buyout = parseFloat(state.inputs.game_tier) || 1.0;
      baseCost = (hours * ratePerHour) * buyout;
      
      lines.push({
        name: `AI Dataset Recording:\n${hours} hrs @ £${ratePerHour}/hr\nLicensing: ${buyout === 1.0 ? 'Research/Testing' : 'Commercial Voice Model'} (×${buyout})`,
        price: baseCost
      });
      break;
    }
      
    case "text_to_speech": {
      const bsf = standardRates.bsf;
      const words = state.inputs.words || 2500;
      const duration = parseFloat(state.inputs.duration) || 3.0;
      
      let wordVolumeSurcharge = (words / 1000) * 100;
      baseCost = (bsf + wordVolumeSurcharge) * duration;
      
      const scopeLabel = duration === 3.0 ? "1 Year (3.0x)" : duration === 8.0 ? "3 Years (8.0x)" : "Perpetuity (15.0x)";
      lines.push({
        name: `Synthetic TTS Voice Model:\nBase session: £${bsf.toFixed(2)} + ${words} w volume surcharge\nLicensing: ${scopeLabel}`,
        price: baseCost
      });
      break;
    }
      
    case "transport_pa": {
      const prompts = state.inputs.prompts || 10;
      const ratePerPrompt = standardRates.ratePerPrompt;
      baseCost = prompts * ratePerPrompt;
      
      lines.push({
        name: `Transport PA Announcements:\n${prompts} announcements @ £${ratePerPrompt}/each`,
        price: baseCost
      });
      break;
    }
  }
  
  return {
    total: baseCost,
    lines: lines
  };
}

function calculateQuote() {
  let finalTotal = 0;
  const allLines = [];
  
  // 1. Temporarily store active state
  const activeSub = state.selectedSubcategory;
  const activeInputs = { ...state.inputs };
  const activeStations = [...state.selectedStations];
  
  // 2. Calculate cart items
  state.cart.forEach((item, index) => {
    state.selectedSubcategory = item.subcategory;
    state.inputs = item.inputs;
    state.selectedStations = item.stations || [];
    
    const result = calculateBaseQuote();
    result.lines.forEach(line => {
      allLines.push({
        ...line,
        name: `[Item ${index + 1}] ` + line.name,
        isCartItem: true,
        cartIndex: index
      });
    });
    finalTotal += result.total;
  });
  
  // 3. Restore active state
  state.selectedSubcategory = activeSub;
  state.inputs = activeInputs;
  state.selectedStations = activeStations;
  
  // 4. Calculate active item if any
  let activeBaseCost = 0;
  if (activeSub && !state.isCurrentItemInCart) {
    const activeResult = calculateBaseQuote();
    activeResult.lines.forEach(line => {
      allLines.push(line);
    });
    activeBaseCost = activeResult.total;
    finalTotal += activeResult.total;
  }
  
  // Calculate Add-on Extras
  let extrasCost = 0;
  
  if (document.getElementById("extra-editing")?.checked) {
    const editHrs = parseFloat(document.getElementById("edit-hours")?.value) || 1;
    const editRate = parseFloat(document.getElementById("edit-rate")?.value) || 50;
    const cost = editHrs * editRate;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Audio Editing & Cleanup\n${editHrs} hr(s) @ £${editRate}/hr`,
      price: cost
    });
  }
  
  if (document.getElementById("extra-remote")?.checked) {
    const remoteCost = parseFloat(document.getElementById("remote-system")?.value) || 100;
    extrasCost += remoteCost;
    allLines.push({
      name: `Add-on: Directed Remote Session\n${remoteCost === 100 ? 'SourceConnect Connection' : 'CleanFeed/Zoom Connection'}`,
      price: remoteCost
    });
  }
  
  if (document.getElementById("extra-studio")?.checked) {
    const studioHrs = parseFloat(document.getElementById("studio-hours")?.value) || 2;
    const studioRate = parseFloat(document.getElementById("studio-rate")?.value) || 120;
    const cost = studioHrs * studioRate;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Physical Studio Rental\n${studioHrs} hr(s) @ £${studioRate}/hr`,
      price: cost
    });
  }

  if (document.getElementById("extra-revisions")?.checked) {
    const rounds = parseInt(document.getElementById("revision-rounds")?.value) || 1;
    const cost = rounds * 45;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Additional Revision Rounds\n${rounds} extra round(s) @ £45/round`,
      price: cost
    });
  }

  if (document.getElementById("extra-script-prep")?.checked) {
    const prepCost = parseFloat(document.getElementById("script-prep-type")?.value) || 50;
    extrasCost += prepCost;
    allLines.push({
      name: `Add-on: Script Preparation & Read-Through\n${prepCost === 50 ? 'Standard Long-Form' : 'Highly Technical/Medical'}`,
      price: prepCost
    });
  }
  
  let subtotal = finalTotal + extrasCost;
  let superTotal = subtotal;
  
  if (document.getElementById("extra-urgent")?.checked) {
    const urgentFee = subtotal * 0.20;
    superTotal += urgentFee;
    allLines.push({
      name: `Surcharge: 24-Hour Urgent Delivery (20% of subtotal)`,
      price: urgentFee
    });
  }
  
  return {
    total: superTotal,
    lines: allLines
  };
}

function addToCart() {
  if (!state.selectedSubcategory || state.isCurrentItemInCart) return;
  const result = calculateBaseQuote();
  if (result.lines.length > 0) {
    state.cart.push({
      id: Date.now(),
      category: state.selectedCategory,
      subcategory: state.selectedSubcategory,
      inputs: { ...state.inputs },
      stations: [...state.selectedStations]
    });
    
    // Mark as added to prevent double counting
    state.isCurrentItemInCart = true;
    
    updateQuote();
    updateNavButtons();
    
    const btn = document.getElementById("btn-add-to-cart");
    if (btn) {
      const origText = btn.innerHTML;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="action-icon" style="margin-right: 6px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Added!`;
      btn.style.color = "var(--green)";
      btn.style.borderColor = "var(--green)";
      setTimeout(() => {
        btn.innerHTML = origText;
        btn.style.color = "";
        btn.style.borderColor = "";
      }, 2000);
    }
  }
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  updateQuote();
}

// Animated counter for the total price
let _animFrame = null;
let _currentDisplayed = 0;

function animateTotal(targetGBP) {
  if (_animFrame) cancelAnimationFrame(_animFrame);
  const start = _currentDisplayed;
  const end = targetGBP;
  const diff = end - start;
  const duration = 350; // ms
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    _currentDisplayed = start + diff * eased;
    const el = document.getElementById("panel-total");
    if (el) el.textContent = formatCurrency(_currentDisplayed);
    if (progress < 1) {
      _animFrame = requestAnimationFrame(step);
    } else {
      _currentDisplayed = end;
    }
  }
  _animFrame = requestAnimationFrame(step);
}

function updateQuote() {
  const result = calculateQuote();
  const sym = CURRENCY_SYMBOLS[state.currency] || '£';

  // Animated total
  animateTotal(result.total);
  
  const stdBadge = document.getElementById("panel-std-badge");
  if (stdBadge) {
    let badgeText, badgeColor;
    if (state.pricingStandard === 'equity') {
      if (state.currency === 'USD') {
        badgeText = "SAG-AFTRA Union Rates";
      } else if (state.currency === 'EUR') {
        badgeText = "EMA Union Rates";
      } else {
        badgeText = "Equity Union Minimums";
      }
      badgeColor = "var(--coral)";
    } else {
      const marketSuffix = state.currency !== 'GBP' ? ` (×${MARKET_MULTIPLIERS[state.currency]} Intl. Premium)` : "";
      badgeText = `Standard Agency Rates${marketSuffix}`;
      badgeColor = "var(--muted)";
    }
    stdBadge.textContent = badgeText;
    stdBadge.style.color = badgeColor;
  }
  
  const unionWarning = document.getElementById("panel-union-warning");
  if (unionWarning) {
    unionWarning.style.display = state.pricingStandard === 'equity' ? "block" : "none";
  }
  
  const complianceContainer = document.getElementById("union-compliance-container");
  if (complianceContainer) {
    complianceContainer.style.display = state.pricingStandard === 'equity' ? "block" : "none";
  }
  
  const breakdownList = document.getElementById("panel-breakdown-list");
  if (breakdownList) {
    if (result.lines.length === 0) {
      breakdownList.innerHTML = `<li class="breakdown-empty">No details selected yet. Start by choosing a category.</li>`;
    } else {
      breakdownList.innerHTML = result.lines.map(line => {
        const removeBtn = line.isCartItem ? `<button type="button" class="btn-remove-cart" onclick="removeFromCart(${line.cartIndex})" style="background: none; border: none; color: var(--coral); cursor: pointer; padding: 0 5px; font-size: 1.1rem; line-height: 1;" title="Remove Item">&times;</button>` : '';
        return `
          <li>
            <div class="item-name" style="flex: 1;">${line.name}</div>
            <div class="item-price-row" style="display:flex; align-items:flex-start; gap: 8px;">
              <div class="item-price">${formatCurrency(line.price)}</div>
              ${removeBtn}
            </div>
          </li>
        `;
      }).join("");
    }
  }
}

// --------------------------------------------------------------------------
// FINAL Enquiry & CLIPBOARD UTILITIES
// --------------------------------------------------------------------------
function generateSummaryText() {
  const result = calculateQuote();
  const sub = state.selectedSubcategory ? state.selectedSubcategory.replace("_", " ").toUpperCase() : "None";
  const stdText = state.pricingStandard === 'agency' ? "Standard Agency / Commercial Market" : "Equity UK Union Minimums";
  
  let text = `==================================================\n`;
  text += `      CK MEDIA - VOICEOVER QUOTE ESTIMATE         \n`;
  text += `==================================================\n\n`;
  text += `Pricing Standard: ${stdText}\n`;
  text += `Project Category: ${sub}\n\n`;
  text += `Line Items:\n`;
  
  result.lines.forEach((line, index) => {
    text += `${index + 1}. ${line.name.replace(/\n/g, " | ")} : £${line.price.toFixed(2)}\n`;
  });
  
  text += `\n--------------------------------------------------\n`;
  text += `ESTIMATED TOTAL: £${result.total.toFixed(2)}\n`;
  text += `==================================================\n`;
  
  return text;
}

function initFormSubmit() {
  const form = document.getElementById("estimator-form");
  const successContainer = document.getElementById("step-success");
  const successSummaryText = document.getElementById("success-summary-text");
  const btnResetWizard = document.getElementById("btn-reset-wizard");
  
  // Pathway Elements
  const pathwayEstimateForm = document.getElementById("pathway-estimate-form");
  const pathwayEnquiryForm = document.getElementById("pathway-enquiry-form");
  const finalActionsContainer = document.getElementById("final-actions-container");
  const btnSubmitQuote = document.getElementById("btn-submit-quote");
  const btnText = btnSubmitQuote ? btnSubmitQuote.querySelector(".btn-text") : null;
  
  if (!form) return;
  
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    if (state.selectedPathway === "estimate" && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    let unionName = "Equity Form of Engagement";
    if (state.currency === "USD") unionName = "SAG-AFTRA";
    if (state.currency === "EUR") unionName = "EMA";

    // Union compliance check
    if (state.pricingStandard === 'equity') {
      const confirmCheck = document.getElementById("contact-union-confirm");
      if (confirmCheck && !confirmCheck.checked) {
        alert(`To book using Union rates, you must confirm that your production will utilize an official ${unionName} contract. Please check the union confirmation box.`);
        return;
      }
    }

    // Common Loading State
    const btnIcon = btnSubmitQuote.querySelector(".btn-icon");
    const btnLoader = btnSubmitQuote.querySelector(".btn-loader");
    
    btnSubmitQuote.disabled = true;
    if (btnText) btnText.textContent = "Processing...";
    if (btnIcon) btnIcon.style.display = "none";
    if (btnLoader) btnLoader.style.display = "inline-block";

    const summary = generateSummaryText();
    const finalVal = calculateQuote();

    if (state.selectedPathway === "enquiry") {
      // ----------------------------------------------------
      // PATHWAY: ENQUIRY (Mailto Fallback or Backend Email)
      // ----------------------------------------------------
      const date = document.getElementById("enq-date") ? document.getElementById("enq-date").value : "";
      const time = document.getElementById("enq-time") ? document.getElementById("enq-time").value : "";
      const company = document.getElementById("enq-company") ? document.getElementById("enq-company").value : "";
      const phone = document.getElementById("enq-phone") ? document.getElementById("enq-phone").value : "";
      const name = document.getElementById("enq-name").value;
      const email = document.getElementById("enq-email").value;
      const project = document.getElementById("enq-project").value;
      const notes = document.getElementById("enq-message").value;

      if (!name || !email || !notes) {
        alert("Please fill in your name, email, and message.");
        resetBtnState();
        return;
      }

      const emailTo = "chris@chriskendall.media";
      const subject = encodeURIComponent(`VO Enquiry: ${project || "General Availability"} - Est: £${finalVal.total.toFixed(2)}`);
      
      let body = `Hello Chris,\n\n`;
      body += `I would like to check studio availability for my project.\n\n`;
      body += `--- DETAILS ---\n`;
      body += `Name: ${name}\n`;
      if (company) body += `Company: ${company}\n`;
      body += `Email: ${email}\n`;
      if (phone) body += `Phone: ${phone}\n`;
      if (date) body += `Preferred Date: ${date}\n`;
      if (time) body += `Preferred Time: ${time}\n`;
      if (project) body += `Project Name: ${project}\n`;
      if (state.pricingStandard === 'equity') {
        let unionName = "Equity Form of Engagement";
        if (state.currency === "USD") unionName = "SAG-AFTRA";
        if (state.currency === "EUR") unionName = "EMA";
        body += `Union Agreement: Confirmed ${unionName} contract will be utilized.\n`;
      }
      body += `Message:\n${notes}\n\n`;
      body += `--- ESTIMATE DETAILS ---\n`;
      body += summary;

      // Trigger mailto
      const mailtoUrl = `mailto:${emailTo}?subject=${subject}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;

      // Show Success Screen
      showSuccess(name, email, summary);
      resetBtnState();

    } else {
      // ----------------------------------------------------
      // PATHWAY: OFFICIAL ESTIMATE (Perfex API Integration)
      // ----------------------------------------------------
      const companyName = document.getElementById("reg-company").value;
      const address = document.getElementById("reg-address").value;
      const city = document.getElementById("reg-city").value;
      const zip = document.getElementById("reg-zip").value;
      const country = document.getElementById("reg-country").value;
      
      const firstName = document.getElementById("reg-firstname").value;
      const lastName = document.getElementById("reg-lastname").value;
      const email = document.getElementById("reg-email").value;

      if (!companyName || !address || !city || !zip || !country || !firstName || !lastName || !email) {
        alert("Please fill in all required company and contact fields.");
        resetBtnState();
        return;
      }

      const payload = {
        client: {
          company: companyName,
          website: document.getElementById("reg-website").value || "",
          phonenumber: document.getElementById("reg-company-phone").value || "",
          address: address,
          city: city,
          state: document.getElementById("reg-state").value || "",
          zip: zip,
          country: country, // Typically the Perfex country ID, e.g. 243 for UK
          firstname: firstName,
          lastname: lastName,
          email: email,
          contact_phonenumber: document.getElementById("reg-contact-phone").value || ""
        },
        estimate: {
          currency: state.currency,
          currency_multiplier: state.currency === 'USD' ? 2.5 : state.currency === 'EUR' ? 1.5 : 1.0,
          subtotal: finalVal.total,
          total: finalVal.total,
          project_name: "Voiceover Quote", // Perfex reference
          clientnote: `Pricing Standard: ${state.pricingStandard}\nCategory: ${state.selectedCategory} / ${state.selectedSubcategory}`,
          items: finalVal.lines.map(line => ({
            description: line.name.split('\n')[0],
            long_description: line.name.split('\n').slice(1).join('\n'),
            rate: line.price,
            qty: 1
          }))
        }
      };

      // Ensure Perfex CRM base URL is configured
      const API_BASE_URL = "https://accounts.chriskendall.media/ckm_quote_wizard/api";

      // Send single payload to the isolated beta staging table
      fetch(`${API_BASE_URL}/submit_beta_quote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to submit beta quote.");
        return res.json();
      })
      .then(response => {
        console.log("Successfully submitted beta quote to Perfex staging table.", response);
        showSuccess(firstName + " " + lastName, email, summary);
      })
      .catch(err => {
        console.error("Perfex API Error:", err);
        alert("There was an issue creating your official estimate. Our system administrator has been notified.\n\nError details: " + err.message);
      })
      .finally(() => {
        resetBtnState();
      });
    }

    function resetBtnState() {
      btnSubmitQuote.disabled = false;
      if (btnText) btnText.textContent = state.selectedPathway === "estimate" ? "Get Official Quote" : "Send Request";
      if (btnIcon) btnIcon.style.display = "inline-block";
      if (btnLoader) btnLoader.style.display = "none";
    }

    function showSuccess(nameStr, emailStr, summaryText) {
      if (successSummaryText) {
        successSummaryText.textContent = `Registered To: ${nameStr} (${emailStr})\n\n` + summaryText;
      }
      form.style.display = "none";
      if (successContainer) {
        successContainer.style.display = "block";
      }
    }
  });
  
  if (btnResetWizard) {
    btnResetWizard.addEventListener("click", () => {
      form.reset();
      
      document.querySelectorAll(".card-selector").forEach(c => c.classList.remove("active"));
      state.selectedCategory = null;
      state.selectedSubcategory = null;
      state.selectedStations = [];
      state.inputs = {};
      state.isCurrentItemInCart = false;
      state.selectedPathway = null;
      
      pathwayEstimateForm.style.display = "none";
      pathwayEnquiryForm.style.display = "none";
      finalActionsContainer.style.display = "none";
      
      document.querySelectorAll(".step-dot").forEach((dot) => dot.classList.remove("completed", "active"));
      
      if (successContainer) successContainer.style.display = "none";
      form.style.display = "block";
      
      setStep(1);
    });
  }
}





