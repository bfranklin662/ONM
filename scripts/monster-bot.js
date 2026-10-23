(function () {
  "use strict";
  const E = window.MonsterBotEngine, $ = id => document.getElementById(id);
  let match = null, undo = null, timer = null, user = null, progress = new Set(), storageKey = "", busy = false, ready = false;
  const validKeys = new Set(E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)));
  const modes = new Map();
  const BULL_RULES = "Bull or Bust · BO1: you must win with a Bullseye (50) checkout and confirm Bull on the checkout prompt. Going below 50 without a Bull finish loses immediately. The bot plays normal double-out.";
  const authUrl = mode => `auth.html?mode=${mode}&redirect=monster-bot.html`;
  const canPlay = (level,format) => ready && user && E.LEVELS.some(p=>p.level===level) && level <= E.highestUnlocked(progress,bestScores) && E.isFormatUnlocked(level,format,progress);
  function playGame(level,format) {
    if (canPlay(level,format)) window.location.href = `dart-scorer.html?mode=bot&level=${level}&format=${format}`;
  }
  function focusUnlocked() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const current = $("bot-level-" + E.highestUnlocked(progress,bestScores));
      if (!ready || !current || $("challengeSetup").hidden || $("ladderPanel").hidden) return;
      current.scrollIntoView({block:"start",inline:"nearest",behavior:"instant"});
    }));
  }
  let bestScores = {};
  const botName = level => E.LEVELS[level - 1].name;
  const avatarNames = { 1: "billy", 2: "croft", 3: "venton", 4: "istan", 5: "nick", 6: "ricky", 7: "aussie", 8: "andre", 9: "bailey", 10: "filip" };
  const botAvatar = level => avatarNames[level] ? `graphics/bots/${avatarNames[level]}-bot.png?v=20261022-avatar` : "";
  function requirements(level) {
    const rows = [];
    if (level >= 3) {
      const required = 6 + (level - 3) * 4;
      rows.push({ label: `Collect ${required} gold stars (${E.goldStars(progress,bestScores)}/${required})`, met: E.goldStars(progress,bestScores) >= required });
    }
    const won = (bot, modes) => modes.every(mode => progress.has(`${bot}-${mode}`));
    if (level >= 2) rows.push({ label: `Beat ${botName(level - 1)} in 2 modes`, met: E.MODES.filter(mode => progress.has(`${level - 1}-${mode}`)).length >= 2 });
    if (level >= 3) rows.push({ label: `Beat ${botName(level - 2)} in BO1, BO3, BO5 and BO7`, met: won(level - 2, E.STANDARD_MODES) });
    if (level >= 4) rows.push({ label: `Beat ${botName(level - 3)} in all five formats, including Bull or Bust`, met: won(level - 3, E.MODES) });
    if (level >= 5) rows.push({ label: `Earn flawless wins in all five ${botName(level - 4)} formats (gold ticks)`, met: E.MODES.every(mode => {
      const key = `${level - 4}-${mode}`;
      return progress.has(key) && E.validWinningScore(key, bestScores[key]) && bestScores[key].lost === 0;
    }) });
    if (E.isUnlocked(level,progress,bestScores)) return "";
    return rows.length ? `<div class="unlockRequirements"><h4>Requirements to play</h4><ul>${rows.map(row => `<li class="${row.met ? "met" : ""}"><span aria-label="${row.met ? "Met" : "Not met"}">${row.met ? "✓" : "○"}</span> ${row.label}</li>`).join("")}</ul></div>` : "";
  }
  function modeChip(level, mode, selectedMode) {
    const key = `${level}-${mode}`, won = progress.has(key), score = bestScores[key];
    const flawless = won && E.validWinningScore(key,score) && score.lost === 0;
    return `<button type="button" class="modePill ${flawless ? "gold" : won ? "won" : ""}" data-choose-level="${level}" data-choose-mode="${mode}" aria-pressed="${mode===selectedMode}" aria-label="${E.modeLabel(mode)}, ${flawless ? "flawless win" : won ? "beaten" : "not beaten"}">${E.modeLabel(mode)} ${flawless ? "★" : won ? "✓" : "○"}</button>`;
  }
  function modeResults(level,mode) {
    const key = `${level}-${mode}`, count = community ? (community[key] || []).length : null;
    const label = count === null ? (communityError ? "Results unavailable" : "Loading results…") : `${count} ${count === 1 ? "player has" : "players have"} beaten ${botName(level)} ${E.modeLabel(mode)}`;
    return `<div class="selectedModeResults"><span>${label}</span><button type="button" class="modeResultsLink" data-community-key="${key}" aria-label="View players and scores for ${botName(level)} ${E.modeLabel(mode)}" title="View players and scores">👤</button></div>`;
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
  let community = null, leaderboard = null, communityError = false, completionKey = null, communityLoading = null;
  function renderLeaderboard() {
    $("leaderboardStatus").textContent = leaderboard ? (leaderboard.length ? `${leaderboard.length} players · Ranked by challenges completed, then level unlocked.` : "No players yet. Start your first match to join the leaderboard.") : communityError ? "Leaderboard could not be loaded. Please retry." : "Loading leaderboard…";
    $("leaderboardRows").innerHTML = (leaderboard || []).map((row,i) => `<tr><td>${i+1}</td><th scope="row">${escape(row.name)}</th><td>Level ${row.level}</td><td class="challengesTotal">${row.completed} / 50</td><td class="flawlessTotal">★ ${row.flawless ?? 0}</td></tr>`).join("");
    $("retryLeaderboard").hidden = !communityError;
  }
  function showTab(board) {
    $("botPageTitle").textContent = board ? "Leaderboard" : "Monster Bot Game";
    document.title = `${board ? "Leaderboard" : "Monster Bot Game"} | Oche Ness Monsters`;
    $("ladderPanel").hidden = board; $("leaderboardPanel").hidden = !board;
    $("ladderTab").setAttribute("aria-selected", String(!board));
    $("leaderboardTab").setAttribute("aria-selected", String(board));
    if (board) { renderLeaderboard(); loadCommunity(Boolean(user)); }
    else focusUnlocked();
  }
  function communityButton(key, label, classes = "") {
    const count = community ? (community[key] || []).length : communityError ? "—" : "…";
    const visibleLabel = label.replace(/^([✓○]) /, '<span class="completionMark" aria-hidden="true">$1</span> ');
    return `<button type="button" class="completionCount ${classes}" data-community-key="${key}" aria-label="${label}, ${count} players completed. View players."><span class="completionLabel">${visibleLabel}</span><b>${count}</b></button>`;
  }
  function showCompletionList() {
    if (!completionKey) return;
    const parts = completionKey.split("-");
    const level = parts[0] === "level" ? Number(parts[1]) : Number(parts[0]);
    $("completionTitle").textContent = `${botName(level)} · ${parts[0] === "level" ? "All formats" : E.modeLabel(Number(parts[1]))}`;
    $("completionModeRules").hidden = parts[0] === "level" || Number(parts[1]) !== E.BULL_MODE;
    $("completionModeRules").textContent = BULL_RULES;
    const ownScore = bestScores[completionKey], beaten = Boolean(user && progress.has(completionKey));
    const flawless = beaten && E.validWinningScore(completionKey,ownScore) && ownScore.lost === 0;
    $("completionYourResult").hidden = !beaten;
    $("completionYourResult").className = `completionYourResult ${flawless ? "gold" : "won"}`;
    $("completionYourResult").textContent = beaten ? `${flawless ? "★ Flawless win" : "✓ You've beaten this challenge"}${E.validWinningScore(completionKey,ownScore) ? ` · ${ownScore.won}–${ownScore.lost}` : ""}` : "";
    const names = community?.[completionKey] || [];
    $("completionStatus").textContent = community ? `${names.length} ${names.length === 1 ? "player has" : "players have"} won${names.length ? ":" : " this challenge yet."}` : communityError ? "Completion counts could not be loaded. Please retry." : "Loading completions…";
    $("completionNames").innerHTML = names.map(row => typeof row === "string" ? `<li>${escape(row)}<small>Score not recorded</small></li>` : `<li><strong>${escape(row.name)}</strong><div class="completionScores">${row.results.map(result => `<span class="${result.flawless ? "gold" : "won"}">${E.modeLabel(result.mode)}: ${result.won === null ? "Score not recorded" : `${result.won}–${result.lost}${result.flawless ? " · Flawless ✓" : " ✓"}`}</span>`).join("")}</div></li>`).join("");
    $("retryCompletions").hidden = !communityError;
    const formats = parts[0] === "level" ? E.MODES : [Number(parts[1])];
    $("completionActions").innerHTML = formats.map(format => `<button type="button" class="primary" data-completion-level="${level}" data-completion-format="${format}" ${canPlay(level,format) ? "" : "disabled"}>Play ${E.modeLabel(format)}${E.isFormatUnlocked(level,format,progress) ? "" : " 🔒"}</button>`).join("");
    $("completionPlayHint").textContent = !user ? "Sign in with a registered account to play." : level > E.highestUnlocked(progress,bestScores) ? "This bot is locked. Meet its ladder requirements first." : formats.includes(E.BULL_MODE) && !E.isFormatUnlocked(level,E.BULL_MODE,progress) ? "Beat BO1, BO3, BO5 and BO7 on this bot to unlock Bull or Bust." : "";
  }
  async function loadCommunity(refresh = false) {
    if (communityLoading) return communityLoading;
    communityError = false;
    renderLeaderboard(); showCompletionList();
    communityLoading = Promise.resolve().then(async () => {
      try {
        const response = await window.ONMBotData.fetchCommunity({projectId:window.ONMFirebase.config.projectId,refresh,getToken:user?.getIdToken ? ()=>user.getIdToken() : null});
        community = response.completions;
        leaderboard = response.leaderboard;
      } catch { communityError = true; }
      finally { communityLoading = null; renderLevels(); showCompletionList(); renderLeaderboard(); }
    });
    return communityLoading;
  }
  const safeLoad = key => { try { return JSON.parse(localStorage.getItem(key) || "[]").filter(value => validKeys.has(value)); } catch { return []; } };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function renderLevels() {
    $("accountLoading").hidden = ready;
    $("botLevels").hidden = !ready;
    $("progressSummary").hidden = !ready;
    if (!ready) { $("botLevels").innerHTML = ""; return; }
    let complete = 0;
    const scrollTop = $("botLevels").scrollTop;
    const visibleThrough = Math.min(10, E.highestUnlocked(progress, bestScores) + 1);
    $("botLevels").innerHTML = E.LEVELS.filter(p => p.level <= visibleThrough).reverse().map(p => {
      const wins = E.MODES.filter(mode => progress.has(`${p.level}-${mode}`));
      const flawless = wins.filter(mode => {
        const key = `${p.level}-${mode}`;
        return E.validWinningScore(key,bestScores[key]) && bestScores[key].lost === 0;
      }).length;
      const selectedMode = modes.get(p.level) || E.MODES.find(mode => !progress.has(`${p.level}-${mode}`)) || E.MODES[0];
      const beaten = wins.length === E.MODES.length;
      const gold = flawless === E.MODES.length;
      const unlocked = E.isUnlocked(p.level, progress, bestScores);
      if (!unlocked) return `<article class="botLevel locked mysteryBot" id="bot-level-${p.level}" aria-labelledby="bot-title-${p.level}"><div class="mysteryPreview" aria-hidden="true"><img src="${botAvatar(p.level)}" alt=""><div>?????<br>Monster Bot</div></div><div class="mysteryLock"><span aria-hidden="true">🔒</span><h3 id="bot-title-${p.level}">Level ${p.level} · Mystery Bot</h3><p>Unlock this level to reveal your opponent.</p></div>${requirements(p.level)}${!user ? `<a class="primary signupToPlay" href="${authUrl("register")}">Sign up to play</a>` : ""}</article>`;
      if (gold) complete++;
      const avatar = botAvatar(p.level) ? `<img class="botAvatar" src="${botAvatar(p.level)}" alt="${p.name} cartoon avatar">` : "";
      return `<article class="botLevel ${gold ? "complete flawlessComplete" : beaten ? "beatenComplete" : ""} ${unlocked ? "unlocked" : "locked"}" id="bot-level-${p.level}" aria-labelledby="bot-title-${p.level}">
        <div class="botCardHeading">${avatar}<div><span class="levelNumber">Level ${p.level}</span><div class="levelTitle"><h3 id="bot-title-${p.level}">${p.name}</h3><div class="completionMedals"><span class="${wins.length ? "won beatenCount" : ""}">${wins.length ? `✓ Beaten ${wins.length}/${E.MODES.length}` : unlocked ? "" : "🔒 Locked"}</span>${wins.length ? `<span class="gold flawlessCount">★ Flawless ${flawless}/${E.MODES.length}</span>` : ""}</div></div><span class="levelStats">${p.average}–${p.average + 5} average</span></div></div>
        <div class="modeMarks" role="group" aria-label="Match formats for ${p.name}">${E.MODES.map(mode => modeChip(p.level, mode, selectedMode)).join("")}</div>
        ${modeResults(p.level,selectedMode)}
        <div class="botCardControls pillPlayControls"><input id="bot-mode-${p.level}" type="hidden" value="${selectedMode}">${!user ? `<a class="primary signupToPlay" href="${authUrl("register")}">Sign up to play</a>` : `<button id="play-bot-${p.level}" type="button" class="primary" data-play-level="${p.level}" ${canPlay(p.level,selectedMode) ? "" : "disabled"}>Play ${p.name} · ${selectedMode===E.BULL_MODE ? "Bull or Bust" : `Best of ${selectedMode}`}</button>`}</div>
        ${selectedMode===E.BULL_MODE && !E.isFormatUnlocked(p.level,E.BULL_MODE,progress) ? '<p class="lockedHint">🔒 Beat BO1, BO3, BO5 and BO7 on this bot first to unlock Bull or Bust.</p>' : ""}
        <p id="bot-mode-rules-${p.level}" class="bullModeRules" ${selectedMode === E.BULL_MODE ? "" : "hidden"}>${BULL_RULES}</p>
        ${requirements(p.level)}</article>`;
    }).join("");
    complete = E.LEVELS.filter(p => E.MODES.every(mode => progress.has(`${p.level}-${mode}`))).length;
    $("progressSummary").textContent = `${progress.size} / 50 formats won · ★ ${E.goldStars(progress,bestScores)} gold stars`;
    $("botLevels").scrollTop = scrollTop;
  }
  async function loadProgress() {
    ready = false;
    $("accountLoadingText").textContent = "Loading your Monster Bot progress…";
    $("accountSpinner").hidden = false;
    $("saveStatus").hidden = true;
    $("retryAccount").hidden = true;
    renderLevels();
    try { user = await window.ONMBotData.withTimeout(window.ONMFirebase.currentFirebaseUser()); }
    catch {
      user = null;
      $("saveStatus").textContent = "Your sign-in could not be checked. Please retry; you do not need to create another account.";
      $("saveStatus").hidden = false;
      $("retryAccount").hidden = false;
      $("accountLoadingText").textContent = "We couldn't check your account. Please retry above.";
      $("accountSpinner").hidden = true;
      renderLevels(); loadCommunity(); return;
    }
    storageKey = user ? `onm-monster-bot-${user.uid}` : "onm-monster-bot-guest";
    progress = new Set(user ? safeLoad(storageKey) : []);
    bestScores = user ? readScores(storageKey + "-scores") : {};
    if (user) {
      try {
        const { db, firestoreSdk: sdk } = await window.ONMBotData.withTimeout(window.ONMFirebase.ready);
        const snap = await window.ONMBotData.withTimeout(sdk.getDoc(sdk.doc(db, "users", user.uid)));
        (snap.data()?.monsterBotWins || []).filter(k => validKeys.has(k)).forEach(k => progress.add(k));
        for (const [key, score] of Object.entries(snap.data()?.monsterBotBestScores || {})) if (E.validWinningScore(key, score)) bestScores[key] = E.bestScore(bestScores[key], score);
        // Retry wins that were saved on this device while offline.
        if (progress.size) window.ONMBotData.withTimeout(syncAccount(),5000).catch(()=>{
          $("saveStatus").textContent = "Your saved progress is loaded. Account sync is unavailable; retry when connected.";
          $("saveStatus").hidden = false;
        });
        $("saveStatus").textContent = "Signed in. Progress synced to your account.";
      } catch {
        $("saveStatus").textContent = "Your account progress could not be loaded. Please retry.";
        $("saveStatus").hidden = false; $("retryAccount").hidden = false;
        $("accountLoadingText").textContent = "Waiting for your saved progress. Please retry above.";
        $("accountSpinner").hidden = true;
        renderLevels(); return;
      }
    } else $("saveStatus").innerHTML = `No active sign-in was found in this browser. <a href="${authUrl("login")}">Sign in and return to the game</a> or <a href="${authUrl("register")}">sign up</a>.`;
    ready = true;
    renderLevels();
    focusUnlocked();
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
    if (!canPlay(level,bestOf)) return;
    clearTimeout(timer);
    match = { level, bestOf, leg: 1, starter: "player", player: newPlayer(), bot: newPlayer(), history: [], ended: false, legEnded: false };
    match.turn = match.starter;
    const playingUid = user.uid;
    window.ONMFirebase.ready.then(({db,firestoreSdk:sdk}) => sdk.updateDoc(sdk.doc(db,"users",playingUid),{monsterBotStarted:true})).then(() => loadCommunity(true)).catch(() => {});
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
    if (match.ended) $("turnStatus").textContent = match.player.legs > match.bot.legs ? `You win ${match.player.legs}–${match.bot.legs}! ${match.bot.legs === 0 ? "★ Flawless victory · Gold star!" : "✓ Format beaten."}${E.MODES.every(mode => progress.has(`${match.level}-${mode}`)) ? " ☑ Level complete!" : ""}${match.level < 10 && E.isUnlocked(match.level + 1, progress, bestScores) ? ` ${botName(match.level + 1)} unlocked!` : ""}` : `${botName(match.level)} wins ${match.bot.legs}–${match.player.legs}. Try again!`;
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
  $("botLevels").addEventListener("click", event => {
    const choice = event.target.closest("[data-choose-mode]");
    if (choice) {
      const level = Number(choice.dataset.chooseLevel), mode = Number(choice.dataset.chooseMode);
      if (!E.MODES.includes(mode)) return;
      modes.set(level,mode); renderLevels();
      $("bot-level-"+level)?.querySelector?.(`[data-choose-mode="${mode}"]`)?.focus();
      return;
    }
    const completion = event.target.closest("[data-community-key]");
    if (completion) { completionKey = completion.dataset.communityKey; showCompletionList(); $("completionDialog").showModal(); return; }
    const button = event.target.closest("[data-play-level]");
    if (button) {
      const level = Number(button.dataset.playLevel), format = Number($("bot-mode-" + level).value);
      playGame(level,format);
    }
  });
  $("botLevels").addEventListener("keydown",event=>{
    if (event.key !== "Escape") return;
    const picker = event.target.closest(".modePicker");
    if (picker) { picker.open=false;picker.querySelector("summary").focus(); }
  });
  $("botLevels").addEventListener("toggle",event=>{
    if (event.target.matches?.(".modePicker") && event.target.open) requestAnimationFrame(()=>event.target.scrollIntoView({block:"nearest",inline:"nearest"}));
  },true);
  $("closeCompletions").addEventListener("click", () => $("completionDialog").close());
  $("completionDialog").addEventListener("click", event => {
    if (event.target === $("completionDialog")) { $("completionDialog").close(); return; }
    const button = event.target.closest("[data-completion-format]");
    if (button) playGame(Number(button.dataset.completionLevel),Number(button.dataset.completionFormat));
  });
  $("retryCompletions").addEventListener("click", () => { $("completionStatus").textContent = "Loading completions…"; loadCommunity(Boolean(user)); });
  $("scoreForm").addEventListener("submit", event => { event.preventDefault(); humanVisit(); });
  $("bustVisit").addEventListener("click", () => humanVisit(true));
  $("undoVisit").addEventListener("click", () => { if (!undo || busy || match.ended) return; match = undo; undo = null; $("scoreError").textContent = ""; renderMatch(); $("visitScore").focus(); });
  $("nextLeg").addEventListener("click", () => {
    if (!match?.legEnded || match.ended) return;
    match.leg++; match.starter = match.leg % 2 === 1 ? "player" : "bot";
    match.turn = match.starter; match.legEnded = false; undo = null;
    for (const side of ["player", "bot"]) { match[side].remaining = 501; match[side].legDarts = 0; }
    renderMatch(); scheduleBot();
  });
  $("leaveMatch").addEventListener("click", levels); $("backToLevels").addEventListener("click", levels);
  $("ladderTab").addEventListener("click", () => showTab(false));
  $("leaderboardTab").addEventListener("click", () => showTab(true));
  $("retryLeaderboard").addEventListener("click", () => loadCommunity(Boolean(user)));
  $("retryAccount").addEventListener("click", () => loadProgress());
  window.addEventListener("beforeunload", event => { if (match && !match.ended) { event.preventDefault(); event.returnValue = ""; } });
  loadCommunity();
  if (window.location.hash === "#leaderboard") showTab(true);
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
