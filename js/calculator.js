/**
 * @file calculator.js
 * @description Pure rate calculation engine, multi-currency conversion, and quote breakdown builders.
 */

import { RATES, ILR_STATIONS, MARKET_MULTIPLIERS, CURRENCY_SYMBOLS, DIGITAL_IMPRESSIONS_TIERS, TVR_TIERS, PACING_MODES } from "./config.js?v=2.1.3";

/**
 * Parse a user-entered amount. Non-numbers, zero, and negatives fall back,
 * matching the previous `|| fallback` defaults while rejecting credits.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(value, fallback) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Parse a user-entered count. Non-integers, zero, and negatives fall back.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function readCount(value, fallback) {
  const n = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Round a sterling amount to the nearest penny.
 * @param {number} amount
 * @returns {number}
 */
function roundMoney(amount) {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Determine ILR spot rate from station reach tier.
 * @param {number} reach - RAJAR listener reach
 * @returns {number} Spot rate in GBP
 */
export function ilrRateFromReach(reach) {
  if (reach <= 250000)   return 31;   // Band 1 (0 to 250,000)
  if (reach <= 500000)   return 44;   // Band 2 (250,001 to 500,000)
  if (reach <= 750000)   return 56;   // Band 3 (500,001 to 750,000)
  if (reach <= 1000000)  return 78;   // Band 4 (750,001 to 1,000,000)
  if (reach <= 2500000)  return 109;  // Band 5 (1,000,001 to 2,500,000)
  if (reach <= 3500000)  return 234;  // Band 6 (2,500,001 to 3,500,000)
  if (reach <= 5000000)  return 349;  // Band 7 (3,500,001 to 5,000,000)
  return 890;                         // Band 8 (5,000,001+)
}

/**
 * Convert a GBP amount to active currency with market multiplier and FX rate.
 * @param {number} gbpAmount
 * @param {string} currency - 'GBP' | 'USD' | 'EUR'
 * @param {object} exchangeRates - e.g. { GBP: 1, USD: 1.27, EUR: 1.17 }
 * @param {boolean} waiveIntlMultiplier - If true, converts using 1.0x direct FX (for student/indie/non-broadcast)
 * @returns {number} Converted amount
 */
export function convertAmount(gbpAmount, currency = "GBP", exchangeRates = { GBP: 1, USD: 1.27, EUR: 1.17 }, waiveIntlMultiplier = false) {
  const multiplier = waiveIntlMultiplier ? 1.0 : (MARKET_MULTIPLIERS[currency] ?? 1.0);
  const fxRate = exchangeRates[currency] ?? 1.0;
  return gbpAmount * multiplier * fxRate;
}

/**
 * Format a GBP amount in the target currency with appropriate symbol.
 * @param {number} gbpAmount
 * @param {string} currency
 * @param {object} exchangeRates
 * @param {boolean} waiveIntlMultiplier
 * @returns {string} e.g. "£250.00", "$625.00"
 */
export function formatCurrency(gbpAmount, currency = "GBP", exchangeRates = { GBP: 1, USD: 1.27, EUR: 1.17 }, waiveIntlMultiplier = false) {
  const symbol = CURRENCY_SYMBOLS[currency] || "£";
  const converted = convertAmount(gbpAmount, currency, exchangeRates, waiveIntlMultiplier);
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
      const bsf = readNumber(inputs.bsf, standardRates.bsf);
      const tvrTierKey = inputs.tvr_tier;

      if (tvrTierKey && tvrTierKey !== "standard" && TVR_TIERS[tvrTierKey]) {
        const tvrItem = TVR_TIERS[tvrTierKey];
        const tvrFee = tvrItem.fee;
        baseCost = bsf + tvrFee;
        lines.push({
          name: `TV Commercial Session Fee (BSF): £${bsf.toFixed(2)}`,
          price: bsf
        });
        lines.push({
          name: `Equity TVR Schedule: ${tvrItem.name}`,
          price: tvrFee
        });
      } else {
        const reach = readNumber(inputs.reach, 1);
        const duration = readNumber(inputs.duration, 1);

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
      }
      break;
    }

    case "radio_generic":
    case "cinema": {
      const bsf = readNumber(inputs.bsf, standardRates.bsf);
      const reach = readNumber(inputs.reach, 1);
      const spots = readCount(inputs.spots, 1);

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
      const bsf = readNumber(inputs.bsf, standardRates.bsf);
      const spots = readCount(inputs.spots, 1);

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

        const duration = readNumber(inputs.duration, 1);
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
      const bsf = readNumber(inputs.bsf, standardRates.bsf);
      const promoUsage = readNumber(inputs.promo_usage, 1);
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
      const hours = readNumber(inputs.hours, 1);
      const hourlyRate = readNumber(inputs.hourly_rate, standardRates.ratePerHour);
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
      const words = readCount(inputs.words, 500);
      const ratePerWord = standardRates.perWord;

      let calculatedBase = words * ratePerWord;
      if (calculatedBase < 150) calculatedBase = 150; // £150 narration minimum floor

      let multiplier = 1.0;
      let mulText = "";

      if (subcategory === "corporate_video") {
        multiplier = readNumber(inputs.corp_usage, 1);
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
      const words = readCount(inputs.words, 300);
      const usageMult = readNumber(inputs.corp_usage, 1);

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
      const words = readCount(inputs.words, 1000);
      const tier1 = readNumber(standardRates.tier1, pricingStandard === "equity" ? 0.30 : 0.60);
      const tier2 = readNumber(standardRates.tier2, pricingStandard === "equity" ? 0.20 : 0.30);
      const tier3 = readNumber(standardRates.tier3, pricingStandard === "equity" ? 0.15 : 0.20);
      let wordRate = tier1;
      if (words > 2000) wordRate = tier3;
      else if (words >= 1000) wordRate = tier2;

      const minFloor = readNumber(standardRates.minFloor, pricingStandard === "equity" ? 120 : 150);
      baseCost = Math.max(minFloor, words * wordRate);
      const rateScaleText = `(0–999w: £${tier1.toFixed(2)} | 1000–2000w: £${tier2.toFixed(2)} | 2001w+: £${tier3.toFixed(2)} | Min £${minFloor})`;

      lines.push({
        name: `E-Learning Course:\n${words} words @ £${wordRate.toFixed(2)}/word\n${rateScaleText}`,
        price: baseCost
      });
      break;
    }

    case "documentary_narration": {
      const words = readCount(inputs.words, 1500);
      const ratePerWord = readNumber(standardRates.perWord, pricingStandard === "equity" ? 0.18 : 0.25);
      const usageMult = readNumber(inputs.doc_usage, 1);
      const isStudent = usageMult < 1.0;
      const minFloor = isStudent
        ? (standardRates.studentMinFloor || 110)
        : (standardRates.minFloor || 200);

      const rawCost = words * ratePerWord * usageMult;
      baseCost = Math.max(minFloor, Math.round(rawCost * 100) / 100);

      let tierLabel = "Indie / Festival / Educational (1.0x)";
      if (usageMult < 1.0) tierLabel = `Student / Academic Film (${Math.round((1 - usageMult) * 100)}% Concession — Student ID Required)`;
      else if (usageMult === 1.5) tierLabel = "Online / Monetized Web / Regional TV (1.5x)";
      else if (usageMult === 2.5) tierLabel = "National Network TV / Major SVOD (2.5x)";
      else if (usageMult >= 3.5) tierLabel = "Global Theatrical / All-Media Buyout (3.5x)";

      lines.push({
        name: `Documentary Narration:\n${words} words @ £${ratePerWord.toFixed(2)}/word (Min £${minFloor})\nDistribution: ${tierLabel}`,
        price: baseCost
      });
      break;
    }

    case "audio_drama_fiction": {
      const words = readCount(inputs.words, 1800);
      const ratePerWord = readNumber(standardRates.perWord, pricingStandard === "equity" ? 0.12 : 0.16);
      const tierMult = readNumber(inputs.drama_tier, 0.55);
      const pacingKey = inputs.drama_pacing || "dramatic";
      const pacingObj = PACING_MODES[pacingKey] || PACING_MODES.dramatic;
      const pacingFactor = pacingObj.timeFactor || 1.0;

      const isStudent = tierMult < 1.0;
      const minFloor = isStudent
        ? (standardRates.studentMinFloor || 100)
        : (tierMult > 1.0 ? 298 : (standardRates.minFloor || 150));

      const rawCost = words * ratePerWord * pacingFactor * tierMult;
      baseCost = Math.max(minFloor, Math.round(rawCost * 100) / 100);

      const estMins = Math.max(1, Math.round(words / pacingObj.wpm));
      let tierLabel = "Indie / Film Festival / Crowdfunded (1.0x)";
      if (tierMult < 1.0) tierLabel = `Student / Academic Project (${Math.round((1 - tierMult) * 100)}% Indie Concession — Student ID Required)`;
      else if (tierMult > 1.0) tierLabel = `Commercial Network / Audible / Spotify Buyout (×${tierMult})`;

      const pacingDesc = pacingKey === "dramatic"
        ? "Dramatic Acting + Pauses (~115 wpm, +20% booth time)"
        : pacingKey === "deliberate"
          ? "Deliberate / Paced (~130 wpm, +10% booth time)"
          : "Standard Narrative Read (~150 wpm)";

      lines.push({
        name: `Audio Drama, Short Film & Fiction:\n${words} words (~${estMins} min finished audio)\nStyle: ${pacingDesc}\nTier: ${tierLabel} (Min Studio Floor £${minFloor})`,
        price: baseCost
      });
      break;
    }

    case "animation_character": {
      const hours = readNumber(inputs.hours, 1);
      const hourlyRate = readNumber(inputs.hourly_rate, standardRates.ratePerHour || (pricingStandard === "equity" ? 220 : 300));
      const tierMult = readNumber(inputs.anim_tier, 1);
      const isStudent = tierMult < 1.0;
      const minFloor = isStudent ? (standardRates.studentMinFloor || 110) : hourlyRate;

      const rawCost = hours * hourlyRate * tierMult;
      baseCost = Math.max(minFloor, Math.round(rawCost * 100) / 100);

      let tierLabel = "Indie Web Series / Pilot / Festival Short (1.0x)";
      if (tierMult < 1.0) tierLabel = `Student Animation / Non-Monetized Short (${Math.round((1 - tierMult) * 100)}% Indie Concession — Student ID Required)`;
      else if (tierMult === 1.75) tierLabel = "Commercial Brand / Monetized Series (1.75x Buyout)";
      else if (tierMult >= 2.5) tierLabel = "Broadcast TV / Major SVOD Series (2.5x Buyout)";

      lines.push({
        name: `Animation & Character Voice:\n${hours} hr(s) @ £${hourlyRate}/hr (Min £${minFloor})\nScale: ${tierLabel}`,
        price: baseCost
      });
      break;
    }

    case "elt_educational": {
      const band = inputs.elt_band || "A";
      const format = inputs.elt_format || "solo";
      const session = inputs.elt_session || "half";
      const key = `${band}_${session}_${format}`;
      baseCost = standardRates[key] || standardRates[`${band}_${session}`] || 0;

      const formatLabel = format === "group" ? "Group/Ensemble" : "Solo Performer";
      const sessionLabel = session === "half" ? "Half Day (≤3 hrs)" : "Full Day (≤6 hrs)";

      lines.push({
        name: `ELT Session:\nBand ${band} (${formatLabel}, ${sessionLabel})`,
        price: baseCost
      });
      break;
    }

    case "psa": {
      const flatRate = standardRates.flat;
      const scale = readNumber(inputs.corp_usage, 1);
      baseCost = flatRate * scale;

      lines.push({
        name: `Public Service Announcement:\nBase BSF £${flatRate.toFixed(2)} × Scale (${scale === 1.0 ? 'Local' : 'National'} - ×${scale})`,
        price: baseCost
      });
      break;
    }

    case "video_games": {
      const hours = readNumber(inputs.hours, 3);
      const capture = inputs.game_capture || "standard";
      const isHeadcam = capture === "headcam";
      const bsfPerHour = isHeadcam
        ? (standardRates.ratePerHourHeadcam || standardRates.ratePerHour + 50)
        : standardRates.ratePerHour;
      const tierMult = readNumber(inputs.game_tier, 1.8);
      const isAAA = tierMult > 1.0;

      const sessionCost = hours * bsfPerHour;
      let buyoutCost = 0;

      if (isAAA) {
        // Equity AAA Game buyout: 200% of BSF for up to 4 hrs + 25% BSF per hr beyond 4 hrs
        const initialBuyout = bsfPerHour * 2.0; // £600 on £300 BSF
        const extraBuyout = hours > 4 ? (hours - 4) * (bsfPerHour * 0.25) : 0;
        buyoutCost = initialBuyout + extraBuyout;
      }

      baseCost = sessionCost + buyoutCost;
      const tierName = isAAA ? "AAA Major Franchise (Includes Equity Usage Buyout)" : "Indie / Non-Broadcast Studio (No Buyout)";
      const captureName = isHeadcam ? "Voiceover + Headcam / Facial Capture" : "Standard Voiceover";

      lines.push({
        name: `Video Game Session (${captureName}):\n${hours} hr(s) @ £${bsfPerHour}/hr\nTier: ${tierName}${isAAA ? ` (+£${buyoutCost.toFixed(2)} Buyout)` : ""}`,
        price: baseCost
      });
      break;
    }

    case "audiobooks": {
      const finishedHours = readNumber(inputs.hours, 6);
      const ratePerFH = readNumber(inputs.hourly_rate, standardRates.ratePerFH);
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
      const words = readCount(inputs.words, 100);
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
      const prompts = readCount(inputs.prompts, 15);
      const languages = readCount(inputs.langs, 1);
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
      // The step 3 form defaults to impression tiers. Duration buyouts are opt-in.
      if (subcategory === "digital_ads" && inputs.digital_model !== "duration") {
        const tierKey = inputs.impression_tier || "1.5m";
        const tier = DIGITAL_IMPRESSIONS_TIERS[tierKey] || DIGITAL_IMPRESSIONS_TIERS["1.5m"];
        const tierCost = tier[pricingStandard] || tier.equity || 450;
        baseCost = tierCost;

        lines.push({
          name: `Digital Online & VOD (${tier.name}): £${tierCost.toFixed(2)}`,
          price: baseCost
        });
      } else {
        const bsf = readNumber(inputs.bsf, standardRates.bsf);
        const duration = readNumber(inputs.duration, 1.5);
        baseCost = bsf * duration;

        const weeksText = duration === 1.5 ? "13 Weeks (1.5x BSF)" : duration === 2.5 ? "26 Weeks (2.5x BSF)" : "52 Weeks (4.5x BSF)";
        const adTitle = subcategory === "digital_ads" ? "Digital Placement" : "Podcast Commercial";
        lines.push({
          name: `${adTitle} BSF: £${bsf.toFixed(2)}\nUsage: ${weeksText}`,
          price: baseCost
        });
      }
      break;
    }

    case "social_organic": {
      const minutes = readNumber(inputs.hours, 2);
      const ratePerMinute = standardRates.ratePerMinute;
      baseCost = Math.max(ratePerMinute, minutes * ratePerMinute);

      lines.push({
        name: `Organic Social Video:\n${minutes} min(s) @ £${ratePerMinute}/min (Min 1 min studio call)`,
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
      const hours = readNumber(inputs.hours, 5);
      const ratePerHour = standardRates.ratePerHour;
      const buyout = readNumber(inputs.game_tier, 1);
      baseCost = (hours * ratePerHour) * buyout;

      lines.push({
        name: `AI Dataset Recording:\n${hours} hrs @ £${ratePerHour}/hr\nLicensing: ${buyout === 1.0 ? 'Research/Testing' : 'Commercial Voice Model'} (×${buyout})`,
        price: baseCost
      });
      break;
    }

    case "text_to_speech": {
      const bsf = standardRates.bsf;
      const words = readCount(inputs.words, 2500);
      const duration = readNumber(inputs.duration, 3);

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
      const prompts = readCount(inputs.prompts, 10);
      const ratePerPrompt = standardRates.ratePerPrompt;
      baseCost = prompts * ratePerPrompt;

      lines.push({
        name: `Transport PA Announcements:\n${prompts} announcements @ £${ratePerPrompt}/each`,
        price: baseCost
      });
      break;
    }
  }

  const roundedLines = lines.map((line) => ({ ...line, price: roundMoney(line.price) }));
  return {
    total: roundMoney(roundedLines.reduce((sum, line) => sum + line.price, 0)),
    lines: roundedLines
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
    const hrs = readNumber(extrasForm.editing.hours, 1);
    const rate = readNumber(extrasForm.editing.rate, 50);
    const cost = hrs * rate;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Audio Editing & Cleanup\n${hrs} hr(s) @ £${rate}/hr`,
      price: cost
    });
  }

  if (extrasForm.remote?.enabled) {
    const cost = readNumber(extrasForm.remote.system, 100);
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Directed Remote Session\n${cost === 100 ? 'SourceConnect Connection' : 'CleanFeed/Zoom Connection'}`,
      price: cost
    });
  }

  if (extrasForm.studio?.enabled) {
    const hrs = readNumber(extrasForm.studio.hours, 2);
    const rate = readNumber(extrasForm.studio.rate, 120);
    const cost = hrs * rate;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Third-Party Studio Hire\n${hrs} hr(s) @ £${rate}/hr`,
      price: cost
    });
  }

  if (extrasForm.revisions?.enabled) {
    const rounds = readCount(extrasForm.revisions.rounds, 1);
    const cost = rounds * 45;
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Additional Revision Rounds\n${rounds} extra round(s) @ £45/round`,
      price: cost
    });
  }

  if (extrasForm.scriptPrep?.enabled) {
    const cost = readNumber(extrasForm.scriptPrep.type, 50);
    extrasCost += cost;
    allLines.push({
      name: `Add-on: Script Preparation & Read-Through\n${cost === 50 ? 'Standard Long-Form' : 'Highly Technical/Medical'}`,
      price: cost
    });
  }

  const subtotal = roundMoney(finalTotal + extrasCost);
  let superTotal = subtotal;

  // Rush Delivery Fee (20%)
  if (extrasForm.urgent?.enabled) {
    const rushFee = roundMoney(subtotal * 0.20);
    superTotal = roundMoney(superTotal + rushFee);
    allLines.push({
      name: `Surcharge: 24-Hour Urgent Delivery (20% of subtotal)`,
      price: rushFee
    });
  }

  return {
    total: roundMoney(superTotal),
    subtotal,
    extrasCost: roundMoney(extrasCost),
    lines: allLines.map((line) => ({ ...line, price: roundMoney(line.price) }))
  };
}

/**
 * Determines whether a single service item uses a Student Discount rate.
 * @param {string} subcategory
 * @param {object} inputs
 * @returns {boolean}
 */
export function isStudentDiscountItem(subcategory, inputs = {}) {
  if (!subcategory) return false;
  if (subcategory === "audio_drama_fiction") {
    return readNumber(inputs.drama_tier, 0.55) < 1;
  }
  if (subcategory === "documentary_narration") {
    return readNumber(inputs.doc_usage, 1) < 1;
  }
  if (subcategory === "animation_character") {
    return readNumber(inputs.anim_tier, 1) < 1;
  }
  return false;
}

/**
 * Default international-premium waiver for a service.
 * Indie and student tiers convert at 1.0x. Commercial categories do not
 * inherit a waiver chosen for a previous service.
 * @param {string} subcategory
 * @param {object} inputs
 * @returns {boolean}
 */
export function defaultWaiveIntlMultiplier(subcategory, inputs = {}) {
  if (subcategory === "audio_drama_fiction") return readNumber(inputs.drama_tier, 0.55) <= 1;
  if (subcategory === "documentary_narration") return readNumber(inputs.doc_usage, 1) <= 1;
  if (subcategory === "animation_character") return readNumber(inputs.anim_tier, 1) <= 1;
  if (subcategory === "video_games") return readNumber(inputs.game_tier, 1.8) <= 1;
  if (subcategory === "ai_dataset") return readNumber(inputs.game_tier, 1) <= 1;
  return false;
}

/**
 * Determines whether the current quote state (active item or any cart item) includes a Student Discount rate.
 * @param {object} appState
 * @returns {boolean}
 */
export function isStudentDiscountActive(appState = {}) {
  if (Array.isArray(appState.cart)) {
    for (const item of appState.cart) {
      if (isStudentDiscountItem(item.subcategory, item.inputs)) {
        return true;
      }
    }
  }
  if (appState.selectedSubcategory && !appState.isCurrentItemInCart) {
    return isStudentDiscountItem(appState.selectedSubcategory, appState.inputs);
  }
  return false;
}
