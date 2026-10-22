(function () {
  "use strict";
  if (!BOT_MODE) return;
  const E = window.MonsterBotEngine;
  const level = Number(params.get("level")), format = Number(params.get("format"));
  const profile = E.LEVELS.find(p => p.level === level);
  const avatars = ["billy","croft","venton","istan","nick","ricky","aussie","andre","bailey","filip"];
  let user = null, active = false, timer = null, recorded = false, resultMessage = "", saving = null;
  let playerPhoto = "graphics/logoWoText.png";
  let knownWins = new Set(), knownScores = {}, pendingUnlock = null, resultVisible = false;
  function showUnlock() {
    resultVisible = true;
    if (!pendingUnlock) return;
    const unlocked = pendingUnlock; pendingUnlock = null;
    $("botUnlockedTitle").textContent = `You've unlocked ${unlocked.name}!`;
    $("botUnlockedAvatar").src = `graphics/bots/${avatars[unlocked.level-1]}-bot.png`;
    $("botUnlockedAvatar").alt = `${unlocked.name} avatar`;
    $("botUnlockedDetail").textContent = `Level ${unlocked.level} · ${unlocked.average}–${unlocked.average + 5} average. Your next Monster is ready.`;
    $("botUnlockedDialog").showModal();
  }
  async function loadPlayerPhoto(account) {
    try {
      const resolved = await window.ONMSession?.resolveProfileImage?.(account);
      playerPhoto = resolved || account.photoUrl || account.photo || playerPhoto;
      if (state.winnerIndex !== null) {
        els.molVictoryPlayerOnePhoto.src = playerPhoto;
        els.molVictoryPlayerOnePhoto.classList.toggle("defaultMonsterPhoto", playerPhoto.includes("logoWoText"));
      }
    } catch { /* Keep the existing fallback if the linked photo is unavailable. */ }
  }
  const bullMode = format === E.BULL_MODE;
  const $ = id => document.getElementById(id);
  const key = `${level}-${format}`;
  const storageKey = uid => `onm-monster-bot-${uid}`;
  function localProgress(uid) {
    try {
      return {wins:JSON.parse(localStorage.getItem(storageKey(uid)) || "[]"),scores:JSON.parse(localStorage.getItem(storageKey(uid)+"-scores") || "{}")};
    } catch { return {wins:[],scores:{}}; }
  }
  function onRender() {
    const playable = active && state.currentPlayer === 0 && state.winnerIndex === null;
    els.submit.disabled = !playable;
    els.input.disabled = !playable;
    els.keypad.querySelectorAll("button").forEach(button => { button.disabled = !playable || button.dataset.action === "undo"; });
    if (active && state.winnerIndex === null && state.currentPlayer === 1) els.turnMessage.textContent = `${profile.name} is throwing…`;
    else if (playable && els.names[0].value === "You") els.turnMessage.textContent = "Your turn!";
  }
  async function saveVictory() {
    if (recorded || !user || state.winnerIndex !== 0) return;
    recorded = true;
    const score = {won:state.players[0].legs,lost:state.players[1].legs};
    const previouslyUnlocked = E.highestUnlocked(knownWins,knownScores);
    knownWins.add(key);
    knownScores[key] = E.bestScore(E.validWinningScore(key,knownScores[key]) ? knownScores[key] : null,score);
    const nowUnlocked = E.highestUnlocked(knownWins,knownScores);
    if (nowUnlocked > previouslyUnlocked) pendingUnlock = E.LEVELS[nowUnlocked-1];
    if (resultVisible) showUnlock();
    const local = localProgress(user.uid);
    local.wins = [...new Set([...local.wins,key])];
    local.scores[key] = E.bestScore(E.validWinningScore(key,local.scores[key]) ? local.scores[key] : null,score);
    try {
      localStorage.setItem(storageKey(user.uid),JSON.stringify(local.wins));
      localStorage.setItem(storageKey(user.uid)+"-scores",JSON.stringify(local.scores));
    } catch { /* Account save below still runs when browser storage is blocked. */ }
    resultMessage = "Victory saved on this device. Syncing to your account…";
    try {
      const {db,firestoreSdk:sdk} = await window.ONMBotData.withTimeout(window.ONMFirebase.ready);
      await sdk.runTransaction(db,async tx => {
        const ref = sdk.doc(db,"users",user.uid), snap = await tx.get(ref), scores = snap.data()?.monsterBotBestScores || {};
        tx.update(ref,{monsterBotStarted:true,monsterBotWins:sdk.arrayUnion(key),monsterBotBestScores:{...scores,[key]:E.bestScore(E.validWinningScore(key,scores[key]) ? scores[key] : null,score)}});
      });
      resultMessage = "Victory saved to your account.";
    } catch { resultMessage = "Victory saved on this device. Open the ladder when connected to retry account sync."; }
    if (state.winnerIndex !== null) showResult();
  }
  function showResult() {
    const kicker = els.molVictoryOverlay?.querySelector(".readyLeagueKicker");
    if (kicker) kicker.textContent = "Monster Bot Game";
    els.molVictoryTitle.textContent = `501 · ${E.modeLabel(format)}`;
    els.molVictoryCloseBtn.textContent = "Back to ladder";
    let status = $("monsterBotResultStatus");
    if (!status) { status = document.createElement("p"); status.id = "monsterBotResultStatus"; els.molVictoryTitle.after(status); }
    const won = state.winnerIndex === 0;
    status.textContent = `${won ? (state.players[1].legs === 0 ? "★ Flawless victory · Gold tick! " : "✓ Challenge beaten. ") : "Challenge not completed. "}${resultMessage}`;
  }
  function lose(reason) {
    clearTimeout(timer); timer = null;
    state.players[1].legs = E.legsNeeded(format); state.winnerIndex = 1; active = false;
    resultMessage = reason; closeCheckoutPrompt(); render();
    openMolVictoryScreen(buildLocalMatchStatsData());
  }
  function submit() {
    if (!active || state.currentPlayer !== 0 || state.winnerIndex !== null || pendingCheckoutPrompt) return;
    const score = Number(els.input.value), previousScore = state.players[0].score, remaining = previousScore - score;
    if (!E.possibleScore(score)) { showImpossibleMessage("Enter a possible score from 0 to 180"); return; }
    if (bullMode && remaining !== 0 && remaining < 50) { state.players[0].score = remaining; lose("Below 50 — Bull or Bust lost."); return; }
    if (!bullMode && (remaining < 0 || remaining === 1)) {
      applyVisit({playerIndex:0,visitScore:0,previousScore,legWon:false,bust:true,dartsUsed:3,doublesAttempted:0}); return;
    }
    const error = E.validateVisit(previousScore,score,3);
    if (error) { showImpossibleMessage(error); return; }
    if (remaining === 0) {
      const visit = {playerIndex:0,visitScore:score,previousScore,legWon:true,bust:false,dartsUsed:3,doublesAttempted:0};
      if (!bullMode) { applyVisit(visit); return; }
      openCheckoutPrompt({...visit,monsterBot:true,doubleOptions:null,checkoutOptions:null,bullOutOptions:["No","Yes"],bullOutDefault:"No",forcedBullOut:false});
      return;
    }
    applyVisit({playerIndex:0,visitScore:score,previousScore,legWon:false,bust:false,dartsUsed:3,doublesAttempted:0});
  }
  function confirmCheckout() {
    if (!active || !pendingCheckoutPrompt?.monsterBot || state.currentPlayer !== 0) return;
    const visit = pendingCheckoutPrompt;
    const dartsUsed = 3;
    const selected = document.querySelector("#bullOutPromptOptions button.selected");
    const bullOut = selected ? selected.dataset.value === "Yes" : Boolean(visit.forcedBullOut);
    closeCheckoutPrompt();
    if (bullMode && (!bullOut || !E.bullCheckoutPossible(visit.visitScore,dartsUsed))) { lose("Bull or Bust needs a valid, confirmed Bullseye finish."); return; }
    if (!E.checkoutPossible(visit.visitScore,dartsUsed)) { showImpossibleMessage("That checkout is not possible with those darts"); return; }
    applyVisit({...visit,dartsUsed,doublesAttempted:0,bullOut});
  }
  function afterVisit() {
    if (state.winnerIndex !== null) {
      clearTimeout(timer); timer = null;
      if (state.winnerIndex === 0) saving = saveVictory();
      return;
    }
    if (!active || state.currentPlayer !== 1 || timer !== null) return;
    function waitForAnnouncement() {
      if (!active || state.winnerIndex !== null || state.currentPlayer !== 1) { timer = null; return; }
      if (isDartCalloutBusy()) {
        timer = setTimeout(waitForAnnouncement,100);
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        if (!active || state.winnerIndex !== null || state.currentPlayer !== 1) return;
        if (isDartCalloutBusy()) { waitForAnnouncement(); return; }
        const player = state.players[1], previousScore = player.score;
        const visit = E.botVisit(previousScore,player.currentLegDarts,profile);
        els.submit.disabled = false;
        applyVisit({playerIndex:1,visitScore:visit.score,previousScore,legWon:visit.remaining === 0,bust:Boolean(visit.bust),dartsUsed:visit.darts,doublesAttempted:0,bullOut:visit.remaining === 0 && visit.hits?.at(-1) === 50});
      },1000);
    }
    waitForAnnouncement();
  }
  function exit() {
    active = false; clearTimeout(timer); timer = null;
    window.location.href = "monster-bot.html";
  }
  async function rematch() { if (saving) await saving; window.location.reload(); }
  async function init() {
    document.body.classList.add("monsterBotScorer");
    document.body.classList.remove("casualMode"); document.body.classList.add("leagueMode");
    syncMainViews("none");
    $("screenTitleText").classList.remove("hidden");
    $("screenTitleText").textContent = "Loading Monster Bot…";
    if (!profile || !E.MODES.includes(format)) { exit(); return; }
    try {
      user = await window.ONMBotData.withTimeout(window.ONMFirebase.currentFirebaseUser());
      if (!user) {
        window.location.href = `auth.html?mode=login&redirect=${encodeURIComponent(`dart-scorer.html?mode=bot&level=${level}&format=${format}`)}`; return;
      }
      const {db,firestoreSdk:sdk} = await window.ONMBotData.withTimeout(window.ONMFirebase.ready);
      const local = localProgress(user.uid), scores = {...local.scores}, wins = new Set(local.wins);
      let firstName = "";
      let accountProfile = {uid:user.uid,userId:user.uid};
      try { const cached = JSON.parse(localStorage.getItem("onmUser") || "null"); if (cached?.uid === user.uid) accountProfile = {...accountProfile,...cached}; } catch {}
      try {
        const snap = await window.ONMBotData.withTimeout(sdk.getDoc(sdk.doc(db,"users",user.uid))), data = snap.data() || {};
        accountProfile = {...accountProfile,...data,uid:user.uid,userId:user.uid};
        firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
        (data.monsterBotWins || []).forEach(win => wins.add(win));
        for (const [key,score] of Object.entries(data.monsterBotBestScores || {})) if (E.validWinningScore(key,score)) scores[key] = E.bestScore(E.validWinningScore(key,scores[key]) ? scores[key] : null,score);
      } catch { /* Retain this account's locally saved progress while offline. */ }
      if (level > E.highestUnlocked(wins,scores) || !E.isFormatUnlocked(level,format,wins)) { exit(); return; }
      knownWins = wins; knownScores = scores;
      loadPlayerPhoto(accountProfile);
      MATCH_MODE = "local"; STATS_MODE = "casual"; window.STATS_MODE = STATS_MODE;
      applyMatchSettings({startScore:501,gameType:"bestOf",legsCount:bullMode ? 1 : format,inMode:"straight"});
      newGame(); state.winnerIndex = null; state.matchStartedAt = new Date();
      let name = firstName || "You";
      try { const account = JSON.parse(localStorage.getItem("onmUser") || "null"); if (!firstName && account?.uid === user.uid) name = account.firstName?.trim() || "You"; } catch {}
      setVisiblePlayerNames(name,profile.name);
      els.names.forEach(input => { input.readOnly = true; });
      const avatar = document.createElement("img"); avatar.className = "monsterScorerAvatar"; avatar.src = photo(1); avatar.alt = `${profile.name} avatar`;
      els.names[1].before(avatar);
      $("screenTitleText").textContent = "Monster Bot Game";
      els.gameTitleText.textContent = `501 · ${E.modeLabel(format)} · ${profile.name}`;
      $("monsterBotNotice").textContent = bullMode ? "Bull or Bust: finish on Bull and confirm it at checkout. Below 50 loses. You throw first." : "You throw first in leg one; the starting player alternates each leg. The bot throws one second after the announcement finishes.";
      $("monsterBotNotice").classList.remove("hidden");
      active = true; state.currentPlayer = 0; syncMainViews("game"); render();
      enterScorerFullscreen();
      $("monsterBotSplash").hidden = true;
      document.body.classList.remove("monsterBotLoading");
      playDartCallout("game-on.mp3", null, () => {
        // Some mobile browsers require the first tap before allowing sound.
        let retried = false;
        const retry = () => {
          if (retried) return;
          retried = true;
          if (active && state.winnerIndex === null) playDartCallout("game-on.mp3");
        };
        window.addEventListener("pointerdown", retry, {once:true});
        window.addEventListener("keydown", retry, {once:true});
      });
      window.addEventListener("pointerdown", () => {
        if (!active || document.fullscreenElement) return;
        document.documentElement?.requestFullscreen?.()?.catch?.(() => {});
      }, {once:true});
      sdk.updateDoc(sdk.doc(db,"users",user.uid),{monsterBotStarted:true}).catch(()=>{});
      if (sdk && (await window.ONMFirebase.ready).authSdk?.onAuthStateChanged) {
        const {auth,authSdk} = await window.ONMFirebase.ready;
        authSdk.onAuthStateChanged(auth,current => { if (current?.uid !== user.uid) exit(); });
      }
    } catch {
      $("screenTitleText").textContent = "Could not load your bot game. Return to the ladder and retry.";
      $("monsterBotLoadingText").textContent = "Could not load your game. Please return to the ladder and retry.";
      document.body.classList.add("monsterBotLoadFailed");
    }
  }
  function photo(index) { return index === 1 ? `graphics/bots/${avatars[level-1]}-bot.png` : playerPhoto; }
  $("closeBotUnlocked").addEventListener("click",()=>$("botUnlockedDialog").close());
  window.ONMMonsterScorer = {init,submit,confirmCheckout,afterVisit,onRender,showResult,showUnlock,exit,rematch,photo,cancelCheckout:()=>{if(bullMode && pendingCheckoutPrompt?.legWon){lose("Bull checkout was not confirmed.");return true;}return false;},canPlay:()=>active && state.currentPlayer === 0 && state.winnerIndex === null};
  window.addEventListener("pagehide",()=>{active=false;clearTimeout(timer);});
  init();
})();
