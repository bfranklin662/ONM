console.log("✅ fines.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  // ---- Constants ----
  const STORAGE_KEY = "darts_fines_tracker_v1";
  const MAX_PLAYERS = 12;
  const MAX_BEFORE_DOUBLE_PENCE = 2500; // £25
  const MAX_AFTER_DOUBLE_PENCE = 5000; // £50

  const MIN_PLAYERS = 1;
  const DEFAULT_PLAYER_INPUTS = 6;
  let playerInputCount = DEFAULT_PLAYER_INPUTS;

  let resultSubmitData = {
    players: [],
    match: {}
  };

  // ---- DOM ----
  const setupGrid = document.getElementById("setupGrid");
  const setupCard = document.getElementById("setupCard");
  const trackerCard = document.getElementById("trackerCard");
  const winnerMathEl = document.getElementById("winnerMath");

  const playersGrid = document.getElementById("playersGrid");
  const fineGrid = document.getElementById("fineGrid");

  const startBtn = document.getElementById("startBtn");
  const submitFineBtn = document.getElementById("submitFineBtn");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  const openHistoryBtn = document.getElementById("openHistoryBtn");
  const openFinesBtn = document.getElementById("openFinesBtn");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const closeModalBtn = document.getElementById("closeModalBtn");

  const specialsGrid = document.getElementById("specialsGrid");
  const headerActions = document.getElementById("headerActions");

  const resultsCard = document.getElementById("resultsCard");
  const resultsList = document.getElementById("resultsList");
  const spinBtn = document.getElementById("spinBtn");
  const wheelCanvas = document.getElementById("wheelCanvas");
  const wheelWinner = document.getElementById("wheelWinner");

  const appHeader = document.getElementById("appHeader");
  const doubleHeader = document.getElementById("doubleHeader");


  const finalCard = document.getElementById("finalCard");
  const finalList = document.getElementById("finalList");

  const resultStatsCard = document.getElementById("resultStatsCard");
  const resultStatsList = document.getElementById("resultStatsList");
  const resultStatsBackBtn = document.getElementById("resultStatsBackBtn");
  const resultStatsNextBtn = document.getElementById("resultStatsNextBtn");

  const matchInfoCard = document.getElementById("matchInfoCard");
  const matchInfoBackBtn = document.getElementById("matchInfoBackBtn");
  const matchInfoNextBtn = document.getElementById("matchInfoNextBtn");

  const reviewResultCard = document.getElementById("reviewResultCard");
  const reviewResultBody = document.getElementById("reviewResultBody");
  const reviewBackBtn = document.getElementById("reviewBackBtn");
  const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");

  const continueResultSubmitBtn = document.getElementById("continueResultSubmitBtn");

  const resumeGameBtnInline = document.getElementById("resumeGameBtnInline");

  const setupGameActions = document.getElementById("setupGameActions");
  const setupResetBtn = document.getElementById("setupResetBtn");
  const setupNextBtn = document.getElementById("setupNextBtn");
  const fineNextBtn = document.getElementById("fineNextBtn");
  const fineBackBtn = document.getElementById("fineBackBtn");


  // Winner popup
  const winnerOverlay = document.getElementById("winnerOverlay");
  const closeWinnerBtn = document.getElementById("closeWinnerBtn");
  const winnerContinueBtn = document.getElementById("winnerContinueBtn");
  const winnerNameEl = document.getElementById("winnerName");
  const winnerAmountEl = document.getElementById("winnerAmount");

  const finalBackBtn = document.getElementById("finalBackBtn");

  const resetGameBtn = document.getElementById("resetGameBtn");

  const wheelBackBtn = document.getElementById("wheelBackBtn");
  const confirmResultBtn = document.getElementById("confirmResultBtn");
  const addPlayerBtn = document.getElementById("addPlayerBtn");
  const removePlayerBtn = document.getElementById("removePlayerBtn");

  const matchLeague = document.getElementById("matchLeague");
  const matchHomeTeam = document.getElementById("matchHomeTeam");
  const matchAwayTeam = document.getElementById("matchAwayTeam");
  const matchHomeScore = document.getElementById("matchHomeScore");
  const matchAwayScore = document.getElementById("matchAwayScore");
  const matchVenue = document.getElementById("matchVenue");
  const matchCup = document.getElementById("matchCup");
  const matchDate = document.getElementById("matchDate");
  const leagueTeamsList = document.getElementById("leagueTeamsList");

  const openImagesBtn = document.getElementById("openImagesBtn");
  const matchImageInput = document.getElementById("matchImageInput");
  const imageSummaryText = document.getElementById("imageSummaryText");

  const onmHomeBtn = document.getElementById("onmHomeBtn");
  const onmAwayBtn = document.getElementById("onmAwayBtn");
  const homeAwayToggle = document.getElementById("homeAwayToggle");
  let onmSide = resultSubmitData.match?.onmSide || "home";

  const cupToggle = document.getElementById("cupToggle");
  const cupNoBtn = document.getElementById("cupNoBtn");
  const cupYesBtn = document.getElementById("cupYesBtn");

  const imagePlusBtn = document.getElementById("imagePlusBtn");
  const imageCountText = document.getElementById("imageCountText");

  const imageText = document.getElementById("imageText");


  cupNoBtn?.addEventListener("click", () => setCup(false));
  cupYesBtn?.addEventListener("click", () => setCup(true));

  const matchInfoStatsBtn = document.getElementById("matchInfoStatsBtn");
  const resultStatsSubmitBtn = document.getElementById("resultStatsSubmitBtn");

  const screenTitleText = document.getElementById("screenTitleText");
  const screenSwitch = document.getElementById("screenSwitch");

  const fineOptions = [
    { label: "50p", pence: 50 },
    { label: "£1", pence: 100 },
    { label: "£2.50", pence: 250 },
    { label: "£5", pence: 500 },
    { label: "Custom", pence: null }
  ];

  // ---- State ----
  let store = loadStore(); // { totalsByName, history }

  let localLightboxUrls = [];
  let localLightboxIndex = 0;

  let customValueText = "";

  const specials = [
    { key: "180", label: "180", type: "S180" },
    { key: "BULL", label: "Bull-Out", type: "BULLOUT" },
    { key: "TON", label: "Ton+ Out", type: "TONOUT" }
  ];

  let selectedSpecial = null; // "S180" | "BULLOUT" | "TONOUT" | null
  let specialsPickerOpen = false; // <-- NEW: purely for UI highlight while modal is open



  const MAX_MATCH_IMAGES = 30;
  let selectedMatchImages = [];

  let reviewImageUrls = [];

  let leagueTeamsData = null;

  async function loadLeagueTeamsData() {
    try {
      const res = await fetch(`data/league-teams.json?v=${Date.now()}`, {
        cache: "no-store"
      });
      leagueTeamsData = await res.json();
    } catch (err) {
      console.warn("Could not load league teams data", err);
      leagueTeamsData = null;
    }
  }

  function setCup(isCup) {
    matchCup.checked = isCup;

    cupNoBtn?.classList.toggle("active", !isCup);
    cupYesBtn?.classList.toggle("active", isCup);
    cupToggle?.classList.toggle("away", isCup);

    readMatchInfo();
    saveGameSnapshot();
  }

  function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderResultStatsScreen() {
    resultSubmitData.players = players.map(p => {
      const existing = resultSubmitData.players.find(x => x.name === p.name);

      return {
        name: p.name,
        finesPence: p.totalPence,
        doubleFine: p.name === doubleWinnerName,
        checkouts: existing?.checkouts ?? 0,
        oneEightys: existing?.oneEightys ?? 0,
        bulls: existing?.bulls ?? 0,
        tonOuts: existing?.tonOuts ?? 0
      };
    });

    resultStatsList.innerHTML = resultSubmitData.players.map((p, i) => `
    <div class="resultRow result-submit-row">
      <div class="name">
        ${escapeHtml(p.name)}
        ${p.doubleFine ? '<span class="x2-badge">X2</span>' : ''}
      </div>

      <div class="result-submit-grid">
        <label>
          Checkouts
          <div class="step-input">
            <input class="result-input" data-index="${i}" data-field="checkouts" type="number" min="0" value="${p.checkouts}">
            <button type="button" class="step-plus" data-index="${i}" data-field="checkouts">+</button>
          </div>
        </label>

        <label>
          Fines
          <div class="step-input">
            <span class="currency">£</span>
            <input
              class="result-input ${p.doubleFine ? "double-fine-input" : ""}"
              data-index="${i}"
              data-field="finesPence"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              value="${(p.finesPence / 100).toFixed(2)}"
            />
          </div>
        </label>

        <label>
          180s
          <div class="step-input">
            <input class="result-input" data-index="${i}" data-field="oneEightys" type="number" min="0" value="${p.oneEightys}">
            <button type="button" class="step-plus" data-index="${i}" data-field="oneEightys">+</button>
          </div>
        </label>

        <label>
          Bulls
          <div class="step-input">
            <input class="result-input" data-index="${i}" data-field="bulls" type="number" min="0" value="${p.bulls}">
            <button type="button" class="step-plus" data-index="${i}" data-field="bulls">+</button>
          </div>
        </label>

        <label>
          Ton+ Outs
          <div class="step-input">
            <input class="result-input" data-index="${i}" data-field="tonOuts" type="number" min="0" value="${p.tonOuts}">
            <button type="button" class="step-plus" data-index="${i}" data-field="tonOuts">+</button>
          </div>
        </label>
      </div>
    </div>
  `).join("");

    resultStatsList.querySelectorAll(".result-input").forEach(input => {
      input.addEventListener("input", () => {
        const index = Number(input.dataset.index);
        const field = input.dataset.field;
        if (field === "finesPence") {
          const num = Number(input.value || 0);
          resultSubmitData.players[index][field] = Math.round(num * 100);
        } else {
          resultSubmitData.players[index][field] = Number(input.value || 0);
        }
        saveGameSnapshot();
      });
    });

    resultStatsList.querySelectorAll('[data-field="finesPence"]').forEach(input => {
      input.addEventListener("focus", () => {
        input.value = input.value.replace("£", "");
      });

      input.addEventListener("blur", () => {
        const num = Number(input.value.replace("£", "").trim() || 0);
        input.value = `£${num.toFixed(2)}`;
        input.dispatchEvent(new Event("input"));
      });
    });

    resultStatsList.querySelectorAll(".step-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.index);
        const field = btn.dataset.field;
        resultSubmitData.players[index][field] = Number(resultSubmitData.players[index][field] || 0) + 1;
        renderResultStatsScreen();
        saveGameSnapshot();
      });
    });

    resultStatsList.querySelectorAll('.result-input:not([data-field="finesPence"])').forEach(input => {
      input.addEventListener('focus', () => {
        if (input.value === "0") input.value = "";
      });

      input.addEventListener('blur', () => {
        input.value = String(Number(input.value || 0));
        input.dispatchEvent(new Event("input"));
      });
    });
  }

  function incrementPlayerSpecial(playerName, field) {
    const existing = resultSubmitData.players.find(p => p.name === playerName);

    if (existing) {
      existing[field] = Number(existing[field] || 0) + 1;
    } else {
      resultSubmitData.players.push({
        name: playerName,
        finesPence: store.totalsByName[playerName] ?? 0,
        doubleFine: playerName === doubleWinnerName,
        checkouts: 0,
        oneEightys: field === "oneEightys" ? 1 : 0,
        bulls: field === "bulls" ? 1 : 0,
        tonOuts: field === "tonOuts" ? 1 : 0
      });
    }

    saveGameSnapshot();
  }

  function openLocalLightbox(startIndex = 0) {
    localLightboxUrls.forEach(URL.revokeObjectURL);
    localLightboxUrls = selectedMatchImages.map(file => URL.createObjectURL(file));
    localLightboxIndex = startIndex;

    openModal("Match Photos", `
    <div class="localLightbox">
      <button id="localPrevBtn" class="lightboxNav">‹</button>
      <img id="localLightboxImg" src="${localLightboxUrls[localLightboxIndex]}" alt="Match photo">
      <button id="localNextBtn" class="lightboxNav">›</button>
    </div>
    <div class="lightboxCounter">
      Image ${localLightboxIndex + 1} / ${localLightboxUrls.length}
    </div>
  `);

    document.getElementById("localPrevBtn")?.addEventListener("click", () => showLocalLightboxImage(localLightboxIndex - 1));
    document.getElementById("localNextBtn")?.addEventListener("click", () => showLocalLightboxImage(localLightboxIndex + 1));
  }

  function showLocalLightboxImage(index) {
    if (!localLightboxUrls.length) return;

    localLightboxIndex = (index + localLightboxUrls.length) % localLightboxUrls.length;

    const img = document.getElementById("localLightboxImg");
    const counter = document.querySelector(".lightboxCounter");

    if (img) img.src = localLightboxUrls[localLightboxIndex];
    if (counter) counter.textContent = `Image ${localLightboxIndex + 1} / ${localLightboxUrls.length}`;
  }

  window.openLocalLightbox = openLocalLightbox;

  function buildResultsRow() {
    const m = resultSubmitData.match;
    const row = [
      m.league,
      formatReviewDate(m.date),
      m.homeTeam,
      m.awayTeam,
      m.homeScore,
      m.awayScore,
      m.result
    ];

    for (let i = 0; i < 10; i++) {
      const p = resultSubmitData.players[i];

      row.push(
        p?.name || "",
        p?.checkouts || "",
        p?.finesPence != null ? (p.finesPence / 100).toFixed(2) : "",
        p?.doubleFine ? "TRUE" : "FALSE",
        p?.oneEightys || "",
        p?.bulls || "",
        p?.tonOuts || ""
      );
    }

    row.push(
      "", // IMGFOLDER gets filled after Drive upload
      m.venue || "",
      m.cup ? "TRUE" : "FALSE",
      m.stage || ""
    );

    return row;
  }

  function hydrateMatchInfoDefaults() {
    const dateEl = document.getElementById("matchDate");
    if (dateEl && !dateEl.value) dateEl.value = todayInputValue();
  }

  function readMatchInfo() {
    resultSubmitData.match = {
      league: document.getElementById("matchLeague")?.value || "",
      homeTeam: document.getElementById("matchHomeTeam")?.value.trim() || "",
      awayTeam: document.getElementById("matchAwayTeam")?.value.trim() || "",
      homeScore: Number(document.getElementById("matchHomeScore")?.value || 0),
      awayScore: Number(document.getElementById("matchAwayScore")?.value || 0),
      result: document.getElementById("matchResult")?.value || "",
      date: document.getElementById("matchDate")?.value || "",
      venue: document.getElementById("matchVenue")?.value.trim() || "",
      imagesCount: selectedMatchImages.length,
      cup: document.getElementById("matchCup")?.checked || false,
      stage: document.getElementById("matchStage")?.value.trim() || "",
      onmSide
    };
  }

  function formatReviewDate(dateStr) {
    if (!dateStr) return "";

    const [part1, part2, part3] = String(dateStr).split(/[\/\-]/).map(Number);
    if (!part1 || !part2 || !part3) return dateStr;

    let d;

    // YYYY-MM-DD
    if (part1 > 1900) {
      d = new Date(part1, part2 - 1, part3);
    } else {
      // DD/MM/YYYY
      d = new Date(part3, part2 - 1, part1);
    }

    if (isNaN(d)) return dateStr;

    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function renderReviewResult() {
    const m = resultSubmitData.match;
    const reviewLeagueTitle = document.getElementById("reviewLeagueTitle");
    if (reviewLeagueTitle) reviewLeagueTitle.textContent = m.league || "";
    const resultClass = String(m.result || "").toLowerCase();

    const playersHtml = resultSubmitData.players.map(p => {
      const specials = [];

      if (p.oneEightys > 0) {
        specials.push(`<span class="badge badge-180">180${p.oneEightys > 1 ? `×${p.oneEightys}` : ""}</span>`);
      }

      if (p.bulls > 0) {
        specials.push(`<span class="badge badge-bull">Bull${p.bulls > 1 ? `×${p.bulls}` : ""}</span>`);
      }

      if (p.tonOuts > 0) {
        specials.push(`<span class="badge badge-ton">Ton+${p.tonOuts > 1 ? `×${p.tonOuts}` : ""}</span>`);
      }

      return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.checkouts === 0 ? "🥯" : p.checkouts}</td>
          <td class="${p.doubleFine ? "fine-highlight" : ""}">${fmtGBP(p.finesPence)}</td>
          <td>
            <div class="specials-container">
              ${specials.join("") || "-"}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    reviewImageUrls.forEach(url => URL.revokeObjectURL(url));
    reviewImageUrls = selectedMatchImages.map(file => URL.createObjectURL(file));
    const reviewImages = reviewImageUrls;
    const visibleImages = reviewImages.slice(0, 4);
    const extraCount = Math.max(0, reviewImages.length - visibleImages.length);

    const imageGrid = reviewImages.length
      ? `
        <div class="match-image-grid review-image-grid">
          ${visibleImages.map((src, i) => `
            <div class="${i === 3 && extraCount > 0 ? "image-count-overlay" : ""}"
                data-extra="${i === 3 && extraCount > 0 ? "+" + extraCount : ""}"
                onclick="openLocalLightbox(${i})">
              <img src="${src}" alt="Match image ${i + 1}">
            </div>
          `).join("")}
        </div>
      `
      : "";

    reviewResultBody.innerHTML = `
      <div class="result-card review-submit-card ${resultClass}">
        ${m.cup ? `
          <img src="https://cdn.jsdelivr.net/npm/lucide-static/icons/trophy.svg"
              alt="Cup Match"
              class="cup-icon"
              title="Cup Match">
        ` : ""}

        <div class="teams">
          <span class="team home">${escapeHtml(m.homeTeam)}</span>
          <span class="score">${m.homeScore} – ${m.awayScore}</span>
          <span class="team away">${escapeHtml(m.awayTeam)}</span>
        </div>

        <p class="date">${escapeHtml(formatReviewDate(m.date))}</p>

        <table class="player-table review-player-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Checkouts</th>
              <th>Fines</th>
              <th>Specials</th>
            </tr>
          </thead>
          <tbody>
            ${playersHtml}
          </tbody>
        </table>
        ${imageGrid}
        <div class="match-venue">
          <span class="venue-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 21s-6-5.33-6-10a6 6 0 0 1 12 0c0 4.67-6 10-6 10z"></path>
              <circle cx="12" cy="11" r="2"></circle>
            </svg>
          </span>
          <span>${escapeHtml(m.venue || "Venue TBA")}</span>
        </div>

        <span class="result-label">${escapeHtml(m.result)}</span>
      </div>
    `;
  }


  // Fines rules list (for modal)
  const finesListContent = `
  <div class="muted">Reference list of fines & specials</div>

  <h3><span class="pill">50p</span></h3>
  <ul>
    <li>Miss the board</li>
    <li>10 score or less</li>
    <li>Miscount double</li>
    <li>No bull attempt on 50</li>
    <li>Leave your partner an odd number</li>
    <li>Madhouse checked out</li>
  </ul>

  <h3><span class="pill">£1</span></h3>
  <ul>
    <li>5 score or less</li>
    <li>Madhouse not checked out</li>
    <li>Late (18:30+)</li>
  </ul>

  <h3><span class="pill">£2.50</span></h3>
  <ul>
    <li>Bagel (no checkouts)</li>
    <li>Late 15+ mins (18:45+)</li>
  </ul>

  <h3><span class="pill">£5</span></h3>
  <ul>
    <li>Forgot darts</li>
    <li>Not wearing team T-shirt</li>
    <li>Late 30+ mins (19:00+)</li>
  </ul>

  <h3><span class="pill">Specials</span></h3>
  <ul>
    <li>Score 180 - £1.80 everyone else</li>
    <li>Bull checkout - £2 everyone else</li>
    <li>Ton+ checkout - £1+ everyone else (eg 116 = £1.16)</li>
  </ul>

  <h3><span class="pill">Max Fines</span></h3>
  <ul>
    <li>£25 max in game fines</li>
    <li>£50 max after doubled</li>
  </ul>
`;

  // ---- Helpers ----
  const fmtGBP = (pence) => (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });

  function undoBatch(batchId) {
    if (!batchId) return;

    // Remove history entries with this batchId (usually last, but we'll scan safely)
    const remaining = [];
    const removed = [];

    for (const h of store.history) {
      if (h.batchId === batchId) removed.push(h);
      else remaining.push(h);
    }
    store.history = remaining;

    // Revert totals for removed entries
    removed.forEach(entry => {
      const current = store.totalsByName[entry.name] ?? 0;
      store.totalsByName[entry.name] = Math.max(0, current - entry.delta);
    });

    saveStore(store);
    syncPlayersFromStore();
  }

  function submitSpecialFlow() {
    if (selectedPlayerIndex === null) return;

    const selectedName = players[selectedPlayerIndex].name;
    const otherNames = players.filter((_, i) => i !== selectedPlayerIndex).map(p => p.name);

    // 180
    if (selectedSpecial === "S180") {
      const penceEach = 180;
      const list = otherNames.map(n => `<li>${escapeHtml(n)} — <b>${fmtGBP(penceEach)}</b></li>`).join("");
      openConfirmModal({
        title: "Confirm Special",
        bodyHtml: `
        <div style="font-weight:900; font-size:14px; margin-bottom:8px;">${escapeHtml(selectedName)} — 180 Scored</div>
        <div class="muted" style="margin-bottom:6px;">Fines for everyone else:</div>
        <ul>${list}</ul>
      `,
        onConfirm: () => {
          const { anyCapped } = applyFineToMany(otherNames, penceEach);
          incrementPlayerSpecial(selectedName, "oneEightys");
          if (anyCapped) showToast("Maximum fine amount reached");
          else showToast("Special applied");
          clearFineSelection();
        }
      });
      return;
    }

    // Bull-out
    if (selectedSpecial === "BULLOUT") {
      const penceEach = 200;
      const list = otherNames.map(n => `<li>${escapeHtml(n)} — <b>${fmtGBP(penceEach)}</b></li>`).join("");
      openConfirmModal({
        title: "Confirm Special",
        bodyHtml: `
        <div style="font-weight:900; font-size:14px; margin-bottom:8px;">${escapeHtml(selectedName)} — Bull-Out</div>
        <div class="muted" style="margin-bottom:6px;">Fines for everyone else:</div>
        <ul>${list}</ul>
      `,
        onConfirm: () => {
          const { anyCapped } = applyFineToMany(otherNames, penceEach);
          incrementPlayerSpecial(selectedName, "bulls");
          if (anyCapped) showToast("Maximum fine amount reached");
          else showToast("Special applied");
          clearFineSelection();
        }
      });
      return;
    }

    // Ton+ Out (same as your previous TONOUT flow)
    if (selectedSpecial === "TONOUT") {
      openConfirmModal({
        title: "Confirm Special",
        bodyHtml: `
        <div style="font-weight:900; font-size:14px; margin-bottom:8px;">${escapeHtml(selectedName)} — Ton+ Out</div>
        <div class="muted" style="margin-bottom:10px;">Enter checkout score (e.g. 116 → £1.16 each):</div>
        <input id="tonOutInput" type="text" inputmode="numeric"
          style="width:100%; height:44px; border-radius:12px; border:1px solid rgba(255,255,255,.12);
                 background: rgba(0,0,0,.22); color: var(--text); padding:0 12px; font-weight:900;"
          placeholder="Checkout score" />
        <div id="tonOutPreview" class="muted" style="margin-top:10px;"></div>
      `,
        onConfirm: () => {
          const input = document.getElementById("tonOutInput");
          const raw = (input?.value ?? "").trim();
          if (!/^\d{2,3}$/.test(raw)) {
            showToast("Enter a valid checkout (e.g. 116)");
            return;
          }
          const penceEach = Number(raw);
          const { anyCapped } = applyFineToMany(otherNames, penceEach);
          incrementPlayerSpecial(selectedName, "tonOuts");
          if (anyCapped) showToast("Maximum fine amount reached");
          else showToast(`Applied £${(penceEach / 100).toFixed(2)} to everyone else`);
          clearFineSelection();
        }
      });

      setTimeout(() => {
        const input = document.getElementById("tonOutInput");
        const preview = document.getElementById("tonOutPreview");
        if (!input || !preview) return;

        const update = () => {
          const raw = input.value.trim();
          if (!/^\d{2,3}$/.test(raw)) {
            preview.innerHTML = "";
            return;
          }
          const penceEach = Number(raw);
          const list = otherNames.map(n => `<li>${escapeHtml(n)} — <b>${fmtGBP(penceEach)}</b></li>`).join("");
          preview.innerHTML = `
          <div style="margin-bottom:6px;">Fines for everyone else:</div>
          <ul>${list}</ul>
        `;
        };

        input.addEventListener("input", update);
        input.focus();
      }, 0);

      return;
    }
  }

  function openSpecialsPicker() {
    if (selectedPlayerIndex === null) {
      showToast("Select a player first.");
      return;
    }

    let temp = null;

    const html = `
      <div class="muted" style="margin-bottom:10px;">Choose a special:</div>

      <div id="specialPickGrid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
        <div class="fineBox" id="pick180" style="height:44px; display:flex; align-items:center; justify-content:center; font-weight:900;">180</div>
        <div class="fineBox" id="pickBull" style="height:44px; display:flex; align-items:center; justify-content:center; font-weight:900;">Bull-Out</div>
        <div class="fineBox" id="pickTon"  style="height:44px; display:flex; align-items:center; justify-content:center; font-weight:900;">Ton+ Out</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:14px;">
        <button id="spBack" class="btn btnGhost" style="height:44px;">Back</button>
        <button id="spSubmit" class="btn btnDisabled" style="height:44px;" disabled>Submit</button>
      </div>
    `;


    // ✅ opening specials should deselect any preset/custom
    selectedFine = null;
    customValueText = "";

    // (optional) if you want it un-selected until they pick one:
    // selectedSpecial = null;

    renderFines();
    updateSubmitState();

    openModal("Specials", html);

    const setActive = (choiceId) => {
      temp = choiceId;

      // enable submit
      const submit = document.getElementById("spSubmit");
      submit.disabled = false;
      submit.className = "btn btnPrimary";

      // toggle yellow selected state like fine tiles
      ["pick180", "pickBull", "pickTon"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle("selected", id === choiceId);
      });
    };


    document.getElementById("pick180")?.addEventListener("click", () => setActive("pick180"));
    document.getElementById("pickBull")?.addEventListener("click", () => setActive("pickBull"));
    document.getElementById("pickTon")?.addEventListener("click", () => setActive("pickTon"));

    document.getElementById("spBack")?.addEventListener("click", () => closeModal());

    document.getElementById("spSubmit")?.addEventListener("click", () => {
      if (!temp) return;

      if (temp === "pick180") selectedSpecial = "S180";
      if (temp === "pickBull") selectedSpecial = "BULLOUT";
      if (temp === "pickTon") selectedSpecial = "TONOUT";

      selectedFine = null;

      specialsPickerOpen = false;   // <-- NEW
      renderFines();                // <-- NEW (keeps yellow border after selection)
      updateSubmitState();          // <-- NEW

      closeModal();
      submitSpecialFlow();
    });

  }

  function goBack() {
    const order = ["setup", "tracker", "results", "resultStats", "matchInfo", "reviewResult"];
    const i = order.indexOf(currentScreen);

    if (i > 0) {
      showScreen(order[i - 1]);
    }
  }

  function updateSpinButtons() {
    const hasWinner = !!doubleWinnerName;
    const label = hasWinner ? "Re-spin Double Fines" : "Spin for Double Fines";

    if (spinBtn) spinBtn.textContent = label;
  }

  function updateConfirmResultButton() {
    if (!confirmResultBtn) return;

    const hasWinner = !!doubleWinnerName;

    confirmResultBtn.textContent = hasWinner ? "Next" : "Skip";

    confirmResultBtn.disabled = false;
    confirmResultBtn.className = "btn btnPrimary";
  }

  function fmtGameDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `${date} • ${time}`;
  }

  function openResumeGameModal() {
    openModal("Resume game?", resumeModalHtml(store.game));

    document.getElementById("resumeGameBtn")?.addEventListener("click", () => {
      closeModal();
      restoreGameFromStore();
    });

    document.getElementById("resetSavedGameBtn")?.addEventListener("click", () => {
      closeModal();
      confirmResetGame();
    });
  }

  function resumeModalHtml(game) {
    const names = Array.isArray(game?.players) ? game.players : [];
    const m = game?.resultSubmitData?.match || {};

    const titleText =
      m.homeTeam && m.awayTeam
        ? `${escapeHtml(m.homeTeam)} vs ${escapeHtml(m.awayTeam)}`
        : "Resume Game";

    const rows = names.map(name => `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td>${fmtGBP(store.totalsByName?.[name] ?? 0)}</td>
    </tr>
  `).join("");

    return `
    <div class="result-card review-submit-card">

      <div style="font-weight:900; font-size:16px; margin-bottom:10px;">
        ${titleText}
      </div>

      <table class="player-table review-player-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Fines</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="row" style="margin-top:12px;">
        <button id="resetSavedGameBtn" class="btn btnGhost">Reset Game</button>
        <button id="resumeGameBtn" class="btn btnPrimary">Resume Game</button>
      </div>
    </div>
  `;
  }

  function goToPlayerStats() {
    renderResultStatsScreen();
    showScreen("resultStats");
    saveGameSnapshot();
  }

  function goToMatchInfo() {
    renderResultStatsScreen();
    hydrateMatchInfoDefaults();
    hydrateMatchInfoFromStore();
    showScreen("matchInfo");
    saveGameSnapshot();
  }

  function goToReviewResult() {
    readMatchInfo();
    renderReviewResult();
    showScreen("reviewResult");
    saveGameSnapshot();
  }

  function goToScreenFromSwitch(target) {
    if (!players.length && target !== "setup") {
      showToast("Start or resume a game first.");
      return;
    }

    if (target === "setup") {
      showScreen("setup");
      return;
    }

    if (target === "tracker") {
      showScreen("tracker");
      return;
    }

    if (target === "results") {
      syncPlayersFromStore();
      excludedFromWheel = new Set();
      renderResultsList();
      drawWheel(getWheelNames());
      updateSpinButtons();
      updateConfirmResultButton();
      showScreen("results");
      return;
    }

    if (target === "resultStats") {
      goToPlayerStats();
      return;
    }

    if (target === "matchInfo") {
      goToMatchInfo();
      return;
    }

    if (target === "reviewResult") {
      readMatchInfo();

      if (!resultSubmitData.match.awayTeam) {
        showToast("Add match info first.");
        goToMatchInfo();
        return;
      }

      goToReviewResult();
    }
  }

  function hydrateMatchInfoFromStore() {
    const m = resultSubmitData.match || {};

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) el.value = value;
    };

    set("matchLeague", m.league);
    set("matchHomeTeam", m.homeTeam);
    set("matchAwayTeam", m.awayTeam);
    set("matchHomeScore", m.homeScore);
    set("matchAwayScore", m.awayScore);
    set("matchResult", m.result);
    set("matchDate", m.date);
    set("matchVenue", m.venue);
    set("matchImageFolder", m.imageFolder);
    set("matchStage", m.stage);

    onmSide = m.onmSide || "home";
    onmHomeBtn?.classList.toggle("active", onmSide === "home");
    onmAwayBtn?.classList.toggle("active", onmSide === "away");
    homeAwayToggle?.classList.toggle("away", onmSide === "away");

    const cup = document.getElementById("matchCup");
    if (cup) cup.checked = !!m.cup;
    cupNoBtn?.classList.toggle("active", !m.cup);
    cupYesBtn?.classList.toggle("active", !!m.cup);
    cupToggle?.classList.toggle("away", !!m.cup);
  }

  function restoreGameFromStore() {
    const g = store.game;
    if (!g || !Array.isArray(g.players) || !g.players.length) return false;

    const targetScreen = g.screen || "tracker";

    players = g.players.map(name => ({
      name,
      totalPence: store.totalsByName?.[name] ?? 0
    }));

    selectedPlayerIndex =
      Number.isInteger(g.selectedPlayerIndex) ? g.selectedPlayerIndex : 0;

    excludedFromWheel = new Set(Array.isArray(g.excludedFromWheel) ? g.excludedFromWheel : []);

    resultSubmitData = g.resultSubmitData || { players: [], match: {} };

    doubleWinnerName = g.doubleWinnerName ?? null;
    doubleBatchId = g.doubleBatchId ?? null;
    doubleFromPence = Number.isInteger(g.doubleFromPence) ? g.doubleFromPence : null;
    doubleToPence = Number.isInteger(g.doubleToPence) ? g.doubleToPence : null;

    selectedFine = null;
    selectedSpecial = null;
    customValueText = "";

    showScreen(targetScreen);

    renderPlayers();
    renderFines();
    updateSubmitState();
    updateSpinButtons();
    updateConfirmResultButton();

    if (targetScreen === "results") {
      syncPlayersFromStore();
      renderResultsList();
      drawWheel(getWheelNames());
      updateSpinButtons();
      updateConfirmResultButton();
    }

    if (targetScreen === "final") {
      renderFinalList();
    }

    if (targetScreen === "resultStats") {
      renderResultStatsScreen();
    }

    if (targetScreen === "matchInfo") {
      renderResultStatsScreen();
      hydrateMatchInfoDefaults();
      hydrateMatchInfoFromStore();
    }

    if (targetScreen === "reviewResult") {
      hydrateMatchInfoFromStore();
      renderReviewResult();
    }

    return true;
  }

  function showScreen(screen) {
    currentScreen = screen;

    setupCard?.classList.toggle("hidden", screen !== "setup");
    trackerCard?.classList.toggle("hidden", screen !== "tracker");
    resultsCard?.classList.toggle("hidden", screen !== "results");
    finalCard?.classList.toggle("hidden", screen !== "final");
    resultStatsCard?.classList.toggle("hidden", screen !== "resultStats");
    matchInfoCard?.classList.toggle("hidden", screen !== "matchInfo");
    reviewResultCard?.classList.toggle("hidden", screen !== "reviewResult");

    const titles = {
      setup: "Players",
      tracker: "Fine Tracker",
      results: "Double Fines",
      final: "Match Result",
      resultStats: "Player Stats",
      matchInfo: "Match Info",
      reviewResult: "Result Submit"
    };

    if (screenTitleText) {
      screenTitleText.textContent = titles[screen] || "Fine Tracker";
    }

    const hasGame = players.length > 0;

    // Player screen: Submit Players for new game, Reset/Next for existing game
    startBtn?.classList.toggle("hidden", screen === "setup" && hasGame);
    setupGameActions?.classList.toggle("hidden", !(screen === "setup" && hasGame));

    if (setupNextBtn) {
      setupNextBtn.textContent = hasGame ? "Resume game" : "Next";
    }

    appHeader?.classList.remove("hiddenHeader");

    document.querySelectorAll(".screenSwitchBtn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.screenTarget === screen);
    });

    if (store.game) {
      store.game.screen = screen;
      store.game.updatedAt = nowIso();
      saveStore(store);
    }
    if (screen === "results") {
      syncPlayersFromStore();
      renderResultsList();
      drawWheel(getWheelNames());
      updateSpinButtons();
      updateConfirmResultButton();
    }
  }

  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove("show"), 1400);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Convert "1.75" => 175 pence, returns null if invalid
  function parseCustomToPence(value) {
    const s = String(value).trim().replaceAll("£", "");
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const pounds = Number(s);
    if (!Number.isFinite(pounds)) return null;
    return Math.round(pounds * 100);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { totalsByName: {}, history: [], game: null };

      const parsed = JSON.parse(raw);
      return {
        totalsByName: parsed?.totalsByName ?? {},
        history: Array.isArray(parsed?.history) ? parsed.history : [],
        game: parsed?.game ?? null,
        setupNames: Array.isArray(parsed?.setupNames) ? parsed.setupNames : []
      };
    } catch {
      return { totalsByName: {}, history: [], game: null, setupNames: [] };
    }
  }

  function saveStore(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }




  function getCurrentLeagueConfig() {
    const leagueName = (matchLeague?.value || "Trafalgar League").trim();
    return leagueTeamsData?.leagues?.[leagueName] || null;
  }

  function getLeagueTeamNames() {
    const league = getCurrentLeagueConfig();
    const teams = league?.teams?.map(t => t.name) || [];
    return teams;
  }

  function populateLeagueTeamSuggestions() {
    if (!leagueTeamsList) return;

    leagueTeamsList.replaceChildren();

    getLeagueTeamNames().forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      leagueTeamsList.appendChild(opt);
    });

    console.log("Dropdown league:", matchLeague.value, getLeagueTeamNames());
  }

  function getTeamVenue(teamName) {
    if (teamName === "Oche Ness Monsters") return "The Horseshoe";

    const league = getCurrentLeagueConfig();
    if (!league) return "";

    const team = league.teams.find(t =>
      t.name.toLowerCase() === String(teamName || "").trim().toLowerCase()
    );

    return team?.venue || "";
  }

  function updateVenueFromHomeTeam() {
    matchVenue.value = getTeamVenue(matchHomeTeam.value) || "";
  }

  function updateScoreAutofill(changedSide) {
    const league = getCurrentLeagueConfig();
    if (!league || matchCup?.checked) return;

    const totalLegs = Number(league.legs || 0);
    if (!totalLegs) return;

    if (changedSide === "home") {
      if (matchHomeScore.value === "") {
        matchAwayScore.value = "";
        readMatchInfo();
        saveGameSnapshot();
        return;
      }

      const home = Number(matchHomeScore.value);
      matchAwayScore.value = Math.max(0, totalLegs - home);
    }

    if (changedSide === "away") {
      if (matchAwayScore.value === "") {
        matchHomeScore.value = "";
        readMatchInfo();
        saveGameSnapshot();
        return;
      }

      const away = Number(matchAwayScore.value);
      matchHomeScore.value = Math.max(0, totalLegs - away);
    }

    updateResultFromScore();
    readMatchInfo();
    saveGameSnapshot();
  }

  function updateResultFromScore() {
    const resultEl = document.getElementById("matchResult");
    if (!resultEl || matchHomeScore.value === "" || matchAwayScore.value === "") return;

    const home = Number(matchHomeScore.value);
    const away = Number(matchAwayScore.value);

    const onmScore = onmSide === "home" ? home : away;
    const oppScore = onmSide === "home" ? away : home;

    resultEl.value = onmScore > oppScore ? "Won" : "Lost";
  }

  function setDefaultLeague() {
    if (matchLeague && !matchLeague.value) {
      matchLeague.value = "Trafalgar League";
    }

    if (matchHomeTeam && !matchHomeTeam.value) {
      matchHomeTeam.value = "Oche Ness Monsters";
    }

    if (matchAwayTeam && matchAwayTeam.value === "Oche Ness Monsters") {
      matchAwayTeam.value = "";
    }

    onmSide = "home";
    onmHomeBtn?.classList.add("active");
    onmAwayBtn?.classList.remove("active");
    homeAwayToggle?.classList.remove("away");
  }

  function autofillFixtureForDate(dateValue = matchDate?.value) {
    if (!dateValue || !leagueTeamsData?.fixtures?.length) return;

    const fixture = leagueTeamsData.fixtures.find(f => f.date === dateValue);
    if (!fixture) return;

    matchLeague.value = fixture.league;
    matchHomeTeam.value = fixture.homeTeam;
    matchAwayTeam.value = fixture.awayTeam;

    onmSide = fixture.homeTeam === "Oche Ness Monsters" ? "home" : "away";

    onmHomeBtn?.classList.toggle("active", onmSide === "home");
    onmAwayBtn?.classList.toggle("active", onmSide === "away");
    homeAwayToggle?.classList.toggle("away", onmSide === "away");

    populateLeagueTeamSuggestions();
    updateVenueFromHomeTeam();
    readMatchInfo();
    saveGameSnapshot();
  }

  function applyHomeAwaySide(side = onmSide) {
    if (side === onmSide) return;

    const oldHome = matchHomeTeam.value.trim();
    const oldAway = matchAwayTeam.value.trim();

    onmSide = side;

    onmHomeBtn?.classList.toggle("active", side === "home");
    onmAwayBtn?.classList.toggle("active", side === "away");
    homeAwayToggle?.classList.toggle("away", side === "away");

    if (side === "home") {
      matchHomeTeam.value = "Oche Ness Monsters";
      matchAwayTeam.value = oldHome && oldHome !== "Oche Ness Monsters" ? oldHome : "";
    } else {
      matchAwayTeam.value = "Oche Ness Monsters";
      matchHomeTeam.value = oldAway && oldAway !== "Oche Ness Monsters" ? oldAway : "";
    }

    populateLeagueTeamSuggestions();
    updateVenueFromHomeTeam();
    updateResultFromScore();
    readMatchInfo();
    saveGameSnapshot();
  }

  function applyTeamChange() {
    updateVenueFromHomeTeam();
    readMatchInfo();
    saveGameSnapshot();
  }

  function makeDatalistShowAll(input) {
    let previousValue = "";

    input?.addEventListener("mousedown", () => {
      previousValue = input.value;
      input.value = "";
    });

    input?.addEventListener("blur", () => {
      if (!input.value) input.value = previousValue;
    });
  }

  makeDatalistShowAll(matchHomeTeam);
  makeDatalistShowAll(matchAwayTeam);

  matchLeague?.addEventListener("change", () => {
    populateLeagueTeamSuggestions();

    matchHomeTeam.value = onmSide === "home" ? "Oche Ness Monsters" : "";
    matchAwayTeam.value = onmSide === "away" ? "Oche Ness Monsters" : "";

    matchHomeScore.value = "";
    matchAwayScore.value = "";

    updateVenueFromHomeTeam();
    readMatchInfo();
    saveGameSnapshot();
  });

  onmHomeBtn?.addEventListener("click", () => applyHomeAwaySide("home"));
  onmAwayBtn?.addEventListener("click", () => applyHomeAwaySide("away"));

  matchHomeTeam?.addEventListener("change", applyTeamChange);
  matchAwayTeam?.addEventListener("change", applyTeamChange);

  matchHomeScore?.addEventListener("input", () => updateScoreAutofill("home"));
  matchAwayScore?.addEventListener("input", () => updateScoreAutofill("away"));

  matchCup?.addEventListener("change", () => {
    readMatchInfo();
    saveGameSnapshot();
  });

  [matchHomeScore, matchAwayScore].forEach(el => {
    el?.addEventListener("focus", () => {
      el.value = "";
    });

    el?.addEventListener("blur", () => {
      if (el.value !== "") el.value = String(Number(el.value));
    });
  });

  setDefaultLeague();

  submitFineBtn?.addEventListener("click", () => {
    if (selectedPlayerIndex === null) return;

    // If a special was chosen via the Specials modal, run that flow
    if (selectedSpecial) {
      submitSpecialFlow();
      return;
    }

    // Otherwise do normal fines
    const selectedName = players[selectedPlayerIndex].name;

    let penceToAdd = null;
    if (selectedFine === "CUSTOM") penceToAdd = parseCustomToPence(customValueText);
    else penceToAdd = selectedFine;

    if (!Number.isInteger(penceToAdd) || penceToAdd <= 0) {
      showToast("Enter a valid fine amount.");
      updateSubmitState();
      return;
    }

    const res = applyFine(selectedName, penceToAdd, nowIso());
    if (res.capped) showToast("Maximum fine amount reached");
    else showToast(`Added ${fmtGBP(res.appliedPence)} to ${selectedName}`);

    clearFineSelection();
  });

  function makeBatchId() {
    return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }


  function renderSetupInputs() {
    const existingValues = [];

    for (let i = 1; i <= playerInputCount; i++) {
      existingValues[i] =
        document.getElementById(`p${i}`)?.value ||
        store.setupNames?.[i - 1] ||
        "";
    }

    setupGrid.innerHTML = "";

    for (let i = 1; i <= playerInputCount; i++) {
      const row = document.createElement("div");
      row.className = "nameRow";
      row.innerHTML = `
      <input type="text" id="p${i}" placeholder="Player ${i} name" maxlength="18" value="${escapeHtml(existingValues[i] || store.setupNames?.[i - 1] || "")}" />
    `;
      setupGrid.appendChild(row);
      const input = row.querySelector("input");
      input?.addEventListener("input", () => {
        const names = [];

        for (let j = 1; j <= playerInputCount; j++) {
          const val = document.getElementById(`p${j}`)?.value || "";
          names.push(val);
        }

        store.setupNames = names;
        saveStore(store);

        if (players.length) {
          applySetupNamesToGame({ silent: true });
        }
      });
    }

    if (addPlayerBtn) addPlayerBtn.disabled = playerInputCount >= MAX_PLAYERS;
    if (removePlayerBtn) removePlayerBtn.disabled = playerInputCount <= MIN_PLAYERS;
  }

  function saveSetupNamesToStore() {
    const setupNames = [];

    for (let i = 1; i <= playerInputCount; i++) {
      const value = document.getElementById(`p${i}`)?.value.trim() || "";
      setupNames.push(value);
    }

    store.setupNames = setupNames;
    saveStore(store);
  }

  function applySetupNamesToGame({ silent = false } = {}) {
    const names = [];

    for (let i = 1; i <= playerInputCount; i++) {
      const value = document.getElementById(`p${i}`)?.value.trim();
      if (value) names.push(value);
    }

    if (!names.length) {
      if (!silent) showToast("Add at least 1 player name.");
      return false;
    }

    const oldPlayers = [...players];

    players = names.map((name, index) => {
      const old = oldPlayers[index];
      const oldName = old?.name;

      if (oldName && oldName !== name) {
        store.totalsByName[name] = store.totalsByName[oldName] ?? 0;
        delete store.totalsByName[oldName];

        store.history.forEach(h => {
          if (h.name === oldName) h.name = name;
        });

        resultSubmitData.players.forEach(p => {
          if (p.name === oldName) p.name = name;
        });

        if (doubleWinnerName === oldName) doubleWinnerName = name;
      }

      return {
        name,
        totalPence: store.totalsByName[name] ?? old?.totalPence ?? 0
      };
    });

    saveSetupNamesToStore();
    saveGameSnapshot();
    syncPlayersFromStore();

    return true;
  }



  function updateResumeButtonVisibility() {
    const hasSavedGame = Array.isArray(store.game?.players) && store.game.players.length > 0;
    resumeGameBtnInline?.classList.toggle("hidden", !hasSavedGame);
  }

  updateResumeButtonVisibility();

  resumeGameBtnInline?.addEventListener("click", () => {
    if (!store.game?.players?.length) {
      showToast("No saved game found.");
      return;
    }

    openModal("Resume game?", resumeModalHtml(store.game));

    const resumeBtn = document.getElementById("resumeGameBtn");
    const resetBtn2 = document.getElementById("resetSavedGameBtn");

    resumeBtn?.addEventListener("click", () => {
      closeModal();
      const ok = restoreGameFromStore();
      if (!ok) showToast("Couldn't restore game.");
    });

    resetBtn2?.addEventListener("click", () => {
      openConfirmModal({
        title: "Reset saved game",
        bodyHtml: `<div>Are you sure you want to reset this saved game?</div>
                 <div class="muted" style="margin-top:6px;">
                 This will clear players, totals and history.</div>`,
        confirmText: "Yes, reset",
        cancelText: "Cancel",
        onConfirm: () => {
          hardResetAll();
          showToast("Saved game cleared");
        }

      });
    });
  });


  let players = [];        // { name, totalPence }
  let selectedPlayerIndex = null;
  let selectedFine = null; // number pence OR "CUSTOM"
  let excludedFromWheel = new Set(); // names excluded from spinner
  let doubleWinnerName = null;       // name who got doubled
  let doubleBatchId = null;
  let doubleFromPence = null;
  let doubleToPence = null;

  let currentScreen = "setup"; // "setup" | "tracker" | "results" | "final"

  function hardResetAll() {
    store = { totalsByName: {}, history: [], game: null, setupNames: [] };
    saveStore(store);

    players = [];
    excludedFromWheel = new Set();
    selectedPlayerIndex = null;
    selectedFine = null;
    selectedSpecial = null;
    customValueText = "";

    doubleWinnerName = null;
    doubleBatchId = null;
    doubleFromPence = null;
    doubleToPence = null;

    resultSubmitData = {
      players: [],
      match: {}
    };

    selectedMatchImages = [];
    reviewImageUrls.forEach(url => URL.revokeObjectURL(url));
    reviewImageUrls = [];

    localLightboxUrls.forEach(url => URL.revokeObjectURL(url));
    localLightboxUrls = [];
    localLightboxIndex = 0;

    onmSide = "home";

    playerInputCount = DEFAULT_PLAYER_INPUTS;
    renderSetupInputs();
    for (let i = 1; i <= playerInputCount; i++) {
      const input = document.getElementById(`p${i}`);
      if (input) input.value = "";
    }

    [
      "matchHomeTeam",
      "matchAwayTeam",
      "matchHomeScore",
      "matchAwayScore",
      "matchVenue",
      "matchStage",
      "matchDate"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    if (matchLeague) matchLeague.value = "Trafalgar League";
    if (document.getElementById("matchResult")) {
      document.getElementById("matchResult").value = "Won";
    }

    if (matchCup) matchCup.checked = false;

    onmHomeBtn?.classList.add("active");
    onmAwayBtn?.classList.remove("active");
    homeAwayToggle?.classList.remove("away");

    cupNoBtn?.classList.add("active");
    cupYesBtn?.classList.remove("active");
    cupToggle?.classList.remove("away");

    if (imageText) imageText.textContent = "📷 Add images";

    if (resultStatsList) resultStatsList.innerHTML = "";
    if (reviewResultBody) reviewResultBody.innerHTML = "";
    if (reviewLeagueTitle) reviewLeagueTitle.textContent = "";
    if (resultsList) resultsList.innerHTML = "";
    if (finalList) finalList.innerHTML = "";

    wheelAngle = 0;

    updateResumeButtonVisibility();
    updateSpinButtons();
    updateConfirmResultButton();
    renderFines();
    updateSubmitState();

    closeModal?.();
    showScreen("setup");
  }


  function saveGameSnapshot() {
    // ✅ If there is no active game, remove any old saved snapshot
    if (!players || !players.length) {
      store.game = null;
      saveStore(store);
      return;
    }

    store.game = {
      createdAt: store.game?.createdAt || nowIso(),
      updatedAt: nowIso(),
      screen: currentScreen,
      players: players.map(p => p.name),
      selectedPlayerIndex: selectedPlayerIndex ?? 0,
      excludedFromWheel: Array.from(excludedFromWheel || []),

      // Persist double-fines context
      doubleWinnerName: doubleWinnerName ?? null,
      doubleBatchId: doubleBatchId ?? null,
      doubleFromPence: doubleFromPence ?? null,
      doubleToPence: doubleToPence ?? null,

      resultSubmitData
    };

    saveStore(store);
  }




  // ---- Rendering ----
  function renderPlayers() {
    playersGrid.innerHTML = "";
    players.forEach((p, idx) => {
      const isWinner = (p.name === doubleWinnerName);

      const box = document.createElement("div");
      box.className =
        "playerBox" +
        (idx === selectedPlayerIndex ? " selected" : "") +
        (isWinner ? " winner" : "");

      box.innerHTML = `
      <div class="playerName">${escapeHtml(p.name)}</div>
      <div class="playerTotal"><strong>${fmtGBP(p.totalPence)}</strong></div>

    `;

      box.addEventListener("click", () => {
        selectedPlayerIndex = idx;
        renderPlayers();
        updateSubmitState();
      });

      playersGrid.appendChild(box);
    });
  }


  function renderFines() {
    fineGrid.innerHTML = "";

    // 1) Normal preset buttons
    fineOptions.forEach((opt) => {
      const isCustom = opt.pence === null;
      if (isCustom) return;

      const isSelected = opt.pence === selectedFine;

      const box = document.createElement("div");
      box.className = "fineBox" + (isSelected ? " selected" : "");
      box.textContent = opt.label;

      box.addEventListener("click", () => {
        selectedFine = opt.pence;
        selectedSpecial = null;
        customValueText = "";            // optional: clears custom when picking preset
        renderFines();                   // ✅ re-render so other selections clear
        updateSubmitState();
      });

      fineGrid.appendChild(box);
    });

    // 2) Custom box
    const customSelected = selectedFine === "CUSTOM";

    const customBox = document.createElement("div");
    customBox.className = "fineBox custom" + (customSelected ? " selected" : "");
    customBox.innerHTML = `
  <div style="font-weight:900;">Custom</div>
  <input id="inlineCustomInput" type="text" inputmode="decimal"
    placeholder="£" value="${escapeHtml(customValueText)}" />
`;

    fineGrid.appendChild(customBox);

    const input = customBox.querySelector("#inlineCustomInput");

    const selectCustomOnce = () => {
      // Only do work if we’re not already on custom
      if (selectedFine !== "CUSTOM") {
        selectedFine = "CUSTOM";
        selectedSpecial = null;

        // Re-render ONCE so the yellow selected style applies
        renderFines();
        updateSubmitState();

        // Refocus new input after re-render
        setTimeout(() => document.getElementById("inlineCustomInput")?.focus(), 0);
        return;
      }

      // If already selected, just ensure submit state is updated
      updateSubmitState();
    };

    // Click anywhere on the custom box selects custom and focuses input
    customBox.addEventListener("click", (e) => {
      // If user clicked directly in the input, don't trigger an extra re-render here
      if (e.target?.id === "inlineCustomInput") return;
      selectCustomOnce();
      setTimeout(() => document.getElementById("inlineCustomInput")?.focus(), 0);
    });

    // If user taps into the input, select custom (but ONLY re-render if not already selected)
    input.addEventListener("focus", selectCustomOnce);
    input.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent bubbling to box click (double fire)
      selectCustomOnce();
    });

    // Typing should NEVER re-render, or it will “fight” the user
    input.addEventListener("input", () => {
      customValueText = input.value;
      updateSubmitState();
    });



    // 3) Specials launcher button
    const specialsSelected = specialsPickerOpen; // ONLY highlight while picker is open

    const specialsBox = document.createElement("div");
    specialsBox.className = "fineBox" + (specialsSelected ? " selected" : "");
    specialsBox.textContent = "Specials";

    specialsBox.addEventListener("click", () => {
      // show highlight immediately behind the modal
      specialsPickerOpen = true;

      // deselect presets/custom when opening specials
      selectedFine = null;
      customValueText = "";

      renderFines();
      updateSubmitState();

      openSpecialsPicker();
    });

    fineGrid.appendChild(specialsBox);

  }




  function updateSubmitState() {
    const hasPlayer = selectedPlayerIndex !== null;

    // specials need a player selected
    if (selectedSpecial) {
      const enabled = hasPlayer;
      submitFineBtn.disabled = !enabled;
      submitFineBtn.className = "btn " + (enabled ? "btnPrimary" : "btnDisabled");
      return;
    }

    // otherwise normal fine selection
    let fineOk = false;

    if (selectedFine === "CUSTOM") {
      const p = parseCustomToPence(customValueText);
      fineOk = p !== null && p > 0;
    } else {
      fineOk = Number.isInteger(selectedFine) && selectedFine > 0;
    }

    const enabled = hasPlayer && fineOk;
    submitFineBtn.disabled = !enabled;
    submitFineBtn.className = "btn " + (enabled ? "btnPrimary" : "btnDisabled");
  }


  function clearFineSelection() {
    selectedFine = null;
    selectedSpecial = null;
    customValueText = "";
    renderFines();

    updateSubmitState();
  }

  function applyFineToMany(names, penceEach, batchId) {
    let anyCapped = false;

    names.forEach(n => {
      const res = applyFine(n, penceEach, nowIso(), batchId);
      if (res.capped) anyCapped = true;
    });

    return { anyCapped };
  }


  // ---- Apply fine with cap ----
  function applyFine(playerName, penceToAdd, timestampIso, batchId = null) {
    const current = store.totalsByName[playerName] ?? 0;

    // Winner can go up to £50 AFTER doubling; everyone else is capped at £25
    const cap = (playerName === doubleWinnerName)
      ? MAX_AFTER_DOUBLE_PENCE
      : MAX_BEFORE_DOUBLE_PENCE;

    const attempted = current + penceToAdd;

    let applied = penceToAdd;
    let capped = false;

    if (attempted >= cap) {
      applied = Math.max(0, cap - current);
      capped = true;
    }

    // Update totals
    store.totalsByName[playerName] = Math.min(cap, attempted);

    if (applied > 0) {
      store.history.push({
        t: timestampIso,
        name: playerName,
        delta: applied,
        batchId: batchId || null
      });
    }

    saveGameSnapshot();
    saveStore(store);
    syncPlayersFromStore();

    return { appliedPence: applied, capped };
  }


  function syncPlayersFromStore() {
    players = players.map(p => ({
      ...p,
      totalPence: store.totalsByName[p.name] ?? 0
    }));
    renderPlayers();
  }

  // ---- Undo ----
  function undoLastFine() {
    if (!store.history.length) {
      showToast("Nothing to undo.");
      return;
    }

    const last = store.history[store.history.length - 1];
    const batchId = last.batchId;

    // If part of a batch, undo ALL entries with that batchId
    let toUndo = [];
    if (batchId) {
      while (store.history.length && store.history[store.history.length - 1].batchId === batchId) {
        toUndo.push(store.history.pop());
      }
    } else {
      toUndo.push(store.history.pop());
    }

    // Revert totals
    toUndo.forEach(entry => {
      const current = store.totalsByName[entry.name] ?? 0;
      store.totalsByName[entry.name] = Math.max(0, current - entry.delta);
    });

    saveStore(store);
    syncPlayersFromStore();

    if (batchId) showToast("Undid special");
    else showToast(`Undid ${fmtGBP(toUndo[0].delta)} from ${toUndo[0].name}`);
  }

  modalBody?.addEventListener("touchmove", (e) => {
    e.stopPropagation();
  }, { passive: true });

  // ---- Modal ----
  function openModal(title, bodyHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;

    modalOverlay.classList.remove("hidden");
    modalOverlay.setAttribute("aria-hidden", "false");

    // ✅ lock page behind
    document.body.classList.add("modal-open");

    // ✅ ensure scroll starts at top
    modalBody.scrollTop = 0;
  }

  function closeModal() {
    // ✅ If we are closing the Specials picker, remove the yellow highlight behind it
    if (modalTitle?.textContent === "Specials") {
      specialsPickerOpen = false;
      // renderFines() will remove the yellow border behind the modal
      renderFines();
      updateSubmitState();
    }

    modalOverlay.classList.add("hidden");
    modalOverlay.setAttribute("aria-hidden", "true");
    modalBody.innerHTML = "";

    document.body.classList.remove("modal-open");
  }

  function renderImageSummary() {
    const count = selectedMatchImages.length;

    if (imageText) {
      imageText.textContent = count === 0
        ? "📷 Add images"
        : `📷 ${count} image${count === 1 ? "" : "s"}`;
    }

    resultSubmitData.match.imagesCount = count;
    readMatchInfo();
    saveGameSnapshot();
  }

  function openImagesModal() {
    const thumbs = selectedMatchImages.map((file, index) => {
      const url = URL.createObjectURL(file);

      return `
      <div class="imageThumb">
        <img src="${url}" alt="">
        <button type="button" class="removeImageBtn" data-index="${index}">×</button>
      </div>
    `;
    }).join("");

    openModal("Match Images", `
    <div class="imageModalActions">
      <button id="chooseImagesBtn" type="button" class="btn btnPrimary">
        ${selectedMatchImages.length ? "Add more" : "Choose images"}
      </button>
      <button id="doneImagesBtn" type="button" class="btn btnGhost">Done</button>
    </div>

    <div class="imageThumbGrid">
      ${thumbs || `<div class="muted">No images selected yet.</div>`}
    </div>
  `);

    document.getElementById("chooseImagesBtn")?.addEventListener("click", () => {
      const grid = modalBody.querySelector(".imageThumbGrid");
      if (grid && selectedMatchImages.length === 0) {
        grid.innerHTML = `<div class="muted">Opening image picker...</div>`;
      }
      matchImageInput?.click();
    });

    document.getElementById("doneImagesBtn")?.addEventListener("click", closeModal);

    modalBody.querySelectorAll(".removeImageBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.index);
        selectedMatchImages.splice(index, 1);
        renderImageSummary();
        openImagesModal();
      });
    });
  }

  const openImagesBox = document.getElementById("openImagesBox");

  openImagesBox?.addEventListener("click", openImagesModal);

  openImagesBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openImagesModal();
  });

  matchImageInput?.addEventListener("change", () => {
    const newFiles = Array.from(matchImageInput.files || []);
    const remainingSlots = MAX_MATCH_IMAGES - selectedMatchImages.length;

    if (remainingSlots <= 0) {
      showToast("Maximum 30 images.");
      matchImageInput.value = "";
      return;
    }

    selectedMatchImages = [
      ...selectedMatchImages,
      ...newFiles.slice(0, remainingSlots)
    ];

    if (newFiles.length > remainingSlots) {
      showToast("Maximum 30 images.");
    }

    matchImageInput.value = "";
    renderImageSummary();
    openImagesModal();
  });



  function openConfirmModal({ title, bodyHtml, confirmText = "Confirm", cancelText = "Cancel", onConfirm }) {
    const html = `
    <div>${bodyHtml}</div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button id="modalCancelBtn" class="btn btnGhost" style="height:44px;">${cancelText}</button>
      <button id="modalConfirmBtn" class="btn btnPrimary" style="height:44px;">${confirmText}</button>
    </div>
  `;
    openModal(title, html);

    const cancelBtn = document.getElementById("modalCancelBtn");
    const confirmBtn = document.getElementById("modalConfirmBtn");

    cancelBtn.addEventListener("click", () => closeModal());
    confirmBtn.addEventListener("click", async () => {
      try {
        await onConfirm?.();
      } finally {
        closeModal();
      }
    });
  }


  function historyHtml() {
    if (!store.history.length) {
      return `<div class="muted">No fines yet.</div>`;
    }

    // latest first
    const items = [...store.history].slice().reverse().map(entry => {
      const dt = new Date(entry.t);
      const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return `<div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,.08);">
      <div style="font-weight:900;">${escapeHtml(entry.name)} <span class="muted" style="font-weight:700;">+ ${fmtGBP(entry.delta)}</span></div>
      <div class="muted">${time}</div>
    </div>`;
    }).join("");

    return `<div class="muted" style="margin-bottom:6px;">Latest first</div>${items}`;
  }



  startBtn.addEventListener("click", () => {
    const names = [];
    for (let i = 1; i <= playerInputCount; i++) {
      const v = document.getElementById(`p${i}`)?.value.trim();
      if (v) names.push(v);
    }
    if (names.length === 0) {
      showToast("Add at least 1 player name.");
      return;
    }

    saveSetupNamesToStore();

    // de-dupe (case-insensitive) by suffixing
    const seen = new Map();
    players = names.map((n) => {
      const key = n.toLowerCase();
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      const finalName = count > 1 ? `${n} (${count})` : n;
      return { name: finalName, totalPence: 0 };
    });

    // ✅ NEW GAME: force these players to start at £0
    players.forEach(p => {
      store.totalsByName[p.name] = 0;
    });

    // Optional but recommended: clear history too so Undo/History are for this game only
    store.history = [];

    // Mark a fresh game snapshot
    store.game = {
      createdAt: nowIso(),
      updatedAt: nowIso(),
      screen: "tracker",
      players: players.map(p => p.name),
      selectedPlayerIndex: 0,
      excludedFromWheel: [],
      doubleWinnerName: null,
      doubleBatchId: null,
      doubleFromPence: null,
      doubleToPence: null
    };

    saveStore(store);
    updateResumeButtonVisibility();



    selectedPlayerIndex = 0;
    selectedFine = null;
    selectedSpecial = null;

    saveGameSnapshot();
    showScreen("tracker");
    syncPlayersFromStore();
    renderFines();

    updateSubmitState();
    showToast("Players added!");



  });




  undoBtn?.addEventListener("click", () => {
    undoLastFine();
    updateSubmitState();
    updateConfirmResultButton();
    updateSpinButtons();
  });

  function confirmResetGame() {
    openConfirmModal({
      title: "Reset game",
      bodyHtml: `<div>Are you sure you want to reset?</div>
              <div class="muted" style="margin-top:6px;">
              This will clear players, totals, stats, match info and images.</div>`,
      confirmText: "Yes, reset",
      cancelText: "Cancel",
      onConfirm: () => {
        hardResetAll();
        showToast("Reset.");
      }
    });
  }

  resetBtn?.addEventListener("click", confirmResetGame);
  setupResetBtn?.addEventListener("click", confirmResetGame);
  resetGameBtn?.addEventListener("click", confirmResetGame);

  let wheelAngle = 0;
  let wheelSpinning = false;

  function drawWheel(labels) {
    if (!wheelCanvas) return;
    const ctx = wheelCanvas.getContext("2d");
    if (!ctx) return; // <- add this guard
    const w = wheelCanvas.width;
    const h = wheelCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 6;

    ctx.clearRect(0, 0, w, h);

    const n = Math.max(1, labels.length);
    const arc = (Math.PI * 2) / n;

    // palette (no hard requirement; simple pleasant set)
    const colors = ["#ff9800", "#00e3ff", "#4caf50", "#f48aae", "#fbfbfb", "#9c27b0", "#03a9f4", "#ffeb3b"];

    for (let i = 0; i < n; i++) {
      const start = wheelAngle + i * arc;
      const end = start + arc;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      // text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = (colors[i % colors.length] === "#fbfbfb") ? "#111" : "#111";
      ctx.font = "bold 16px system-ui";
      ctx.fillText(labels[i], r - 14, 6);
      ctx.restore();
    }

    // center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function pickWinnerIndex(labels) {
    const n = labels.length;
    const arc = (Math.PI * 2) / n;

    // ✅ Pointer at TOP (12 o’clock)
    const pointerAngle = (Math.PI * 3) / 2; // same as -Math.PI/2

    let a = (pointerAngle - wheelAngle) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;

    return Math.floor(a / arc);
  }



  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function spinWheel(labels, onDone) {
    if (wheelSpinning) return;

    // Hard guard: must have a canvas + ctx
    if (!wheelCanvas) {
      console.error("wheelCanvas missing");
      showToast("Wheel not ready");
      return;
    }
    const ctx = wheelCanvas.getContext("2d");
    if (!ctx) {
      console.error("No 2D context available");
      showToast("Wheel not supported");
      return;
    }

    wheelSpinning = true;
    spinBtn.disabled = true;
    spinBtn.className = "btn btnDisabled";

    const start = performance.now();
    const duration = 3800;
    const spins = 6 + Math.random() * 4;
    const finalOffset = Math.random() * Math.PI * 2;
    const startAngle = wheelAngle;
    const targetAngle = startAngle + spins * Math.PI * 2 + finalOffset;

    const safeFail = (err) => {
      console.error("Spin failed:", err);
      wheelSpinning = false;
      spinBtn.disabled = false;
      spinBtn.className = "btn btnPrimary";
      showToast("Spin failed (check console)");
    };

    const tick = (now) => {
      try {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(t);
        wheelAngle = startAngle + (targetAngle - startAngle) * eased;

        drawWheel(labels); // if this throws, we'll recover

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          wheelSpinning = false;
          spinBtn.disabled = false;
          spinBtn.className = "btn btnPrimary";

          const winnerIdx = pickWinnerIndex(labels);
          onDone?.(winnerIdx);
        }
      } catch (e) {
        safeFail(e);
      }
    };

    saveGameSnapshot();
    requestAnimationFrame(tick);
  }


  function openWinnerPopup(name, fromPence, toPence) {
    if (!winnerOverlay || !winnerNameEl || !winnerAmountEl || !winnerMathEl) {
      console.warn("Winner popup DOM missing", { winnerOverlay, winnerNameEl, winnerAmountEl, winnerMathEl });
      showToast(`${name} doubled to ${fmtGBP(toPence)}`);
      return;
    }

    winnerOverlay.classList.remove("hidden");
    winnerOverlay.setAttribute("aria-hidden", "false");
    winnerNameEl.textContent = `${name}!`;

    // Math line (same styling as your resultMath/toRed)
    winnerMathEl.innerHTML = `
    <span>${fmtGBP(fromPence)} × 2 =</span>
    <span class="toRed">${fmtGBP(toPence)}</span>
  `;

    // Big number animation (same as you had)
    const start = performance.now();
    const dur = 900;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(fromPence + (toPence - fromPence) * eased);
      winnerAmountEl.textContent = fmtGBP(v);
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }




  function closeWinnerPopup() {
    winnerOverlay.classList.add("hidden");
    winnerOverlay.setAttribute("aria-hidden", "true");
  }

  closeWinnerBtn?.addEventListener("click", closeWinnerPopup);
  winnerOverlay?.addEventListener("click", (e) => {
    if (e.target === winnerOverlay) closeWinnerPopup();
  });



  spinBtn?.addEventListener("click", () => {
    const labels = getWheelNames();
    if (labels.length < 2) {
      showToast("Need at least 2 players on the wheel.");
      return;
    }

    // If already have a winner, undo their doubling first (re-spin behavior)
    if (doubleBatchId) {
      undoBatch(doubleBatchId);
      doubleWinnerName = null;
      doubleBatchId = null;
      doubleFromPence = null;
      doubleToPence = null;
    }

    spinWheel(labels, (winnerIdx) => {
      const winnerName = labels[winnerIdx];

      const current = store.totalsByName[winnerName] ?? 0;
      const doubled = Math.min(MAX_AFTER_DOUBLE_PENCE, current * 2);
      const delta = doubled - current;

      doubleWinnerName = winnerName;
      doubleFromPence = current;
      doubleToPence = doubled;
      updateConfirmResultButton();


      if (delta > 0) {
        const batchId = makeBatchId();
        doubleBatchId = batchId;

        store.totalsByName[winnerName] = doubled;
        store.history.push({ t: nowIso(), name: winnerName, delta, batchId });
        saveStore(store);
      } else {
        // already at cap or 0
        doubleBatchId = null;
      }

      saveGameSnapshot();
      syncPlayersFromStore();
      renderResultsList();
      updateSpinButtons();

      openWinnerPopup(winnerName, current, doubled);

      if (winnerContinueBtn) {
        winnerContinueBtn.onclick = () => {
          closeWinnerPopup();
          goToPlayerStats();
        };
      }


      if (doubled >= MAX_AFTER_DOUBLE_PENCE) showToast("Maximum fine amount reached");
    });
  });

  finalBackBtn?.addEventListener("click", goBack);

  resultStatsBackBtn?.addEventListener("click", goBack);

  matchInfoBackBtn?.addEventListener("click", goBack);

  resultStatsNextBtn?.addEventListener("click", goToMatchInfo);

  resultStatsSubmitBtn?.addEventListener("click", () => {
    readMatchInfo();
    goToReviewResult();
  });


  matchInfoNextBtn?.addEventListener("click", goToReviewResult);

  setupNextBtn?.addEventListener("click", () => {
    if (!applySetupNamesToGame()) return;
    showScreen("tracker");
  });

  fineBackBtn?.addEventListener("click", goBack);
  fineNextBtn?.addEventListener("click", () => goToScreenFromSwitch("results"));


  addPlayerBtn?.addEventListener("click", () => {
    if (playerInputCount >= MAX_PLAYERS) return;
    playerInputCount++;
    renderSetupInputs();
    document.getElementById(`p${playerInputCount}`)?.focus();
  });

  removePlayerBtn?.addEventListener("click", () => {
    if (playerInputCount <= MIN_PLAYERS) return;
    playerInputCount--;
    renderSetupInputs();
  });

  screenSwitch?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-screen-target]");
    if (!btn) return;

    goToScreenFromSwitch(btn.dataset.screenTarget);
  });

  if (!continueResultSubmitBtn) {
    console.error("Missing button: #continueResultSubmitBtn");
  } else {
    continueResultSubmitBtn.addEventListener("click", () => {
      renderResultStatsScreen();
      showScreen("resultStats");
    });
  }

  matchDate?.addEventListener("change", () => {
    autofillFixtureForDate(matchDate.value);
  });

  reviewBackBtn?.addEventListener("click", goBack);

  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const base64 = String(reader.result).split(",")[1];

        resolve({
          name: file.name,
          mimeType: file.type,
          base64
        });
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function shareStoryImage() {
    const frame = document.getElementById("storyFrame");
    if (!frame) return;

    const canvas = await html2canvas(frame, {
      backgroundColor: "#0f1115",
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    canvas.toBlob(async (blob) => {
      const file = new File([blob], "onm-result.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "ONM Result"
        });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "onm-result.png";
        link.click();
      }
    }, "image/png");
  }

  function showSubmittedActions() {
    reviewSubmitBtn.classList.add("hidden");

    const actions = document.getElementById("submittedActions");
    if (actions) actions.classList.remove("hidden");
  }

  reviewSubmitBtn?.addEventListener("click", async () => {
    try {
      reviewSubmitBtn.disabled = true;
      reviewSubmitBtn.textContent = "Confirming...";

      openModal("Confirm result", `
      <div class="loading-results">
        <div class="spinner"></div>
        <p>Uploading result and images...</p>
      </div>
    `);

      readMatchInfo();

      const images = await Promise.all(
        selectedMatchImages.map(fileToBase64)
      );

      const payload = {
        match: resultSubmitData.match,
        players: resultSubmitData.players,
        images
      };

      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Submit failed");
      }

      openModal("Result submitted", `
      <div class="muted">✅ Result saved successfully.</div>
    `);

      showSubmittedActions();

    } catch (err) {
      console.error(err);
      openModal("Submit failed", `
      <div class="muted">Something went wrong. Check the console for details.</div>
    `);
    } finally {
      reviewSubmitBtn.disabled = false;
      reviewSubmitBtn.textContent = "Confirm Result";
    }
  });

  document.getElementById("resetAfterSubmitBtn")?.addEventListener("click", () => {
    hardResetAll();
  });

  document.getElementById("shareResultBtn")?.addEventListener("click", () => {
    const cleanShareHtml = reviewResultBody.innerHTML
      .replaceAll(/onclick="openLocalLightbox\(\d+\)"/g, "")
      .replaceAll(/image-count-overlay/g, "")
      .replaceAll(/data-extra="[^"]*"/g, "");

    const temp = document.createElement("div");
    temp.innerHTML = cleanShareHtml;

    temp.querySelectorAll(".match-image-grid img").forEach(img => {
      const src = img.src;
      const wrapper = img.parentElement;

      wrapper.innerHTML = "";
      wrapper.style.backgroundImage = `url("${src}")`;
      wrapper.style.backgroundSize = "cover";
      wrapper.style.backgroundPosition = "center";
      wrapper.style.backgroundRepeat = "no-repeat";
    });

    openModal("Share Result", `
    <div class="storyFrame" id="storyFrame">
      <div class="fixturesTitle">
        ${escapeHtml(resultSubmitData.match.league || "")}
      </div>

      ${temp.innerHTML}
    </div>

    <button id="shareImageBtn" type="button" class="btn btnPrimary" style="margin-top:12px;">
      Share image
    </button>
  `);

    setTimeout(() => {
      document.getElementById("shareImageBtn")?.addEventListener("click", shareStoryImage);
    }, 0);
  });


  function getWheelNames() {
    return players
      .map(p => p.name)
      .filter(name => !excludedFromWheel.has(name));
  }


  function renderResultsList() {
    if (!resultsList) return;

    resultsList.innerHTML = players.map((p) => {
      const excluded = excludedFromWheel.has(p.name);
      const isWinner = (p.name === doubleWinnerName);

      return `
      <div class="playerBox ${excluded ? "resultExcluded" : ""} ${isWinner ? "resultWinner" : ""}"
           data-name="${escapeHtml(p.name)}"
           role="button"
           aria-pressed="${excluded ? "true" : "false"}">
        <div class="playerName">${escapeHtml(p.name)}</div>
        <div class="playerTotal"><strong>${fmtGBP(p.totalPence)}</strong></div>
      </div>
    `;
    }).join("");

    resultsList.querySelectorAll(".playerBox").forEach((box) => {
      box.addEventListener("click", () => {
        const name = box.getAttribute("data-name");
        if (!name) return;

        if (excludedFromWheel.has(name)) excludedFromWheel.delete(name);
        else excludedFromWheel.add(name);

        renderResultsList();
        drawWheel(getWheelNames());
      });
    });
  }





  function renderFinalList() {
    finalList.innerHTML = players.map(p => {
      const isWinner = (p.name === doubleWinnerName && doubleFromPence !== null && doubleToPence !== null);

      const amountHtml = isWinner
        ? `<div class="resultMath">
           <span>${fmtGBP(doubleFromPence)} x 2 =</span>
           <span class="toRed">${fmtGBP(doubleToPence)}</span>
         </div>`
        : `<div class="amt">${fmtGBP(p.totalPence)}</div>`;

      return `
      <div class="resultRow">
        <div class="name">${escapeHtml(p.name)}</div>
        ${amountHtml}
      </div>
    `;
    }).join("");
  }

  wheelBackBtn?.addEventListener("click", goBack);

  confirmResultBtn?.addEventListener("click", () => {
    // If skipped, just continue normally
    syncPlayersFromStore();
    goToPlayerStats();
  });

  matchInfoStatsBtn?.addEventListener("click", () => {
    readMatchInfo();
    saveGameSnapshot();
    goToPlayerStats();
  });


  openHistoryBtn?.addEventListener("click", () => {
    openModal("History", historyHtml());
  });

  openFinesBtn?.addEventListener("click", () => {
    openModal("Fines list", finesListContent);
  });

  closeModalBtn?.addEventListener("click", closeModal);

  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });


  loadLeagueTeamsData().then(() => {
    setDefaultLeague();
    populateLeagueTeamSuggestions();
    updateVenueFromHomeTeam();
  });

  renderSetupInputs();
  updateSpinButtons();
  renderFines();
  updateSubmitState();

  if (store.game?.players?.length) {
    openResumeGameModal();
  } else {
    showScreen("setup");
  }
});