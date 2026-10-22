(function () {
  "use strict";
  const E = window.MonsterBotEngine, $ = id => document.getElementById(id);
  let selected = 1, match = null, undo = null, timer = null, user = null, progress = new Set(), storageKey = "", busy = false, ready = false;
  const validKeys = new Set(E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)));
  const safeLoad = key => { try { return JSON.parse(localStorage.getItem(key) || "[]").filter(value => validKeys.has(value)); } catch { return []; } };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function renderLevels() {
    let complete = 0;
    $("botLevels").innerHTML = E.LEVELS.map(p => {
      const wins = E.MODES.filter(mode => progress.has(`${p.level}-${mode}`));
      const gold = wins.length === 4;
      if (gold) complete++;
      return `<button type="button" class="botLevel ${gold ? "complete" : ""}" data-level="${p.level}" aria-pressed="${selected === p.level}"><span class="levelTitle"><span>Monster ${p.level}</span><span class="${gold ? "gold" : ""}">${gold ? "☑ Complete" : wins.length ? "✓ Beaten" : ""}</span></span><span class="levelStats">${p.average} avg · First 9: ${p.firstNine.join("–")} · Checkout: ${p.checkout.join("–")}%</span><span class="modeMarks">${E.MODES.map(mode => `<span class="${gold ? "gold" : progress.has(`${p.level}-${mode}`) ? "won" : ""}">${progress.has(`${p.level}-${mode}`) ? "✓" : "○"} Best of ${mode}</span>`).join("")}</span></button>`;
    }).join("");
    $("progressSummary").textContent = `${progress.size} / 40 formats won · ${complete} / 10 levels complete`;
    $("startMatch").textContent = `Play Level ${selected}`;
    $("startMatch").disabled = !ready;
  }
  async function loadProgress() {
    renderLevels();
    try { user = await window.ONMFirebase.loadOwnUser(); } catch { user = null; }
    storageKey = user ? `onm-monster-bot-${user.uid}` : "onm-monster-bot-guest";
    progress = new Set(safeLoad(storageKey));
    if (user) {
      try {
        const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
        const snap = await sdk.getDoc(sdk.doc(db, "users", user.uid));
        (snap.data()?.monsterBotWins || []).filter(k => validKeys.has(k)).forEach(k => progress.add(k));
        // Retry wins that were saved on this device while offline.
        if (progress.size) await sdk.updateDoc(sdk.doc(db, "users", user.uid), { monsterBotWins: sdk.arrayUnion(...progress) });
        $("saveStatus").textContent = "Progress synced to your account.";
      } catch { $("saveStatus").textContent = "Account sync unavailable. Progress is saved on this device until you reconnect."; }
    } else $("saveStatus").textContent = "Guest progress saves on this browser. Sign in before playing to save to your account.";
    ready = true;
    renderLevels();
  }
  async function saveWin(game) {
    const key = `${game.level}-${game.bestOf}`;
    progress.add(key);
    try { localStorage.setItem(storageKey, JSON.stringify([...progress])); }
    catch { $("saveStatus").textContent = "Browser storage unavailable; keep this page open until account sync completes."; }
    if (user) {
      try {
        const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
        await sdk.updateDoc(sdk.doc(db, "users", user.uid), { monsterBotWins: sdk.arrayUnion(key) });
        $("saveStatus").textContent = "Victory saved to your account.";
      } catch { $("saveStatus").textContent = "Victory saved on this device; account sync will retry next time you open this game."; }
    }
    renderLevels();
  }
  function newPlayer() { return { remaining: 501, legs: 0, points: 0, darts: 0, legDarts: 0 }; }
  function begin() {
    if (!ready) return;
    clearTimeout(timer);
    const starter = $("firstThrow").value;
    match = { level: selected, bestOf: Number($("bestOf").value), leg: 1, starter: starter === "random" ? (Math.random() < 0.5 ? "player" : "bot") : starter, player: newPlayer(), bot: newPlayer(), history: [], ended: false, legEnded: false };
    match.turn = match.starter;
    undo = null; busy = false;
    $("challengeSetup").hidden = true; $("matchPanel").hidden = false;
    $("matchFormat").textContent = `501 · Best of ${match.bestOf} · First to ${(match.bestOf + 1) / 2} ${match.bestOf === 1 ? "leg" : "legs"}`;
    $("matchTitle").textContent = `You vs Monster ${match.level}`;
    $("botName").textContent = `Monster ${match.level}`;
    renderMatch(); scheduleBot();
  }
  function renderMatch() {
    for (const side of ["player", "bot"]) {
      const p = match[side];
      $(`${side}Remaining`).textContent = p.remaining;
      $(`${side}Legs`).textContent = `${p.legs} ${p.legs === 1 ? "leg" : "legs"}`;
      $(`${side}Average`).textContent = `Average ${p.darts ? (p.points * 3 / p.darts).toFixed(1) : "—"}`;
      $(`${side}Board`).classList.toggle("active", !match.legEnded && match.turn === side);
    }
    const playing = !match.ended && !match.legEnded && match.turn === "player" && !busy;
    $("scoreForm").querySelectorAll("input,select,button").forEach(el => { el.disabled = !playing; });
    $("undoVisit").disabled = !undo || busy || match.ended;
    $("nextLeg").hidden = !match.legEnded || match.ended;
    $("backToLevels").hidden = !match.ended;
    if (match.ended) $("turnStatus").textContent = match.player.legs > match.bot.legs ? `You win ${match.player.legs}–${match.bot.legs}! ${E.MODES.every(mode => progress.has(`${match.level}-${mode}`)) ? "☑ Gold level complete!" : "✓ Format beaten."}` : `Monster ${match.level} wins ${match.bot.legs}–${match.player.legs}. Try again!`;
    else if (match.legEnded) $("turnStatus").textContent = `${match.player.remaining === 0 ? "You win" : "Monster wins"} leg ${match.leg}.`;
    else $("turnStatus").textContent = `Leg ${match.leg} · ${match.turn === "player" ? "Your throw" : "Monster is throwing…"}`;
    $("visitHistory").innerHTML = [...match.history].reverse().map(v => `<li><span>${v.side === "player" ? "You" : `Monster ${match.level}`} · ${v.bust ? "Bust" : v.score}${v.remaining === 0 ? " · Checkout!" : ""}</span><small>${v.remaining} left · ${v.darts} darts${v.hits ? " · " + escape(v.hits.join(" / ")) : ""}</small></li>`).join("");
  }
  function apply(side, visit) {
    const p = match[side];
    p.remaining = visit.remaining; p.points += visit.score; p.darts += visit.darts; p.legDarts += visit.darts;
    match.history.push({ side, ...visit });
    if (p.remaining === 0) {
      p.legs++; match.legEnded = true;
      if (p.legs >= (match.bestOf + 1) / 2) {
        match.ended = true; undo = null;
        if (side === "player") { const game = match; saveWin(game).then(() => { if (match === game) renderMatch(); }); }
      }
    } else match.turn = side === "player" ? "bot" : "player";
  }
  function scheduleBot() {
    if (!match || match.legEnded || match.turn !== "bot") return;
    busy = true; renderMatch();
    timer = setTimeout(() => {
      apply("bot", E.botVisit(match.bot.remaining, match.bot.legDarts, E.LEVELS[match.level - 1]));
      busy = false; renderMatch();
      if (!match.legEnded) $("visitScore").focus();
    }, 1100);
  }
  function humanVisit(bust = false) {
    if (!match || busy || match.turn !== "player" || match.legEnded) return;
    const score = bust ? 0 : Number($("visitScore").value);
    if (!bust && $("visitScore").value.trim() === "") return;
    const darts = score === match.player.remaining ? Number($("checkoutDarts").value) : 3;
    const error = bust ? "" : E.validateVisit(match.player.remaining, score, darts);
    $("scoreError").textContent = error;
    if (error) return;
    undo = JSON.parse(JSON.stringify(match));
    apply("player", { score, remaining: bust ? match.player.remaining : match.player.remaining - score, darts, bust });
    $("visitScore").value = ""; $("checkoutDarts").value = "3";
    renderMatch(); scheduleBot();
  }
  function levels() {
    if (match && !match.ended && !confirm("Leave this match? Unfinished matches do not earn completion ticks.")) return;
    clearTimeout(timer); match = null; undo = null; busy = false;
    $("challengeSetup").hidden = false; $("matchPanel").hidden = true; renderLevels();
  }
  $("botLevels").addEventListener("click", event => { const button = event.target.closest("[data-level]"); if (button) { selected = Number(button.dataset.level); renderLevels(); } });
  $("startMatch").addEventListener("click", begin);
  $("scoreForm").addEventListener("submit", event => { event.preventDefault(); humanVisit(); });
  $("bustVisit").addEventListener("click", () => humanVisit(true));
  $("undoVisit").addEventListener("click", () => { if (!undo || busy || match.ended) return; match = undo; undo = null; $("scoreError").textContent = ""; renderMatch(); $("visitScore").focus(); });
  $("nextLeg").addEventListener("click", () => {
    if (!match?.legEnded || match.ended) return;
    match.leg++; match.starter = match.starter === "player" ? "bot" : "player";
    match.turn = match.starter; match.legEnded = false; undo = null;
    for (const side of ["player", "bot"]) { match[side].remaining = 501; match[side].legDarts = 0; }
    renderMatch(); scheduleBot();
  });
  $("leaveMatch").addEventListener("click", levels); $("backToLevels").addEventListener("click", levels);
  window.addEventListener("beforeunload", event => { if (match && !match.ended) { event.preventDefault(); event.returnValue = ""; } });
  loadProgress();
})();
