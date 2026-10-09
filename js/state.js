/**
 * @file state.js
 * @description Centralized reactive application state management for the quote wizard.
 */

class AppStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      currentStep: 1,
      selectedCategory: null,     // 'broadcast' | 'corporate' | 'specialty'
      selectedSubcategory: null,  // e.g. 'tv_commercial', 'explainer_video'
      selectedPathway: null,      // 'estimate' | 'enquiry'
      pricingStandard: 'agency',  // 'agency' | 'equity'
      theme: 'dark',
      ilrSearchQuery: '',
      selectedStations: [],       // Array of station names
      inputs: {},                 // Step 3 dynamic inputs cache
      currency: 'GBP',            // Active display currency
      exchangeRates: { GBP: 1, USD: 1.27, EUR: 1.17 },
      cart: [],                   // Array of previous quote items
      isCurrentItemInCart: false
    };
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changedKeys = []) {
    for (const listener of this.listeners) {
      try {
        listener(this.state, changedKeys);
      } catch (err) {
        console.error("State listener execution error:", err);
      }
    }
  }

  set(partialOrFn) {
    const next = typeof partialOrFn === "function" ? partialOrFn(this.state) : partialOrFn;
    const changed = Object.keys(next);
    Object.assign(this.state, next);
    this.notify(changed);
  }

  reset() {
    this.state.currentStep = 1;
    this.state.selectedCategory = null;
    this.state.selectedSubcategory = null;
    this.state.selectedPathway = null;
    this.state.selectedStations = [];
    this.state.inputs = {};
    this.state.isCurrentItemInCart = false;
    this.state.cart = [];
    this.notify(['reset']);
  }
}

export const store = new AppStore();
