(function () {
  "use strict";
  if (!BOT_MODE) return;
  const E = window.MonsterBotEngine;
  const level = Number(params.get("level")), format = Number(params.get("format"));
  const casual = params.get("casual")==="1";
  const casualLegs = Number(params.get("legs"));
  const formatLabel = casual ? `Casual · First to ${casualLegs}` : E.modeLabel(format);
  const gameUrl = `dart-scorer.html?mode=bot&level=${level}&format=${format}${casual?`&casual=1&legs=${casualLegs}`:""}`;
  const profile = E.LEVELS.find(p => p.level === level);
  const avatars = ["billy","croft","venton","istan","nick","ricky","aussie","andre","bailey","filip"];
  let user = null, active = false, timer = null, recorded = false, resultMessage = "", saving = null;
  let playerPhoto = "graphics/logoWoText.png";
  let knownWins = new Set(), knownScores = {}, pendingUnlock = null, resultVisible = false, pendingCasualUnlock = false;
  let undoFrame = null, replayVisit = null;
  let initialized = false, exited = false;
  let lossAnnounced = false, lossVoiceTimer = null;
  const ONE_SHOT_LOSS = "You can't intentionally bust your checkout to return to a score of 50 or more. This is one-shot Bull or Bust — better luck next time!";
  function announceLoss() {
    if(lossAnnounced || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    lossAnnounced = true;
    const speak = () => {
      if(exited) return;
      if(isDartCalloutBusy()) {lossVoiceTimer=setTimeout(speak,100);return;}
      try {window.speechSynthesis.speak(new window.SpeechSynthesisUtterance("You lose"));} catch {}
    };
    speak();
  }
  function startWithAudio() {
    if (!initialized || active || exited) return;
    active = true;
    state.matchStartedAt = new Date();
    $("monsterBotSplash").hidden = true;
    document.body.classList.remove("monsterBotLoading");
    render();
    if(window.parent!==window && window.parent?.ONMBotLaunch?.ready(window)) {
      // The gesture-authorised parent audio plays as the ready scorer is revealed.
    } else if(params.get("intro")==="played") {
      // Consume the launch cue so a later refresh is treated as a fresh game.
      const url=new URL(window.location.href);url.searchParams.delete("intro");
      window.history?.replaceState(null,"",url.pathname+url.search+url.hash);
    } else playDartCallout("game-on.mp3");
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  function humanVisit(visit) {
    undoFrame = {players:clone(state.players),visitHistory:clone(state.visitHistory),currentPlayer:state.currentPlayer,legJustWon:state.legJustWon,reply:replayVisit};
    applyVisit(visit);
  }
  function undo() {
    if (!active || !undoFrame || state.winnerIndex !== null || pendingCheckoutPrompt) return;
    clearTimeout(timer); timer = null;
    replayVisit = undoFrame.reply;
    state.players = clone(undoFrame.players);
    state.visitHistory = clone(undoFrame.visitHistory);
    state.currentPlayer = undoFrame.currentPlayer;
    state.legJustWon = undoFrame.legJustWon;
    undoFrame = null;
    els.input.value = "";
    render();
    els.turnMessage.textContent = "Score undone for both players. Enter your corrected score.";
  }
  function showUnlock() {
    resultVisible = true;
    if (!pendingUnlock) return;
    const unlocked = pendingUnlock; pendingUnlock = null;
    const casualMilestone=pendingCasualUnlock;pendingCasualUnlock=false;
    $("botUnlockedTitle").textContent = casualMilestone ? `You've unlocked ${unlocked.name} and Casual mode!` : `You've unlocked ${unlocked.name}!`;
    $("botUnlockedAvatar").src = `graphics/bots/${avatars[unlocked.level-1]}-bot.png`;
    $("botUnlockedAvatar").alt = `${unlocked.name} avatar`;
    $("botUnlockedDetail").textContent = `Level ${unlocked.level} · ${unlocked.average}–${unlocked.average + 5} average. ${casualMilestone?"Casual mode is now available from the dice icon: play any unlocked bot with your own leg target, without saving stats or earning awards.":"Your next Monster is ready."}`;
    $("botUnlockedDialog").showModal();
    celebrateUnlock();
    if(casualMilestone&&user)window.ONMFirebase.ready.then(({db,firestoreSdk:sdk})=>sdk.updateDoc(sdk.doc(db,"users",user.uid),{monsterBotCasualNoticeSeen:true})).catch(()=>{});
  }
  function celebrateUnlock(){
    const host=window.parent!==window?window.parent:window;
    host?.ONMBotLaunch?.celebrate();
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    const dialog=$("botUnlockedDialog");
    for(let i=0;i<42;i++){
      const spark=document.createElement("span");spark.className="botUnlockSpark";spark.setAttribute("aria-hidden","true");
      const angle=Math.PI*2*i/14,distance=70+Math.random()*100;
      spark.style.setProperty("--x",`${Math.cos(angle)*distance}px`);spark.style.setProperty("--y",`${Math.sin(angle)*distance}px`);
      spark.style.setProperty("--delay",`${Math.floor(i/14)*.35}s`);spark.style.setProperty("--spark-color",["#ffd740","#67e0bd","#fff"][i%3]);
      dialog.appendChild(spark);setTimeout(()=>spark.remove(),2000);
    }
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
  const bullMode = !casual && format === E.BULL_MODE;
  const startingScore = casual?501:E.startScore(level,format);
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
    els.keypad.querySelectorAll("button").forEach(button => { button.disabled = button.dataset.action === "undo" ? !active || !undoFrame || state.winnerIndex !== null || Boolean(pendingCheckoutPrompt) : !playable; });
    if (active && state.winnerIndex === null && state.currentPlayer === 1) els.turnMessage.textContent = `${profile.name} is throwing…`;
    else if (playable && els.names[0].value === "You") els.turnMessage.textContent = "Your turn!";
  }
  async function saveVictory() {
    if (casual || recorded || !user || state.winnerIndex !== 0) return;
    recorded = true;
    const score = {won:state.players[0].legs,lost:state.players[1].legs};
    const previouslyUnlocked = E.highestUnlocked(knownWins,knownScores);
    knownWins.add(key);
    knownScores[key] = E.bestScore(E.validWinningScore(key,knownScores[key]) ? knownScores[key] : null,score);
    const nowUnlocked = E.highestUnlocked(knownWins,knownScores);
    if(previouslyUnlocked<3&&nowUnlocked>=3)pendingCasualUnlock=true;
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
    if (kicker) kicker.textContent = casual?"Casual Bot Game":"Monster Bot Game";
    els.molVictoryTitle.textContent = `${startingScore} · ${formatLabel}`;
    els.molVictoryCloseBtn.textContent = casual?"Back to casual":"Back to ladder";
    els.molVictoryRematchBtn.textContent = "Restart";
    if(!casual&&knownWins.has(key)&&E.validWinningScore(key,knownScores[key])&&knownScores[key].lost===0){els.molVictoryRematchBtn.textContent="Completed this game mode";els.molVictoryRematchBtn.disabled=true;}
    let status = $("monsterBotResultStatus");
    if (!status) { status = document.createElement("p"); status.id = "monsterBotResultStatus"; els.molVictoryTitle.after(status); }
    const won = state.winnerIndex === 0;
    status.textContent = casual ? `${won?"You win!":"You lose."} Casual game — no stats or progress saved.` : `${won ? (state.players[1].legs === 0 ? "★ Flawless victory · Gold star! " : "✓ Challenge beaten. ") : "You lose. "}${resultMessage}`;
  }
  function lose(reason) {
    clearTimeout(timer); timer = null;
    state.players[1].legs = E.legsNeeded(format); state.winnerIndex = 1; active = false;
    resultMessage = reason; closeCheckoutPrompt(); render(); announceLoss();
    openMolVictoryScreen(buildLocalMatchStatsData());
  }
  function submit() {
    if (!active || state.currentPlayer !== 0 || state.winnerIndex !== null || pendingCheckoutPrompt) return;
    const score = Number(els.input.value), previousScore = state.players[0].score, remaining = previousScore - score;
    if (!E.possibleScore(score)) { showImpossibleMessage("Enter a possible score from 0 to 180"); return; }
    if (bullMode && score === 0 && E.checkoutPossible(previousScore,3)) { lose(ONE_SHOT_LOSS); return; }
    if (bullMode && remaining !== 0 && remaining < 50) { state.players[0].score = remaining; lose(ONE_SHOT_LOSS); return; }
    if (!bullMode && (remaining < 0 || remaining === 1)) {
      if(casual&&E.checkoutPossible(previousScore,3)){openCheckoutPrompt({playerIndex:0,visitScore:0,previousScore,legWon:false,bust:true,dartsUsed:3,monsterBot:true,title:"Darts at double",doubleOptions:[0,1,2,3],checkoutOptions:null,bullOutOptions:null});return;}
      humanVisit({playerIndex:0,visitScore:0,previousScore,legWon:false,bust:true,dartsUsed:3,doublesAttempted:0}); return;
    }
    const error = E.validateVisit(previousScore,score,3);
    if (error) { showImpossibleMessage(error); return; }
    if (remaining === 0) {
      const visit = {playerIndex:0,visitScore:score,previousScore,legWon:true,bust:false,dartsUsed:3,doublesAttempted:0};
      if (!bullMode && !casual) { humanVisit(visit); return; }
      if(casual){
        const minimum=getMinimumCheckoutDarts(previousScore);
        openCheckoutPrompt({...visit,monsterBot:true,title:"Checkout details",doubleOptions:Array.from({length:4-minimum},(_,i)=>i+1),checkoutOptions:Array.from({length:4-minimum},(_,i)=>i+minimum),...getBullOutPromptConfig(previousScore)});return;
      }
      openCheckoutPrompt({...visit,monsterBot:true,doubleOptions:null,checkoutOptions:null,bullOutOptions:["No","Yes"],bullOutDefault:"No",forcedBullOut:false});
      return;
    }
    const visit={playerIndex:0,visitScore:score,previousScore,legWon:false,bust:false,dartsUsed:3,doublesAttempted:0};
    if(casual){const options=getDoubleOptionsForMissedVisit(previousScore,score);if(options?.length>1){openCheckoutPrompt({...visit,monsterBot:true,title:"Darts at double",doubleOptions:options,checkoutOptions:null,bullOutOptions:null});return;}}
    humanVisit(visit);
  }
  function confirmCheckout() {
    if (!active || !pendingCheckoutPrompt?.monsterBot || state.currentPlayer !== 0) return;
    const visit = pendingCheckoutPrompt;
    const dartsUsed = casual && visit.legWon ? Number(getSelectedPromptValue(els.checkoutPromptOptions))||3 : 3;
    const doublesAttempted=casual?Math.min(dartsUsed,Math.max(visit.legWon?1:0,Number(getSelectedPromptValue(els.doublePromptOptions))||0)):0;
    const selected = document.querySelector("#bullOutPromptOptions button.selected");
    const bullOut = selected ? selected.dataset.value === "Yes" : Boolean(visit.forcedBullOut);
    closeCheckoutPrompt();
    if (bullMode && (!bullOut || !E.bullCheckoutPossible(visit.visitScore,dartsUsed))) { lose(`A confirmed Bullseye finish is required. ${ONE_SHOT_LOSS}`); return; }
    if (visit.legWon && !E.checkoutPossible(visit.visitScore,dartsUsed)) { showImpossibleMessage("That checkout is not possible with those darts"); return; }
    humanVisit({...visit,dartsUsed,doublesAttempted,bullOut});
  }
  function afterVisit({legWon} = {}) {
    if (legWon) { undoFrame = null; replayVisit = null; onRender(); }
    if (state.winnerIndex !== null) {
      clearTimeout(timer); timer = null;
      if (state.winnerIndex === 0) saving = saveVictory();
      else announceLoss();
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
        const visit = undoFrame?.reply || replayVisit || E.botVisit(previousScore,player.currentLegDarts,profile);
        if (undoFrame) undoFrame.reply = clone(visit);
        replayVisit = null;
        els.submit.disabled = false;
        applyVisit({playerIndex:1,visitScore:visit.score,previousScore,legWon:visit.remaining === 0,bust:Boolean(visit.bust),dartsUsed:visit.darts,doublesAttempted:casual?visit.attempts||0:0,bullOut:visit.remaining === 0 && visit.hits?.at(-1) === 50});
      },1000);
    }
    waitForAnnouncement();
  }
  function exit() {
    exited = true;
    active = false; clearTimeout(timer); timer = null;
    clearTimeout(lossVoiceTimer); window.speechSynthesis?.cancel();
    const destination=casual?"monster-bot.html#casual":"monster-bot.html";
    window.parent?.ONMBotLaunch?.stop?.();
    if(window.parent!==window&&window.parent?.ONMBotLaunch?.open)window.parent.location.href=destination;
    else window.location.href=destination;
  }
  async function rematch() {
    if(!casual&&knownWins.has(key)&&E.validWinningScore(key,knownScores[key])&&knownScores[key].lost===0)return;
    active=false; exited=true; clearTimeout(timer); clearTimeout(lossVoiceTimer);
    window.speechSynthesis?.cancel();
    if(typeof fullyStopDartAudio==="function") fullyStopDartAudio();
    const host=window.parent!==window&&window.parent?.ONMBotLaunch?.open?window.parent:window;
    if(host.ONMBotLaunch?.open){host.ONMBotLaunch.open(gameUrl,saving);return;}
    let played=false;
    const intro=window.ONMBotLaunch?new Promise(resolve=>window.ONMBotLaunch.start(value=>{played=value;resolve();})):Promise.resolve();
    $("monsterBotLoadingText").textContent=`Restarting ${profile.name} · ${formatLabel}`;
    $("monsterBotSplash").hidden=false;
    await Promise.all([intro,saving]);
    if(played)window.location.href=gameUrl+"&intro=played";
    else window.location.reload();
  }
  async function init() {
    document.body.classList.add("monsterBotScorer");
    document.body.classList.remove("casualMode"); document.body.classList.add("leagueMode");
    syncMainViews("none");
    $("screenTitleText").classList.remove("hidden");
    $("screenTitleText").textContent = "Loading Monster Bot…";
    if (!profile || !E.MODES.includes(format) || casual&&(!Number.isSafeInteger(casualLegs)||casualLegs<1)) { exit(); return; }
    try {
      user = await window.ONMBotData.withTimeout(window.ONMFirebase.currentFirebaseUser());
      if (!user) {
        window.location.href = `auth.html?mode=login&redirect=${encodeURIComponent(gameUrl)}`; return;
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
      const highest=E.highestUnlocked(wins,scores);
      if (level>highest || casual&&highest<3 || !casual&&(!E.isFormatUnlocked(level,format,wins)||wins.has(key)&&E.validWinningScore(key,scores[key])&&scores[key].lost===0)) { exit(); return; }
      knownWins = wins; knownScores = scores;
      loadPlayerPhoto(accountProfile);
      MATCH_MODE = "local"; STATS_MODE = "casual"; window.STATS_MODE = STATS_MODE;
      applyMatchSettings({startScore:startingScore,gameType:casual?"firstTo":"bestOf",legsCount:casual?casualLegs:bullMode ? 1 : format,inMode:"straight"});
      newGame(); state.winnerIndex = null; state.matchStartedAt = new Date();
      let name = firstName || "You";
      try { const account = JSON.parse(localStorage.getItem("onmUser") || "null"); if (!firstName && account?.uid === user.uid) name = account.firstName?.trim() || "You"; } catch {}
      setVisiblePlayerNames(name,profile.name);
      els.names.forEach(input => { input.readOnly = true; });
      const avatar = document.createElement("img"); avatar.className = "monsterScorerAvatar"; avatar.src = photo(1); avatar.alt = `${profile.name} avatar`;
      els.names[1].before(avatar);
      $("screenTitleText").textContent = "Monster Bot Game";
      els.gameTitleText.textContent = `${startingScore} · ${formatLabel} · ${profile.name}`;
      if(casual)$("screenTitleText").textContent="Casual Bot Game";
      $("monsterBotNotice").textContent = bullMode ? "301 · One-shot Bull or Bust: finish on Bull and confirm it. Below 50, a bust or a zero visit when on a finish loses. You can't intentionally bust to return to 50 or more." : "You throw first in leg one; the starting player alternates each leg. The bot throws one second after the announcement finishes.";
      $("botRestartGame").hidden = false;
      $("monsterBotNotice").classList.remove("hidden");
      state.currentPlayer = 0; syncMainViews("game"); render();
      enterScorerFullscreen();
      initialized = true;
      startWithAudio();
      window.addEventListener("pointerdown", () => {
        if (!active || document.fullscreenElement) return;
        document.documentElement?.requestFullscreen?.()?.catch?.(() => {});
      }, {once:true});
      if(!casual)sdk.updateDoc(sdk.doc(db,"users",user.uid),{monsterBotStarted:true}).catch(()=>{});
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
  $("botRestartGame").addEventListener("click",rematch);
  window.ONMMonsterScorer = {init,submit,undo,confirmCheckout,afterVisit,onRender,showResult,showUnlock,exit,rematch,photo,tracksCheckouts:()=>casual,cancelCheckout:()=>{if(bullMode && pendingCheckoutPrompt?.legWon){lose("Bull checkout was not confirmed.");return true;}return false;},canPlay:()=>active && state.currentPlayer === 0 && state.winnerIndex === null};
  window.addEventListener("pagehide",()=>{exited=true;active=false;clearTimeout(timer);clearTimeout(lossVoiceTimer);window.speechSynthesis?.cancel();});
  init();
})();
