console.log("✅ fines.js loaded");


document.addEventListener("DOMContentLoaded", () => {
  // ---- Constants ----
  const STORAGE_KEY = "darts_fines_tracker_v1";
  const MAX_BEFORE_DOUBLE_PENCE = 2500; // £25
  const MAX_AFTER_DOUBLE_PENCE = 5000; // £50


  const fineOptions = [
    { label: "50p", pence: 50 },
    { label: "£1", pence: 100 },
    { label: "£2.50", pence: 250 },
    { label: "£5", pence: 500 },
    { label: "Custom", pence: null }
  ];

  let customValueText = "";

  const specials = [
    { key: "180", label: "180", type: "S180" },
    { key: "BULL", label: "Bull-Out", type: "BULLOUT" },
    { key: "TON", label: "Ton+ Out", type: "TONOUT" }
  ];

  let selectedSpecial = null; // "S180" | "BULLOUT" | "TONOUT" | null
  let specialsPickerOpen = false; // <-- NEW: purely for UI highlight while modal is open


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



  function updateSpinButtons() {
    const hasWinner = !!doubleWinnerName;
    const label = hasWinner ? "Re-spin Double Fines" : "Spin for Double Fines";

    if (spinBtn) spinBtn.textContent = label;
  }

  function updateConfirmResultButton() {
    const enabled = !!doubleWinnerName;
    if (!confirmResultBtn) return;

    confirmResultBtn.disabled = !enabled;
    confirmResultBtn.className = "btn " + (enabled ? "btnPrimary" : "btnDisabled");
  }

  function fmtGameDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `${date} • ${time}`;
  }

  function resumeModalHtml(game) {
    const created = fmtGameDate(game?.createdAt);
    const updated = fmtGameDate(game?.updatedAt);

    const names = Array.isArray(game?.players) ? game.players : [];
    const rows = names.map(n => {
      const total = store.totalsByName?.[n] ?? 0;
      return `
      <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="font-weight:900;">${escapeHtml(n)}</div>
        <div style="font-weight:900;">${fmtGBP(total)}</div>
      </div>
    `;
    }).join("");

    return `
    <div class="muted" style="margin-bottom:10px;">
      A saved game was found.
    </div>

    <div style="margin-bottom:10px;">
      <div><b>Started:</b> ${escapeHtml(created || "Unknown")}</div>
      <div class="muted" style="margin-top:4px;"><b>Last updated:</b> ${escapeHtml(updated || "Unknown")}</div>
    </div>

    <div style="margin-top:10px; font-weight:900;">Players</div>
    <div style="margin-top:6px;">
      ${rows || `<div class="muted">No players found.</div>`}
    </div>

    <div style="display:flex; gap:10px; margin-top:14px;">
      <button id="resumeGameBtn" class="btn btnPrimary" style="height:44px;">Continue game</button>
      <button id="resetSavedGameBtn" class="btn btnGhost" style="height:44px;">Reset game</button>
    </div>
  `;
  }

  function restoreGameFromStore() {
    const g = store.game;
    if (!g || !Array.isArray(g.players) || !g.players.length) return false;

    // Restore players + totals
    players = g.players.map(name => ({
      name,
      totalPence: store.totalsByName?.[name] ?? 0
    }));

    selectedPlayerIndex =
      Number.isInteger(g.selectedPlayerIndex) ? g.selectedPlayerIndex : 0;

    excludedFromWheel = new Set(Array.isArray(g.excludedFromWheel) ? g.excludedFromWheel : []);

    // ✅ Restore double-fines context
    doubleWinnerName = g.doubleWinnerName ?? null;
    doubleBatchId = g.doubleBatchId ?? null;
    doubleFromPence = Number.isInteger(g.doubleFromPence) ? g.doubleFromPence : null;
    doubleToPence = Number.isInteger(g.doubleToPence) ? g.doubleToPence : null;

    // Clear transient UI selections
    selectedFine = null;
    selectedSpecial = null;
    customValueText = "";

    // Restore screen
    const targetScreen = g.screen || "tracker";
    showScreen(targetScreen);

    // Re-render base UI
    renderPlayers();
    renderFines();
    updateSubmitState();
    updateSpinButtons();
    updateConfirmResultButton();

    // Restore screen-specific UI
    if (targetScreen === "results") {
      renderResultsList();
      drawWheel(getWheelNames());
    }

    if (targetScreen === "final") {
      renderFinalList();
    }

    return true;
  }


  const doubleTitle = document.getElementById("doubleTitle");

  function showScreen(screen) {
    currentScreen = screen;

    setupCard.classList.toggle("hidden", screen !== "setup");
    trackerCard.classList.toggle("hidden", screen !== "tracker");
    resultsCard.classList.toggle("hidden", screen !== "results");
    finalCard.classList.toggle("hidden", screen !== "final");

    // Header visibility logic
    const headerShouldShow = (screen === "setup" || screen === "tracker");
    appHeader?.classList.toggle("hiddenHeader", !headerShouldShow);

    if (screen === "tracker") headerActions?.classList.remove("hidden");
    else headerActions?.classList.add("hidden");

    // ✅ NEW — Double fines header visibility
    if (doubleHeader) {
      const show = (screen === "results");
      doubleHeader.classList.toggle("hidden", !show);
    }

    // Persist current screen
    store.game = store.game || {};
    store.game.screen = screen;
    store.game.updatedAt = nowIso();
    saveStore(store);
  }


  function resumeGameFromStore() {
    const g = store.game;
    if (!g || !Array.isArray(g.players) || g.players.length === 0) return false;

    // Restore core state
    players = g.players.map(name => ({
      name,
      totalPence: store.totalsByName[name] ?? 0
    }));

    selectedPlayerIndex =
      Number.isInteger(g.selectedPlayerIndex) ? g.selectedPlayerIndex : 0;

    excludedFromWheel = new Set(Array.isArray(g.excludedFromWheel) ? g.excludedFromWheel : []);
    doubleWinnerName = g.doubleWinnerName ?? null;
    doubleBatchId = g.doubleBatchId ?? null;
    doubleFromPence = Number.isInteger(g.doubleFromPence) ? g.doubleFromPence : null;
    doubleToPence = Number.isInteger(g.doubleToPence) ? g.doubleToPence : null;

    // Clear any half-selected fine UI state (safer UX)
    selectedFine = null;
    selectedSpecial = null;
    customValueText = "";

    // Move UI to the right screen
    const targetScreen = g.screen || "tracker";
    showScreen(targetScreen);

    // Re-render everything for that screen
    renderPlayers();
    renderFines();

    updateSubmitState();

    // If resuming results/final, rebuild those UIs too
    if (targetScreen === "results") {
      renderResultsList();
      drawWheel(getWheelNames());
      updateSpinButtons();
      updateConfirmResultButton();
    }
    if (targetScreen === "final") {
      renderFinalList();
      updateSpinButtons();
    }

    return true;
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
        game: parsed?.game ?? null
      };
    } catch {
      return { totalsByName: {}, history: [], game: null };
    }
  }

  function saveStore(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }


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
  const openDoubleInfoBtn = document.getElementById("openDoubleInfoBtn");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const closeModalBtn = document.getElementById("closeModalBtn");

  const specialsGrid = document.getElementById("specialsGrid");
  const headerActions = document.getElementById("headerActions");

  const resultsCard = document.getElementById("resultsCard");
  const resultsList = document.getElementById("resultsList");
  const submitResultBtn = document.getElementById("submitResultBtn");
  const backToGameBtn = document.getElementById("backToGameBtn");
  const spinBtn = document.getElementById("spinBtn");
  const wheelCanvas = document.getElementById("wheelCanvas");
  const wheelWinner = document.getElementById("wheelWinner");

  const appHeader = document.getElementById("appHeader");
  const doubleHeader = document.getElementById("doubleHeader");


  const finalCard = document.getElementById("finalCard");
  const finalList = document.getElementById("finalList");

  const resumeGameBtnInline = document.getElementById("resumeGameBtnInline");


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





  // ---- Setup screen inputs ----
  for (let i = 1; i <= 6; i++) {
    const row = document.createElement("div");
    row.className = "nameRow";
    row.innerHTML = `<input type="text" id="p${i}" placeholder="Player ${i} name" maxlength="18" />`;
    setupGrid.appendChild(row);
  }

  // ---- State ----
  let store = loadStore(); // { totalsByName, history }

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



  // ✅ If we have a saved game snapshot but no in-memory players (fresh reload),
  // show a resume popup.
  if (store.game?.players?.length) {
    // Only show this if we're currently on setup (i.e., page reset)
    // Your initial UI is setup by default.
    openModal("Resume game?", resumeModalHtml(store.game));

    const resumeBtn = document.getElementById("resumeGameBtn");
    const resetBtn2 = document.getElementById("resetSavedGameBtn");

    resumeBtn?.addEventListener("click", () => {
      closeModal();
      const ok = restoreGameFromStore();
      if (!ok) showToast("Couldn't restore game.");
    });


    resetBtn2?.addEventListener("click", () => {
      // confirmation like your existing reset
      openConfirmModal({
        title: "Reset saved game",
        bodyHtml: `<div>Are you sure you want to reset this saved game?</div><div class="muted" style="margin-top:6px;">This will clear players, totals and history.</div>`,
        confirmText: "Yes, reset",
        cancelText: "Cancel",
        onConfirm: () => {
          hardResetAll();
          showToast("Reset.");
        }
      });
    });
  }



  let players = [];        // { name, totalPence }
  let selectedPlayerIndex = null;
  let selectedFine = null; // number pence OR "CUSTOM"
  let excludedFromWheel = new Set(); // names excluded from spinner
  let doubleWinnerName = null;       // name who got doubled
  let doubleBatchId = null;
  let doubleFromPence = null;
  let doubleToPence = null;

  let currentScreen = "setup"; // "setup" | "tracker" | "results" | "final"

  function hardResetAll({ clearNameInputs = true } = {}) {
    // clear storage
    store = { totalsByName: {}, history: [], game: null };
    saveStore(store);

    // wipe in-memory state
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

    // clear inputs on setup screen
    if (clearNameInputs) {
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById(`p${i}`);
        if (el) el.value = "";
      }
    }

    // UI
    updateResumeButtonVisibility();
    updateConfirmResultButton?.();
    wheelAngle = 0;

    closeModal?.();       // harmless if modal not open
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
      doubleToPence: doubleToPence ?? null
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
    for (let i = 1; i <= 6; i++) {
      const v = document.getElementById(`p${i}`).value.trim();
      if (v) names.push(v);
    }
    if (names.length === 0) {
      showToast("Add at least 1 player name.");
      return;
    }

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




  undoBtn.addEventListener("click", () => {
    undoLastFine();
    doubleWinnerName = null;

    // keep selected player as-is
    updateSubmitState();
  });

  resetBtn.addEventListener("click", () => {
    openConfirmModal({
      title: "Reset game",
      bodyHtml: `<div>Are you sure you want to reset?</div><div class="muted" style="margin-top:6px;">You may lose your current screen progress.</div>`,
      confirmText: "Yes, reset",
      cancelText: "Cancel",
      onConfirm: () => {
        hardResetAll();
        showToast("Reset.");
      }

    });
  });

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
          renderFinalList();
          updateSpinButtons();
          showScreen("final");
        };
      }


      if (doubled >= MAX_TOTAL_PENCE) showToast("Maximum fine amount reached");
    });
  });

  finalBackBtn?.addEventListener("click", () => {
    // Go back to the Double Fines screen
    renderResultsList();
    drawWheel(getWheelNames());
    updateSpinButtons();
    updateConfirmResultButton();
    showScreen("results");
  });


  resetGameBtn?.addEventListener("click", () => {
    if (doubleBatchId) undoBatch(doubleBatchId);
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

  wheelBackBtn?.addEventListener("click", () => {
    // IMPORTANT: do NOT clear doubleWinnerName / batch etc.
    // Just go back and show highlight.
    syncPlayersFromStore();  // ensures totals are current
    showScreen("tracker");
  });

  confirmResultBtn?.addEventListener("click", () => {
    if (!doubleWinnerName) return; // safety
    syncPlayersFromStore();
    renderFinalList();
    showScreen("final");
  });

  submitResultBtn?.addEventListener("click", () => {
    syncPlayersFromStore();

    // don't wipe winner here; user might come back to respin from final, but usually OK either way.
    // If you prefer always fresh: uncomment next 3 lines:
    // doubleWinnerName = null; doubleBatchId = null; doubleFromPence = null; doubleToPence = null;

    excludedFromWheel = new Set();

    syncPlayersFromStore();
    renderResultsList();
    drawWheel(getWheelNames());
    updateSpinButtons();
    updateConfirmResultButton();
    showScreen("results");
  });

  backToGameBtn?.addEventListener("click", () => {
    showScreen("tracker");
  });

  openHistoryBtn?.addEventListener("click", () => {
    openModal("History", historyHtml());
  });

  openFinesBtn?.addEventListener("click", () => {
    openModal("Fines list", finesListContent);
  });

  openDoubleInfoBtn?.addEventListener("click", () => {
    openModal("Info", `
      <div class="muted" style="line-height:1.35;">
        Spin the wheel to select a player for double fines.<br/>
        Tap a player to exclude them from the wheel spinner.
      </div>
    `);
  });

  closeModalBtn?.addEventListener("click", closeModal);

  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });




  // Initial fine render
  updateSpinButtons();
  renderFines();

  updateSubmitState();
});

document.getElementById("headerActions")
document.getElementById("openHistoryBtn")
document.getElementById("openFinesBtn")
