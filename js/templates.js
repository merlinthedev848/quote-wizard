/**
 * @file templates.js
 * @description Dynamic template builders for Step 3 variable fields and station selection lists.
 */

import { RATES, ILR_STATIONS, PACING_MODES } from "./config.js?v=2.1.3";

/**
 * Escapes unsafe characters for HTML injection.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Renders quick word count preset buttons.
 * @param {number[]} presets
 * @returns {string}
 */
export function renderWordPresets(presets = [150, 300, 750, 1500, 3000]) {
  return `
    <div class="word-presets-row" role="group" aria-label="Word count quick presets">
      <span class="preset-label">Quick Presets:</span>
      ${presets.map(w => `<button type="button" class="btn-preset-pill" data-words="${w}">${w >= 1000 ? (w / 1000).toFixed(1).replace('.0', '') + 'k' : w}w (~${Math.ceil(w / 150)} min)</button>`).join("")}
    </div>
  `;
}

/**
 * Renders an interactive script paste, pacing selector, and minutes-to-words converter box.
 * @param {string} scriptText
 * @param {string} pacingWpm
 * @param {number|string} rawMinutes
 * @returns {string}
 */
export function renderScriptPasteBox(scriptText = "", pacingWpm = "150", rawMinutes = "") {
  const safeText = escapeHtml(scriptText);
  const wpmStr = String(pacingWpm || "150");
  return `
    <div class="script-analyzer-container glass-card-nested" style="margin-top: 14px; margin-bottom: 16px; padding: 14px; border: 1.5px solid var(--ink); border-radius: var(--radius); background: rgba(255, 250, 242, 0.85); box-shadow: 2px 2px 0 var(--ink);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; flex-wrap:wrap; gap:6px;">
        <label for="input-script-text" style="font-weight: 800; font-size: 0.82rem; color: var(--ink); text-transform: uppercase; letter-spacing: 0.04em; display:flex; align-items:center; gap:6px; margin:0;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px; height:15px; color:var(--orange);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Paste Script or Convert Minutes to Words
        </label>
        <button type="button" id="btn-clear-script" style="${safeText ? '' : 'display:none;'} background:none; border:none; color:var(--coral); font-size:0.75rem; font-weight:800; cursor:pointer; text-decoration:underline;">Clear Script</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
        <div>
          <label for="input-raw-minutes" style="font-size:0.74rem; font-weight:700; color:var(--muted); display:block; margin-bottom:4px;">Know length in minutes? (Auto-fills words)</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="number" id="input-raw-minutes" min="0.5" max="180" step="0.5" value="${escapeHtml(String(rawMinutes || ''))}" placeholder="e.g. 15" style="width:90px; padding:7px 10px; border:1.5px solid var(--line); border-radius:6px; font-size:0.84rem; font-weight:700; background:var(--white); color:var(--ink);"/>
            <span style="font-size:0.76rem; font-weight:700; color:var(--ink);">mins raw read</span>
          </div>
        </div>
        <div>
          <label for="input-script-wpm" style="font-size:0.74rem; font-weight:700; color:var(--muted); display:block; margin-bottom:4px;">Delivery Pace &amp; Acting Style</label>
          <select id="input-script-wpm" style="width:100%; padding:7px 10px; border:1.5px solid var(--line); border-radius:6px; font-size:0.8rem; font-weight:700; background:var(--white); color:var(--ink);">
            <option value="150" ${wpmStr === "150" ? "selected" : ""}>Standard Narration (150 wpm)</option>
            <option value="115" ${wpmStr === "115" ? "selected" : ""}>Dramatic / Acted + Pauses (115 wpm)</option>
            <option value="130" ${wpmStr === "130" ? "selected" : ""}>Deliberate / Documentary (130 wpm)</option>
            <option value="170" ${wpmStr === "170" ? "selected" : ""}>Fast / Promo Read (170 wpm)</option>
          </select>
        </div>
      </div>

      <textarea id="input-script-text" placeholder="Or paste your voiceover script here to auto-calculate exact words, characters, and acted runtime..." rows="3" style="width:100%; padding:10px; border:1.5px solid var(--line); border-radius:6px; font-family:inherit; font-size:0.85rem; resize:vertical; background:var(--white); color:var(--ink); box-sizing:border-box;">${safeText}</textarea>
      
      <div class="script-stats-row" id="script-stats-row" style="display:flex; flex-wrap:wrap; gap:12px; margin-top:8px; font-size:0.78rem; font-weight:700; color:var(--muted);">
        <span class="stat-pill"><strong id="stat-words" style="color:var(--ink);">0</strong> words</span>
        <span class="stat-pill"><strong id="stat-chars" style="color:var(--ink);">0</strong> chars</span>
        <span class="stat-pill"><strong id="stat-duration" style="color:var(--coral);">~0m 0s</strong> est. read-time (${wpmStr} wpm)</span>
        <span class="stat-pill" id="stat-scope" style="background:rgba(183,245,90,0.3); color:var(--ink); padding:1px 7px; border-radius:4px; border:1px solid rgba(17,19,22,0.18);">Studio Scope: ~0.5 hr session</span>
      </div>
    </div>
  `;
}

/**
 * Renders the Step 3 Student Identification & Eligibility verification variables card.
 * Shown dynamically whenever a Student Discount tier (< 1.0x) is selected.
 * @param {boolean} isVisible
 * @param {object} inputs
 * @returns {string}
 */
export function renderStudentVerificationBox(isVisible = true, inputs = {}) {
  const inst = escapeHtml(String(inputs.student_institution || ""));
  const idRef = escapeHtml(String(inputs.student_id_ref || ""));
  const course = escapeHtml(String(inputs.student_course || ""));
  const confirmed = Boolean(inputs.student_confirm);

  return `
    <div id="step3-student-id-box" class="glass-card-nested" style="display: ${isVisible ? "block" : "none"}; margin-top: 14px; margin-bottom: 16px; padding: 14px; border: 2px solid var(--ink); border-radius: var(--radius); background: rgba(255, 179, 44, 0.16); box-shadow: 2px 2px 0 var(--ink);">
      <div style="font-weight: 800; font-size: 0.82rem; color: var(--ink); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px; color: var(--orange);"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
        🎓 Student Discount Verification Variables (Required for Student Rate)
      </div>
      <p style="font-size: 0.76rem; color: var(--muted); margin: 0 0 12px 0; line-height: 1.4;">
        Student identification is required in order to order a student-discount rated project. Please enter your academic institution and Student ID / university email below.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 10px;">
        <div>
          <label for="step3-student-institution" style="font-size: 0.75rem; font-weight: 800; color: var(--ink); display: block; margin-bottom: 4px;">University / College / School Name *</label>
          <input type="text" id="step3-student-institution" value="${inst}" placeholder="e.g. University of Bologna / NFTS" style="width: 100%; padding: 8px 10px; border: 1.5px solid var(--ink); border-radius: 6px; font-size: 0.83rem; background: var(--white); color: var(--ink); box-sizing: border-box;"/>
        </div>
        <div>
          <label for="step3-student-id-ref" style="font-size: 0.75rem; font-weight: 800; color: var(--ink); display: block; margin-bottom: 4px;">Student ID # or Academic Email (.ac.uk / .edu / uni) *</label>
          <input type="text" id="step3-student-id-ref" value="${idRef}" placeholder="e.g. ID #948201 or name@studio.unibo.it" style="width: 100%; padding: 8px 10px; border: 1.5px solid var(--ink); border-radius: 6px; font-size: 0.83rem; background: var(--white); color: var(--ink); box-sizing: border-box;"/>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <label for="step3-student-course" style="font-size: 0.75rem; font-weight: 700; color: var(--muted); display: block; margin-bottom: 4px;">Course / Degree Title or Supervisor (Optional)</label>
        <input type="text" id="step3-student-course" value="${course}" placeholder="e.g. BA Film & Media Production — Final Year Short Film" style="width: 100%; padding: 7px 10px; border: 1.5px solid var(--line); border-radius: 6px; font-size: 0.82rem; background: var(--white); color: var(--ink); box-sizing: border-box;"/>
      </div>
      <label style="font-size: 0.8rem; font-weight: 800; color: var(--ink); display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
        <input type="checkbox" id="step3-student-confirm" ${confirmed ? "checked" : ""} style="margin-top: 2px; accent-color: var(--orange); width: 16px; height: 16px; cursor: pointer;"/>
        <span>I confirm I am a currently enrolled student and can provide valid Student Identification (Student ID card) to qualify for this student discount rate. *</span>
      </label>
    </div>
  `;
}

/**
 * Builds HTML for Step 3 dynamic variable fields.
 * @param {string} subcategory
 * @param {string} pricingStandard
 * @param {object} inputs
 * @param {string} ilrSearchQuery
 * @returns {string}
 */
export function renderDynamicVariables(subcategory, pricingStandard = "agency", inputs = {}, ilrSearchQuery = "") {
  if (!subcategory) {
    return `<p class="field-hint">Please choose a subcategory first.</p>`;
  }

  const standardRates = (RATES[subcategory] && RATES[subcategory][pricingStandard]) || {};

  switch (subcategory) {
    case "tv_commercial": {
      const defaultBsf = standardRates.bsf || (pricingStandard === "equity" ? 220 : 350);
      const bsfVal = inputs.bsf ?? defaultBsf;
      const tvrVal = inputs.tvr_tier || "standard";
      const reachVal = inputs.reach || "1.0";
      const durationVal = inputs.duration || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-bsf">Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="200" max="600" step="50" value="${bsfVal}" aria-label="Base Session Fee Slider"/>
            <span class="slider-value-display" id="disp-bsf">£${bsfVal}</span>
          </div>
          <span class="field-hint">Standard BSF ranges: Equity minimum £220, Agency market rate £350.</span>
        </div>

        <div class="var-field-group">
          <label for="input-tvr-tier">TV Buyout Metric</label>
          <select id="input-tvr-tier" name="tvr_tier">
            <option value="standard" ${tvrVal === "standard" ? "selected" : ""}>Standard Multipliers (Local, Regional, National, Worldwide)</option>
            <option value="1" ${tvrVal === "1" ? "selected" : ""}>1 Equity TVR Point (£322.23)</option>
            <option value="10" ${tvrVal === "10" ? "selected" : ""}>10 Equity TVR Points (£522.30)</option>
            <option value="25" ${tvrVal === "25" ? "selected" : ""}>25 Equity TVR Points (£855.75)</option>
            <option value="50" ${tvrVal === "50" ? "selected" : ""}>50 Equity TVR Points (£1,411.50)</option>
            <option value="75" ${tvrVal === "75" ? "selected" : ""}>75 Equity TVR Points (£1,967.25)</option>
            <option value="100" ${tvrVal === "100" ? "selected" : ""}>100 Equity TVR Points (£2,523.00)</option>
            <option value="200" ${tvrVal === "200" ? "selected" : ""}>200 Equity TVR Points (£4,746.00)</option>
            <option value="500" ${tvrVal === "500" ? "selected" : ""}>500 Equity TVR Points (£7,680.00)</option>
          </select>
          <span class="field-hint">Choose between standard campaign multipliers or official Equity TVR schedule brackets.</span>
        </div>
        
        <div id="tv-standard-reach-group" style="${tvrVal !== 'standard' ? 'display: none;' : ''}">
          <div class="var-field-group">
            <label for="input-reach">Media Reach / Market</label>
            <select id="input-reach" name="reach">
              <option value="1.0" ${reachVal === "1.0" ? "selected" : ""}>Local / Regional (100% Buyout)</option>
              <option value="2.5" ${reachVal === "2.5" ? "selected" : ""}>Multi-Regional / Small Satellite (250% Buyout)</option>
              <option value="6.0" ${reachVal === "6.0" ? "selected" : ""}>National Campaign - UK & Ireland (600% Buyout)</option>
              <option value="12.0" ${reachVal === "12.0" ? "selected" : ""}>Worldwide / Global Broadcast (1200% Buyout)</option>
            </select>
          </div>
          
          <div class="var-field-group">
            <label for="input-duration">Campaign Duration</label>
            <select id="input-duration" name="duration">
              <option value="1.0" ${durationVal === "1.0" ? "selected" : ""}>3 Months (included in the reach buyout)</option>
              <option value="1.8" ${durationVal === "1.8" ? "selected" : ""}>6 Months (renewal +28% of reach cost)</option>
              <option value="3.0" ${durationVal === "3.0" ? "selected" : ""}>1 Year (renewal +70% of reach cost)</option>
              <option value="10.0" ${durationVal === "10.0" ? "selected" : ""}>Perpetuity (renewal +315% of reach cost)</option>
            </select>
          </div>
        </div>
      `;
    }

    case "radio_generic":
    case "cinema": {
      const isCinema = subcategory === "cinema";
      const defaultBsf = standardRates.bsf || (isCinema ? (pricingStandard === 'equity' ? 220 : 350) : (pricingStandard === 'equity' ? 180 : 250));
      const bsfVal = inputs.bsf ?? defaultBsf;
      const reachVal = inputs.reach || "1.0";
      const spotsVal = inputs.spots ?? 1;

      return `
        <div class="var-field-group">
          <label for="input-bsf">Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="500" step="50" value="${bsfVal}" aria-label="Base Session Fee Slider"/>
            <span class="slider-value-display" id="disp-bsf">£${bsfVal}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-reach">${isCinema ? "Cinema Scale" : "Radio Network"}</label>
          <select id="input-reach" name="reach">
            <option value="1.0" ${reachVal === "1.0" ? "selected" : ""}>Local Commercial (1.0x)</option>
            <option value="2.5" ${reachVal === "2.5" ? "selected" : ""}>Regional Broadcast (2.5x)</option>
            <option value="6.0" ${reachVal === "6.0" ? "selected" : ""}>National Broadcast (6.0x)</option>
          </select>
        </div>
        
        <div class="var-field-group">
          <label for="input-spots">Number of Spots / Scripts</label>
          <input type="number" id="input-spots" name="spots" min="1" max="20" value="${spotsVal}"/>
          <span class="field-hint">First spot at full buyout; subsequent spots discounted by 50%.</span>
        </div>
      `;
    }

    case "radio_ilr": {
      const defaultBsf = standardRates.bsf || (pricingStandard === 'equity' ? 180 : 250);
      const bsfVal = inputs.bsf ?? defaultBsf;
      const spotsVal = inputs.spots ?? 1;
      const durationVal = inputs.duration || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-bsf">Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="400" step="25" value="${bsfVal}" aria-label="Base Session Fee Slider"/>
            <span class="slider-value-display" id="disp-bsf">£${bsfVal}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="ilr-search">Select Target ILR Stations (RAJAR)</label>
          <input type="text" id="ilr-search" placeholder="Type station name to filter..." value="${escapeHtml(ilrSearchQuery)}"/>
          
          <div class="station-list-container" id="station-list" role="group" aria-label="UK Radio Stations">
            <!-- Populated dynamically by renderStationList -->
          </div>
          <span class="field-hint">Select all stations that will broadcast the spot. Listener reach maps to standardized fee brackets.</span>
        </div>
        
        <div class="var-field-group">
          <label for="input-spots">Number of Spots</label>
          <input type="number" id="input-spots" name="spots" min="1" max="50" value="${spotsVal}"/>
        </div>
        
        <div class="var-field-group">
          <label for="input-duration">Campaign Duration / Usage</label>
          <select id="input-duration" name="duration">
            <option value="1.0" ${durationVal === "1.0" ? "selected" : ""}>Up to 13 Weeks (3 Months) - Base</option>
            <option value="1.5" ${durationVal === "1.5" ? "selected" : ""}>Up to 26 Weeks (6 Months) - 1.5x Multiplier</option>
            <option value="2.5" ${durationVal === "2.5" ? "selected" : ""}>Up to 52 Weeks (1 Year) - 2.5x Multiplier</option>
          </select>
        </div>
      `;
    }

    case "trailers_promos": {
      const defaultBsf = standardRates.bsf || (pricingStandard === 'equity' ? 180 : 250);
      const bsfVal = inputs.bsf ?? defaultBsf;
      const promoUsageVal = inputs.promo_usage || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-bsf">Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="400" step="25" value="${bsfVal}"/>
            <span class="slider-value-display" id="disp-bsf">£${bsfVal}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-promo-usage">Distribution Channel</label>
          <select id="input-promo-usage" name="promo_usage">
            <option value="1.0" ${promoUsageVal === "1.0" ? "selected" : ""}>Single Channel / Local Station (1.0x)</option>
            <option value="2.0" ${promoUsageVal === "2.0" ? "selected" : ""}>Multi-Channel / Regional Network (2.0x)</option>
            <option value="3.0" ${promoUsageVal === "3.0" ? "selected" : ""}>National Network / Main Broadcast (3.0x)</option>
            <option value="4.0" ${promoUsageVal === "4.0" ? "selected" : ""}>VOD / Streaming Platforms (Netflix, Prime, etc.) (4.0x)</option>
          </select>
        </div>
      `;
    }

    case "voice_god":
    case "adr_dubbing": {
      const isAdr = subcategory === "adr_dubbing";
      const defaultHourly = standardRates.ratePerHour || (isAdr ? (pricingStandard === 'equity' ? 180 : 250) : (pricingStandard === 'equity' ? 200 : 300));
      const hoursVal = inputs.hours ?? 1;
      const hourlyRateVal = inputs.hourly_rate ?? defaultHourly;

      return `
        <div class="var-field-group">
          <label for="input-hours">Estimated Session / Recording Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="0.5" max="8" step="0.5" value="${hoursVal}"/>
            <span class="slider-value-display" id="disp-hours">${hoursVal} hr</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-hourly-rate">Base Hourly Rate (£)</label>
          <div class="slider-container">
            <input type="range" id="input-hourly-rate" min="150" max="500" step="25" value="${hourlyRateVal}"/>
            <span class="slider-value-display" id="disp-hourly-rate">£${hourlyRateVal}</span>
          </div>
        </div>
      `;
    }

    case "corporate_video":
    case "medical_narration":
    case "museum_exhibition": {
      const wordsVal = inputs.words ?? 500;
      const corpUsageVal = inputs.corp_usage || "1.0";

      let html = `
        <div class="var-field-group">
          <label for="input-words">Estimated Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="100" max="5000" step="100" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="50" max="50000" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([150, 300, 750, 1500, 3000])}
          <span class="field-hint">A typical narration script reads at approximately 150 words per minute (Min £150 studio floor).</span>
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm, inputs.raw_minutes)}
      `;

      if (subcategory === "corporate_video") {
        html += `
          <div class="var-field-group">
            <label for="input-corp-usage">Project Distribution (Usage Buyout)</label>
            <select id="input-corp-usage" name="corp_usage">
              <option value="1.0" ${corpUsageVal === "1.0" ? "selected" : ""}>Internal Corporate Use Only (Included / 1.0x)</option>
              <option value="2.0" ${corpUsageVal === "2.0" ? "selected" : ""}>External Use - Website / Social organic (2.0x)</option>
              <option value="4.0" ${corpUsageVal === "4.0" ? "selected" : ""}>Paid Promotion / YouTube Ads (4.0x)</option>
            </select>
          </div>
        `;
      }
      return html;
    }

    case "explainer_video": {
      const wordsVal = inputs.words ?? 300;
      const corpUsageVal = inputs.corp_usage || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-words">Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="50" max="3000" step="50" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="50" max="3000" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([75, 150, 300, 450, 750])}
          <span class="field-hint">A standard explainer video reads at approx. 150 words per minute.</span>
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm, inputs.raw_minutes)}
        
        <div class="var-field-group">
          <label for="input-corp-usage">Distribution Usage</label>
          <select id="input-corp-usage" name="corp_usage">
            <option value="1.0" ${corpUsageVal === "1.0" ? "selected" : ""}>Internal Corporate / Company-wide (1.0x)</option>
            <option value="1.5" ${corpUsageVal === "1.5" ? "selected" : ""}>External Web / Organic YouTube & Socials (1.5x)</option>
            <option value="3.0" ${corpUsageVal === "3.0" ? "selected" : ""}>Paid Placement / YouTube Ads / Web Pre-rolls (3.0x)</option>
          </select>
        </div>
      `;
    }

    case "elearning": {
      const wordsVal = inputs.words ?? 1000;
      return `
        <div class="var-field-group">
          <label for="input-words">Estimated Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="100" max="25000" step="100" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="1" max="99999" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([500, 1000, 2500, 5000, 10000])}
          <span class="field-hint">Rate card: 0–999w @ £${Number(standardRates.tier1).toFixed(2)}/w &nbsp;|&nbsp; 1000–2000w @ £${Number(standardRates.tier2).toFixed(2)}/w &nbsp;|&nbsp; 2001w+ @ £${Number(standardRates.tier3).toFixed(2)}/w (Min £${standardRates.minFloor}).</span>
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm, inputs.raw_minutes)}
      `;
    }

    case "documentary_narration": {
      const wordsVal = inputs.words ?? 1500;
      const docUsageVal = inputs.doc_usage || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-words">Estimated Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="150" max="15000" step="150" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="50" max="99999" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([450, 750, 1500, 3000, 6000])}
          <span class="field-hint">Aligned with Equity / PACT &amp; Gravy For The Brain Documentary narration benchmarks.</span>
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm || "130", inputs.raw_minutes)}

        <div class="var-field-group">
          <label for="input-doc-usage">Distribution &amp; Broadcast Rights</label>
          <select id="input-doc-usage" name="doc_usage">
            <option value="0.6" ${docUsageVal === "0.6" ? "selected" : ""}>Student / Academic Documentary (40% Student Discount — Valid Student ID Required, Min £110–£140 Floor)</option>
            <option value="1.0" ${docUsageVal === "1.0" ? "selected" : ""}>Indie / Film Festival / Non-Broadcast Educational (1.0x — Min £200–£275)</option>
            <option value="1.5" ${docUsageVal === "1.5" ? "selected" : ""}>Online / Monetized YouTube / Regional TV (1.5x)</option>
            <option value="2.5" ${docUsageVal === "2.5" ? "selected" : ""}>National TV Network / Major SVOD (Netflix, BBC, Discovery) (2.5x)</option>
            <option value="3.5" ${docUsageVal === "3.5" ? "selected" : ""}>Global Theatrical / Worldwide All-Media Buyout (3.5x)</option>
          </select>
          <span class="field-hint">🎓 <strong>Note:</strong> Selecting the Student Discount tier requires valid Student Identification (Student ID card or academic institution email) at booking.</span>
        </div>
        ${renderStudentVerificationBox(parseFloat(docUsageVal) < 1.0, inputs)}
      `;
    }

    case "audio_drama_fiction": {
      const wordsVal = inputs.words ?? 1800;
      const tierVal = inputs.drama_tier || "0.55";
      const pacingVal = inputs.drama_pacing || "dramatic";

      return `
        <div class="var-field-group">
          <label for="input-drama-tier">Production &amp; Budget Tier</label>
          <select id="input-drama-tier" name="drama_tier">
            <option value="0.55" ${tierVal === "0.55" ? "selected" : ""}>Student / Academic Project (45% Student Discount — Valid Student ID Required, Min £100–£125 Floor)</option>
            <option value="1.0" ${tierVal === "1.0" ? "selected" : ""}>Independent Short Film / Festival / Passion Project (1.0x — Min £150–£200 Floor)</option>
            <option value="1.75" ${tierVal === "1.75" ? "selected" : ""}>Commercial Network / Monetized Audio Drama / Audible / Spotify (1.75x — Min £298 Floor)</option>
          </select>
          <span class="field-hint">🎓 <strong>Note:</strong> Student discount rates require valid Student Identification (Student ID card or university email) to be verified upon booking. Independent non-student creators should select the 1.0x Independent tier.</span>
        </div>
        ${renderStudentVerificationBox(parseFloat(tierVal) < 1.0, inputs)}

        <div class="var-field-group">
          <label for="input-drama-pacing">Performance &amp; Acting Style</label>
          <select id="input-drama-pacing" name="drama_pacing">
            <option value="dramatic" ${pacingVal === "dramatic" ? "selected" : ""}>Dramatic Acting with Pauses &amp; Emotional Beats (~115 wpm, +20% studio time)</option>
            <option value="deliberate" ${pacingVal === "deliberate" ? "selected" : ""}>Measured Storytelling / Atmospheric Pacing (~130 wpm, +10% studio time)</option>
            <option value="standard" ${pacingVal === "standard" ? "selected" : ""}>Straight Narrative Read (~150 wpm, 1.0x baseline)</option>
          </select>
          <span class="field-hint">A 15-minute un-paused script (~2,250 words) typically runs ~19–20 minutes once dramatic pauses and acting takes are factored in.</span>
        </div>

        <div class="var-field-group">
          <label for="input-words">Script Word Count (or enter raw minutes below)</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="150" max="10000" step="150" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="50" max="99999" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([450, 750, 1500, 2250, 4500])}
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm || "115", inputs.raw_minutes)}
      `;
    }

    case "animation_character": {
      const hoursVal = inputs.hours ?? 1;
      const defaultHourly = standardRates.ratePerHour || (pricingStandard === "equity" ? 220 : 300);
      const hourlyVal = inputs.hourly_rate ?? defaultHourly;
      const tierVal = inputs.anim_tier || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-anim-tier">Animation Production Scale</label>
          <select id="input-anim-tier" name="anim_tier">
            <option value="0.55" ${tierVal === "0.55" ? "selected" : ""}>Student Animation / Academic Short (45% Student Discount — Valid Student ID Required, Min £110–£135 Floor)</option>
            <option value="1.0" ${tierVal === "1.0" ? "selected" : ""}>Indie Web Series / Pilot / Festival Short (1.0x Base BSF)</option>
            <option value="1.75" ${tierVal === "1.75" ? "selected" : ""}>Commercial Brand Animation / Monetized Series (1.75x Buyout)</option>
            <option value="2.5" ${tierVal === "2.5" ? "selected" : ""}>Broadcast TV / Major SVOD Animated Series (2.5x Buyout)</option>
          </select>
          <span class="field-hint">🎓 <strong>Note:</strong> Selecting the Student Animation tier requires valid Student Identification (Student ID card or academic email) at booking.</span>
        </div>
        ${renderStudentVerificationBox(parseFloat(tierVal) < 1.0, inputs)}

        <div class="var-field-group">
          <label for="input-hours">Estimated Recording / Character Session Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="1" max="8" step="0.5" value="${hoursVal}"/>
            <span class="slider-value-display" id="disp-hours">${hoursVal} hr</span>
          </div>
        </div>

        <div class="var-field-group">
          <label for="input-hourly-rate">Base Studio Hourly Rate (£)</label>
          <div class="slider-container">
            <input type="range" id="input-hourly-rate" min="150" max="500" step="25" value="${hourlyVal}"/>
            <span class="slider-value-display" id="disp-hourly-rate">£${hourlyVal}</span>
          </div>
        </div>
      `;
    }

    case "elt_educational": {
      const bandVal = inputs.elt_band || "A";
      const formatVal = inputs.elt_format || "solo";
      const sessionVal = inputs.elt_session || "half";

      return `
        <div class="var-field-group">
          <label for="input-elt-band">Educational Complexity (Band)</label>
          <select id="input-elt-band" name="elt_band">
            <option value="A" ${bandVal === "A" ? "selected" : ""}>Band A: Generic text readings, coursebook audios</option>
            <option value="B" ${bandVal === "B" ? "selected" : ""}>Band B: Educational dialogues, teaching material</option>
            <option value="C" ${bandVal === "C" ? "selected" : ""}>Band C: Specialized scientific or technical tests</option>
            <option value="D" ${bandVal === "D" ? "selected" : ""}>Band D: Character acting, dictionaries & database scripts</option>
          </select>
        </div>

        <div class="var-field-group">
          <label for="input-elt-format">Performance Format</label>
          <select id="input-elt-format" name="elt_format">
            <option value="solo" ${formatVal === "solo" ? "selected" : ""}>Solo Performer (Single Voice)</option>
            <option value="group" ${formatVal === "group" ? "selected" : ""}>Group / Ensemble Session</option>
          </select>
        </div>
        
        <div class="var-field-group">
          <label for="input-elt-session">Session Length</label>
          <select id="input-elt-session" name="elt_session">
            <option value="half" ${sessionVal === "half" ? "selected" : ""}>Half Day Session (Up to 3 hours)</option>
            <option value="full" ${sessionVal === "full" ? "selected" : ""}>Full Day Session (Up to 6 hours)</option>
          </select>
        </div>
      `;
    }

    case "psa": {
      const scaleVal = inputs.corp_usage || "1.0";
      return `
        <div class="var-field-group">
          <label for="input-corp-usage">Campaign Scale</label>
          <select id="input-corp-usage" name="corp_usage">
            <option value="1.0" ${scaleVal === "1.0" ? "selected" : ""}>Local / Regional drive (1.0x)</option>
            <option value="2.5" ${scaleVal === "2.5" ? "selected" : ""}>National broadcast / Large Charity drive (2.5x)</option>
          </select>
        </div>
      `;
    }

    case "video_games": {
      const hoursVal = inputs.hours ?? 3;
      const captureType = inputs.game_capture || "standard";
      const tierVal = inputs.game_tier || "1.8";
      const headcamPremium = Math.max(0, (standardRates.ratePerHourHeadcam || 0) - (standardRates.ratePerHour || 0));

      return `
        <div class="var-field-group">
          <label for="input-hours">Estimated Session Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="1" max="8" step="1" value="${hoursVal}"/>
            <span class="slider-value-display" id="disp-hours">${hoursVal} hr</span>
          </div>
          <span class="field-hint">Equity standard minimum session call is 3 hours (£300/hr).</span>
        </div>

        <div class="var-field-group">
          <label for="input-game-capture">Capture Method</label>
          <select id="input-game-capture" name="game_capture">
            <option value="standard" ${captureType === "standard" ? "selected" : ""}>Standard Studio Voiceover</option>
            <option value="headcam" ${captureType === "headcam" ? "selected" : ""}>Voiceover with Headcam / Facial Capture (+£${headcamPremium}/hr)</option>
          </select>
        </div>
        
        <div class="var-field-group">
          <label for="input-game-tier">Production Scale (Tier)</label>
          <select id="input-game-tier" name="game_tier">
            <option value="1.8" ${tierVal === "1.8" ? "selected" : ""}>AAA Major Franchise / Mid-to-Large Publisher (Includes 200% Equity Usage Buyout)</option>
            <option value="1.0" ${tierVal === "1.0" ? "selected" : ""}>Indie / Crowdfunded Studio (No Buyout / 1.0x)</option>
          </select>
        </div>
      `;
    }

    case "audiobooks": {
      const hoursVal = inputs.hours ?? 6;
      const defaultPfh = pricingStandard === "equity" ? 150 : 250;
      const pfhVal = inputs.hourly_rate ?? defaultPfh;

      return `
        <div class="var-field-group">
          <label for="input-hours">Finished Audio Hours (PFH)</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="0.5" max="25" step="0.5" value="${hoursVal}"/>
            <span class="slider-value-display" id="disp-hours">${hoursVal} FH</span>
          </div>
          <span class="field-hint">Charged Per Finished Hour (PFH) (~9,000 words/FH), including standard studio preparation and mastering.</span>
        </div>

        <div class="var-field-group">
          <label for="input-hourly-rate">Rate Per Finished Hour (PFH)</label>
          <div class="slider-container">
            <input type="range" id="input-hourly-rate" min="100" max="400" step="25" value="${pfhVal}"/>
            <span class="slider-value-display" id="disp-hourly-rate">£${pfhVal}</span>
          </div>
        </div>
      `;
    }

    case "ivr_basic": {
      const wordsVal = inputs.words ?? 100;
      const memVal = inputs.ivr_membership || "none";

      return `
        <div class="var-field-group">
          <label for="input-words">Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="10" max="1000" step="10" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="1" max="9999" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([50, 100, 250, 500, 1000])}
          <span class="field-hint">Enter exact word count or use slider to estimate.</span>
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm, inputs.raw_minutes)}
        <div class="var-field-group">
          <label for="input-ivr-membership">Industry Membership</label>
          <select id="input-ivr-membership" name="ivr_membership">
            <option value="none" ${memVal === "none" ? "selected" : ""}>No Membership (Standard Rate)</option>
            <option value="ama" ${memVal === "ama" ? "selected" : ""}>AMA Member — American Media Association (−20%)</option>
            <option value="ema" ${memVal === "ema" ? "selected" : ""}>EMA Member — European Media Association (−20%)</option>
          </select>
          <span class="field-hint">AMA &amp; EMA members are entitled to reduced IVR rates per agreement.</span>
        </div>
      `;
    }

    case "telephony_bundles": {
      const promptsVal = inputs.prompts ?? 15;
      const langsVal = inputs.langs ?? 1;
      const memVal = inputs.ivr_membership || "none";

      return `
        <div class="var-field-group">
          <label for="input-prompts">Number of Prompts</label>
          <input type="number" id="input-prompts" name="prompts" min="1" max="500" value="${promptsVal}"/>
        </div>
        <div class="var-field-group">
          <label for="input-langs">Number of Languages / Versions</label>
          <input type="number" id="input-langs" name="langs" min="1" max="10" value="${langsVal}"/>
        </div>
        <div class="var-field-group">
          <label for="input-ivr-membership">Industry Membership</label>
          <select id="input-ivr-membership" name="ivr_membership">
            <option value="none" ${memVal === "none" ? "selected" : ""}>No Membership (Standard Rate)</option>
            <option value="ama" ${memVal === "ama" ? "selected" : ""}>AMA Member — American Media Association (−20%)</option>
            <option value="ema" ${memVal === "ema" ? "selected" : ""}>EMA Member — European Media Association (−20%)</option>
          </select>
        </div>
      `;
    }

    case "digital_ads": {
      const defaultBsf = standardRates.bsf || (pricingStandard === 'equity' ? 180 : 280);
      const bsfVal = inputs.bsf ?? defaultBsf;
      const modelVal = inputs.digital_model || "impressions";
      const durVal = inputs.duration || "1.5";
      const impressionVal = inputs.impression_tier || "1.5m";

      return `
        <div class="var-field-group">
          <label for="input-digital-model">Pricing &amp; Buyout Calculation Model</label>
          <select id="input-digital-model" name="digital_model">
            <option value="impressions" ${modelVal === "impressions" ? "selected" : ""}>Modern Online / VOD Impression Tiers (Equity / Voice Fairy 2024–2027)</option>
            <option value="duration" ${modelVal === "duration" ? "selected" : ""}>Term-Based Duration Buyout (13w / 26w / 52w)</option>
          </select>
          <span class="field-hint">Voice Fairy &amp; Equity recommended structure uses exponential view/impression tiers.</span>
        </div>

        <div id="digital-impression-group" style="${modelVal !== 'impressions' ? 'display: none;' : ''}">
          <div class="var-field-group">
            <label for="input-impression-tier">Target Views / Impressions</label>
            <select id="input-impression-tier" name="impression_tier">
              <option value="1.5m" ${impressionVal === "1.5m" ? "selected" : ""}>Up to 1.5 Million Views (£450 Equity / £550 Agency)</option>
              <option value="3m" ${impressionVal === "3m" ? "selected" : ""}>Up to 3 Million Views (£900 Equity / £1,100 Agency)</option>
              <option value="10m" ${impressionVal === "10m" ? "selected" : ""}>Up to 10 Million Views (£3,000 Equity / £3,600 Agency)</option>
              <option value="15m" ${impressionVal === "15m" ? "selected" : ""}>Up to 15 Million Views (£4,500 Equity / £5,400 Agency)</option>
              <option value="21m" ${impressionVal === "21m" ? "selected" : ""}>Up to 21 Million Views (£6,150 Equity / £7,200 Agency)</option>
              <option value="37m" ${impressionVal === "37m" ? "selected" : ""}>Up to 37 Million Views (£8,550 Equity / £9,800 Agency)</option>
              <option value="50m" ${impressionVal === "50m" ? "selected" : ""}>Up to 50 Million Views (£10,500 Equity / £12,500 Agency)</option>
              <option value="100m" ${impressionVal === "100m" ? "selected" : ""}>Up to 100 Million Views (£15,450 Equity / £18,000 Agency)</option>
              <option value="unlimited_1yr" ${impressionVal === "unlimited_1yr" ? "selected" : ""}>1 Year Unlimited Views Buyout (£1,600 Equity / £2,200 Agency)</option>
            </select>
          </div>
        </div>

        <div id="digital-duration-group" style="${modelVal !== 'duration' ? 'display: none;' : ''}">
          <div class="var-field-group">
            <label for="input-bsf">Campaign BSF (Base Session Fee)</label>
            <div class="slider-container">
              <input type="range" id="input-bsf" min="150" max="400" step="25" value="${bsfVal}"/>
              <span class="slider-value-display" id="disp-bsf">£${bsfVal}</span>
            </div>
          </div>
          
          <div class="var-field-group">
            <label for="input-duration">Campaign Duration</label>
            <select id="input-duration" name="duration">
              <option value="1.5" ${durVal === "1.5" ? "selected" : ""}>13 Weeks / 3 Months (1.5x BSF)</option>
              <option value="2.5" ${durVal === "2.5" ? "selected" : ""}>26 Weeks / 6 Months (2.5x BSF)</option>
              <option value="4.5" ${durVal === "4.5" ? "selected" : ""}>52 Weeks / 12 Months (4.5x BSF)</option>
            </select>
          </div>
        </div>
      `;
    }

    case "podcast_ads": {
      const defaultBsf = standardRates.bsf || (pricingStandard === 'equity' ? 150 : 220);
      const bsfVal = inputs.bsf ?? defaultBsf;
      const durVal = inputs.duration || "1.5";

      return `
        <div class="var-field-group">
          <label for="input-bsf">Campaign BSF (Base Session Fee)</label>
          <div class="slider-container">
            <input type="range" id="input-bsf" min="150" max="400" step="25" value="${bsfVal}"/>
            <span class="slider-value-display" id="disp-bsf">£${bsfVal}</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-duration">Campaign Duration</label>
          <select id="input-duration" name="duration">
            <option value="1.5" ${durVal === "1.5" ? "selected" : ""}>13 Weeks / 3 Months (1.5x BSF)</option>
            <option value="2.5" ${durVal === "2.5" ? "selected" : ""}>26 Weeks / 6 Months (2.5x BSF)</option>
            <option value="4.5" ${durVal === "4.5" ? "selected" : ""}>52 Weeks / 12 Months (4.5x BSF)</option>
          </select>
        </div>
      `;
    }

    case "social_organic": {
      const hoursVal = inputs.hours ?? 2;
      return `
        <div class="var-field-group">
          <label for="input-hours">Duration of Video (Minutes)</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="0.5" max="15" step="0.5" value="${hoursVal}"/>
            <span class="slider-value-display" id="disp-hours">${hoursVal} min</span>
          </div>
        </div>
      `;
    }

    case "podcast_intro": {
      return `<div class="badge-notice">Standard flat fee package. Proceed to extras!</div>`;
    }

    case "ai_dataset": {
      const hoursVal = inputs.hours ?? 5;
      const tierVal = inputs.game_tier || "1.0";

      return `
        <div class="var-field-group">
          <label for="input-hours">Recording Hours</label>
          <div class="slider-container">
            <input type="range" id="input-hours" min="1" max="40" step="1" value="${hoursVal}"/>
            <span class="slider-value-display" id="disp-hours">${hoursVal} hr</span>
          </div>
        </div>
        
        <div class="var-field-group">
          <label for="input-game-tier">AI Buyout Licensing Scope</label>
          <select id="input-game-tier" name="game_tier">
            <option value="1.0" ${tierVal === "1.0" ? "selected" : ""}>Internal Research & Testing (1.0x)</option>
            <option value="10.0" ${tierVal === "10.0" ? "selected" : ""}>Full Commercial AI Voice Deployment (10.0x Buyout Premium)</option>
          </select>
        </div>
      `;
    }

    case "text_to_speech": {
      const wordsVal = inputs.words ?? 2500;
      const durVal = inputs.duration || "3.0";

      return `
        <div class="var-field-group">
          <label for="input-words">Total Script Word Count</label>
          <div class="slider-with-number">
            <input type="range" id="input-words" min="500" max="25000" step="500" value="${wordsVal}"/>
            <input type="number" id="input-words-num" class="manual-word-input" min="1" max="999999" step="1" value="${wordsVal}" placeholder="Type count"/>
          </div>
          ${renderWordPresets([1000, 2500, 5000, 10000, 20000])}
        </div>
        ${renderScriptPasteBox(inputs.script_text, inputs.script_wpm, inputs.raw_minutes)}
        
        <div class="var-field-group">
          <label for="input-duration">Licensing Duration (Synthetic Playback)</label>
          <select id="input-duration" name="duration">
            <option value="3.0" ${durVal === "3.0" ? "selected" : ""}>1 Year (3.0x)</option>
            <option value="8.0" ${durVal === "8.0" ? "selected" : ""}>3 Years (8.0x)</option>
            <option value="15.0" ${durVal === "15.0" ? "selected" : ""}>In Perpetuity Buyout (15.0x)</option>
          </select>
        </div>
      `;
    }

    case "transport_pa": {
      const promptsVal = inputs.prompts ?? 10;
      return `
        <div class="var-field-group">
          <label for="input-prompts">Number of Audio Announcements</label>
          <input type="number" id="input-prompts" name="prompts" min="1" max="200" value="${promptsVal}"/>
        </div>
      `;
    }

    default:
      return `<p class="field-hint">No extra parameters required for this subcategory.</p>`;
  }
}

/**
 * Builds HTML for the filtered UK ILR station checklist.
 * @param {string} searchQuery
 * @param {string[]} selectedStations
 * @returns {string}
 */
export function renderStationList(searchQuery = "", selectedStations = []) {
  const query = (searchQuery || "").trim().toLowerCase();
  const filtered = ILR_STATIONS.filter(s => s.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    return `<span class="breakdown-empty">No matching stations found.</span>`;
  }

  return filtered.map(station => {
    const isChecked = selectedStations.includes(station.name);
    const safeName = escapeHtml(station.name);
    return `
      <label class="station-item">
        <input type="checkbox" class="ilr-checkbox" value="${safeName}" ${isChecked ? "checked" : ""}/>
        <span class="station-name-text">${safeName}</span>
        <span class="station-info-meta">${station.reach.toLocaleString()} Reach</span>
      </label>
    `;
  }).join("");
}
