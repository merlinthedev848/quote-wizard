/**
 * @file app.js
 * @description Main application controller and UI coordinator for the Chris Kendall Voiceover Quote Estimator.
 */

import { RATES, ILR_STATIONS, MARKET_MULTIPLIERS, CURRENCY_SYMBOLS, API_ENDPOINTS } from "./config.js?v=2.1.3";
import { store } from "./state.js?v=2.1.3";
import {
  calculateFullQuote,
  formatCurrency,
  convertAmount,
  ilrRateFromReach,
  isStudentDiscountItem,
  isStudentDiscountActive,
  defaultWaiveIntlMultiplier
} from "./calculator.js?v=2.1.3";
import {
  renderDynamicVariables,
  renderStationList,
  escapeHtml
} from "./templates.js?v=2.1.3";
import { getLiveExchangeRates, submitPerfexBetaQuote } from "./api.js?v=2.1.3";
import { toast } from "./toast.js?v=2.1.3";

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
    sidebarFxModeBar: document.getElementById("sidebar-fx-mode-bar"),
    sidebarFxModeLabel: document.getElementById("sidebar-fx-mode-label"),
    btnSidebarToggleFx: document.getElementById("btn-sidebar-toggle-fx"),
    currencyRateInfo: document.getElementById("currency-rate-info"),
    panelTotal: document.getElementById("panel-total"),
    panelStdBadge: document.getElementById("panel-std-badge"),
    panelUnionWarning: document.getElementById("panel-union-warning"),
    panelUnionWarningText: document.getElementById("panel-union-warning-text"),
    panelStudentWarning: document.getElementById("panel-student-warning"),
    panelBreakdownList: document.getElementById("panel-breakdown-list"),
    sidebarCartBadge: document.getElementById("sidebar-cart-badge"),
    btnClearCart: document.getElementById("btn-clear-cart"),
    btnQuickPrint: document.getElementById("btn-quick-print"),
    unionComplianceContainer: document.getElementById("union-compliance-container"),
    unionNoticeP1: document.getElementById("union-notice-p1"),
    unionNoticeP2: document.getElementById("union-notice-p2"),
    studentComplianceContainer: document.getElementById("student-compliance-container"),
    studentInstitution: document.getElementById("student-institution"),
    studentIdRef: document.getElementById("student-id-ref"),
    contactStudentConfirm: document.getElementById("contact-student-confirm"),
    pathwayEstimateForm: document.getElementById("pathway-estimate-form"),
    pathwayEnquiryForm: document.getElementById("pathway-enquiry-form"),
    finalActionsContainer: document.getElementById("final-actions-container"),
    btnSubmitQuote: document.getElementById("btn-submit-quote"),
    btnAddToCart: document.getElementById("btn-add-to-cart"),
    btnAddToCartText: document.getElementById("btn-add-to-cart-text"),
    btnAddAnotherItem: document.getElementById("btn-add-another-item"),
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
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    cacheElements();
    bindEventHandlers();
    initStoreSubscribers();
    await loadExchangeRates();
    renderCurrentQuote();
  });
}

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
  // Receipt rebuilds are the expensive part of typing in a script. Step changes
  // and price-mode changes still paint immediately; field edits batch briefly.
  const renderQuoteSoon = debounce(() => renderCurrentQuote(), 80);
  store.subscribe((state, changedKeys) => {
    if (changedKeys.includes("currentStep") || changedKeys.includes("reset")) {
      syncStepUI(state.currentStep);
    }
    if (
      changedKeys.includes("pricingStandard") ||
      changedKeys.includes("currency") ||
      changedKeys.includes("waiveIntlMultiplier") ||
      changedKeys.includes("reset")
    ) {
      syncStandardAndCurrencyUI(state);
    }
    const immediate = changedKeys.some((key) =>
      key === "currentStep" ||
      key === "reset" ||
      key === "currency" ||
      key === "pricingStandard" ||
      key === "waiveIntlMultiplier" ||
      key === "selectedSubcategory" ||
      key === "selectedCategory" ||
      key === "isCurrentItemInCart"
    );
    if (immediate) renderCurrentQuote();
    else renderQuoteSoon();
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
  // Step 1: Quick Project Finder Shortcuts
  const quickJumpPills = document.querySelectorAll(".quick-jump-pill");
  quickJumpPills.forEach(pill => {
    pill.addEventListener("click", () => {
      const cat = pill.dataset.quickCat;
      const sub = pill.dataset.quickSub;
      const tier = pill.dataset.quickTier;
      if (!cat || !sub) return;

      document.querySelectorAll(".card-selector[data-category]").forEach(c => {
        c.classList.toggle("active", c.dataset.category === cat);
      });

      const radio = document.querySelector(`input[name="subcategory"][value="${sub}"]`);
      if (radio) radio.checked = true;

      const nextInputs = {};
      if (tier && sub === "audio_drama_fiction") {
        nextInputs.drama_tier = tier;
      }

      store.set({
        selectedCategory: cat,
        selectedSubcategory: sub,
        inputs: nextInputs,
        selectedStations: [],
        waiveIntlMultiplier: defaultWaiveIntlMultiplier(sub, nextInputs),
        isCurrentItemInCart: false,
        currentStep: 3
      });
      updateNavButtons();
    });
  });

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
        inputs: {},
        selectedStations: [],
        isCurrentItemInCart: false
      });
      updateNavButtons();

      setTimeout(() => {
        navigateStep(1);
      }, 180);
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
      const sub = radio.value;
      store.set({
        selectedSubcategory: sub,
        inputs: {},
        selectedStations: [],
        waiveIntlMultiplier: defaultWaiveIntlMultiplier(sub, {}),
        isCurrentItemInCart: false
      });
      updateNavButtons();

      setTimeout(() => {
        navigateStep(1);
      }, 180);
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

      // Auto-sync Step 6 registration country default based on currency
      const regCountry = document.getElementById("reg-country");
      if (regCountry && !regCountry.dataset.userModified) {
        if (newCurr === "GBP") regCountry.value = "243";
        else if (newCurr === "USD") regCountry.value = "244";
        else if (newCurr === "EUR") regCountry.value = "109";
      }

      store.set({ currency: newCurr });
    });
  });

  const regCountrySelect = document.getElementById("reg-country");
  if (regCountrySelect) {
    regCountrySelect.addEventListener("change", () => {
      regCountrySelect.dataset.userModified = "true";
    });
  }

  if (elements.btnSidebarToggleFx) {
    elements.btnSidebarToggleFx.addEventListener("click", () => {
      store.set({ waiveIntlMultiplier: !store.getState().waiveIntlMultiplier });
    });
  }

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
    input.addEventListener("input", () => {
      if (input.id === "edit-hours") {
        input.dataset.userModified = "true";
      }
      renderCurrentQuote();
    });
  });

  // Add to Quote (Cart) Button
  if (elements.btnAddToCart) {
    elements.btnAddToCart.addEventListener("click", () => handleAddToCart());
  }

  // Add Another Service Button
  if (elements.btnAddAnotherItem) {
    elements.btnAddAnotherItem.addEventListener("click", () => handleAddAnotherItem());
  }

  // Clear Cart Button
  if (elements.btnClearCart) {
    elements.btnClearCart.addEventListener("click", () => handleClearCart());
  }

  // Quick Print / Save PDF Button
  if (elements.btnQuickPrint) {
    elements.btnQuickPrint.addEventListener("click", () => {
      window.print();
    });
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
 * Validates Step 3 Student Identification fields if a Student Discount tier is currently active.
 * @returns {boolean}
 */
function validateStep3StudentFields() {
  saveCurrentInputs();
  const state = store.getState();
  if (!isStudentDiscountItem(state.selectedSubcategory, state.inputs)) {
    return true;
  }

  const instInput = document.getElementById("step3-student-institution");
  const idRefInput = document.getElementById("step3-student-id-ref");
  const confirmInput = document.getElementById("step3-student-confirm");

  if (instInput && !instInput.value.trim()) {
    toast.warning("Student identification is required: please enter your University, College, or School name.");
    instInput.focus();
    return false;
  }
  if (idRefInput && !idRefInput.value.trim()) {
    toast.warning("Student identification is required: please enter your Student ID number or academic email.");
    idRefInput.focus();
    return false;
  }
  if (confirmInput && !confirmInput.checked) {
    toast.warning("Please confirm you have valid Student Identification to qualify for the student discount rate.");
    confirmInput.focus();
    return false;
  }
  return true;
}

/**
 * Step transition logic.
 * @param {number} direction
 */
function navigateStep(direction) {
  const { currentStep } = store.getState();
  if (currentStep === 3 && direction > 0) {
    if (!validateStep3StudentFields()) return;
  }
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
function buildDynamicVariablesUI({ commit = true } = {}) {
  const container = elements.dynamicVariablesContainer;
  if (!container) return;

  const state = store.getState();
  container.dataset.subcategory = state.selectedSubcategory || "";
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

  // Commit the visible defaults. Reading the previous form first used to
  // wipe an explicit quick-jump tier and price a different model than the one on screen.
  if (commit) saveCurrentInputs();
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
      saveCurrentInputs();
    });
  }

  // Script Paste, Pacing WPM & Minutes-to-Words Live Analyzer
  const scriptTextarea = document.getElementById("input-script-text");
  const clearScriptBtn = document.getElementById("btn-clear-script");
  const scriptWpmSelect = document.getElementById("input-script-wpm");
  const rawMinutesInput = document.getElementById("input-raw-minutes");
  const dramaPacingSelect = document.getElementById("input-drama-pacing");

  if (scriptTextarea || scriptWpmSelect || rawMinutesInput) {
    const updateScriptStats = (source = "script") => {
      const wpm = parseInt(scriptWpmSelect?.value, 10) || 150;
      const raw = scriptTextarea ? scriptTextarea.value : "";
      const trimmed = raw.trim();

      let words = 0;
      const chars = raw.length;

      if (source === "minutes" && rawMinutesInput) {
        const mins = parseFloat(rawMinutesInput.value) || 0;
        // Raw un-paused reading speed is ~150 wpm; converts minutes into baseline script words
        words = Math.round(mins * 150);
      } else if (trimmed) {
        words = trimmed.split(/\s+/).filter(Boolean).length;
      } else {
        const numInput = document.getElementById("input-words-num");
        words = parseInt(numInput?.value, 10) || 0;
      }

      const minutes = Math.floor(words / wpm);
      const seconds = Math.round(((words % wpm) / wpm) * 60);
      const durStr = `~${minutes > 0 ? minutes + "m " : ""}${seconds}s`;

      const statWords = document.getElementById("stat-words");
      const statChars = document.getElementById("stat-chars");
      const statDur = document.getElementById("stat-duration");
      const statScope = document.getElementById("stat-scope");
      if (statWords) statWords.textContent = words.toLocaleString();
      if (statChars) statChars.textContent = chars.toLocaleString();
      if (statDur) statDur.textContent = `${durStr} est. read-time (${wpm} wpm)`;

      const finishedMins = words / wpm;
      const sessionHrs = Math.max(0.5, Math.ceil((finishedMins * 2.5) / 30) * 0.5);
      const recEditHrs = Math.max(0.5, Math.round((finishedMins / 10) * 2) / 2);
      if (statScope) {
        statScope.textContent = `Studio Scope: ~${sessionHrs} hr session • ~${recEditHrs} hr full edit`;
      }

      const editHoursInput = document.getElementById("edit-hours");
      if (editHoursInput && !editHoursInput.dataset.userModified && words > 0) {
        editHoursInput.value = recEditHrs;
      }

      if (clearScriptBtn) {
        clearScriptBtn.style.display = raw ? "inline-block" : "none";
      }

      if (words > 0 && (source === "script" || source === "minutes")) {
        const slider = document.getElementById("input-words");
        const numInput = document.getElementById("input-words-num");
        const disp = document.getElementById("disp-words");
        if (slider) {
          const max = parseInt(slider.max, 10) || 50000;
          slider.value = Math.min(words, max);
        }
        if (numInput) numInput.value = words;
        if (disp) disp.textContent = `${words} w`;
      }

      saveCurrentInputs();
    };

    if (scriptTextarea) {
      scriptTextarea.addEventListener("input", () => updateScriptStats("script"));
    }

    if (rawMinutesInput) {
      rawMinutesInput.addEventListener("input", () => updateScriptStats("minutes"));
    }

    if (scriptWpmSelect) {
      scriptWpmSelect.addEventListener("change", () => {
        if (dramaPacingSelect) {
          const w = scriptWpmSelect.value;
          if (w === "115") dramaPacingSelect.value = "dramatic";
          else if (w === "130") dramaPacingSelect.value = "deliberate";
          else if (w === "150") dramaPacingSelect.value = "standard";
        }
        updateScriptStats("wpm");
      });
    }

    if (dramaPacingSelect && scriptWpmSelect) {
      dramaPacingSelect.addEventListener("change", () => {
        const p = dramaPacingSelect.value;
        if (p === "dramatic") scriptWpmSelect.value = "115";
        else if (p === "deliberate") scriptWpmSelect.value = "130";
        else scriptWpmSelect.value = "150";
        updateScriptStats("wpm");
      });
    }

    if (clearScriptBtn && scriptTextarea) {
      clearScriptBtn.addEventListener("click", () => {
        scriptTextarea.value = "";
        if (rawMinutesInput) rawMinutesInput.value = "";
        updateScriptStats("script");
      });
    }

    updateScriptStats("init");
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
    });
  }

  // Selects and numbers
  const selectsAndNumbers = container.querySelectorAll('select:not(#input-script-wpm), input[type="number"]:not(#input-words-num):not(#input-raw-minutes)');
  selectsAndNumbers.forEach(input => {
    input.addEventListener("input", () => {
      const studentBox = document.getElementById("step3-student-id-box");
      if (studentBox && (input.id === "input-drama-tier" || input.id === "input-doc-usage" || input.id === "input-anim-tier")) {
        studentBox.style.display = parseFloat(input.value) < 1.0 ? "block" : "none";
      }
      saveCurrentInputs();
    });
  });

  // Step 3 Student ID Verification Inputs
  const step3StudentInputs = container.querySelectorAll("#step3-student-institution, #step3-student-id-ref, #step3-student-course, #step3-student-confirm");
  step3StudentInputs.forEach(el => {
    el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
      saveCurrentInputs();
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
      const state = store.getState();
      const patch = { selectedStations: current };
      const syncedCart = cartWithOpenItem(state, { stations: current });
      if (syncedCart) patch.cart = syncedCart;
      store.set(patch);
    });
  });
}

/**
 * True when the Step 3 form on screen belongs to the selected service.
 * Stops a hidden previous form from being written into the new service.
 * @returns {boolean}
 */
function formMatchesSelectedSubcategory() {
  const container = elements.dynamicVariablesContainer;
  const sub = store.getState().selectedSubcategory;
  if (!container || !sub) return false;
  return container.dataset.subcategory === sub;
}

/**
 * Replace the open bundled item with the form's latest inputs.
 * @param {object} state
 * @param {{ inputs?: object, stations?: string[] }} updates
 * @returns {Array|null}
 */
function cartWithOpenItem(state, updates) {
  if (!state.isCurrentItemInCart || !Array.isArray(state.cart) || state.cart.length === 0) return null;
  const last = state.cart[state.cart.length - 1];
  if (!last || last.subcategory !== state.selectedSubcategory) return null;
  const next = state.cart.slice(0, -1);
  next.push({
    ...last,
    category: state.selectedCategory,
    inputs: { ...(updates.inputs ?? last.inputs) },
    stations: [...(updates.stations ?? last.stations ?? [])]
  });
  return next;
}

/**
 * Clears the in-progress service so a removed bundle line is not priced again.
 */
function clearOpenServiceSelection() {
  document.querySelectorAll(".card-selector[data-category]").forEach(c => c.classList.remove("active"));
  const activeRadio = document.querySelector('input[name="subcategory"]:checked');
  if (activeRadio) activeRadio.checked = false;
  if (elements.dynamicVariablesContainer) {
    elements.dynamicVariablesContainer.innerHTML = `<p class="field-hint">Please choose a subcategory first.</p>`;
    elements.dynamicVariablesContainer.dataset.subcategory = "";
  }
}

/**
 * Saves current Step 3 input field values into state.
 */
function saveCurrentInputs() {
  if (!formMatchesSelectedSubcategory()) return;

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

  const scriptTextInput = document.getElementById("input-script-text");
  if (scriptTextInput) inputs.script_text = scriptTextInput.value;

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

  const docUsageSelect = document.getElementById("input-doc-usage");
  if (docUsageSelect) inputs.doc_usage = docUsageSelect.value;

  const dramaTierSelect = document.getElementById("input-drama-tier");
  if (dramaTierSelect) inputs.drama_tier = dramaTierSelect.value;

  const dramaPacingSelect = document.getElementById("input-drama-pacing");
  if (dramaPacingSelect) inputs.drama_pacing = dramaPacingSelect.value;

  const animTierSelect = document.getElementById("input-anim-tier");
  if (animTierSelect) inputs.anim_tier = animTierSelect.value;

  const scriptWpmSelect = document.getElementById("input-script-wpm");
  if (scriptWpmSelect) inputs.script_wpm = scriptWpmSelect.value;

  const rawMinutesInput = document.getElementById("input-raw-minutes");
  if (rawMinutesInput && rawMinutesInput.value !== "") inputs.raw_minutes = rawMinutesInput.value;

  const prevInputs = store.getState().inputs || {};

  // Step 3 Student Verification Fields (persist & sync to Step 6)
  const s3Inst = document.getElementById("step3-student-institution");
  const s3IdRef = document.getElementById("step3-student-id-ref");
  const s3Course = document.getElementById("step3-student-course");
  const s3Confirm = document.getElementById("step3-student-confirm");

  inputs.student_institution = s3Inst ? s3Inst.value.trim() : (prevInputs.student_institution || "");
  inputs.student_id_ref = s3IdRef ? s3IdRef.value.trim() : (prevInputs.student_id_ref || "");
  inputs.student_course = s3Course ? s3Course.value.trim() : (prevInputs.student_course || "");
  inputs.student_confirm = s3Confirm ? s3Confirm.checked : Boolean(prevInputs.student_confirm);

  if (elements.studentInstitution && inputs.student_institution) {
    elements.studentInstitution.value = inputs.student_institution;
  }
  if (elements.studentIdRef && inputs.student_id_ref) {
    elements.studentIdRef.value = inputs.student_id_ref;
  }
  if (elements.contactStudentConfirm && s3Confirm) {
    elements.contactStudentConfirm.checked = inputs.student_confirm;
  }

  // Auto-detect Student / Indie Concession vs Commercial Buyout tier changes for International FX.
  // Only when that tier actually changed, so a manual 1.0x toggle survives word-count edits.
  const prev = store.getState();
  let nextWaiveFx = prev.waiveIntlMultiplier;
  if (inputs.drama_tier && inputs.drama_tier !== prevInputs.drama_tier) {
    nextWaiveFx = parseFloat(inputs.drama_tier) <= 1.0;
  } else if (inputs.doc_usage && inputs.doc_usage !== prevInputs.doc_usage) {
    nextWaiveFx = parseFloat(inputs.doc_usage) <= 1.0;
  } else if (inputs.anim_tier && inputs.anim_tier !== prevInputs.anim_tier) {
    nextWaiveFx = parseFloat(inputs.anim_tier) <= 1.0;
  } else if (inputs.game_tier && inputs.game_tier !== prevInputs.game_tier) {
    nextWaiveFx = parseFloat(inputs.game_tier) <= 1.0;
  }

  const patch = { inputs };
  if (nextWaiveFx !== prev.waiveIntlMultiplier) patch.waiveIntlMultiplier = nextWaiveFx;

  const syncedCart = cartWithOpenItem(prev, { inputs, stations: prev.selectedStations });
  if (syncedCart) {
    patch.cart = syncedCart;
  } else if (prev.isCurrentItemInCart) {
    // The open form no longer matches the bundled snapshot, so price it on its own.
    patch.isCurrentItemInCart = false;
  }

  store.set(patch);
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

  if (currency !== "GBP") {
    const region = currency === "USD" ? "US Market" : "EU Market";
    const waived = Boolean(state.waiveIntlMultiplier);
    const rateLabel = waived
      ? `1.0&times; UK Base Rate (Indie / Non-Broadcast Direct FX)`
      : `&times;${multiplier} commercial market premium applied`;
    const toggleBtnText = waived
      ? `Restore &times;${multiplier} Commercial Rate`
      : `Use 1.0&times; Indie / Direct FX`;

    if (elements.intlNotice) {
      elements.intlNotice.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${region} &bull; ${rateLabel}</span>
        <button type="button" id="btn-toggle-intl-fx" style="margin-left:6px; background:var(--orange); color:var(--ink); border:none; border-radius:4px; padding:2px 7px; font-size:0.65rem; font-weight:800; cursor:pointer; text-transform:uppercase;">${toggleBtnText}</button>
      `;
      elements.intlNotice.style.display = "flex";

      const btnToggleFx = document.getElementById("btn-toggle-intl-fx");
      if (btnToggleFx) {
        btnToggleFx.addEventListener("click", () => {
          store.set({ waiveIntlMultiplier: !store.getState().waiveIntlMultiplier });
        });
      }
    }

    if (elements.sidebarFxModeBar) {
      elements.sidebarFxModeBar.style.display = "flex";
      if (elements.sidebarFxModeLabel) {
        elements.sidebarFxModeLabel.innerHTML = waived
          ? `🌱 <strong>1.0&times; Direct FX</strong> (Indie / Student)`
          : `🏢 <strong>&times;${multiplier} ${region}</strong> Commercial`;
      }
      if (elements.btnSidebarToggleFx) {
        elements.btnSidebarToggleFx.innerHTML = waived
          ? `Switch to &times;${multiplier} Commercial`
          : `Use 1.0&times; Indie FX`;
      }
    }
  } else {
    if (elements.intlNotice) elements.intlNotice.style.display = "none";
    if (elements.sidebarFxModeBar) elements.sidebarFxModeBar.style.display = "none";
  }
}

/**
 * Updates default slider values when standard toggles.
 */
function applyStandardToCurrentInputs() {
  const { selectedSubcategory, pricingStandard, currentStep } = store.getState();
  if (!selectedSubcategory || !RATES[selectedSubcategory]) return;

  if (currentStep === 3) {
    buildDynamicVariablesUI({ commit: false });
  }

  const stdRates = RATES[selectedSubcategory][pricingStandard];
  if (!stdRates) return;

  const bsfInput = document.getElementById("input-bsf");
  if (bsfInput && stdRates.bsf) {
    bsfInput.value = stdRates.bsf;
    const disp = document.getElementById("disp-bsf");
    if (disp) disp.textContent = `£${stdRates.bsf}`;
  }

  const hourlyRateInput = document.getElementById("input-hourly-rate");
  const stdHourlyOrPfh = stdRates.ratePerHour || stdRates.ratePerFH;
  if (hourlyRateInput && stdHourlyOrPfh) {
    hourlyRateInput.value = stdHourlyOrPfh;
    const disp = document.getElementById("disp-hourly-rate");
    if (disp) disp.textContent = `£${stdHourlyOrPfh}`;
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

  if (elements.studentComplianceContainer) {
    elements.studentComplianceContainer.style.display = isStudentDiscountActive(state) ? "block" : "none";
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
      elements.panelTotal.textContent = formatCurrency(_currentDisplayedTotal, state.currency, state.exchangeRates, Boolean(state.waiveIntlMultiplier));
    }

    if (progress < 1) {
      _animFrameId = requestAnimationFrame(tick);
    } else {
      _currentDisplayedTotal = end;
      if (elements.panelTotal) {
        elements.panelTotal.textContent = formatCurrency(end, state.currency, state.exchangeRates, Boolean(state.waiveIntlMultiplier));
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
      const marketSuffix = state.currency !== "GBP"
        ? (state.waiveIntlMultiplier ? " (1.0× Indie Direct FX)" : ` (×${MARKET_MULTIPLIERS[state.currency]} Intl. Premium)`)
        : "";
      elements.panelStdBadge.textContent = `Standard Agency Rates${marketSuffix}`;
      elements.panelStdBadge.style.color = "var(--muted)";
    }
  }

  // Sidebar Cart Count Badge
  if (elements.sidebarCartBadge) {
    const cartCount = state.cart.length;
    if (cartCount > 0) {
      elements.sidebarCartBadge.textContent = `${cartCount} Item${cartCount > 1 ? "s" : ""}`;
      elements.sidebarCartBadge.style.display = "inline-block";
    } else {
      elements.sidebarCartBadge.style.display = "none";
    }
  }

  // Clear Cart button visibility
  if (elements.btnClearCart) {
    elements.btnClearCart.style.display = state.cart.length > 0 ? "inline-block" : "none";
  }

  // Add Another Service button visibility in Step 3
  if (elements.btnAddAnotherItem) {
    elements.btnAddAnotherItem.style.display = (state.currentStep === 3 && state.selectedSubcategory) ? "inline-flex" : "none";
  }

  // Add to Cart button state text
  if (elements.btnAddToCartText) {
    elements.btnAddToCartText.textContent = state.isCurrentItemInCart ? "Added to Quote ✓" : "Add to Quote";
  }

  // Union Warning Box
  if (elements.panelUnionWarning) {
    elements.panelUnionWarning.style.display = state.pricingStandard === "equity" ? "block" : "none";
  }

  // Student Discount ID Requirement Warning Box
  if (elements.panelStudentWarning) {
    elements.panelStudentWarning.style.display = isStudentDiscountActive(state) ? "block" : "none";
  }

  // Breakdown List
  if (elements.panelBreakdownList) {
    if (quote.lines.length === 0) {
      elements.panelBreakdownList.innerHTML = `<li class="breakdown-empty">No details selected yet. Start by choosing a category.</li>`;
    } else {
      elements.panelBreakdownList.innerHTML = quote.lines.map((line) => {
        const cartActions = line.isCartItem
          ? `<button type="button" class="btn-edit-cart" data-cart-index="${line.cartIndex}" style="background: rgba(17,19,22,0.06); border: 1px solid rgba(17,19,22,0.2); border-radius: 4px; color: var(--ink); cursor: pointer; padding: 1px 5px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;" title="Edit Item in Step 3">Edit</button>
             <button type="button" class="btn-remove-cart" data-cart-index="${line.cartIndex}" style="background: none; border: none; color: var(--coral); cursor: pointer; padding: 0 4px; font-size: 1.15rem; line-height: 1; font-weight: 800;" title="Remove Item from Bundle">&times;</button>`
          : "";

        const isCart = line.isCartItem;
        const isAddon = line.name.startsWith("Add-on:");
        const isSurcharge = line.name.startsWith("Surcharge:");

        let badgeHtml = "";
        if (isCart) badgeHtml = `<span style="font-size:0.65rem; font-weight:800; background:rgba(255,179,44,0.25); color:var(--ink); padding:2px 6px; border-radius:4px; margin-right:5px; border:1px solid rgba(17,19,22,0.15);">IN BUNDLE</span>`;
        else if (isAddon) badgeHtml = `<span style="font-size:0.65rem; font-weight:800; background:rgba(24,199,216,0.2); color:var(--ink); padding:2px 6px; border-radius:4px; margin-right:5px; border:1px solid rgba(17,19,22,0.15);">ADD-ON</span>`;
        else if (isSurcharge) badgeHtml = `<span style="font-size:0.65rem; font-weight:800; background:rgba(255,91,74,0.2); color:var(--coral); padding:2px 6px; border-radius:4px; margin-right:5px; border:1px solid rgba(255,91,74,0.3);">RUSH</span>`;
        else badgeHtml = `<span style="font-size:0.65rem; font-weight:800; background:rgba(183,245,90,0.3); color:var(--ink); padding:2px 6px; border-radius:4px; margin-right:5px; border:1px solid rgba(17,19,22,0.15);">ACTIVE</span>`;

        return `
          <li style="display:flex; flex-direction:column; gap:4px; padding: 10px 0; border-bottom: 1px solid var(--line);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div class="item-name" style="flex: 1; font-size:0.83rem; font-weight:600; line-height:1.35; white-space:pre-wrap;">${badgeHtml}${escapeHtml(line.name)}</div>
              <div class="item-price-row" style="display:flex; align-items:center; gap: 6px; flex-shrink:0;">
                <div class="item-price" style="font-weight:800; font-size:0.9rem;">${formatCurrency(line.price, state.currency, state.exchangeRates, Boolean(state.waiveIntlMultiplier))}</div>
                ${cartActions}
              </div>
            </div>
          </li>
        `;
      }).join("");

      // Delegate edit and remove button events
      elements.panelBreakdownList.querySelectorAll(".btn-edit-cart").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.cartIndex, 10);
          editCartItem(idx);
        });
      });

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
  const initial = store.getState();
  if (!initial.selectedSubcategory) {
    toast.warning("Please select and configure a service first.");
    return;
  }
  if (initial.isCurrentItemInCart) {
    toast.info("Item is already in your quote bundle.");
    return;
  }
  if (!validateStep3StudentFields()) {
    return;
  }

  saveCurrentInputs();
  const state = store.getState();
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
 * Saves current item to cart and smoothly transitions user to Step 1 to choose another service.
 */
function handleAddAnotherItem() {
  const initial = store.getState();
  if (!initial.selectedSubcategory) {
    toast.warning("Please configure your current service first.");
    return;
  }
  if (!validateStep3StudentFields()) {
    return;
  }

  saveCurrentInputs();
  const state = store.getState();
  const nextCart = [...state.cart];
  if (!state.isCurrentItemInCart) {
    nextCart.push({
      id: Date.now(),
      category: state.selectedCategory,
      subcategory: state.selectedSubcategory,
      inputs: { ...state.inputs },
      stations: [...state.selectedStations]
    });
  }

  // Clear card active visual states
  document.querySelectorAll(".card-selector[data-category]").forEach(c => c.classList.remove("active"));
  const activeRadio = document.querySelector('input[name="subcategory"]:checked');
  if (activeRadio) activeRadio.checked = false;

  store.set({
    cart: nextCart,
    selectedCategory: null,
    selectedSubcategory: null,
    inputs: {},
    selectedStations: [],
    isCurrentItemInCart: false,
    currentStep: 1
  });

  toast.success("Service added to receipt! Choose your next category.");
}

/**
 * Clears all items from the quote bundle.
 */
function handleClearCart() {
  const state = store.getState();
  if (state.isCurrentItemInCart) {
    clearOpenServiceSelection();
    store.set({
      cart: [],
      isCurrentItemInCart: false,
      selectedCategory: null,
      selectedSubcategory: null,
      inputs: {},
      selectedStations: []
    });
  } else {
    store.set({ cart: [] });
  }
  toast.info("Quote bundle cleared.");
}

/**
 * Removes an item from the cart.
 * @param {number} index
 */
function removeCartItem(index) {
  const state = store.getState();
  const currentCart = [...state.cart];
  const removed = currentCart[index];
  if (!removed) return;
  const removingOpenItem = state.isCurrentItemInCart && index === currentCart.length - 1;
  currentCart.splice(index, 1);

  if (removingOpenItem) {
    clearOpenServiceSelection();
    store.set({
      cart: currentCart,
      isCurrentItemInCart: false,
      selectedCategory: null,
      selectedSubcategory: null,
      inputs: {},
      selectedStations: []
    });
  } else {
    store.set({ cart: currentCart });
  }
  toast.info("Item removed from bundle.");
}

/**
 * Loads a bundled item back into Step 3 for editing.
 * @param {number} index
 */
function editCartItem(index) {
  const currentCart = [...store.getState().cart];
  const item = currentCart[index];
  if (!item) return;

  currentCart.splice(index, 1);

  document.querySelectorAll(".card-selector[data-category]").forEach(c => {
    c.classList.toggle("active", c.dataset.category === item.category);
  });
  const radio = document.querySelector(`input[name="subcategory"][value="${item.subcategory}"]`);
  if (radio) radio.checked = true;

  store.set({
    cart: currentCart,
    selectedCategory: item.category,
    selectedSubcategory: item.subcategory,
    inputs: { ...item.inputs },
    selectedStations: [...(item.stations || [])],
    isCurrentItemInCart: false,
    currentStep: 3
  });
  buildDynamicVariablesUI();
  updateNavButtons();
  toast.info("Loaded item into Step 3 for editing.");
}

/**
 * Constructs the mailto URL and structured email body for the Availability Enquiry pathway.
 * @param {object} params
 * @param {object} params.state
 * @param {object} params.quote
 * @param {object} params.formData
 * @returns {{ recipient: string, subject: string, body: string, mailtoUrl: string }}
 */
export function buildEnquiryMailtoPayload({ state, quote, formData = {} }) {
  const {
    name = "",
    email = "",
    message = "",
    company = "",
    phone = "",
    date = "",
    time = "",
    project = "",
    budget = "",
    scopeHelp = "",
    studentInstitution = "",
    studentIdRef = ""
  } = formData;

  const waiveFx = Boolean(state.waiveIntlMultiplier);
  const studentActive = isStudentDiscountActive(state);
  const formattedTotal = formatCurrency(quote.total, state.currency, state.exchangeRates, waiveFx);
  const subject = `VO Enquiry: ${project || "Studio Availability"} - Est: ${formattedTotal}`;

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
  if (budget) body += `Target Budget / Stipend: ${budget}\n`;
  if (scopeHelp) body += `Guidance Requested: ${scopeHelp}\n`;

  if (state.pricingStandard === "equity") {
    let uName = state.currency === "USD" ? "SAG-AFTRA" : state.currency === "EUR" ? "EMA" : "Equity";
    body += `Union Agreement: Confirmed official ${uName} contract will be utilized.\n`;
  }

  if (studentActive) {
    body += `Student Discount Eligibility: Confirmed enrolled student (Valid Student ID Required).\n`;
    if (studentInstitution) body += `Educational Institution: ${studentInstitution}\n`;
    if (studentIdRef) body += `Student ID / Academic Email: ${studentIdRef}\n`;
  }

  body += `\nMessage / Notes:\n${message}\n\n`;
  body += `--- ESTIMATE DETAILS ---\n`;

  const sub = state.selectedSubcategory ? state.selectedSubcategory.replace(/_/g, " ").toUpperCase() : "None";
  const stdText = state.pricingStandard === "agency" ? "Standard Commercial Agency" : "Union Regulated Minimums";

  let summary = `==================================================\n`;
  summary += `      CK MEDIA - VOICEOVER QUOTE ESTIMATE         \n`;
  summary += `==================================================\n\n`;
  summary += `Currency: ${state.currency}${waiveFx ? " (1.0x Direct FX)" : ""}\n`;
  summary += `Pricing Standard: ${stdText}\n`;
  if (state.cart?.length > 0) {
    summary += `Bundled Services: ${state.cart.length} item(s)\n\n`;
  } else {
    summary += `Project Category: ${sub}\n\n`;
  }
  summary += `Line Items Breakdown:\n`;

  quote.lines.forEach((line, index) => {
    const formattedPrice = formatCurrency(line.price, state.currency, state.exchangeRates, waiveFx);
    summary += `${index + 1}. ${line.name.replace(/\n/g, " | ")} : ${formattedPrice}\n`;
  });

  summary += `\n--------------------------------------------------\n`;
  summary += `ESTIMATED TOTAL: ${formattedTotal}\n`;
  summary += `==================================================\n`;

  body += summary;

  const recipient = API_ENDPOINTS.SUPPORT_EMAIL;
  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    recipient,
    subject,
    body,
    mailtoUrl
  };
}

/**
 * Constructs the standardized Perfex CRM API registration and estimate payload.
 * @param {object} params
 * @param {object} params.state
 * @param {object} params.quote
 * @param {object} params.formData
 * @returns {object} Perfex CRM API Payload
 */
export function buildPerfexPayload({ state, quote, formData = {} }) {
  const {
    company = "",
    website = "",
    companyPhone = "",
    address = "",
    city = "",
    regionState = "",
    zip = "",
    country = "243",
    firstName = "",
    lastName = "",
    email = "",
    contactPhone = "",
    studentInstitution = "",
    studentIdRef = ""
  } = formData;

  const studentActive = isStudentDiscountActive(state);
  let clientNote = `Pricing Standard: ${state.pricingStandard}\nCurrency: ${state.currency}${state.waiveIntlMultiplier ? " (1.0x Direct FX)" : ""}\nItems Count: ${state.cart?.length || 1}`;
  if (studentActive) {
    clientNote += `\nStudent Discount Rate: Valid Student ID Required`;
    if (studentInstitution) clientNote += `\nInstitution: ${studentInstitution}`;
    if (studentIdRef) clientNote += `\nStudent ID / Academic Email: ${studentIdRef}`;
  }

  return {
    client: {
      company,
      website,
      phonenumber: companyPhone,
      address,
      city,
      state: regionState,
      zip,
      country,
      firstname: firstName,
      lastname: lastName,
      email,
      contact_phonenumber: contactPhone
    },
    estimate: {
      currency: state.currency,
      currency_multiplier: state.waiveIntlMultiplier ? 1.0 : (MARKET_MULTIPLIERS[state.currency] || 1.0),
      subtotal: quote.subtotal,
      total: quote.total,
      project_name: "Voiceover Quote",
      clientnote: clientNote,
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
}

/**
 * Generates formatted plain text summary for email/clipboard.
 * @returns {string}
 */
export function generateFormattedSummaryText() {
  const state = store.getState();
  const extrasData = getExtrasFormData();
  const quote = calculateFullQuote(state, extrasData);

  const sub = state.selectedSubcategory ? state.selectedSubcategory.replace(/_/g, " ").toUpperCase() : "None";
  const stdText = state.pricingStandard === "agency" ? "Standard Commercial Agency" : "Union Regulated Minimums";
  const waiveFx = Boolean(state.waiveIntlMultiplier);

  let text = `==================================================\n`;
  text += `      CK MEDIA - VOICEOVER QUOTE ESTIMATE         \n`;
  text += `==================================================\n\n`;
  text += `Currency: ${state.currency}${waiveFx ? " (1.0x Direct FX)" : ""}\n`;
  text += `Pricing Standard: ${stdText}\n`;
  if (isStudentDiscountActive(state)) {
    text += `Eligibility Note: Student Discount Applied (Valid Student ID Required)\n`;
  }
  if (state.cart?.length > 0) {
    text += `Bundled Services: ${state.cart.length} item(s)\n\n`;
  } else {
    text += `Project Category: ${sub}\n\n`;
  }
  text += `Line Items Breakdown:\n`;

  quote.lines.forEach((line, index) => {
    const formattedPrice = formatCurrency(line.price, state.currency, state.exchangeRates, waiveFx);
    text += `${index + 1}. ${line.name.replace(/\n/g, " | ")} : ${formattedPrice}\n`;
  });

  const formattedTotal = formatCurrency(quote.total, state.currency, state.exchangeRates, waiveFx);
  text += `\n--------------------------------------------------\n`;
  text += `ESTIMATED TOTAL: ${formattedTotal}\n`;
  text += `==================================================\n`;

  return text;
}

/**
 * Handles wizard form submission for both Estimate (Perfex) and Enquiry (Mailto) pathways.
 * @param {Event} e
 */
export async function handleFormSubmit(e) {
  e.preventDefault();
  const state = store.getState();

  // Enter in an earlier step must not submit the booking form.
  if (state.currentStep !== 6) return;

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

  // Student Discount Identification Verification Check
  const studentDiscountUsed = isStudentDiscountActive(state);
  const studentInstitutionVal = elements.studentInstitution?.value?.trim() || "";
  const studentIdRefVal = elements.studentIdRef?.value?.trim() || "";

  if (studentDiscountUsed) {
    if (!studentInstitutionVal) {
      toast.warning("Student identification is required: please enter your University, College, or School name.");
      elements.studentInstitution?.focus();
      return;
    }
    if (!studentIdRefVal) {
      toast.warning("Student identification is required: please enter your Student ID number or academic email.");
      elements.studentIdRef?.focus();
      return;
    }
    if (elements.contactStudentConfirm && !elements.contactStudentConfirm.checked) {
      toast.warning("Please confirm that you have valid Student Identification to order a student discount rated project.");
      elements.contactStudentConfirm.focus();
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

  // The enquiry form is what step 6 shows unless the official-quote path was chosen.
  if (state.selectedPathway !== "estimate") {
    // ----------------------------------------------------
    // PATHWAY: Availability Enquiry (Mailto)
    // ----------------------------------------------------
    const formData = {
      name: document.getElementById("enq-name")?.value?.trim() || "",
      email: document.getElementById("enq-email")?.value?.trim() || "",
      message: document.getElementById("enq-message")?.value?.trim() || "",
      company: document.getElementById("enq-company")?.value?.trim() || "",
      phone: document.getElementById("enq-phone")?.value?.trim() || "",
      date: document.getElementById("enq-date")?.value || "",
      time: document.getElementById("enq-time")?.value || "",
      project: document.getElementById("enq-project")?.value?.trim() || "",
      budget: document.getElementById("enq-budget")?.value?.trim() || "",
      scopeHelp: document.getElementById("enq-scope-help")?.value || "",
      studentInstitution: studentInstitutionVal,
      studentIdRef: studentIdRefVal
    };

    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }

    const { mailtoUrl } = buildEnquiryMailtoPayload({ state, quote, formData });
    window.location.href = mailtoUrl;

    showSuccessScreen(formData.name, formData.email, summary);
    toast.success("Enquiry prepared! Email client launched.");

  } else {
    // ----------------------------------------------------
    // PATHWAY: Official Estimate (Perfex CRM API)
    // ----------------------------------------------------
    const formData = {
      company: document.getElementById("reg-company")?.value?.trim() || "",
      website: document.getElementById("reg-website")?.value?.trim() || "",
      companyPhone: document.getElementById("reg-company-phone")?.value?.trim() || "",
      address: document.getElementById("reg-address")?.value?.trim() || "",
      city: document.getElementById("reg-city")?.value?.trim() || "",
      regionState: document.getElementById("reg-state")?.value?.trim() || "",
      zip: document.getElementById("reg-zip")?.value?.trim() || "",
      country: document.getElementById("reg-country")?.value || "243",
      firstName: document.getElementById("reg-firstname")?.value?.trim() || "",
      lastName: document.getElementById("reg-lastname")?.value?.trim() || "",
      email: document.getElementById("reg-email")?.value?.trim() || "",
      contactPhone: document.getElementById("reg-contact-phone")?.value?.trim() || "",
      studentInstitution: studentInstitutionVal,
      studentIdRef: studentIdRefVal
    };

    if (!formData.company || !formData.address || !formData.city || !formData.zip || !formData.firstName || !formData.lastName || !formData.email) {
      toast.error("Please fill in all required company and contact fields.");
      return;
    }

    const payload = buildPerfexPayload({ state, quote, formData });

    setButtonLoading(true);

    try {
      await submitPerfexBetaQuote(payload);
      showSuccessScreen(`${formData.firstName} ${formData.lastName}`, formData.email, summary);
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
  const editHours = document.getElementById("edit-hours");
  if (editHours) delete editHours.dataset.userModified;
  const regCountry = document.getElementById("reg-country");
  if (regCountry) delete regCountry.dataset.userModified;
  if (elements.dynamicVariablesContainer) {
    elements.dynamicVariablesContainer.innerHTML = "";
    elements.dynamicVariablesContainer.dataset.subcategory = "";
  }
  store.reset();

  if (elements.successContainer) elements.successContainer.style.display = "none";
  if (elements.pathwayEstimateForm) elements.pathwayEstimateForm.style.display = "none";
  if (elements.pathwayEnquiryForm) elements.pathwayEnquiryForm.style.display = "none";
  if (elements.finalActionsContainer) elements.finalActionsContainer.style.display = "none";

  syncStepUI(1);
  toast.info("Wizard reset for new quote calculation.");
}
