/**
 * @file api.js
 * @description Resilient API client for live currency conversion and Perfex CRM submissions.
 */

import { API_ENDPOINTS } from "./config.js?v=2.1.3";

const FX_CACHE_KEY = "ckm_quote_fx_rates_v2";
const FX_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Fetches live exchange rates with localStorage caching and 3-tier CORS-safe fallback resilience.
 * Never calls legacy api.frankfurter.app (which returns a 301 redirect without CORS headers).
 * @returns {Promise<{ rates: { GBP: number, USD: number, EUR: number }, cached: boolean, fallback?: boolean }>}
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let usdRate = null;
    let eurRate = null;

    // 1. Primary: Frankfurter v1 (.dev domain — direct 200 OK with Access-Control-Allow-Origin: *)
    try {
      const rawPrimary = API_ENDPOINTS.FRANKFURTER_FX || "";
      const primaryUrl = (!rawPrimary || rawPrimary.includes("frankfurter.app"))
        ? "https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR"
        : rawPrimary;
      const res = await fetch(primaryUrl, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.USD && data?.rates?.EUR) {
          usdRate = parseFloat(data.rates.USD);
          eurRate = parseFloat(data.rates.EUR);
        }
      }
    } catch (_) {
      // Primary failed; proceed to secondary
    }

    // 2. Secondary: Open Exchange Rates v6 (direct 200 OK with Access-Control-Allow-Origin: *)
    if (!usdRate || !eurRate) {
      try {
        const fallbackUrl = API_ENDPOINTS.FRANKFURTER_FX_FALLBACK || "https://open.er-api.com/v6/latest/GBP";
        const res = await fetch(fallbackUrl, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data?.rates?.USD && data?.rates?.EUR) {
            usdRate = parseFloat(data.rates.USD);
            eurRate = parseFloat(data.rates.EUR);
          }
        }
      } catch (_) {
        // Secondary failed; proceed to tertiary CDN
      }
    }

    // 3. Tertiary: jsDelivr Currency API CDN (edge-cached 200 OK with Access-Control-Allow-Origin: *)
    if (!usdRate || !eurRate) {
      try {
        const cdnUrl = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/gbp.json";
        const res = await fetch(cdnUrl, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data?.gbp?.usd && data?.gbp?.eur) {
            usdRate = parseFloat(data.gbp.usd);
            eurRate = parseFloat(data.gbp.eur);
          }
        }
      } catch (_) {
        // All 3 live endpoints unreachable
      }
    }

    clearTimeout(timeout);

    if (!usdRate || !eurRate) {
      throw new Error("All live exchange rate providers are unreachable.");
    }

    const rates = {
      GBP: 1,
      USD: usdRate || 1.33,
      EUR: eurRate || 1.20
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
    clearTimeout(timeout);
    console.warn("Live FX fetch failed, falling back to approximate rates:", err.message);
    return {
      rates: { GBP: 1, USD: 1.33, EUR: 1.20 },
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
