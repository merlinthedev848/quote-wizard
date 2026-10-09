/**
 * @file app.js
 * @description Main application controller and UI coordinator for the Chris Kendall Voiceover Quote Estimator.
 */

import { RATES, ILR_STATIONS, MARKET_MULTIPLIERS, CURRENCY_SYMBOLS, API_ENDPOINTS } from "./config.js";
import { store } from "./state.js";
import {
  calculateFullQuote,
  formatCurrency,
  convertAmount,
  ilrRateFromReach
} from "./calculator.js";
import {
  renderDynamicVariables,
  renderStationList,
  escapeHtml
} from "./templates.js";
import { getLiveExchangeRates, submitPerfexBetaQuote } from "./api.js";
import { toast } from "./toast.js";

// Animation tracking variables
let _animFrameId = null;
let _currentDisplayedTotal = 0;

// Cached DOM Elements
let elements = {};

/**
 * Initialize DOM element cache for high performance.
 */
function cacheElements() {
  elements = {
    form: document.getElementById("estimator-form"),
    progressBarFill: document.getElementById("progress-bar-fill"),
    dynamicVariablesContainer: document.getElementById("dynamic-variables-container"),
    stepDots: document.querySelectorAll(".step-dot"),
    stepContents: document.querySelectorAll(".step-content"),
    btnStdAgency: document.getElementById("btn-std-agency"),
    btnStdEquity: document.getElementById("btn-std-equity"),
    intlNotice: document.getElementById("intl-agency-notice"),
    currencyRateInfo: document.getElementById("currency-rate-info"),
    panelTotal: document.getElementById("panel-total"),
    panelStdBadge: document.getElementById("panel-std-badge"),
    panelUnionWarning: document.getElementById("panel-union-warning"),
    panelUnionWarningText: document.getElementById("panel-union-warning-text"),
    panelBreakdownList: document.getElementById("panel-breakdown-list"),
    unionComplianceContainer: document.getElementById("union-compliance-container"),
    unionNoticeP1: document.getElementById("union-notice-p1"),
    unionNoticeP2: document.getElementById("union-notice-p2"),
    pathwayEstimateForm: document.getElementById("pathway-estimate-form"),
    pathwayEnquiryForm: document.getElementById("pathway-enquiry-form"),
    finalActionsContainer: document.getElementById("final-actions-container"),
    btnSubmitQuote: document.getElementById("btn-submit-quote"),
    btnAddToCart: document.getElementById("btn-add-to-cart"),
    successContainer: document.getElementById("step-success"),
    successSummaryText: document.getElementById("success-summary-text"),
    btnSuccessCopy: document.getElementById("btn-success-copy"),
    btnResetWizard: document.getElementById("btn-reset-wizard"),
    contactUnionConfirm: document.getElementById("contact-union-confirm")
  };
}

/**
 * Main application bootstrapping on DOM ready.
 */
document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEventHandlers();
  initStoreSubscribers();
  await loadExchangeRates();
  renderCurrentQuote();
});

/**
 * Fetches and applies live exchange rates.
 */
async function loadExchangeRates() {
  const result = await getLiveExchangeRates();
  store.set({ exchangeRates: result.rates });

  if (elements.currencyRateInfo) {
    elements.currencyRateInfo.textContent = `1 GBP = $${result.rates.USD.toFixed(4)} / €${result.rates.EUR.toFixed(4)}`;
  }
}

/**
 * Subscribes UI rendering to state store updates.
 */
function initStoreSubscribers() {
  store.subscribe((state, changedKeys) => {
    if (changedKeys.includes("currentStep")) {
      syncStepUI(state.currentStep);
    }
    if (changedKeys.includes("pricingStandard") || changedKeys.includes("currency")) {
      syncStandardAndCurrencyUI(state);
    }
    renderCurrentQuote();
  });
}

/**
 * Debounce helper for performance optimization during input filtering.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay = 120) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Binds all global interactive listeners.
 */
function bindEventHandlers() {
  // Step 1: Category Selection (Click & Keyboard Accessible)
  const categoryCards = document.querySelectorAll(".card-selector[data-category]");
  categoryCards.forEach(card => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    const selectCategory = () => {
      categoryCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      // Reset Step 2 subcategory
      const activeRadio = document.querySelector('input[name="subcategory"]:checked');
      if (activeRadio) activeRadio.checked = false;

      store.set({
        selectedCategory: card.dataset.category,
        selectedSubcategory: null,
        isCurrentItemInCart: false
      });
      updateNavButtons();
    };

    card.addEventListener("click", selectCategory);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectCategory();
      }
    });
  });

  // Step 2: Subcategory Selection
  const subRadios = document.querySelectorAll('input[name="subcategory"]');
  subRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      store.set({
        selectedSubcategory: radio.value,
        isCurrentItemInCart: false
      });
      updateNavButtons();
    });
  });

  // Wizard Navigation (Next / Prev)
  document.querySelectorAll('[data-action="next"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateStep(1);
    });
  });

  document.querySelectorAll('[data-action="prev"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateStep(-1);
    });
  });

  // Direct Step Dot Navigation
  elements.stepDots.forEach(dot => {
    dot.addEventListener("click", () => {
      const stepNum = parseInt(dot.dataset.step, 10);
      const { currentStep } = store.getState();
      if (stepNum < currentStep || dot.classList.contains("completed") || dot.classList.contains("active")) {
        store.set({ currentStep: stepNum });
      }
    });
  });

  // Step 5: Pathway Cards (Click & Keyboard Accessible)
  const pathwayCards = document.querySelectorAll(".card-selector[data-pathway]");
  pathwayCards.forEach(card => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    const selectPathway = () => {
      pathwayCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      store.set({ selectedPathway: card.dataset.pathway });
      updateNavButtons();

      setTimeout(() => {
        navigateStep(1);
      }, 200);
    };

    card.addEventListener("click", selectPathway);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectPathway();
      }
    });
  });

  // Pricing Standard Toggle (Header)
  if (elements.btnStdAgency) {
    elements.btnStdAgency.addEventListener("click", () => {
      if (store.getState().pricingStandard !== "agency") {
        store.set({ pricingStandard: "agency" });
        applyStandardToCurrentInputs();
      }
    });
  }

  if (elements.btnStdEquity) {
    elements.btnStdEquity.addEventListener("click", () => {
      if (store.getState().pricingStandard !== "equity") {
        store.set({ pricingStandard: "equity" });
        applyStandardToCurrentInputs();
      }
    });
  }

  // Currency Switcher Buttons
  const currencyBtns = document.querySelectorAll(".currency-btn");
  currencyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const newCurr = btn.dataset.currency;
      currencyBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      store.set({ currency: newCurr });
    });
  });

  // Step 4: Extras Add-on Checkboxes
  const extrasToggles = ["editing", "remote", "studio", "urgent", "revisions", "script-prep"];
  extrasToggles.forEach(slug => {
    const check = document.getElementById(`extra-${slug}`);
    const fields = document.getElementById(`${slug}-fields`);
    if (check && fields) {
      check.addEventListener("change", () => {
        fields.style.display = check.checked ? "block" : "none";
        renderCurrentQuote();
      });
    }
  });

  // Extra inputs listeners
  const extraInputs = document.querySelectorAll(".extra-fields input, .extra-fields select");
  extraInputs.forEach(input => {
    input.addEventListener("input", () => renderCurrentQuote());
  });

  // Add to Quote (Cart) Button
  if (elements.btnAddToCart) {
    elements.btnAddToCart.addEventListener("click", () => handleAddToCart());
  }

  // Copy Summary Button
  if (elements.btnSuccessCopy) {
    elements.btnSuccessCopy.addEventListener("click", () => {
      const summaryText = generateFormattedSummaryText();
      navigator.clipboard.writeText(summaryText)
        .then(() => toast.success("Quote summary copied to clipboard!"))
        .catch(err => {
          console.error("Clipboard copy failed:", err);
          toast.error("Could not copy to clipboard automatically.");
        });
    });
  }

  // Reset Wizard Button
  if (elements.btnResetWizard) {
    elements.btnResetWizard.addEventListener("click", () => resetWizard());
  }

  // Main Form Submission
  if (elements.form) {
    elements.form.addEventListener("submit", handleFormSubmit);
  }
}

/**
 * Step transition logic.
 * @param {number} direction
 */
function navigateStep(direction) {
  const { currentStep } = store.getState();
  const nextStep = currentStep + direction;
  if (nextStep >= 1 && nextStep <= 6) {
    store.set({ currentStep: nextStep });
  }
}

/**
 * Synchronizes step container visibility and timeline dots.
 * @param {number} stepNum
 */
function syncStepUI(stepNum) {
  // Toggle step panels
  elements.stepContents.forEach((c, index) => {
    c.classList.toggle("active", (index + 1) === stepNum);
  });

  // Update dots
  elements.stepDots.forEach(dot => {
    const s = parseInt(dot.dataset.step, 10);
    dot.classList.toggle("active", s === stepNum);
    dot.classList.toggle("completed", s < stepNum);
  });

  // Update progress bar
  if (elements.progressBarFill) {
    const progressPct = ((stepNum - 1) / 5) * 100;
    elements.progressBarFill.style.width = `${progressPct}%`;
  }

  // Step-specific initializations
  const state = store.getState();

  if (stepNum === 2) {
    document.querySelectorAll(".subcategory-panel").forEach(p => {
      p.style.display = p.dataset.branch === state.selectedCategory ? "block" : "none";
    });
  } else if (stepNum === 3) {
    buildDynamicVariablesUI();
  } else if (stepNum === 6) {
    syncStep6BookingUI(state);
  }

  updateNavButtons();
}

/**
 * Renders dynamic variables into Step 3 container.
 */
function buildDynamicVariablesUI() {
  const container = elements.dynamicVariablesContainer;
  if (!container) return;

  saveCurrentInputs();
  const state = store.getState();
  container.innerHTML = renderDynamicVariables(
    state.selectedSubcategory,
    state.pricingStandard,
    state.inputs,
    state.ilrSearchQuery
  );

  attachDynamicVariableListeners();

  if (state.selectedSubcategory === "radio_ilr") {
    renderILRStationsList();
  }
}

/**
 * Attaches dynamic event listeners for Step 3 form controls.
 */
function attachDynamicVariableListeners() {
  const container = elements.dynamicVariablesContainer;
  if (!container) return;

  // Sliders
  const sliders = container.querySelectorAll('input[type="range"]');
  sliders.forEach(slider => {
    slider.addEventListener("input", (e) => {
      const disp = document.getElementById(slider.id.replace("input", "disp"));
      if (disp) {
        let suffix = "";
        if (slider.id.includes("words")) suffix = " w";
        else if (slider.id.includes("hours")) {
          const sub = store.getState().selectedSubcategory;
          suffix = sub === "audiobooks" ? " FH" : sub === "social_organic" ? " min" : " hr";
        }
        const isPound = slider.id.includes("bsf") || slider.id.includes("hourly-rate");
        disp.textContent = `${isPound ? "£" : ""}${e.target.value}${suffix}`;
      }

      // Sync companion number input
      const numInput = document.getElementById(`${slider.id}-num`);
      if (numInput) numInput.value = e.target.value;

      saveCurrentInputs();
      renderCurrentQuote();
    });
  });

  // Paired word count number input
  const wordNumInput = document.getElementById("input-words-num");
  if (wordNumInput) {
    wordNumInput.addEventListener("input", (e) => {
      const slider = document.getElementById("input-words");
      if (slider) {
        const val = parseInt(e.target.value, 10) || 0;
        const clamped = Math.min(Math.max(val, parseInt(slider.min, 10) || 0), parseInt(slider.max, 10) || 99999);
        slider.value = clamped;
      }
      store.getState().inputs.words = parseInt(e.target.value, 10) || 0;
      renderCurrentQuote();
    });
  }

  // Quick word count preset pills
  const presetPills = container.querySelectorAll(".btn-preset-pill");
  presetPills.forEach(pill => {
    pill.addEventListener("click", () => {
      const words = parseInt(pill.dataset.words, 10);
      if (!isNaN(words)) {
        const slider = document.getElementById("input-words");
        if (slider) slider.value = words;

        const numInput = document.getElementById("input-words-num");
        if (numInput) numInput.value = words;

        const disp = document.getElementById("disp-words");
        if (disp) disp.textContent = `${words} w`;

        saveCurrentInputs();
        renderCurrentQuote();
      }
    });
  });

  // TV Commercial TVR toggle
  const tvrSelect = document.getElementById("input-tvr-tier");
  const tvReachGroup = document.getElementById("tv-standard-reach-group");
  if (tvrSelect && tvReachGroup) {
    tvrSelect.addEventListener("change", () => {
      tvReachGroup.style.display = tvrSelect.value === "standard" ? "block" : "none";
      saveCurrentInputs();
      renderCurrentQuote();
    });
  }

  // Digital Ads model toggle
  const digModelSelect = document.getElementById("input-digital-model");
  const digImpressionGroup = document.getElementById("digital-impression-group");
  const digDurationGroup = document.getElementById("digital-duration-group");
  if (digModelSelect) {
    digModelSelect.addEventListener("change", () => {
      if (digImpressionGroup) digImpressionGroup.style.display = digModelSelect.value === "impressions" ? "block" : "none";
      if (digDurationGroup) digDurationGroup.style.display = digModelSelect.value === "duration" ? "block" : "none";
      saveCurrentInputs();
      renderCurrentQuote();
    });
  }

  // Selects and numbers
  const selectsAndNumbers = container.querySelectorAll('select, input[type="number"]:not(#input-words-num)');
  selectsAndNumbers.forEach(input => {
    input.addEventListener("input", () => {
      saveCurrentInputs();
      renderCurrentQuote();
    });
  });

  // ILR Search filter (debounced)
  const ilrSearch = document.getElementById("ilr-search");
  if (ilrSearch) {
    const debouncedFilter = debounce((query) => {
      store.set({ ilrSearchQuery: query });
      renderILRStationsList();
    }, 120);

    ilrSearch.addEventListener("input", (e) => {
      debouncedFilter(e.target.value);
    });
  }
}

/**
 * Renders the filtered ILR station checklist.
 */
function renderILRStationsList() {
  const listContainer = document.getElementById("station-list");
  if (!listContainer) return;

  const state = store.getState();
  listContainer.innerHTML = renderStationList(state.ilrSearchQuery, state.selectedStations);

  listContainer.querySelectorAll(".ilr-checkbox").forEach(box => {
    box.addEventListener("change", () => {
      const current = [...store.getState().selectedStations];
      if (box.checked) {
        if (!current.includes(box.value)) current.push(box.value);
      } else {
        const idx = current.indexOf(box.value);
        if (idx > -1) current.splice(idx, 1);
      }
      store.set({ selectedStations: current });
      renderCurrentQuote();
    });
  });
}

/**
 * Saves current Step 3 input field values into state.
 */
function saveCurrentInputs() {
  const inputs = {};
  const bsfInput = document.getElementById("input-bsf");
  if (bsfInput) inputs.bsf = parseFloat(bsfInput.value);

  const hoursInput = document.getElementById("input-hours");
  if (hoursInput) inputs.hours = parseFloat(hoursInput.value);

  const hourlyRateInput = document.getElementById("input-hourly-rate");
  if (hourlyRateInput) inputs.hourly_rate = parseFloat(hourlyRateInput.value);

  const reachSelect = document.getElementById("input-reach");
  if (reachSelect) inputs.reach = reachSelect.value;

  const durationSelect = document.getElementById("input-duration");
  if (durationSelect) inputs.duration = durationSelect.value;

  const spotsInput = document.getElementById("input-spots");
  if (spotsInput) inputs.spots = parseInt(spotsInput.value, 10) || 1;

  const promoUsageSelect = document.getElementById("input-promo-usage");
  if (promoUsageSelect) inputs.promo_usage = promoUsageSelect.value;

  const corpUsageSelect = document.getElementById("input-corp-usage");
  if (corpUsageSelect) inputs.corp_usage = corpUsageSelect.value;

  const wordsInput = document.getElementById("input-words-num") || document.getElementById("input-words");
  if (wordsInput) inputs.words = parseInt(wordsInput.value, 10) || 0;

  const eltBandSelect = document.getElementById("input-elt-band");
  if (eltBandSelect) inputs.elt_band = eltBandSelect.value;

  const eltFormatSelect = document.getElementById("input-elt-format");
  if (eltFormatSelect) inputs.elt_format = eltFormatSelect.value;

  const eltSessionSelect = document.getElementById("input-elt-session");
  if (eltSessionSelect) inputs.elt_session = eltSessionSelect.value;

  const gameCaptureSelect = document.getElementById("input-game-capture");
  if (gameCaptureSelect) inputs.game_capture = gameCaptureSelect.value;

  const gameTierSelect = document.getElementById("input-game-tier");
  if (gameTierSelect) inputs.game_tier = gameTierSelect.value;

  const promptsInput = document.getElementById("input-prompts");
  if (promptsInput) inputs.prompts = parseInt(promptsInput.value, 10) || 0;

  const langsInput = document.getElementById("input-langs");
  if (langsInput) inputs.langs = parseInt(langsInput.value, 10) || 1;

  const ivrMemberSelect = document.getElementById("input-ivr-membership");
  if (ivrMemberSelect) inputs.ivr_membership = ivrMemberSelect.value;

  const tvrTierSelect = document.getElementById("input-tvr-tier");
  if (tvrTierSelect) inputs.tvr_tier = tvrTierSelect.value;

  const digitalModelSelect = document.getElementById("input-digital-model");
  if (digitalModelSelect) inputs.digital_model = digitalModelSelect.value;

  const impressionTierSelect = document.getElementById("input-impression-tier");
  if (impressionTierSelect) inputs.impression_tier = impressionTierSelect.value;

  store.set({ inputs, isCurrentItemInCart: false });
}

/**
 * Synchronizes header standard toggle and international currency UI notices.
 */
function syncStandardAndCurrencyUI(state) {
  const { pricingStandard, currency } = state;

  if (elements.btnStdAgency) {
    elements.btnStdAgency.classList.toggle("active", pricingStandard === "agency");
  }
  if (elements.btnStdEquity) {
    elements.btnStdEquity.classList.toggle("active", pricingStandard === "equity");
  }

  const multiplier = MARKET_MULTIPLIERS[currency] || 1.0;
  let unionName = "Equity";
  let contractDoc = "Equity Form of Engagement contract";

  if (currency === "USD") {
    unionName = "SAG-AFTRA";
    contractDoc = "SAG-AFTRA contract";
  } else if (currency === "EUR") {
    unionName = "EMA";
    contractDoc = "EMA contract";
  }

  if (elements.unionNoticeP1) {
    elements.unionNoticeP1.innerHTML = `Union rates are strictly regulated minimums. Selecting this option requires you to sign an official <strong>${contractDoc}</strong>.`;
  }
  if (elements.unionNoticeP2) {
    elements.unionNoticeP2.innerHTML = `I confirm this project is union-compliant and will utilize an official ${contractDoc}. *`;
  }
  if (elements.panelUnionWarningText) {
    elements.panelUnionWarningText.textContent = unionName;
  }

  if (elements.intlNotice) {
    if (currency !== "GBP") {
      const region = currency === "USD" ? "US Market" : "EU Market";
      elements.intlNotice.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${region} &mdash; Agency or ${unionName} &nbsp;&bull;&nbsp; &times;${multiplier} market premium applied
      `;
      elements.intlNotice.style.display = "flex";
    } else {
      elements.intlNotice.style.display = "none";
    }
  }
}

/**
 * Updates default slider values when standard toggles.
 */
function applyStandardToCurrentInputs() {
  const { selectedSubcategory, pricingStandard } = store.getState();
  if (!selectedSubcategory || !RATES[selectedSubcategory]) return;

  const stdRates = RATES[selectedSubcategory][pricingStandard];
  if (!stdRates) return;

  const bsfInput = document.getElementById("input-bsf");
  if (bsfInput && stdRates.bsf) {
    bsfInput.value = stdRates.bsf;
    const disp = document.getElementById("disp-bsf");
    if (disp) disp.textContent = `£${stdRates.bsf}`;
  }

  const hourlyRateInput = document.getElementById("input-hourly-rate");
  if (hourlyRateInput && stdRates.ratePerHour) {
    hourlyRateInput.value = stdRates.ratePerHour;
    const disp = document.getElementById("disp-hourly-rate");
    if (disp) disp.textContent = `£${stdRates.ratePerHour}`;
  }

  saveCurrentInputs();
}

/**
 * Synchronizes Step 6 booking forms.
 */
function syncStep6BookingUI(state) {
  const { pricingStandard, selectedPathway } = state;

  if (elements.unionComplianceContainer) {
    elements.unionComplianceContainer.style.display = pricingStandard === "equity" ? "block" : "none";
  }

  const isEstimate = selectedPathway === "estimate";
  if (elements.pathwayEstimateForm) elements.pathwayEstimateForm.style.display = isEstimate ? "block" : "none";
  if (elements.pathwayEnquiryForm) elements.pathwayEnquiryForm.style.display = isEstimate ? "none" : "block";

  if (elements.btnSubmitQuote) {
    const btnText = elements.btnSubmitQuote.querySelector(".btn-text");
    if (btnText) btnText.textContent = isEstimate ? "Get Official Quote" : "Send Request";
  }

  if (elements.finalActionsContainer) {
    elements.finalActionsContainer.style.display = "block";
  }
}

/**
 * Updates Next button disabled states based on required selections.
 */
function updateNavButtons() {
  const state = store.getState();
  const step1Btn = document.querySelector('#step-1 [data-action="next"]');
  if (step1Btn) step1Btn.disabled = !state.selectedCategory;

  const step2Btn = document.querySelector('#step-2 [data-action="next"]');
  if (step2Btn) step2Btn.disabled = !state.selectedSubcategory;
}

/**
 * Extracts extra add-on values from the DOM.
 * @returns {object}
 */
function getExtrasFormData() {
  return {
    editing: {
      enabled: document.getElementById("extra-editing")?.checked || false,
      hours: document.getElementById("edit-hours")?.value || 1,
      rate: document.getElementById("edit-rate")?.value || 50
    },
    remote: {
      enabled: document.getElementById("extra-remote")?.checked || false,
      system: document.getElementById("remote-system")?.value || 100
    },
    studio: {
      enabled: document.getElementById("extra-studio")?.checked || false,
      hours: document.getElementById("studio-hours")?.value || 2,
      rate: document.getElementById("studio-rate")?.value || 120
    },
    urgent: {
      enabled: document.getElementById("extra-urgent")?.checked || false
    },
    revisions: {
      enabled: document.getElementById("extra-revisions")?.checked || false,
      rounds: document.getElementById("revision-rounds")?.value || 1
    },
    scriptPrep: {
      enabled: document.getElementById("extra-script-prep")?.checked || false,
      type: document.getElementById("script-prep-type")?.value || 50
    }
  };
}

/**
 * Animates the total price display smoothly.
 * @param {number} targetTotalGBP
 */
function animatePriceTicker(targetTotalGBP) {
  if (_animFrameId) cancelAnimationFrame(_animFrameId);

  const start = _currentDisplayedTotal;
  const end = targetTotalGBP;
  const diff = end - start;
  const duration = 300;
  const startTime = performance.now();
  const state = store.getState();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    _currentDisplayedTotal = start + diff * eased;

    if (elements.panelTotal) {
      elements.panelTotal.textContent = formatCurrency(_currentDisplayedTotal, state.currency, state.exchangeRates);
    }

    if (progress < 1) {
      _animFrameId = requestAnimationFrame(tick);
    } else {
      _currentDisplayedTotal = end;
      if (elements.panelTotal) {
        elements.panelTotal.textContent = formatCurrency(end, state.currency, state.exchangeRates);
      }
    }
  }

  _animFrameId = requestAnimationFrame(tick);
}

/**
 * Renders the live quote calculation, badge, and breakdown list.
 */
function renderCurrentQuote() {
  const state = store.getState();
  const extrasData = getExtrasFormData();
  const quote = calculateFullQuote(state, extrasData);

  animatePriceTicker(quote.total);

  // Standard Badge
  if (elements.panelStdBadge) {
    if (state.pricingStandard === "equity") {
      let unionText = "Equity Union Minimums";
      if (state.currency === "USD") unionText = "SAG-AFTRA Union Rates";
      else if (state.currency === "EUR") unionText = "EMA Union Rates";

      elements.panelStdBadge.textContent = unionText;
      elements.panelStdBadge.style.color = "var(--coral)";
    } else {
      const marketSuffix = state.currency !== "GBP" ? ` (×${MARKET_MULTIPLIERS[state.currency]} Intl. Premium)` : "";
      elements.panelStdBadge.textContent = `Standard Agency Rates${marketSuffix}`;
      elements.panelStdBadge.style.color = "var(--muted)";
    }
  }

  // Union Warning Box
  if (elements.panelUnionWarning) {
    elements.panelUnionWarning.style.display = state.pricingStandard === "equity" ? "block" : "none";
  }

  // Breakdown List
  if (elements.panelBreakdownList) {
    if (quote.lines.length === 0) {
      elements.panelBreakdownList.innerHTML = `<li class="breakdown-empty">No details selected yet. Start by choosing a category.</li>`;
    } else {
      elements.panelBreakdownList.innerHTML = quote.lines.map((line) => {
        const removeBtn = line.isCartItem
          ? `<button type="button" class="btn-remove-cart" data-cart-index="${line.cartIndex}" style="background: none; border: none; color: var(--coral); cursor: pointer; padding: 0 5px; font-size: 1.1rem; line-height: 1;" title="Remove Item">&times;</button>`
          : "";

        return `
          <li>
            <div class="item-name" style="flex: 1;">${escapeHtml(line.name)}</div>
            <div class="item-price-row" style="display:flex; align-items:flex-start; gap: 8px;">
              <div class="item-price">${formatCurrency(line.price, state.currency, state.exchangeRates)}</div>
              ${removeBtn}
            </div>
          </li>
        `;
      }).join("");

      // Delegate remove button events
      elements.panelBreakdownList.querySelectorAll(".btn-remove-cart").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.cartIndex, 10);
          removeCartItem(idx);
        });
      });
    }
  }
}

/**
 * Adds the active item to cart.
 */
function handleAddToCart() {
  const state = store.getState();
  if (!state.selectedSubcategory || state.isCurrentItemInCart) return;

  saveCurrentInputs();
  const nextCart = [...state.cart, {
    id: Date.now(),
    category: state.selectedCategory,
    subcategory: state.selectedSubcategory,
    inputs: { ...state.inputs },
    stations: [...state.selectedStations]
  }];

  store.set({
    cart: nextCart,
    isCurrentItemInCart: true
  });

  toast.success("Item added to quote bundle!");

  if (elements.btnAddToCart) {
    const origHTML = elements.btnAddToCart.innerHTML;
    elements.btnAddToCart.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="action-icon" style="margin-right: 6px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Added!
    `;
    elements.btnAddToCart.style.color = "var(--green)";
    elements.btnAddToCart.style.borderColor = "var(--green)";

    setTimeout(() => {
      elements.btnAddToCart.innerHTML = origHTML;
      elements.btnAddToCart.style.color = "";
      elements.btnAddToCart.style.borderColor = "";
    }, 1800);
  }
}

/**
 * Removes an item from the cart.
 * @param {number} index
 */
function removeCartItem(index) {
  const currentCart = [...store.getState().cart];
  currentCart.splice(index, 1);
  store.set({ cart: currentCart });
  toast.info("Item removed from bundle.");
}

/**
 * Generates formatted plain text summary for email/clipboard.
 * @returns {string}
 */
function generateFormattedSummaryText() {
  const state = store.getState();
  const extrasData = getExtrasFormData();
  const quote = calculateFullQuote(state, extrasData);

  const sub = state.selectedSubcategory ? state.selectedSubcategory.replace(/_/g, " ").toUpperCase() : "None";
  const stdText = state.pricingStandard === "agency" ? "Standard Commercial Agency" : "Union Regulated Minimums";

  let text = `==================================================\n`;
  text += `      CK MEDIA - VOICEOVER QUOTE ESTIMATE         \n`;
  text += `==================================================\n\n`;
  text += `Currency: ${state.currency}\n`;
  text += `Pricing Standard: ${stdText}\n`;
  text += `Project Category: ${sub}\n\n`;
  text += `Line Items Breakdown:\n`;

  quote.lines.forEach((line, index) => {
    const formattedPrice = formatCurrency(line.price, state.currency, state.exchangeRates);
    text += `${index + 1}. ${line.name.replace(/\n/g, " | ")} : ${formattedPrice}\n`;
  });

  const formattedTotal = formatCurrency(quote.total, state.currency, state.exchangeRates);
  text += `\n--------------------------------------------------\n`;
  text += `ESTIMATED TOTAL: ${formattedTotal}\n`;
  text += `==================================================\n`;

  return text;
}

/**
 * Handles wizard form submission for both Estimate (Perfex) and Enquiry (Mailto) pathways.
 * @param {Event} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const state = store.getState();

  // Union Confirmation Check
  if (state.pricingStandard === "equity") {
    if (elements.contactUnionConfirm && !elements.contactUnionConfirm.checked) {
      let unionName = "Equity Form of Engagement";
      if (state.currency === "USD") unionName = "SAG-AFTRA";
      if (state.currency === "EUR") unionName = "EMA";

      toast.warning(`Please confirm that your production will utilize an official ${unionName} contract.`);
      elements.contactUnionConfirm.focus();
      return;
    }
  }

  const btn = elements.btnSubmitQuote;
  const btnText = btn?.querySelector(".btn-text");
  const btnIcon = btn?.querySelector(".btn-icon");
  const btnLoader = btn?.querySelector(".btn-loader");

  const setButtonLoading = (loading) => {
    if (!btn) return;
    btn.disabled = loading;
    if (btnText) btnText.textContent = loading ? "Processing..." : (state.selectedPathway === "estimate" ? "Get Official Quote" : "Send Request");
    if (btnIcon) btnIcon.style.display = loading ? "none" : "inline-block";
    if (btnLoader) btnLoader.style.display = loading ? "inline-block" : "none";
  };

  const summary = generateFormattedSummaryText();
  const quote = calculateFullQuote(state, getExtrasFormData());

  if (state.selectedPathway === "enquiry") {
    // ----------------------------------------------------
    // PATHWAY: Availability Enquiry (Mailto)
    // ----------------------------------------------------
    const name = document.getElementById("enq-name")?.value?.trim();
    const email = document.getElementById("enq-email")?.value?.trim();
    const message = document.getElementById("enq-message")?.value?.trim();
    const company = document.getElementById("enq-company")?.value?.trim() || "";
    const phone = document.getElementById("enq-phone")?.value?.trim() || "";
    const date = document.getElementById("enq-date")?.value || "";
    const time = document.getElementById("enq-time")?.value || "";
    const project = document.getElementById("enq-project")?.value?.trim() || "";

    if (!name || !email || !message) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }

    const formattedTotal = formatCurrency(quote.total, state.currency, state.exchangeRates);
    const subject = encodeURIComponent(`VO Enquiry: ${project || "Studio Availability"} - Est: ${formattedTotal}`);

    let body = `Hello Chris,\n\n`;
    body += `I would like to check studio availability for my project.\n\n`;
    body += `--- PROJECT DETAILS ---\n`;
    body += `Name: ${name}\n`;
    if (company) body += `Company: ${company}\n`;
    body += `Email: ${email}\n`;
    if (phone) body += `Phone: ${phone}\n`;
    if (date) body += `Preferred Date: ${date}\n`;
    if (time) body += `Preferred Time: ${time}\n`;
    if (project) body += `Project Name: ${project}\n`;

    if (state.pricingStandard === "equity") {
      let uName = state.currency === "USD" ? "SAG-AFTRA" : state.currency === "EUR" ? "EMA" : "Equity";
      body += `Union Agreement: Confirmed official ${uName} contract will be utilized.\n`;
    }

    body += `\nMessage / Notes:\n${message}\n\n`;
    body += `--- ESTIMATE DETAILS ---\n`;
    body += summary;

    const mailtoUrl = `mailto:${API_ENDPOINTS.SUPPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    showSuccessScreen(name, email, summary);
    toast.success("Enquiry prepared! Email client launched.");

  } else {
    // ----------------------------------------------------
    // PATHWAY: Official Estimate (Perfex CRM API)
    // ----------------------------------------------------
    const companyName = document.getElementById("reg-company")?.value?.trim();
    const address = document.getElementById("reg-address")?.value?.trim();
    const city = document.getElementById("reg-city")?.value?.trim();
    const zip = document.getElementById("reg-zip")?.value?.trim();
    const country = document.getElementById("reg-country")?.value || "243";
    const firstName = document.getElementById("reg-firstname")?.value?.trim();
    const lastName = document.getElementById("reg-lastname")?.value?.trim();
    const email = document.getElementById("reg-email")?.value?.trim();

    if (!companyName || !address || !city || !zip || !firstName || !lastName || !email) {
      toast.error("Please fill in all required company and contact fields.");
      return;
    }

    const payload = {
      client: {
        company: companyName,
        website: document.getElementById("reg-website")?.value?.trim() || "",
        phonenumber: document.getElementById("reg-company-phone")?.value?.trim() || "",
        address,
        city,
        state: document.getElementById("reg-state")?.value?.trim() || "",
        zip,
        country,
        firstname: firstName,
        lastname: lastName,
        email,
        contact_phonenumber: document.getElementById("reg-contact-phone")?.value?.trim() || ""
      },
      estimate: {
        currency: state.currency,
        currency_multiplier: MARKET_MULTIPLIERS[state.currency] || 1.0,
        subtotal: quote.subtotal,
        total: quote.total,
        project_name: "Voiceover Quote",
        clientnote: `Pricing Standard: ${state.pricingStandard}\nCategory: ${state.selectedCategory} / ${state.selectedSubcategory}`,
        items: quote.lines.map(line => {
          const parts = line.name.split("\n");
          return {
            description: parts[0] || "Voiceover Service",
            long_description: parts.slice(1).join("\n"),
            rate: line.price,
            qty: 1
          };
        })
      }
    };

    setButtonLoading(true);

    try {
      await submitPerfexBetaQuote(payload);
      showSuccessScreen(`${firstName} ${lastName}`, email, summary);
      toast.success("Official estimate submitted successfully!");
    } catch (err) {
      console.error("Perfex Submission Error:", err);
      toast.error(`Estimate submission failed: ${err.message}`);
    } finally {
      setButtonLoading(false);
    }
  }
}

/**
 * Displays the success confirmation view.
 */
function showSuccessScreen(fullName, emailAddress, summaryText) {
  if (elements.successSummaryText) {
    elements.successSummaryText.textContent = `Registered To: ${fullName} (${emailAddress})\n\n${summaryText}`;
  }
  if (elements.form) elements.form.style.display = "none";
  if (elements.successContainer) elements.successContainer.style.display = "block";
}

/**
 * Resets wizard form state to initial step.
 */
function resetWizard() {
  if (elements.form) {
    elements.form.reset();
    elements.form.style.display = "block";
  }

  document.querySelectorAll(".card-selector").forEach(c => c.classList.remove("active"));
  store.reset();

  if (elements.successContainer) elements.successContainer.style.display = "none";
  if (elements.pathwayEstimateForm) elements.pathwayEstimateForm.style.display = "none";
  if (elements.pathwayEnquiryForm) elements.pathwayEnquiryForm.style.display = "none";
  if (elements.finalActionsContainer) elements.finalActionsContainer.style.display = "none";

  syncStepUI(1);
  toast.info("Wizard reset for new quote calculation.");
}
