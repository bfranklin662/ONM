(function () {
  "use strict";
  const E = window.MonsterBotEngine, $ = id => document.getElementById(id);
  let match = null, undo = null, timer = null, user = null, progress = new Set(), storageKey = "", busy = false, ready = false;
  const validKeys = new Set(E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)));
  const modes = new Map();
  let bestScores = {};
  const botName = level => E.LEVELS[level - 1].name;
  const avatarNames = { 1: "billy", 2: "croft", 3: "venton", 4: "istan", 5: "nick-friendly", 6: "ricky" };
  const botAvatar = level => avatarNames[level] ? `graphics/bots/${avatarNames[level]}-bot.png` : "";
  function requirements(level) {
    const rows = [{ label: "Sign in with a registered account", met: Boolean(user) }];
    const won = (bot, modes) => modes.every(mode => progress.has(`${bot}-${mode}`));
    if (level >= 2) rows.push({ label: `Beat ${botName(level - 1)} in BO1 and BO3`, met: won(level - 1, [1,3]) });
    if (level >= 3) rows.push({ label: `Beat ${botName(level - 2)} in BO1, BO3, BO5 and BO7`, met: won(level - 2, E.STANDARD_MODES) });
    if (level >= 4) rows.push({ label: `Beat ${botName(level - 3)} in all five formats, including Bull or Bust`, met: won(level - 3, E.MODES) });
    if (level >= 5) rows.push({ label: `Earn flawless wins in all five ${botName(level - 4)} formats (gold ticks)`, met: E.MODES.every(mode => {
      const key = `${level - 4}-${mode}`;
      return progress.has(key) && E.validWinningScore(key, bestScores[key]) && bestScores[key].lost === 0;
    }) });
    return `<div class="unlockRequirements"><h4>Requirements to play</h4><ul>${rows.map(row => `<li class="${row.met ? "met" : ""}"><span aria-label="${row.met ? "Met" : "Not met"}">${row.met ? "✓" : "○"}</span> ${row.label}</li>`).join("")}</ul></div>`;
  }
  function modeChip(level, mode) {
    const key = `${level}-${mode}`, won = progress.has(key), score = bestScores[key];
    const flawless = won && score?.lost === 0;
    return communityButton(key, `${won ? "✓" : "○"} ${E.modeLabel(mode)}`, flawless ? "gold" : won ? "won" : "");
  }
  function readScores(key) {
    try { return Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(key) || "{}")).filter(([k,v]) => E.validWinningScore(k,v))); } catch { return {}; }
  }
  async function syncAccount() {
    const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
    let syncedScores = bestScores;
    await sdk.runTransaction(db, async tx => {
      const ref = sdk.doc(db, "users", user.uid), snap = await tx.get(ref);
      const saved = snap.data()?.monsterBotBestScores || {}, merged = { ...saved };
      for (const [key, score] of Object.entries(bestScores)) merged[key] = E.bestScore(E.validWinningScore(key, saved[key]) ? saved[key] : null, score);
      tx.update(ref, { monsterBotWins: sdk.arrayUnion(...progress), monsterBotBestScores: merged });
      syncedScores = merged;
    });
    bestScores = Object.fromEntries(Object.entries(syncedScores).filter(([key,score]) => E.validWinningScore(key,score)));
  }
  let community = null, communityError = false, completionKey = null, communityLoading = null;
  function communityButton(key, label, classes = "") {
    const count = community ? (community[key] || []).length : communityError ? "—" : "…";
    return `<button type="button" class="completionCount ${classes}" data-community-key="${key}" aria-label="${label}, ${count} players completed. View players.">${label} <b>${count}</b></button>`;
  }
  function showCompletionList() {
    if (!completionKey) return;
    const parts = completionKey.split("-");
    const level = parts[0] === "level" ? Number(parts[1]) : Number(parts[0]);
    $("completionTitle").textContent = `${botName(level)} · ${parts[0] === "level" ? "All formats" : E.modeLabel(Number(parts[1]))}`;
    const names = community?.[completionKey] || [];
    $("completionStatus").textContent = community ? `${names.length} ${names.length === 1 ? "player has" : "players have"} won${names.length ? ":" : " this challenge yet."}` : communityError ? "Completion counts could not be loaded. Please retry." : "Loading completions…";
    $("completionNames").innerHTML = names.map(row => typeof row === "string" ? `<li>${escape(row)}<small>Score not recorded</small></li>` : `<li><strong>${escape(row.name)}</strong><div class="completionScores">${row.results.map(result => `<span class="${result.flawless ? "gold" : "won"}">${E.modeLabel(result.mode)}: ${result.won === null ? "Score not recorded" : `${result.won}–${result.lost}${result.flawless ? " · Flawless ✓" : " ✓"}`}</span>`).join("")}</div></li>`).join("");
    $("retryCompletions").hidden = !communityError;
  }
  async function loadCommunity(refresh = false) {
    if (communityLoading) return communityLoading;
    communityError = false;
    communityLoading = (async () => {
      try {
        const { app } = await window.ONMFirebase.ready;
        const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js");
        const response = await httpsCallable(getFunctions(app, "europe-west2"), "getMonsterBotCompletions")({ refresh, version: 2 });
        community = response.data.completions;
      } catch { communityError = true; }
      finally { communityLoading = null; renderLevels(); showCompletionList(); }
    })();
    return communityLoading;
  }
  const safeLoad = key => { try { return JSON.parse(localStorage.getItem(key) || "[]").filter(value => validKeys.has(value)); } catch { return []; } };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function renderLevels() {
    let complete = 0;
    const scrollTop = $("botLevels").scrollTop;
    $("botLevels").innerHTML = [...E.LEVELS].reverse().map(p => {
      const wins = E.MODES.filter(mode => progress.has(`${p.level}-${mode}`));
      const gold = wins.length === E.MODES.length;
      const unlocked = E.isUnlocked(p.level, progress, bestScores);
      if (gold) complete++;
      const avatar = botAvatar(p.level) ? `<img class="botAvatar" src="${botAvatar(p.level)}" alt="${p.name} cartoon avatar">` : "";
      return `<article class="botLevel ${gold ? "complete" : ""} ${unlocked ? "unlocked" : "locked"}" id="bot-level-${p.level}" aria-labelledby="bot-title-${p.level}">
        <div class="botCardHeading">${avatar}<div><span class="levelNumber">Level ${p.level}</span><div class="levelTitle"><h3 id="bot-title-${p.level}">${p.name}</h3><span class="${gold ? "gold" : ""}">${gold ? "☑ Complete" : wins.length ? "✓ Beaten" : unlocked ? "" : "🔒 Locked"}</span></div><span class="levelStats">${p.average} average</span></div></div>
        <div class="modeMarks">${E.MODES.map(mode => modeChip(p.level, mode)).join("")}</div>
        <div class="botCompletionTotal">${communityButton(`level-${p.level}`, "Players who beat this bot")}</div>
        <div class="botCardControls"><label for="bot-mode-${p.level}">Match length</label><select id="bot-mode-${p.level}" data-mode-level="${p.level}" >${E.MODES.map(mode => `<option value="${mode}" ${(modes.get(p.level) || 1) === mode ? "selected" : ""}>${E.modeLabel(mode)}</option>`).join("")}</select>${!ready ? '<button type="button" class="primary" disabled>Loading account…</button>' : !user ? '<a class="primary signupToPlay" href="auth.html?mode=register">Sign up to play</a>' : `<button id="play-bot-${p.level}" type="button" class="primary" data-play-level="${p.level}" ${unlocked ? "" : "disabled"}>Play ${p.name}</button>`}</div>
        ${requirements(p.level)}</article>`;
    }).join("");
    $("progressSummary").textContent = `${progress.size} / 50 formats won · ${complete} / 10 levels complete`;
    $("botLevels").scrollTop = scrollTop;
  }
  async function loadProgress() {
    renderLevels();
    try { user = await window.ONMFirebase.loadOwnUser(); } catch { user = null; }
    storageKey = user ? `onm-monster-bot-${user.uid}` : "onm-monster-bot-guest";
    progress = new Set(user ? safeLoad(storageKey) : []);
    bestScores = user ? readScores(storageKey + "-scores") : {};
    if (user) {
      try {
        const { db, firestoreSdk: sdk } = await window.ONMFirebase.ready;
        const snap = await sdk.getDoc(sdk.doc(db, "users", user.uid));
        (snap.data()?.monsterBotWins || []).filter(k => validKeys.has(k)).forEach(k => progress.add(k));
        for (const [key, score] of Object.entries(snap.data()?.monsterBotBestScores || {})) if (E.validWinningScore(key, score)) bestScores[key] = E.bestScore(bestScores[key], score);
        // Retry wins that were saved on this device while offline.
        if (progress.size) await syncAccount();
        $("saveStatus").textContent = "Progress synced to your account.";
      } catch { $("saveStatus").textContent = "Account sync unavailable. Progress is saved on this device until you reconnect."; }
    } else $("saveStatus").innerHTML = 'Browse every bot and format. <a href="auth.html?mode=register">Sign up to play</a> or <a href="auth.html">sign in</a> if you already have an account.';
    ready = true;
    renderLevels();
    $("botLevels").scrollTop = $("botLevels").scrollHeight;
    loadCommunity(Boolean(user));
  }
  async function saveWin(game) {
    if (!user) return;
    const key = `${game.level}-${game.bestOf}`;
    progress.add(key);
    bestScores[key] = E.bestScore(bestScores[key], { won: game.player.legs, lost: game.bot.legs });
    try { localStorage.setItem(storageKey, JSON.stringify([...progress])); localStorage.setItem(storageKey + "-scores", JSON.stringify(bestScores)); }
    catch { $("saveStatus").textContent = "Browser storage unavailable; keep this page open until account sync completes."; }
    if (user) {
      try {
        await syncAccount();
        $("saveStatus").textContent = "Victory saved to your account.";
        loadCommunity(true);
      } catch { $("saveStatus").textContent = "Victory saved on this device; account sync will retry next time you open this game."; }
    }
    renderLevels();
  }
  function newPlayer() { return { remaining: 501, legs: 0, points: 0, darts: 0, legDarts: 0 }; }
  function begin(level, bestOf) {
    if (!ready || !user || !E.LEVELS.some(p => p.level === level) || !E.MODES.includes(bestOf) || !E.isUnlocked(level, progress, bestScores)) return;
    clearTimeout(timer);
    const starter = $("firstThrow").value;
    match = { level, bestOf, leg: 1, starter: starter === "random" ? (Math.random() < 0.5 ? "player" : "bot") : starter, player: newPlayer(), bot: newPlayer(), history: [], ended: false, legEnded: false };
    match.turn = match.starter;
    undo = null; busy = false;
    $("challengeSetup").hidden = true; $("matchPanel").hidden = false;
    $("matchFormat").textContent = match.bestOf === E.BULL_MODE ? "501 · Bull or Bust · BO1 · Bull out only" : `501 · Best of ${match.bestOf} · First to ${E.legsNeeded(match.bestOf)} ${match.bestOf === 1 ? "leg" : "legs"}`;
    $("bullRules").hidden = match.bestOf !== E.BULL_MODE;
    $("matchTitle").textContent = `You vs ${botName(match.level)}`;
    $("botName").textContent = botName(match.level);
    const avatar = $("scorerBotAvatar"), avatarPath = botAvatar(match.level);
    avatar.hidden = !avatarPath;
    avatar.src = avatarPath;
    avatar.alt = `${botName(match.level)} cartoon avatar`;
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
    if (match.ended) $("turnStatus").textContent = match.player.legs > match.bot.legs ? `You win ${match.player.legs}–${match.bot.legs}! ${match.bot.legs === 0 ? "★ Flawless victory · Gold tick!" : "✓ Format beaten."}${E.MODES.every(mode => progress.has(`${match.level}-${mode}`)) ? " ☑ Level complete!" : ""}${match.level < 10 && E.isUnlocked(match.level + 1, progress, bestScores) ? ` ${botName(match.level + 1)} unlocked!` : ""}` : `${botName(match.level)} wins ${match.bot.legs}–${match.player.legs}. Try again!`;
    else if (match.legEnded) $("turnStatus").textContent = `${match.player.remaining === 0 ? "You win" : botName(match.level) + " wins"} leg ${match.leg}.`;
    else $("turnStatus").textContent = `Leg ${match.leg} · ${match.turn === "player" ? "Your throw" : "Monster is throwing…"}`;
    $("visitHistory").innerHTML = [...match.history].reverse().map(v => `<li><span>${v.side === "player" ? "You" : botName(match.level)} · ${v.bust ? "Bust" : v.score}${v.remaining === 0 ? " · Checkout!" : ""}</span><small>${v.remaining} left · ${v.darts} darts${v.hits ? " · " + escape(v.hits.join(" / ")) : ""}</small></li>`).join("");
  }
  function apply(side, visit) {
    const p = match[side];
    p.remaining = visit.remaining; p.points += visit.score; p.darts += visit.darts; p.legDarts += visit.darts;
    match.history.push({ side, ...visit });
    if (p.remaining === 0) {
      p.legs++; match.legEnded = true;
      if (p.legs >= E.legsNeeded(match.bestOf)) {
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
    if (!match || busy || pendingCheckout || match.turn !== "player" || match.legEnded) return;
    const score = bust ? 0 : Number($("visitScore").value);
    if (!bust && $("visitScore").value.trim() === "") return;
    const darts = score === match.player.remaining ? Number($("checkoutDarts").value) : 3;
    if (match.bestOf === E.BULL_MODE) {
      if (bust) { loseBull("Bust — Bull or Bust lost."); return; }
      if (!E.possibleScore(score)) { $("scoreError").textContent = "Enter a possible three-dart score from 0 to 180."; return; }
      const remaining = match.player.remaining - score;
      if (remaining === 0) {
        pendingCheckout = { score, remaining, darts, bust: false };
        $("bullCheckoutDialog").showModal();
        return;
      }
      if (remaining < 50) {
        match.player.remaining = remaining; match.player.points += score; match.player.darts += darts;
        match.history.push({ side: "player", score, remaining, darts, bust: false });
        loseBull("Below 50 — Bull or Bust lost."); return;
      }
    }
    const error = bust ? "" : E.validateVisit(match.player.remaining, score, darts);
    $("scoreError").textContent = error;
    if (error) return;
    undo = JSON.parse(JSON.stringify(match));
    apply("player", { score, remaining: bust ? match.player.remaining : match.player.remaining - score, darts, bust });
    $("visitScore").value = ""; $("checkoutDarts").value = "3";
    renderMatch(); scheduleBot();
  }
  let pendingCheckout = null;
  function loseBull(reason) {
    pendingCheckout = null; undo = null; clearTimeout(timer); busy = false;
    match.bot.legs = 1; match.ended = true; match.legEnded = true;
    renderMatch(); $("turnStatus").textContent = `${reason} ${botName(match.level)} wins 1–0.`;
  }
  function confirmBull(isBull) {
    if (!pendingCheckout || !match || match.ended) return;
    const visit = pendingCheckout; pendingCheckout = null;
    $("bullCheckoutDialog").close();
    if (!isBull) { loseBull("Checkout was not on Bull — challenge lost."); return; }
    if (!E.bullCheckoutPossible(visit.score, visit.darts)) { loseBull("That Bull checkout is not possible with those darts — challenge lost."); return; }
    apply("player", visit); renderMatch();
  }
  $("confirmBullCheckout").addEventListener("click", () => confirmBull(true));
  $("otherCheckout").addEventListener("click", () => confirmBull(false));
  $("bullCheckoutDialog").addEventListener("cancel", event => { event.preventDefault(); confirmBull(false); });
  function levels() {
    if (match && !match.ended && !confirm("Leave this match? Unfinished matches do not earn completion ticks.")) return;
    clearTimeout(timer); pendingCheckout = null; $("bullCheckoutDialog").close(); match = null; undo = null; busy = false;
    $("challengeSetup").hidden = false; $("matchPanel").hidden = true; renderLevels();
  }
  $("botLevels").addEventListener("change", event => { const select = event.target.closest("[data-mode-level]"); if (select) modes.set(Number(select.dataset.modeLevel), Number(select.value)); });
  $("botLevels").addEventListener("click", event => {
    const completion = event.target.closest("[data-community-key]");
    if (completion) { completionKey = completion.dataset.communityKey; showCompletionList(); $("completionDialog").showModal(); return; }
    const button = event.target.closest("[data-play-level]");
    if (button) { const level = Number(button.dataset.playLevel); begin(level, Number($("bot-mode-" + level).value)); }
  });
  $("closeCompletions").addEventListener("click", () => $("completionDialog").close());
  $("completionDialog").addEventListener("click", event => { if (event.target === $("completionDialog")) $("completionDialog").close(); });
  $("retryCompletions").addEventListener("click", () => { $("completionStatus").textContent = "Loading completions…"; loadCommunity(Boolean(user)); });
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
  loadProgress().then(async () => {
    try {
      const {auth, authSdk} = await window.ONMFirebase.ready;
      if (!authSdk?.onAuthStateChanged) return;
      authSdk.onAuthStateChanged(auth, current => {
        if ((current?.uid || null) === (user?.uid || null)) return;
        clearTimeout(timer); match = null; undo = null; busy = false; pendingCheckout = null;
        $("bullCheckoutDialog").close(); $("matchPanel").hidden = true; $("challengeSetup").hidden = false;
        user = null; progress = new Set(); bestScores = {}; ready = false;
        loadProgress();
      });
    } catch { /* A failed auth connection never enables guest play. */ }
  });
})();
