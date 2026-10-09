/**
 * @file calculator.js
 * @description Pure rate calculation engine, multi-currency conversion, and quote breakdown builders.
 */

import { RATES, ILR_STATIONS, MARKET_MULTIPLIERS, CURRENCY_SYMBOLS } from "./config.js";

/**
 * Determine ILR spot rate from station reach tier.
 * @param {number} reach - RAJAR listener reach
 * @returns {number} Spot rate in GBP
 */
export function ilrRateFromReach(reach) {
  if (reach <= 50000)   return 24;
  if (reach <= 100000)  return 36;
  if (reach <= 200000)  return 48;
  if (reach <= 300000)  return 60;
  if (reach <= 500000)  return 72;
  if (reach <= 1000000) return 96;
  if (reach <= 2000000) return 140;  // Heart London, Capital London
  if (reach <= 3000000) return 180;  // Absolute Radio, TalkSport
  return 240;                         // 3M+ (Classic FM)
}

/**
 * Convert a GBP amount to active currency with market multiplier and FX rate.
 * @param {number} gbpAmount
 * @param {string} currency - 'GBP' | 'USD' | 'EUR'
 * @param {object} exchangeRates - e.g. { GBP: 1, USD: 1.27, EUR: 1.17 }
 * @returns {number} Converted amount
 */
export function convertAmount(gbpAmount, currency = "GBP", exchangeRates = { GBP: 1, USD: 1.27, EUR: 1.17 }) {
  const multiplier = MARKET_MULTIPLIERS[currency] ?? 1.0;
  const fxRate = exchangeRates[currency] ?? 1.0;
  return gbpAmount * multiplier * fxRate;
}

/**
 * Format a GBP amount in the target currency with appropriate symbol.
 * @param {number} gbpAmount
 * @param {string} currency
 * @param {object} exchangeRates
 * @returns {string} e.g. "£250.00", "$625.00"
 */
export function formatCurrency(gbpAmount, currency = "GBP", exchangeRates = { GBP: 1, USD: 1.27, EUR: 1.17 }) {
  const symbol = CURRENCY_SYMBOLS[currency] || "£";
  const converted = convertAmount(gbpAmount, currency, exchangeRates);
  return `${symbol}${converted.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculates base voiceover session and buyout cost for a single item.
 * @param {object} params
 * @param {string} params.subcategory
 * @param {string} params.pricingStandard - 'agency' | 'equity'
 * @param {object} params.inputs - Step 3 parameters
 * @param {string[]} params.selectedStations - Selected ILR station names
 * @returns {{ total: number, lines: Array<{ name: string, price: number }> }}
 */
export function calculateSingleItemQuote({
  subcategory,
  pricingStandard = "agency",
  inputs = {},
  selectedStations = []
}) {
  if (!subcategory || !RATES[subcategory]) {
    return { total: 0, lines: [] };
  }

  const standardRates = RATES[subcategory][pricingStandard] || RATES[subcategory].agency;
  let baseCost = 0;
  const lines = [];

  switch (subcategory) {
    case "tv_commercial": {
      const bsf = parseFloat(inputs.bsf) || standardRates.bsf;
      const reach = parseFloat(inputs.reach) || 1.0;
      const duration = parseFloat(inputs.duration) || 1.0;

      const reachCost = bsf * reach;
      const renewalMultiplier = duration;
      const renewalFee = duration > 1.0 ? reachCost * (renewalMultiplier - 1.0) * 0.35 : 0;
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
      break;
    }

    case "radio_generic":
    case "cinema": {
      const bsf = parseFloat(inputs.bsf) || standardRates.bsf;
      const reach = parseFloat(inputs.reach) || 1.0;
      const spots = parseInt(inputs.spots, 10) || 1;

      const firstSpotCost = bsf * reach;
      const extraSpotsCost = (bsf * reach * 0.5) * Math.max(0, spots - 1);
      baseCost = firstSpotCost + extraSpotsCost;

      const reachLabel = reach === 1.0 ? "Local" : reach === 2.5 ? "Regional" : "National";
      const title = subcategory === "cinema" ? "Cinema" : "Radio Generic";
      lines.push({
        name: `${title} BSF: £${bsf.toFixed(2)}\nReach: ${reachLabel} (×${reach})\nSpots: ${spots} (1st spot full, additional 50% off)`,
        price: baseCost
      });
      break;
    }

    case "radio_ilr": {
      const bsf = parseFloat(inputs.bsf) || standardRates.bsf;
      const spots = parseInt(inputs.spots, 10) || 1;

      if (!selectedStations || selectedStations.length === 0) {
        baseCost = bsf;
        lines.push({
          name: `Radio Specific ILR (Base BSF, no stations selected yet)`,
          price: baseCost
        });
      } else {
        let stationSubtotal = 0;
        const stationDetails = [];

        selectedStations.forEach(name => {
          const station = ILR_STATIONS.find(s => s.name === name);
          if (station) {
            const reachRate = ilrRateFromReach(station.reach);
            const stationCost = reachRate * spots;
            stationSubtotal += stationCost;
            stationDetails.push(`- ${name} (${station.reach.toLocaleString()} reach): £${reachRate} × ${spots} spot(s) = £${stationCost.toFixed(2)}`);
          }
        });

        const duration = parseFloat(inputs.duration) || 1.0;
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
      const bsf = parseFloat(inputs.bsf) || standardRates.bsf;
      const promoUsage = parseFloat(inputs.promo_usage) || 1.0;
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
      const hours = parseFloat(inputs.hours) || 1.0;
      const hourlyRate = parseFloat(inputs.hourly_rate) || standardRates.ratePerHour;
      baseCost = hours * hourlyRate;

      const label = subcategory === "adr_dubbing" ? "ADR / Dubbing" : "Voice of God";
      lines.push({
        name: `${label} Session:\n${hours} hr(s) @ £${hourlyRate}/hr`,
        price: baseCost
      });
      break;
    }

    case "corporate_video":
    case "medical_narration":
    case "museum_exhibition": {
      const words = parseInt(inputs.words, 10) || 500;
      const ratePerWord = standardRates.perWord;

      let calculatedBase = words * ratePerWord;
      if (calculatedBase < 150) calculatedBase = 150; // £150 narration minimum floor

      let multiplier = 1.0;
      let mulText = "";

      if (subcategory === "corporate_video") {
        multiplier = parseFloat(inputs.corp_usage) || 1.0;
        if (multiplier > 1.0) {
          const corpUseLabel = multiplier === 2.0 ? "External (Web/Social)" : "Paid Promotion";
          mulText = `\nBuyout: ${corpUseLabel} (×${multiplier})`;
        }
      }

      baseCost = calculatedBase * multiplier;
      const labelMap = {
        corporate_video: "Corporate Video",
        medical_narration: "Medical Narration",
        museum_exhibition: "Museum & Exhibition"
      };
      lines.push({
        name: `${labelMap[subcategory]}:\n${words} words @ £${ratePerWord.toFixed(2)}/word (Min £150)${mulText}`,
        price: baseCost
      });
      break;
    }

    case "explainer_video": {
      const bsf = standardRates.bsf;
      const perWord = standardRates.perWord;
      const words = parseInt(inputs.words, 10) || 300;
      const usageMult = parseFloat(inputs.corp_usage) || 1.0;

      let wordsCost = bsf;
      if (words > 150) {
        wordsCost += (words - 150) * perWord;
      }
      baseCost = wordsCost * usageMult;

      const usageText = usageMult === 1.0 ? "Internal Use" : usageMult === 1.5 ? "External Web" : "Paid Digital Ads";
      lines.push({
        name: `Explainer Video:\n${words} words (Base 150w flat £${bsf.toFixed(2)} + £${perWord}/word after)\nUsage: ${usageText} (×${usageMult})`,
        price: baseCost
      });
      break;
    }

    case "elearning": {
      const words = parseInt(inputs.words, 10) || 1000;
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
      const band = inputs.elt_band || "A";
      const session = inputs.elt_session || "half";
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
      const scale = parseFloat(inputs.corp_usage) || 1.0;
      baseCost = flatRate * scale;

      lines.push({
        name: `Public Service Announcement:\nBase BSF £${flatRate.toFixed(2)} × Scale (${scale === 1.0 ? 'Local' : 'National'} - ×${scale})`,
        price: baseCost
      });
      break;
    }

    case "video_games": {
      const hours = parseFloat(inputs.hours) || 3;
      const bsfPerHour = standardRates.ratePerHour;
      const tierMult = parseFloat(inputs.game_tier) || 1.0;

      baseCost = (hours * bsfPerHour) * tierMult;
      const tierName = tierMult === 1.0 ? "Indie / Crowdfunded" : "AAA Franchise";

      lines.push({
        name: `Video Game Session:\n${hours} hr(s) @ £${bsfPerHour}/hr\nStudio Scale: ${tierName} (×${tierMult})`,
        price: baseCost
      });
      break;
    }

    case "audiobooks": {
      const finishedHours = parseFloat(inputs.hours) || 6;
      const ratePerFH = standardRates.ratePerFH;
      baseCost = finishedHours * ratePerFH;

      lines.push({
        name: `Audiobook Narration:\n${finishedHours} Finished Hour(s) (PFH) @ £${ratePerFH}/FH`,
        price: baseCost
      });
      break;
    }

    case "ivr_basic": {
      const minFee = standardRates.min;
      const perWord = standardRates.perWord;
      const words = parseInt(inputs.words, 10) || 100;
      const ivrMembership = inputs.ivr_membership || 'none';

      const memberDiscount = (ivrMembership === 'ama' || ivrMembership === 'ema') ? 0.80 : 1.0;
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
      const prompts = parseInt(inputs.prompts, 10) || 10;
      const languages = parseInt(inputs.langs, 10) || 1;
      const ratePerPrompt = standardRates.ratePerPrompt;
      const ivrMembership = inputs.ivr_membership || 'none';
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
      const bsf = parseFloat(inputs.bsf) || standardRates.bsf;
      const duration = parseFloat(inputs.duration) || 1.5;
      baseCost = bsf * duration;

      const weeksText = duration === 1.5 ? "13 Weeks (1.5x BSF)" : duration === 2.5 ? "26 Weeks (2.5x BSF)" : "52 Weeks (4.5x BSF)";
      const adTitle = subcategory === "digital_ads" ? "Digital Placement" : "Podcast Commercial";
      lines.push({
        name: `${adTitle} BSF: £${bsf.toFixed(2)}\nUsage: ${weeksText}`,
        price: baseCost
      });
      break;
    }

    case "social_organic": {
      const minutes = parseFloat(inputs.hours) || 2;
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
      const hours = parseFloat(inputs.hours) || 5;
      const ratePerHour = standardRates.ratePerHour;
      const buyout = parseFloat(inputs.game_tier) || 1.0;
      baseCost = (hours * ratePerHour) * buyout;

      lines.push({
        name: `AI Dataset Recording:\n${hours} hrs @ £${ratePerHour}/hr\nLicensing: ${buyout === 1.0 ? 'Research/Testing' : 'Commercial Voice Model'} (×${buyout})`,
        price: baseCost
      });
      break;
    }

    case "text_to_speech": {
      const bsf = standardRates.bsf;
      const words = parseInt(inputs.words, 10) || 2500;
      const duration = parseFloat(inputs.duration) || 3.0;

      const wordVolumeSurcharge = (words / 1000) * 100;
      baseCost = (bsf + wordVolumeSurcharge) * duration;

      const scopeLabel = duration === 3.0 ? "1 Year (3.0x)" : duration === 8.0 ? "3 Years (8.0x)" : "Perpetuity (15.0x)";
      lines.push({
        name: `Synthetic TTS Voice Model:\nBase session: £${bsf.toFixed(2)} + ${words}w volume surcharge\nLicensing: ${scopeLabel}`,
        price: baseCost
      });
      break;
    }

    case "transport_pa": {
      const prompts = parseInt(inputs.prompts, 10) || 10;
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
    lines
  };
}

/**
 * Calculates the complete quote encompassing cart items, active items, extras, and rush fees.
 * @param {object} appState - Full application state snapshot
 * @param {object} extrasForm - Values from extra add-on form controls
 * @returns {{ total: number, subtotal: number, extrasCost: number, lines: Array }}
 */
export function calculateFullQuote(appState, extrasForm = {}) {
  let finalTotal = 0;
  const allLines = [];

  // 1. Calculate Cart Items
  if (Array.isArray(appState.cart)) {
    appState.cart.forEach((item, index) => {
      const res = calculateSingleItemQuote({
        subcategory: item.subcategory,
        pricingStandard: appState.pricingStandard,
        inputs: item.inputs || {},
        selectedStations: item.stations || []
      });

      res.lines.forEach(line => {
        allLines.push({
          ...line,
          name: `[Item ${index + 1}] ` + line.name,
          isCartItem: true,
          cartIndex: index
        });
      });
      finalTotal += res.total;
    });
  }

  // 2. Calculate Active Selected Item (if not already added to cart)
  if (appState.selectedSubcategory && !appState.isCurrentItemInCart) {
    const activeRes = calculateSingleItemQuote({
      subcategory: appState.selectedSubcategory,
      pricingStandard: appState.pricingStandard,
      inputs: appState.inputs || {},
      selectedStations: appState.selectedStations || []
    });

    activeRes.lines.forEach(line => {
      allLines.push(line);
    });
    finalTotal += activeRes.total;
  }

  // 3. Extras & Add-ons Calculation
  let extrasCost = 0;

  if (extrasForm.editing?.enabled) {
    const hrs = parseFloat(extrasForm.editing.hours) || 1;
    const rate = parseFloat(extrasForm.editing.rate) || 50;
    const cost = hrs * rate;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Audio Editing & Cleanup\n${hrs} hr(s) @ £${rate}/hr`,
      price: cost
    });
  }

  if (extrasForm.remote?.enabled) {
    const cost = parseFloat(extrasForm.remote.system) || 100;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Directed Remote Session\n${cost === 100 ? 'SourceConnect Connection' : 'CleanFeed/Zoom Connection'}`,
      price: cost
    });
  }

  if (extrasForm.studio?.enabled) {
    const hrs = parseFloat(extrasForm.studio.hours) || 2;
    const rate = parseFloat(extrasForm.studio.rate) || 120;
    const cost = hrs * rate;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Third-Party Studio Hire\n${hrs} hr(s) @ £${rate}/hr`,
      price: cost
    });
  }

  if (extrasForm.revisions?.enabled) {
    const rounds = parseInt(extrasForm.revisions.rounds, 10) || 1;
    const cost = rounds * 45;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Additional Revision Rounds\n${rounds} extra round(s) @ £45/round`,
      price: cost
    });
  }

  if (extrasForm.scriptPrep?.enabled) {
    const cost = parseFloat(extrasForm.scriptPrep.type) || 50;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Script Preparation & Read-Through\n${cost === 50 ? 'Standard Long-Form' : 'Highly Technical/Medical'}`,
      price: cost
    });
  }

  const subtotal = finalTotal + extrasCost;
  let superTotal = subtotal;

  // Rush Delivery Fee (20%)
  if (extrasForm.urgent?.enabled) {
    const rushFee = subtotal * 0.20;
    superTotal += rushFee;
    allLines.push({
      name: `Surcharge: 24-Hour Urgent Delivery (20% of subtotal)`,
      price: rushFee
    });
  }

  return {
    total: superTotal,
    subtotal,
    extrasCost,
    lines: allLines
  };
}
