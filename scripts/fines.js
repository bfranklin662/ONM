console.log("✅ fines.js loaded");


document.addEventListener("DOMContentLoaded", () => {
  // ---- Constants ----
  const STORAGE_KEY = "darts_fines_tracker_v1";
  const MAX_TOTAL_PENCE = 2500; // £25 cap

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
    <li>Late 10 mins (18:40)</li>
  </ul>

  <h3><span class="pill">£2.50</span></h3>
  <ul>
    <li>Bagel (no checkouts)</li>
    <li>Late 30 mins (19:00)</li>
  </ul>

  <h3><span class="pill">£5</span></h3>
  <ul>
    <li>Forgot darts</li>
    <li>Not wearing team T-shirt</li>
    <li>Late, game has started (19:15 ish)</li>
  </ul>

  <h3><span class="pill">Specials</span></h3>
  <ul>
    <li>Score 180 - £1.80 everyone else</li>
    <li>Bull checkout - £2 everyone else</li>
    <li>Ton+ checkout - £1+ everyone else (eg 116 = £1.16)</li>
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


  function renderSpecials() {
    specialsGrid.innerHTML = "";
    specials.forEach(s => {
      const box = document.createElement("div");
      box.className = "specialBox" + (selectedSpecial === s.type ? " selected" : "");
      box.textContent = s.label;
      box.addEventListener("click", () => {
        selectedSpecial = (selectedSpecial === s.type) ? null : s.type;
        // when selecting a special, clear normal fine selection
        selectedFine = null;
        renderFines();
        renderSpecials();
        updateSubmitState();
      });
      specialsGrid.appendChild(box);
    });
  }

  function makeBatchId() {
    return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function showScreen(screen) {
    // screen: "setup" | "tracker" | "results" | "final"
    setupCard.classList.toggle("hidden", screen !== "setup");
    trackerCard.classList.toggle("hidden", screen !== "tracker");
    resultsCard.classList.toggle("hidden", screen !== "results");
    finalCard.classList.toggle("hidden", screen !== "final");

    // Header visible only during setup/tracker
    const headerShouldShow = (screen === "setup" || screen === "tracker");
    appHeader?.classList.toggle("hiddenHeader", !headerShouldShow);

    // Header actions only make sense on tracker (optional)
    if (screen === "tracker") headerActions?.classList.remove("hidden");
    else headerActions?.classList.add("hidden");
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
      if (!raw) return { totalsByName: {}, history: [] };
      const parsed = JSON.parse(raw);
      return {
        totalsByName: parsed?.totalsByName ?? {},
        history: Array.isArray(parsed?.history) ? parsed.history : []
      };
    } catch {
      return { totalsByName: {}, history: [] };
    }
  }

  function saveStore(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // ---- DOM ----
  const setupGrid = document.getElementById("setupGrid");
  const setupCard = document.getElementById("setupCard");
  const trackerCard = document.getElementById("trackerCard");

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
  const submitResultBtn = document.getElementById("submitResultBtn");
  const backToGameBtn = document.getElementById("backToGameBtn");
  const spinBtn = document.getElementById("spinBtn");
  const wheelCanvas = document.getElementById("wheelCanvas");
  const wheelWinner = document.getElementById("wheelWinner");

  const appHeader = document.getElementById("appHeader");

  const finalCard = document.getElementById("finalCard");
  const finalList = document.getElementById("finalList");

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






  // ---- Setup screen inputs ----
  for (let i = 1; i <= 6; i++) {
    const row = document.createElement("div");
    row.className = "nameRow";
    row.innerHTML = `<input type="text" id="p${i}" placeholder="Player ${i} name" maxlength="18" />`;
    setupGrid.appendChild(row);
  }

  // ---- State ----
  let store = loadStore(); // { totalsByName, history }
  let players = [];        // { name, totalPence }
  let selectedPlayerIndex = null;
  let selectedFine = null; // number pence OR "CUSTOM"
  let excludedFromWheel = new Set(); // names excluded from spinner
  let doubleWinnerName = null;       // name who got doubled
  let doubleBatchId = null;
  let doubleFromPence = null;
  let doubleToPence = null;



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
      <div class="playerTotal">Total:<strong>${fmtGBP(p.totalPence)}</strong></div>
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

    fineOptions.forEach((opt) => {
      const isCustom = opt.pence === null;

      if (!isCustom) {
        const isSelected = opt.pence === selectedFine;

        const box = document.createElement("div");
        box.className = "fineBox" + (isSelected ? " selected" : "");
        box.textContent = opt.label;

        box.addEventListener("click", () => {
          selectedFine = opt.pence;
          selectedSpecial = null;        // selecting normal fine clears specials
          renderFines();
          renderSpecials();
          updateSubmitState();
        });

        fineGrid.appendChild(box);
        return;
      }

      // Custom box with inline input
      const customSelected = selectedFine === "CUSTOM";

      const customBox = document.createElement("div");
      customBox.className = "fineBox custom" + (customSelected ? " selected" : "");
      customBox.innerHTML = `
      <div style="font-weight:900;">Custom</div>
      <input id="inlineCustomInput" type="text" inputmode="decimal" placeholder="£" value="${escapeHtml(customValueText)}" />
    `;

      customBox.addEventListener("click", (e) => {
        // allow clicking anywhere to select, but don't steal typing
        selectedFine = "CUSTOM";
        selectedSpecial = null;
        renderSpecials();
        updateSubmitState();

        const input = customBox.querySelector("#inlineCustomInput");
        if (e.target !== input) input.focus();
      });

      // attach input handler after insert
      fineGrid.appendChild(customBox);

      const input = customBox.querySelector("#inlineCustomInput");
      input.addEventListener("focus", () => {
        selectedFine = "CUSTOM";
        selectedSpecial = null;
        renderSpecials();
        updateSubmitState();
        customBox.classList.add("selected");
      });

      input.addEventListener("input", () => {
        customValueText = input.value;
        updateSubmitState();
      });

      input.addEventListener("click", () => {
        selectedFine = "CUSTOM";
        selectedSpecial = null;
        updateSubmitState();
      });
    });
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
    renderSpecials();
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
    const attempted = current + penceToAdd;

    let applied = penceToAdd;
    let capped = false;

    if (attempted >= MAX_TOTAL_PENCE) {
      applied = Math.max(0, MAX_TOTAL_PENCE - current);
      capped = true;
    }

    // Update totals
    store.totalsByName[playerName] = Math.min(MAX_TOTAL_PENCE, attempted);

    // Log only if anything was actually applied
    if (applied > 0) {
      store.history.push({
        t: timestampIso,
        name: playerName,
        delta: applied,
        batchId: batchId || null
      });
    }

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


  // ---- Modal ----
  function openModal(title, bodyHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.remove("hidden");
    modalOverlay.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modalOverlay.classList.add("hidden");
    modalOverlay.setAttribute("aria-hidden", "true");
    modalBody.innerHTML = "";
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
      return { name: finalName, totalPence: store.totalsByName[finalName] ?? 0 };
    });

    selectedPlayerIndex = 0;
    selectedFine = null;
    selectedSpecial = null;

    showScreen("tracker");
    syncPlayersFromStore();
    renderFines();
    renderSpecials();
    updateSubmitState();
    showToast("Players added!");



  });

  submitFineBtn.addEventListener("click", () => {
    if (selectedPlayerIndex === null) return;

    const selectedName = players[selectedPlayerIndex].name;
    const otherNames = players.filter((_, i) => i !== selectedPlayerIndex).map(p => p.name);

    // --- Specials ---
    if (selectedSpecial === "S180") {
      const penceEach = 180; // £1.80
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
          // keep player selected, clear amount/special
          clearFineSelection();
        }
      });
      return;
    }

    if (selectedSpecial === "BULLOUT") {
      const penceEach = 200; // £2.00
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
            // keep modal open by throwing (openConfirmModal closes in finally, so we must stop close)
            // easiest: just reopen by returning early and not applying:
            return;
          }
          const score = Number(raw);
          const penceEach = score; // 116 -> £1.16
          const { anyCapped } = applyFineToMany(otherNames, penceEach);
          if (anyCapped) showToast("Maximum fine amount reached");
          else showToast(`Applied £${(penceEach / 100).toFixed(2)} to everyone else`);
          clearFineSelection();
        }
      });

      // live preview inside modal
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

    // --- Normal fine ---
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

    clearFineSelection(); // keeps player selected as-is
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
        // wipe saved data
        store = { totalsByName: {}, history: [] };
        saveStore(store);

        // wipe in-memory game state
        players = [];
        selectedPlayerIndex = null;
        selectedFine = null;
        selectedSpecial = null;
        customValueText = "";

        for (let i = 1; i <= 6; i++) {
          const el = document.getElementById(`p${i}`);
          if (el) el.value = "";
        }

        trackerCard.classList.add("hidden");
        setupCard.classList.remove("hidden");

        // hide top-right buttons on setup screen
        headerActions?.classList.add("hidden");

        showToast("Reset.");
        showScreen("setup");

      }

    });
  });

  let wheelAngle = 0;
  let wheelSpinning = false;

  function drawWheel(labels) {
    if (!wheelCanvas) return;
    const ctx = wheelCanvas.getContext("2d");
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
    // Pointer is at the top (12 o’clock). We need the segment under that pointer.
    const n = labels.length;
    const arc = (Math.PI * 2) / n;

    // Angle at top is -90deg (or 3π/2). Compute relative to wheelAngle.
    const pointerAngle = (Math.PI * 3) / 2;

    // Normalize wheelAngle
    let a = (pointerAngle - wheelAngle) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;

    const idx = Math.floor(a / arc);
    return idx; // 0..n-1
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function spinWheel(labels, onDone) {
    if (wheelSpinning) return;
    wheelSpinning = true;
    spinBtn.disabled = true;
    spinBtn.className = "btn btnDisabled";

    const start = performance.now();
    const duration = 3800; // ms
    const spins = 6 + Math.random() * 4; // 6-10 spins
    const finalOffset = Math.random() * Math.PI * 2;
    const startAngle = wheelAngle;
    const targetAngle = startAngle + spins * Math.PI * 2 + finalOffset;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      wheelAngle = startAngle + (targetAngle - startAngle) * eased;

      drawWheel(labels);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        wheelSpinning = false;
        spinBtn.disabled = false;
        spinBtn.className = "btn btnPrimary";

        const winnerIdx = pickWinnerIndex(labels);
        onDone?.(winnerIdx);
      }
    };

    requestAnimationFrame(tick);
  }

  function openWinnerPopup(name, fromPence, toPence) {
    winnerOverlay.classList.remove("hidden");
    winnerOverlay.setAttribute("aria-hidden", "false");
    winnerNameEl.textContent = `${name}!`;

    // Count-up animation
    const start = performance.now();
    const dur = 900;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOut
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
      const doubled = Math.min(MAX_TOTAL_PENCE, current * 2);
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

      syncPlayersFromStore();
      renderResultsList();
      updateSpinButtons();

      openWinnerPopup(winnerName, current, doubled);

      winnerContinueBtn.onclick = () => {
        closeWinnerPopup();
        renderFinalList();
        updateSpinButtons();
        showScreen("final");
      };

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
    // Undo any double-fine batch first
    if (doubleBatchId) undoBatch(doubleBatchId);

    // Fully clear storage
    store = { totalsByName: {}, history: [] };
    saveStore(store);

    // Reset all in-memory state
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

    updateConfirmResultButton();


    // Clear name inputs
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(`p${i}`);
      if (el) el.value = "";
    }

    // Reset wheel
    wheelAngle = 0;

    // Go back to setup screen
    showScreen("setup");

    showToast("Game reset");
  });





  function getWheelNames() {
    return players
      .map(p => p.name)
      .filter(name => !excludedFromWheel.has(name));
  }


  function renderResultsList() {
    resultsList.innerHTML = players.map(p => {
      const excluded = excludedFromWheel.has(p.name);
      const isWinner = (p.name === doubleWinnerName && doubleFromPence !== null && doubleToPence !== null);

      const amountHtml = isWinner
        ? `<div class="resultMath">
           <span>${fmtGBP(doubleFromPence)} x 2 =</span>
           <span class="toRed">${fmtGBP(doubleToPence)}</span>
         </div>`
        : `<div class="amt">${fmtGBP(p.totalPence)}</div>`;

      return `
      <div class="resultRow ${excluded ? "excluded" : ""}" data-name="${escapeHtml(p.name)}">
        <div class="name">${escapeHtml(p.name)}</div>
        ${amountHtml}
        <button class="excludeBtn" type="button" aria-label="Toggle exclude">X</button>
      </div>
    `;
    }).join("");

    // attach handlers
    resultsList.querySelectorAll(".resultRow").forEach(row => {
      const name = row.getAttribute("data-name");
      const btn = row.querySelector(".excludeBtn");
      btn.addEventListener("click", () => {
        if (!name) return;

        // Optional: prevent excluding the winner after spin
        // if (doubleWinnerName) return;

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

  closeModalBtn?.addEventListener("click", closeModal);

  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });


  // Initial fine render
  updateSpinButtons();
  renderFines();
  renderSpecials();
  updateSubmitState();
});

document.getElementById("headerActions")
document.getElementById("openHistoryBtn")
document.getElementById("openFinesBtn")
