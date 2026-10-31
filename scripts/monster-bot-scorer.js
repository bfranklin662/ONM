(function () {
  "use strict";
  if (!BOT_MODE) return;
  const E = window.MonsterBotEngine;
  const level = Number(params.get("level")), format = Number(params.get("format"));
  const casual = params.get("casual")==="1";
  const survival=params.get("survival")==="1",survivalRun=params.get("run");
  const survivalTier=Number(params.get("tier")||1),survivalRound=E.localLevel(level),survivalBots=survivalTier===2?E.TIER2_LEVELS:E.LEVELS,survivalFirst=survivalBots[0].name;
  let survivalReported=false;
  const casualLegs = Number(params.get("legs"));
  const casualStart=Number(params.get("start")||501);
  const formatLabel = survival ? `Survival · Round ${survivalRound}/10` : casual ? `Casual · BO${casualLegs}` : E.modeLabel(format);
  const gameUrl = survival?"monster-survival.html":`dart-scorer.html?mode=bot&level=${level}&format=${format}${casual?`&casual=1&legs=${casualLegs}&start=${casualStart}`:""}`;
  const profile = E.ALL_LEVELS.find(p => p.level === level);
  let ladderSurvivalBest=0;
  const avatars = ["billy","croft","venton","istan","nick","ricky","aussie","andre","bailey","filip"];
  let user = null, active = false, timer = null, recorded = false, resultMessage = "", saving = null;
  let playerPhoto = "graphics/logoWoText.png";
  let knownWins = new Set(), knownScores = {};
  let undoFrame = null, replayVisit = null;
  let initialized = false, exited = false, restarting=false;
  let lossAnnounced = false, lossVoiceTimer = null;
  const ONE_SHOT_LOSS = "You can't intentionally bust your checkout to return to a score of 50 or more. This is one-shot Bull or Bust — better luck next time!";
  function announceLoss() {
    if(lossAnnounced) return;
    lossAnnounced = true;
    const speak = () => {
      if(exited) return;
      if(isDartCalloutBusy()) {lossVoiceTimer=setTimeout(speak,100);return;}
      playDartCallout("bot-lose.m4a");
    };
    speak();
  }
  function startWithAudio(countAttempt=true) {
    if (!initialized || active || exited) return;
    if(countAttempt&&!casual&&!survival&&user&&window.ONMBotAttempts){
      window.ONMBotAttempts.start(user.uid,key);
      window.ONMFirebase.ready.then(({db,firestoreSdk:sdk})=>window.ONMBotAttempts.sync(user.uid,db,sdk)).then(()=>{if(state.winnerIndex!==null)showResult();}).catch(()=>{});
    }
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
    } else playDartCallout("bot-start.m4a");
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  function humanVisit(visit) {
    if(survival)window.parent?.ONMMonsterSurvival?.recordAttempt?.({id:survivalRun,level});
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
    // Unlock announcements belong to the ladder, after the results screen.
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
  const startingScore = casual?casualStart:E.startScore(level,format);
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
    if (active && state.winnerIndex === null && state.currentPlayer === 1) els.turnMessage.textContent = `${profile.name}'s turn`;
    else if (playable) els.turnMessage.textContent = els.names[0].value === "You" ? "Your turn" : `${els.names[0].value}'s turn`;
  }
  async function saveVictory() {
    if (survival || casual || recorded || !user || state.winnerIndex !== 0) return;
    recorded = true;
    const score = {won:state.players[0].legs,lost:state.players[1].legs};
    const tier=E.tierOf(level),previouslyUnlocked = E.highestUnlocked(knownWins,knownScores,tier,ladderSurvivalBest);
    const tier2WasUnlocked=E.tier2EntryUnlocked(knownWins,knownScores,ladderSurvivalBest);
    knownWins.add(key);
    knownScores[key] = E.bestScore(E.validWinningScore(key,knownScores[key]) ? knownScores[key] : null,score);
    const nowUnlocked = E.highestUnlocked(knownWins,knownScores,tier,ladderSurvivalBest);
    const local = localProgress(user.uid);
    local.wins = [...new Set([...local.wins,key])];
    local.scores[key] = E.bestScore(E.validWinningScore(key,local.scores[key]) ? local.scores[key] : null,score);
    try {
      localStorage.setItem(storageKey(user.uid),JSON.stringify(local.wins));
      localStorage.setItem(storageKey(user.uid)+"-scores",JSON.stringify(local.scores));
      if(nowUnlocked>previouslyUnlocked||!tier2WasUnlocked&&E.tier2EntryUnlocked(knownWins,knownScores,ladderSurvivalBest)){
        const noticeKey=storageKey(user.uid)+"-unlocks";
        let queue=[];try{queue=JSON.parse(localStorage.getItem(noticeKey)||"[]");}catch{}
        if(!Array.isArray(queue))queue=[];
        for(let next=previouslyUnlocked+1;next<=nowUnlocked;next++)if(!queue.includes(next))queue.push(next);
        if(!tier2WasUnlocked&&E.tier2EntryUnlocked(knownWins,knownScores,ladderSurvivalBest)&&!queue.includes(11))queue.push(11);
        localStorage.setItem(noticeKey,JSON.stringify(queue));
      }
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
    reportSurvivalResult();
    const kicker = els.molVictoryOverlay?.querySelector(".readyLeagueKicker");
    if (kicker) kicker.textContent = survival?"Monster Survival":casual?"Casual Bot Game":"Monster Bot Game";
    els.molVictoryTitle.textContent = `${startingScore} · ${formatLabel}`;
    els.molVictoryCloseBtn.textContent = casual?"Back to casual":"Back to ladder";
    els.molVictoryRematchBtn.textContent = "Restart";
    els.molVictoryRematchBtn.hidden=!casual&&state.winnerIndex===0&&state.players[1].legs===0;
    if(survival){els.molVictoryCloseBtn.textContent=state.winnerIndex===0?(survivalRound===10?"Survival complete":`Next: ${survivalBots[survivalRound].name}`):"Back to Survival";els.molVictoryRematchBtn.textContent=`Restart from ${survivalFirst}`;}
    let status = $("monsterBotResultStatus");
    if (!status) { status = document.createElement("p"); status.id = "monsterBotResultStatus"; els.molVictoryTitle.after(status); }
    const won = state.winnerIndex === 0;
    status.textContent = casual ? `${won?"You win!":"You lose."} Casual game — no stats or progress saved.` : won ? (state.players[1].legs === 0 ? "Flawless Victory – Gold Star earned" : "Challenge beaten") : bullMode ? "You lose · One-shot Bull or Bust" : "You lose. Better luck next time!";
    els.molVictoryOverlay.classList.toggle("bullBustLoss",bullMode&&!won);
    if(survival)status.textContent=won?(survivalRound===10?"All ten Monsters defeated. Survival complete!":`${profile.name} defeated · ${survivalRound}/10 Monsters beaten`):`Run over. Your next attempt starts with ${survivalFirst}.`;
    status.classList.toggle("flawlessResult",!survival&&!casual&&won&&state.players[1].legs===0);
    const attempts=$("monsterBotResultAttempts");
    attempts.hidden=survival||casual||!window.ONMBotAttempts;
    attempts.textContent=attempts.hidden?"":`Your attempts: ${window.ONMBotAttempts.counts(user.uid)[key]||0}`;
  }
  function reportSurvivalResult(){
    if(!survival||survivalReported||state.winnerIndex===null)return;
    survivalReported=true;
    window.parent?.ONMMonsterSurvival?.recordResult({id:survivalRun,level,won:state.winnerIndex===0});
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
      reportSurvivalResult();
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
        const visit = undoFrame?.reply || replayVisit || E.botVisit(previousScore,player.currentLegDarts,profile,Math.random,startingScore);
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
    if(survival){if(window.parent?.ONMMonsterSurvival)window.parent.ONMMonsterSurvival.returnFromGame();else window.location.href="monster-survival.html";return;}
    if(window.parent!==window&&window.parent?.ONMMonsterLadder?.returnToLadder)window.parent.ONMMonsterLadder.returnToLadder(casual);
    else if(window.parent!==window&&window.parent?.ONMBotLaunch?.open)window.parent.location.href=destination;
    else window.location.href=destination;
  }
  async function rematch() {
    if(survival){clearTimeout(timer);clearTimeout(lossVoiceTimer);active=false;exited=true;window.speechSynthesis?.cancel();if(typeof clearDartAudioQueue==="function")clearDartAudioQueue();if(window.parent?.ONMMonsterSurvival)window.parent.ONMMonsterSurvival.returnFromGame(true);else window.location.href="monster-survival.html";return;}
    if(!casual&&knownWins.has(key)&&E.validWinningScore(key,knownScores[key])&&knownScores[key].lost===0)return;
    if(!initialized||exited||restarting)return;
    const countAttempt=state.winnerIndex!==null||state.players.some(player=>player.legs>0);
    restarting=true;active=false;clearTimeout(timer); clearTimeout(lossVoiceTimer);
    window.parent?.ONMBotLaunch?.prepareRestart?.(window);
    window.speechSynthesis?.cancel();
    if(typeof clearDartAudioQueue==="function")clearDartAudioQueue();
    $("monsterBotLoadingText").textContent=`Restarting ${profile.name} · ${formatLabel}`;
    $("monsterBotSplash").hidden=false;
    // Loss is a media clip, so Restart need not wait for speech-session ducking.
    await saving;
    restarting=false;if(exited)return;
    undoFrame=null;replayVisit=null;recorded=false;resultMessage="";saving=null;lossAnnounced=false;
    closeCheckoutPrompt();newGame();state.winnerIndex=null;state.currentPlayer=0;
    els.molVictoryOverlay.classList.add("hidden");els.molVictoryOverlay.setAttribute?.("aria-hidden","true");
    els.quitConfirmOverlay.classList.add("hidden");els.quitConfirmOverlay.setAttribute?.("aria-hidden","true");
    exited=false;syncMainViews("game");render();
    // Keep the same authenticated scorer and frame. A retry is a new game,
    // not a fresh page load or a second Firebase sign-in restoration.
    window.parent?.ONMBotLaunch?.resetAnnouncement?.(window);
    startWithAudio(countAttempt);
  }
  async function init() {
    document.body.classList.add("monsterBotScorer");
    document.body.classList.remove("casualMode"); document.body.classList.add("leagueMode");
    syncMainViews("none");
    $("screenTitleText").classList.remove("hidden");
    $("screenTitleText").textContent = "Loading Monster Bot…";
    if (!profile || !E.MODES.includes(format) || survival&&(casual||format!==1||![1,2].includes(survivalTier)||E.tierOf(level)!==survivalTier) || casual&&(!Number.isSafeInteger(casualLegs)||casualLegs<1||casualLegs%2!==1||![301,501,701].includes(casualStart))) { exit(); return; }
    try {
      user = await window.ONMBotData.withTimeout(window.ONMFirebase.currentFirebaseUser());
      if (!user) {
        const url=`auth.html?mode=login&redirect=${encodeURIComponent(gameUrl)}`;
        if(window.parent!==window&&(window.parent?.ONMMonsterLadder||window.parent?.ONMMonsterSurvival))window.parent.location.href=url;
        else window.location.href=url;
        return;
      }
      const {db,firestoreSdk:sdk} = await window.ONMBotData.withTimeout(window.ONMFirebase.ready);
      if(survival&&!window.parent?.ONMMonsterSurvival?.authorize(survivalRun,level,user.uid)){exit();return;}
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
      let deviceSurvivalBest=0;try{deviceSurvivalBest=Number(localStorage.getItem(`onm-survival-best-${user.uid}`))||0;}catch{}
      ladderSurvivalBest=Math.max(accountProfile.monsterSurvivalCompleted?10:Number(accountProfile.monsterSurvivalBest)||0,deviceSurvivalBest);
      if(survival&&E.highestUnlocked(wins,scores,survivalTier)<(survivalTier===2?13:3)){exit();return;}
      if (!survival&&(!E.isUnlocked(level,wins,scores,ladderSurvivalBest) || !casual&&(!E.isFormatUnlocked(level,format,wins)||wins.has(key)&&E.validWinningScore(key,scores[key])&&scores[key].lost===0))) { exit(); return; }
      knownWins = wins; knownScores = scores;
      if(!casual&&!survival)window.ONMBotAttempts?.load(user.uid,accountProfile);
      loadPlayerPhoto(accountProfile);
      MATCH_MODE = "local"; STATS_MODE = "casual"; window.STATS_MODE = STATS_MODE;
      applyMatchSettings({startScore:startingScore,gameType:"bestOf",legsCount:casual?casualLegs:bullMode ? 1 : format,inMode:"straight"});
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
      if(survival)$("screenTitleText").textContent="Monster Survival";
      $("monsterBotNotice").textContent = bullMode ? "301 · One-shot Bull or Bust: finish on Bull and confirm it. Below 50, a bust or a zero visit when on a finish loses. You can't intentionally bust to return to 50 or more." : "You throw first in leg one; the starting player alternates each leg. The bot throws one second after the announcement finishes.";
      if(survival)$("monsterBotNotice").textContent=`Survival · Round ${survivalRound}/10 · One 501 leg. Lose, quit or restart and your run begins again with ${survivalFirst}.`;
      $("botRestartGame").hidden = false;
      if(survival)$("botRestartGame").textContent=`Restart run from ${survivalFirst}`;
      $("monsterBotNotice").classList.remove("hidden");
      state.currentPlayer = 0; syncMainViews("game"); render();
      enterScorerFullscreen();
      initialized = true;
      startWithAudio();
      window.addEventListener("pointerdown", () => {
        if (!active || document.fullscreenElement) return;
        document.documentElement?.requestFullscreen?.()?.catch?.(() => {});
      }, {once:true});
      if(!casual&&!survival)sdk.updateDoc(sdk.doc(db,"users",user.uid),{monsterBotStarted:true}).catch(()=>{});
      if (sdk && (await window.ONMFirebase.ready).authSdk?.onAuthStateChanged) {
        const {auth,authSdk} = await window.ONMFirebase.ready;
        let authLossTimer=null;
        authSdk.onAuthStateChanged(auth,current => {
          clearTimeout(authLossTimer);
          if(current?.uid===user.uid)return;
          if(current){exit();return;}
          // A transient null notification must not eject a restored session.
          authLossTimer=setTimeout(async()=>{
            try{const restored=await window.ONMFirebase.currentFirebaseUser();if(restored?.uid!==user.uid)exit();}catch{/* Connection failures are not sign-outs. */}
          },1500);
        });
      }
    } catch {
      $("screenTitleText").textContent = "Could not load your bot game. Return to the ladder and retry.";
      $("monsterBotLoadingText").textContent = "Could not load your game. Please return to the ladder and retry.";
      document.body.classList.add("monsterBotLoadFailed");
    }
  }
  function photo(index) { return index === 1 ? level===20?"graphics/bots/cod-bot.png":level===19?"graphics/bots/gary-bot.png":level===18?"graphics/bots/seb-bot.png":level===17?"graphics/bots/piesse-bot.png":level===16?"graphics/bots/russ-bot.png?v=20261027-fixed":level===15?"graphics/bots/bobby-bot.png":level===14?"graphics/bots/scottsman-bot.png":level===13?"graphics/bots/phil-bot.png":level===12?"graphics/bots/paddy-bot.png":level===11?"graphics/bots/george-bot.png":level<=10?`graphics/bots/${avatars[level-1]}-bot.png`:"graphics/logoWoText.png" : playerPhoto; }
  $("closeBotUnlocked").addEventListener("click",()=>$("botUnlockedDialog").close());
  $("botRestartGame").addEventListener("click",rematch);
  window.ONMMonsterScorer = {init,submit,undo,confirmCheckout,afterVisit,onRender,showResult,showUnlock,exit,rematch,photo,tracksCheckouts:()=>casual,cancelCheckout:()=>{if(bullMode && pendingCheckoutPrompt?.legWon){lose("Bull checkout was not confirmed.");return true;}return false;},canPlay:()=>active && state.currentPlayer === 0 && state.winnerIndex === null};
  window.addEventListener("pagehide",()=>{exited=true;active=false;clearTimeout(timer);clearTimeout(lossVoiceTimer);window.speechSynthesis?.cancel();});
  init();
})();
