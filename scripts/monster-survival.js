(function(){
  "use strict";
  const $=id=>document.getElementById(id),E=window.MonsterBotEngine,S=window.ONMSurvivalState;
  const avatars=["billy","croft","venton","istan","nick","ricky","aussie","andre","bailey","filip"];
  const tier2Avatars=["george","paddy","phil","scottsman","bobby","russ","piesse","seb","gary","cod"];
  const avatar=level=>tier===1?`graphics/bots/${avatars[level-1]}-bot.png`:tier2Avatars[level-1]?`graphics/bots/${tier2Avatars[level-1]}-bot.png?v=20261027-russ-fixed`:"graphics/logoWoText.png";
  let tier=1,tier2Unlocked=false,accountData={};
  const bots=()=>tier===2?E.TIER2_LEVELS:E.LEVELS;
  const firstBot=()=>bots()[0].name;
  const canSurvive=()=>Boolean(user&&(tier===1||tier2Unlocked)&&E.highestUnlocked(new Set(accountData.monsterBotWins||[]),accountData.monsterBotBestScores||{},tier)>=(tier===2?13:3));
  const field=name=>`monsterSurvival${tier===2?"Tier2":""}${name}`;
  const bestKey=()=>`onm-survival-best-${tier===2?"tier2-":""}${user.uid}`;
  let user=null,run=null,transitionTimer=null,champion=false,loading=false,best=0,previous=null,boardLoading=false,stopAccountWatch=null;
  const previousKey=()=>`onm-survival-previous-${tier}-${user.uid}`;
  function loadPrevious(){previous=null;try{const saved=localStorage.getItem(previousKey());if(saved!==null&&saved!==undefined)previous=cap(Number(saved));}catch{}if(Number.isInteger(accountData[field("Previous")]))previous=cap(accountData[field("Previous")]);}
  function savePrevious(){
    if(!user||!run||run.previousSaved||run.status==="ready")return;
    run.previousSaved=true;previous=cap(run.beaten);accountData[field("Previous")]=previous;
    try{localStorage.setItem(previousKey(),String(previous));}catch{}
    const uid=user.uid,key=field("Previous"),value=previous;
    window.ONMFirebase.ready.then(({db,firestoreSdk:sdk})=>sdk.updateDoc(sdk.doc(db,"users",uid),{[key]:value})).catch(()=>{});
  }
  const badges=round=>`${best>0&&best<10&&round===best+1?'<small class="survivalBestBadge">BEST</small>':""}${previous!==null&&previous<10&&round===previous+1?'<small class="survivalPreviousBadge">PREVIOUS</small>':""}`;
  const cap=value=>Number.isInteger(value)?Math.max(0,Math.min(10,value)):0;
  const escape=value=>String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let playerPhotos={};
  const photoKey=value=>String(value||"").toLowerCase().replace(/\.[^/.]+$/,"").replace(/[^a-z0-9]/g,"");
  function boardPhoto(row){const stored=row.photoUrl||"";return stored&&!/^\/?images\/players\//i.test(stored)?stored:playerPhotos[photoKey(stored.split("/").pop())]||playerPhotos[photoKey(row.name)]||"graphics/logoWoText.png";}
  const fresh=()=>S.fresh(crypto.randomUUID());
  const trophyKey=()=>`onm-survival-complete-${tier===2?"tier2-":""}${user.uid}`;
  function render(){
    const accessible=canSurvive()&&!loading;
    $("survivalRoute").hidden=!accessible;$("survivalRouteTitle").hidden=!accessible;
    $("survivalPersonalBest").hidden=!accessible;$("survivalTrophy").hidden=!accessible||!champion;
    $("startSurvival").textContent=canSurvive()?"Play Survival":`🔒 Reach Level 3 · Tier ${tier} Ladder`;
    $("survivalTierTabs").hidden=!tier2Unlocked;$("survivalTierTwo").hidden=!tier2Unlocked;
    $("survivalTierOne").setAttribute("aria-selected",String(tier===1));$("survivalTierTwo").setAttribute("aria-selected",String(tier===2));
    $("startSurvival").disabled=!canSurvive()||loading||run?.status==="playing";
    $("startSurvival").hidden=!user;$("survivalSignUp").hidden=Boolean(user)||loading;
    $("survivalTrophy").hidden=!accessible||!champion;
    $("survivalPersonalBest").textContent=user?`Your best run: ${best}/10 Monsters beaten`:"";
    $("botProfileLink").href=user?"account.html":"auth.html?mode=register&redirect=monster-survival.html";
    $("botProfileLink").setAttribute("aria-label",user?"My account":"Sign up or sign in");
    const revealed=Math.min(10,Math.max(run?.level||1,best+1));
    $("survivalRoute").innerHTML=bots().map((profile,index)=>{const bot={...profile,level:index+1};return bot.level>revealed?`<li class="survivalMystery"><span>ROUND ${bot.level}</span><span class="survivalMysteryLock" aria-hidden="true">🔒</span><strong>Mystery Monster</strong><span>Survive to reveal</span></li>`:`<li class="${run?.beaten>=bot.level?"defeated":run?.level===bot.level?"current":""}"><span>${run?.beaten>=bot.level?"✓ DEFEATED":`ROUND ${bot.level}`}</span><img src="${avatar(bot.level)}" alt=""><strong class="survivalOpponentName">${bot.name}<span class="survivalRoundBadges">${badges(bot.level)}</span></strong><span>${bot.average}–${bot.average+5} avg</span></li>`}).join("");
    if(best===10||previous===10)$("survivalRoute").innerHTML+=`<li class="survivalCompleted"><strong>✓ Completed</strong><span class="survivalRoundBadges">${best===10?'<small class="survivalBestBadge">BEST</small>':""}${previous===10?'<small class="survivalPreviousBadge">PREVIOUS</small>':""}</span></li>`;
  }
  async function persistBest(value){
    best=Math.max(best,cap(value));accountData[field("Best")]=best;if(best===10)accountData[field("Completed")]=true;const uid=user.uid,saved=best,startedField=field("Started"),bestField=field("Best"),completeField=field("Completed");
    try{localStorage.setItem(bestKey(),String(saved));}catch{}
    render();
    const {db,firestoreSdk:sdk}=await window.ONMBotData.withTimeout(window.ONMFirebase.ready);
    await window.ONMBotData.withTimeout(sdk.runTransaction(db,async tx=>{
      const ref=sdk.doc(db,"users",uid),snap=await tx.get(ref),data=snap.data()||{};
      const maximum=Math.max(saved,data[completeField]===true?10:cap(data[bestField]));
      tx.update(ref,{[startedField]:true,[bestField]:maximum,...(maximum===10?{[completeField]:true}:{})});
    }));
  }
  async function saveCompletion(){
    champion=true;try{localStorage.setItem(trophyKey(),"earned");}catch{}
    render();$("survivalTrophySave").textContent="Completion saved on this device. Syncing to your account…";
    try{await persistBest(10);$("survivalTrophySave").textContent="Completion saved to your account.";}
    catch{$("survivalTrophySave").textContent="Completion saved on this device. Reopen Survival when connected to sync it.";}
  }
  function launchLeg(){
    if(!canSurvive()||!run||!["ready","between"].includes(run.status))return;
    run=S.begin(run);render();const bot=bots()[run.level-1];
    $("botLaunchText").textContent=`Survival · Round ${run.level}/10 · ${bot.name}`;$("botLaunchSplash").hidden=false;
    window.ONMBotLaunch.open(`dart-scorer.html?mode=bot&survival=1&tier=${tier}&level=${bot.level}&format=1&run=${encodeURIComponent(run.id)}`);
  }
  function endRun(message){savePrevious();clearTimeout(transitionTimer);$("survivalTransition").hidden=true;window.ONMBotLaunch.close();run=fresh();$("survivalStatus").textContent=message;render();$("startSurvival").focus();}
  function returnFromGame(restart=false){
    window.ONMBotLaunch.close();$("botLaunchSplash").hidden=true;
    if(restart){endRun(`New run. ${firstBot()} is waiting.`);launchLeg();return;}
    if(run?.status==="between"){
      render();const beaten=run.beaten,next=bots()[run.level-1];
      $("survivalTransitionTitle").textContent=`${bots()[beaten-1].name} eliminated!`;
      $("survivalNextDetail").textContent=`Up next · Level ${run.level} · ${next.name} · ${next.average}–${next.average+5} average`;
      $("survivalDefeatedAvatar").src=avatar(beaten);$("survivalNextAvatar").src=avatar(run.level);
      const overlay=$("survivalTransition");overlay.hidden=false;overlay.focus();
      $("continueSurvivalTransition").focus();
    }else if(run?.status==="complete"){
      render();$("survivalStatus").textContent="Ten wins. Zero losses. Survival complete!";
      $("survivalChampionDialog").showModal();window.ONMBotLaunch.celebrate($("survivalChampionDialog"));
    }else endRun(run?.status==="lost"?`Run over after ${run.beaten} wins. Start again with ${firstBot()}.`:`Run ended. Your next run starts with ${firstBot()}.`);
  }
  window.ONMMonsterSurvival={
    authorize:(id,level,uid)=>Boolean(canSurvive()&&user.uid===uid&&run?.id===id&&bots()[run.level-1].level===level&&run.status==="playing"),
    recordResult({id,level,won}){try{run=S.finish(run,id,E.localLevel(level),won);}catch{return false;}if(run.status==="complete"){savePrevious();saveCompletion();}else if(!won)savePrevious();else if(won)persistBest(run.beaten).catch(()=>{$("survivalStatus").textContent="Best run saved on this device. Reopen Survival when connected to sync it.";});return true;},
    returnFromGame
  };
  async function load(){
    if(loading)return;loading=true;$("survivalStatus").setAttribute("aria-busy","true");$("retrySurvivalAccount").hidden=true;render();
    try{
      user=await window.ONMBotData.withTimeout(window.ONMFirebase.currentFirebaseUser());
      if(!user){$("survivalStatus").textContent="Sign up or sign in to start your Survival run.";return;}
      run=fresh();$("survivalStatus").textContent=`${firstBot()} is waiting.`;
      $("survivalSignUp").hidden=true;
      try{champion=localStorage.getItem(trophyKey())==="earned";best=cap(Number(localStorage.getItem(bestKey())));}catch{}
      try{const {db,firestoreSdk:sdk}=await window.ONMBotData.withTimeout(window.ONMFirebase.ready);const snap=await window.ONMBotData.withTimeout(sdk.getDoc(sdk.doc(db,"users",user.uid))),data=snap.data()||{};accountData=data;loadPrevious();tier2Unlocked=E.tier2EntryUnlocked(new Set(data.monsterBotWins||[]),data.monsterBotBestScores||{});champion=champion||data[field("Completed")]===true;best=Math.max(best,cap(data[field("Best")]),champion?10:0);if(champion)saveCompletion();else if(best>cap(data[field("Best")]))persistBest(best).catch(()=>{});}catch{/* A restored signed-in session may play while offline. */}
    }catch{$("survivalStatus").textContent="Couldn't check your account. Please retry.";$("retrySurvivalAccount").hidden=false;}
    finally{loading=false;$("survivalStatus").setAttribute("aria-busy","false");render();
      if(user&&!stopAccountWatch)window.ONMFirebase.ready.then(({db,firestoreSdk:sdk})=>{
        if(sdk.onSnapshot)stopAccountWatch=sdk.onSnapshot(sdk.doc(db,"users",user.uid),snap=>{accountData=snap.data()||{};loadPrevious();tier2Unlocked=E.tier2EntryUnlocked(new Set(accountData.monsterBotWins||[]),accountData.monsterBotBestScores||{});render();},()=>{});
      }).catch(()=>{});
    }
  }
  $("startSurvival").addEventListener("click",()=>{if(!canSurvive())return;persistBest(0).catch(()=>{});run=fresh();launchLeg();});
  async function loadBoard(refresh=false){
    if(boardLoading)return;boardLoading=true;$("survivalBoardStatus").setAttribute("aria-busy","true");$("refreshSurvivalBoard").disabled=true;$("survivalBoardStatus").textContent="Loading Survival leaderboard…";
    try{
      const data=await window.ONMBotData.fetchCommunity({projectId:window.ONMFirebase.config.projectId,refresh,getToken:user?.getIdToken?()=>user.getIdToken():null});
      if(typeof fetch==="function")try{const response=await fetch("data/player-photo-map.json");if(response.ok)playerPhotos=await response.json();}catch{}
      const rows=tier===2?data.survivalTier2Leaderboard:data.survivalLeaderboard;
      if(!Array.isArray(rows))throw Error("Leaderboard service needs its Survival update.");
      $("survivalBoardRows").innerHTML=rows.map((row,index)=>`<tr><td>${index+1}</td><th scope="row"><span class="survivalBoardIdentity"><img src="${escape(boardPhoto(row))}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${escape(row.name)}</span><span aria-label="${escape(row.nationality)}">${escape(row.flag)}</span></span></th><td>${cap(row.best)}/10</td><td>${row.complete?"✓":"—"}</td></tr>`).join("");
      $("survivalBoardStatus").textContent=rows.length?"Ranked by most Monsters beaten in one run.":"No runs yet. Be the first to enter Survival.";
    }catch{$("survivalBoardStatus").textContent="Survival leaderboard couldn't load. Please refresh to retry.";}
    finally{boardLoading=false;$("survivalBoardStatus").setAttribute("aria-busy","false");$("refreshSurvivalBoard").disabled=false;}
  }
  function showView(board){
    $("survivalPlayPanel").hidden=board;$("survivalBoardPanel").hidden=!board;
    $("survivalPlayTab").setAttribute("aria-selected",String(!board));$("survivalBoardTab").setAttribute("aria-selected",String(board));
    $("survivalPageTitle").textContent=board?"Leaderboard":"Monster Survival";
    window.history?.replaceState(null,"",board?"#leaderboard":"#play");if(board)loadBoard(true);
  }
  $("survivalPlayTab").addEventListener("click",()=>showView(false));$("survivalBoardTab").addEventListener("click",()=>showView(true));
  $("refreshSurvivalBoard").addEventListener("click",()=>loadBoard(true));
  $("survivalBoardRows").addEventListener("error",event=>{if(event.target?.tagName==="IMG"&&!event.target.src.endsWith("graphics/logoWoText.png"))event.target.src="graphics/logoWoText.png";},true);
  window.addEventListener("hashchange",()=>showView(window.location?.hash==="#leaderboard"));
  $("retrySurvivalAccount").addEventListener("click",load);
  $("cancelSurvivalTransition").addEventListener("click",()=>endRun(`Run ended. Start again with ${firstBot()}.`));
  $("continueSurvivalTransition").addEventListener("click",()=>{$("survivalTransition").hidden=true;launchLeg();});
  $("survivalTransition").addEventListener("keydown",event=>{if(event.key==="Escape")endRun(`Run ended. Start again with ${firstBot()}.`);if(event.key==="Tab"){event.preventDefault();$("continueSurvivalTransition").focus();}});
  $("closeSurvivalChampion").addEventListener("click",()=>{$("survivalChampionDialog").close();$("startSurvival").focus();});
  window.addEventListener("pagehide",()=>clearTimeout(transitionTimer));
  let refreshingAccess=false;
  async function refreshAccess(){
    if(!user||loading||refreshingAccess)return;refreshingAccess=true;
    try{const {db,firestoreSdk:sdk}=await window.ONMBotData.withTimeout(window.ONMFirebase.ready);const snap=await window.ONMBotData.withTimeout(sdk.getDoc(sdk.doc(db,"users",user.uid)));accountData=snap.data()||{};loadPrevious();tier2Unlocked=E.tier2EntryUnlocked(new Set(accountData.monsterBotWins||[]),accountData.monsterBotBestScores||{});render();}catch{}finally{refreshingAccess=false;}
  }
  window.addEventListener("pageshow",refreshAccess);window.addEventListener("focus",refreshAccess);
  if(document.addEventListener)document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshAccess();});
  window.addEventListener("storage",refreshAccess);
  async function selectTier(next){
    if(loading||run?.status==="playing"||run?.status==="between"||next===2&&!tier2Unlocked)return;
    tier=next;loadPrevious();run=fresh();best=cap(accountData[field("Best")]);champion=accountData[field("Completed")]===true;
    try{best=Math.max(best,cap(Number(localStorage.getItem(bestKey()))));champion=champion||localStorage.getItem(trophyKey())==="earned";}catch{}
    $("survivalStatus").textContent=`${firstBot()} is waiting.`;render();if(!$("survivalBoardPanel").hidden)loadBoard(true);
  }
  $("survivalTierOne").addEventListener("click",()=>selectTier(1));$("survivalTierTwo").addEventListener("click",()=>selectTier(2));
  showView(window.location?.hash==="#leaderboard");
  load();
})();
