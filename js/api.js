/**
 * @file api.js
 * @description Resilient API client for live currency conversion and Perfex CRM submissions.
 */

import { API_ENDPOINTS } from "./config.js";

const FX_CACHE_KEY = "ckm_quote_fx_rates";
const FX_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Fetches live exchange rates with localStorage caching and fallback resilience.
 * @returns {Promise<{ rates: { GBP: number, USD: number, EUR: number }, cached: boolean }>}
 */
export async function getLiveExchangeRates() {
  // Check local cache
  try {
    const cached = localStorage.getItem(FX_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < FX_CACHE_TTL_MS && parsed.rates?.USD && parsed.rates?.EUR) {
        return { rates: parsed.rates, cached: true };
      }
    }
  } catch (err) {
    console.warn("Could not read FX cache from localStorage:", err);
  }

  // Fetch live
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(API_ENDPOINTS.FRANKFURTER_FX, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Frankfurter API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rates = {
      GBP: 1,
      USD: parseFloat(data.rates.USD) || 1.27,
      EUR: parseFloat(data.rates.EUR) || 1.17
    };

    // Store in cache
    try {
      localStorage.setItem(FX_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        rates
      }));
    } catch (err) {
      console.warn("Could not write FX cache to localStorage:", err);
    }

    return { rates, cached: false };
  } catch (err) {
    console.warn("Live FX fetch failed, falling back to approximate rates:", err.message);
    return {
      rates: { GBP: 1, USD: 1.27, EUR: 1.17 },
      cached: false,
      fallback: true
    };
  }
}

/**
 * Submits an official quote payload to Perfex CRM beta staging endpoint.
 * @param {object} payload - Standardized registration and estimate payload
 * @returns {Promise<object>} API JSON response
 */
export async function submitPerfexBetaQuote(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(API_ENDPOINTS.PERFEX_BETA_SUBMIT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      let errMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.message) errMsg = errJson.message;
      } catch (_) {}
      throw new Error(errMsg);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("The request timed out. Please check your network connection.");
    }
    throw err;
  }
}
