(function () {
  "use strict";
  const E = window.MonsterBotEngine, $ = id => document.getElementById(id);
  const trophyIcon='<svg class="platinumTrophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8v5a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v5m-4 4h8m-7 0v-4h6v4"/></svg>';
  let match = null, undo = null, timer = null, user = null, progress = new Set(), storageKey = "", busy = false, ready = false;
  const allBots=E.ALL_LEVELS;
  let selectedTier=1;
  const survivalBest=()=>{let deviceBest=0;try{deviceBest=Number(user&&localStorage.getItem(`onm-survival-best-${user.uid}`))||0;}catch{}return Math.max(playerProfile.monsterSurvivalCompleted?10:Number(playerProfile.monsterSurvivalBest)||0,deviceBest);};
  const validKeys = new Set(allBots.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)));
  const modes = new Map();
  let pendingBullGame=null;
  const authUrl = mode => `auth.html?mode=${mode}&redirect=monster-bot.html`;
  const isFlawless = (level,format) => {const key=`${level}-${format}`;return progress.has(key)&&E.validWinningScore(key,bestScores[key])&&bestScores[key].lost===0;};
  const canPlay = (level,format) => ready && user && allBots.some(p=>p.level===level) && E.isUnlocked(level,progress,bestScores,survivalBest()) && E.isFormatUnlocked(level,format,progress) && !isFlawless(level,format);
  const casualUnlocked = () => ready && Boolean(user);
  function renderCasual() {
    $("casualTab").hidden=!casualUnlocked();
    const bots=casualUnlocked()?allBots.filter(p=>E.isUnlocked(p.level,progress,bestScores,survivalBest())):[];
    const selected=bots.find(p=>p.level===Number($("casualBot").value))||bots[0];
    if(selected)$("casualBot").value=String(selected.level);
    $("casualBotCount").textContent=`Bots unlocked: ${bots.length}`;
    $("casualBots").innerHTML=bots.map(p=>`<button type="button" class="casualBotChoice" data-casual-bot="${p.level}" aria-pressed="${selected?.level===p.level}"><img src="${botAvatar(p.level)}" alt="" width="100" height="110"><span>${p.name}</span></button>`).join("");
    $("casualSelectedName").textContent=selected?`${selected.name} · ${selected.average}–${selected.average+5} average`:"";
    $("casualLocked").hidden=Boolean(casualUnlocked());$("casualForm").hidden=!selected;
  }
  let unlockNoticeLevel=null;
  const unlockQueueKey=()=>`onm-monster-bot-${user.uid}-unlocks`;
  function showUnlockNotices(){
    if(!ready||!user)return;
    try{
      for(const intro of ["survival","tiers"]){
        if(localStorage.getItem(`onm-intro-${intro}-v1-${user.uid}`))continue;
        unlockNoticeLevel=intro;
        $("ladderUnlockedTitle").textContent=intro==="survival"?"New game mode unlocked":"New Monsters. New Tiers!";
        $("ladderUnlockedAvatar").src=botAvatar(intro==="survival"?1:11);
        $("ladderUnlockedDetail").textContent=intro==="survival"?"One 501 leg against each of ten Monsters. Lose once and start again! Reach Level 3 on the Tier 1 Ladder to unlock Survival. Each tier has a separate best run and leaderboard.":"Unlock Tier 2 Ladder with 3 Tier 1 trophies and 20 Tier 1 gold stars. Earn a trophy by completing all five modes flawlessly against one Monster. Tier 2 brings ten new opponents and its own Survival tab—reach Level 3 on Tier 2 Ladder to play that Survival run.";
        $("ladderUnlockedDialog").showModal();localStorage.setItem(`onm-intro-${intro}-v1-${user.uid}`,"1");return;
      }
    }catch{}
    let queue=[];try{queue=JSON.parse(localStorage.getItem(unlockQueueKey())||"[]");if(E.tier2EntryUnlocked(progress,bestScores)&&!localStorage.getItem(`onm-tier2-announced-${user.uid}`)&&!queue.includes(11))queue.unshift(11);}catch{}
    const next=Array.isArray(queue)?queue.find(level=>Number.isInteger(level)&&level>1&&E.isUnlocked(level,progress,bestScores,survivalBest())):null;
    if(next){
      unlockNoticeLevel=next;const bot=allBots[next-1];
      $("ladderUnlockedTitle").textContent=next===11?"You've unlocked Tier 2 Ladder!":`You've unlocked ${bot.name}!`;
      $("ladderUnlockedAvatar").src=botAvatar(next);
      $("ladderUnlockedDetail").textContent=next===11?"Tier 2 has also been added to Survival. Reach Level 3 on the Tier 2 Ladder to unlock its Survival run.":`Tier ${E.tierOf(next)} · Level ${E.localLevel(next)} · ${bot.average}–${bot.average+5} average. Your next Monster is ready.`;
      $("ladderUnlockedDialog").showModal();window.ONMBotLaunch?.celebrate?.($("ladderUnlockedDialog"));return;
    }
  }
  function openCasual() {
    $("ladderPanel").hidden=true;$("leaderboardPanel").hidden=true;$("casualPanel").hidden=false;
    $("botPageTitle").textContent="Casual Bot Game";document.title="Casual Bot Game | Oche Ness Monsters";
    $("ladderTab").setAttribute("aria-selected","true");$("ladderTab").setAttribute("aria-label","Play casual");$("leaderboardTab").setAttribute("aria-selected","false");$("casualTab").setAttribute("aria-selected","true");
    window.history?.replaceState(null,"","#casual");renderCasual();window.dispatchEvent?.(new Event("onm-mode-change"));
  }
  function launch(url,label) {
    if(!window.ONMBotLaunch){window.location.href=url;return;}
    $("completionDialog").close();$("botLaunchText").textContent=label;$("botLaunchSplash").hidden=false;
    if(window.ONMBotLaunch.open)window.ONMBotLaunch.open(url);
    else window.ONMBotLaunch.start(played=>{window.location.href=url+(played?"&intro=played":"");});
  }
  function playGame(level,format,confirmed=false) {
    if (!canPlay(level,format)) return;
    if(format===E.BULL_MODE&&!confirmed){
      pendingBullGame={level,format};$("completionDialog").close();
      $("bullStartOpponent").textContent=`${botName(level)} · 301 · One leg`;
      $("bullStartDialog").showModal();return;
    }
    launch(`dart-scorer.html?mode=bot&level=${level}&format=${format}`,`Loading ${botName(level)} · ${E.modeLabel(format)}`);
  }
  function focusUnlocked() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const current = $("bot-level-" + (E.highestUnlocked(progress,bestScores,selectedTier,survivalBest())||(selectedTier===2?11:1)));
      if (!ready || !current || $("challengeSetup").hidden || $("ladderPanel").hidden) return;
      const list=$("botLevels");
      if(current.getBoundingClientRect&&list.getBoundingClientRect){
        list.scrollTop+=current.getBoundingClientRect().top-list.getBoundingClientRect().top;
      }else current.scrollIntoView({block:"start",inline:"nearest",behavior:"instant"});
    }));
  }
  let bestScores = {};
  let playerProfile = {};
  function renderPlayerSummary() {
    $("playerSummary").hidden = !ready || !user;
    if (!ready || !user) return;
    const firstName = playerProfile.firstName || user.displayName?.split(" ")[0] || "Player";
    $("playerSummaryName").textContent = firstName;
    const tierProgress=new Set([...progress].filter(key=>E.tierOf(Number(key.split("-")[0]))===selectedTier));
    const highest=E.highestUnlocked(progress,bestScores,selectedTier,survivalBest());
    $("playerSummaryLevel").textContent=highest?`Tier ${selectedTier} · Level ${E.localLevel(highest)} unlocked`:`Tier ${selectedTier} · Locked`;
    $("playerSummaryPhoto").src = leaderboardPhoto({photoUrl:playerProfile.photoUrl,name:playerProfile.linkedPlayerName || firstName});
    $("playerSummaryBeaten").textContent = `✓ Beaten ${tierProgress.size}`;
    $("playerSummaryFlawless").textContent = `★ Flawless ${E.goldStars(tierProgress,bestScores)}`;
    $("playerSummaryTrophies").innerHTML = `${trophyIcon}<span>Trophy ${E.trophies(progress,bestScores,selectedTier)}</span>`;
    $("playerSummaryPercent").textContent = `${Math.round(tierProgress.size/50*100)}% complete`;
    $("playerSummaryBar").max=50;
    $("playerSummaryBar").value = tierProgress.size;
  }
  const botName = level => allBots[level - 1].name;
  const avatarNames = { 1: "billy", 2: "croft", 3: "venton", 4: "istan", 5: "nick", 6: "ricky", 7: "aussie", 8: "andre", 9: "bailey", 10: "filip", 11: "george", 12: "paddy", 13: "phil", 14: "scottsman", 15: "bobby", 16: "russ", 17: "piesse", 18: "seb", 19: "gary", 20: "cod" };
  const botAvatar = level => avatarNames[level] ? `graphics/bots/${avatarNames[level]}-bot.png?v=20261027-russ-fixed` : "graphics/logoWoText.png";
  function requirements(level) {
    const rows = [];
    if(level===11&&!E.isUnlocked(level,progress,bestScores,survivalBest())){
      const trophies=E.trophies(progress,bestScores,1),stars=E.tierStars(progress,bestScores,1);
      return `<div class="unlockRequirements"><h4>Unlock Tier 2</h4><ul><li class="${trophies>=3?"met":""}">${trophies>=3?"✓":"○"} Earn 3 Tier 1 mastery trophies (${trophies}/3)</li><li class="${stars>=20?"met":""}">${stars>=20?"✓":"○"} Collect 20 Tier 1 gold stars (${stars}/20)</li></ul></div>`;
    }
    const local=E.localLevel(level),tier=E.tierOf(level),stars=E.tierStars(progress,bestScores,tier);
    if (local >= 3) {
      const required = 5 + (local - 3) * 4;
      rows.push({ label: `Collect ${required} gold stars (${stars}/${required})`, met: stars >= required });
    }
    const won = (bot, modes) => modes.every(mode => progress.has(`${bot}-${mode}`));
    if (local >= 2) rows.push({ label: `Beat ${botName(level - 1)} in 2 modes`, met: E.MODES.filter(mode => progress.has(`${level - 1}-${mode}`)).length >= 2 });
    if (local >= 3) rows.push({ label: `Beat ${botName(level - 2)} in BO1, BO3, BO5 and BO7`, met: won(level - 2, E.STANDARD_MODES) });
    if (local >= 4) rows.push({ label: local===4 ? `Beat ${botName(level-3)} in Bull or Bust format` : `Beat ${botName(level - 3)} in all five formats, including Bull or Bust`, met: won(level - 3, E.MODES) });
    if (local >= 5) rows.push({ label: `Earn flawless wins in all five ${botName(level - 4)} formats (gold ticks)`, met: E.MODES.every(mode => {
      const key = `${level - 4}-${mode}`;
      return progress.has(key) && E.validWinningScore(key, bestScores[key]) && bestScores[key].lost === 0;
    }) });
    if (E.isUnlocked(level,progress,bestScores,survivalBest())) return "";
    return rows.length ? `<div class="unlockRequirements"><h4>Requirements to play</h4><ul>${rows.map(row => `<li class="${row.met ? "met" : ""}"><span aria-label="${row.met ? "Met" : "Not met"}">${row.met ? "✓" : "○"}</span> ${row.label}</li>`).join("")}</ul></div>` : "";
  }
  function modeChip(level, mode, selectedMode) {
    const key = `${level}-${mode}`, won = progress.has(key), score = bestScores[key];
    const flawless = won && E.validWinningScore(key,score) && score.lost === 0;
    return `<button type="button" class="modePill ${flawless ? "gold" : won ? "won" : ""}" data-choose-level="${level}" data-choose-mode="${mode}" aria-pressed="${!flawless&&mode===selectedMode}" ${flawless?'aria-haspopup="dialog" ':""}aria-label="${E.modeLabel(mode)}, ${flawless ? "flawless win. View completions" : won ? "beaten" : "not beaten"}">${E.modeLabel(mode)} ${flawless ? "★" : won ? "✓" : "○"}</button>`;
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
  let leaderboardPhotos = {};
  const photoKey = value => String(value||"").toLowerCase().replace(/\.[^/.]+$/,"").replace(/[^a-z0-9]/g,"");
  function leaderboardPhoto(row) {
    const stored = row.photoUrl || "";
    if (stored && !/^\/?images\/players\//i.test(stored)) return stored;
    return leaderboardPhotos[photoKey(stored.split("/").pop())] || leaderboardPhotos[photoKey(row.name)] || "graphics/logoWoText.png";
  }
  function renderLeaderboard() {
    $("leaderboardStatus").setAttribute("aria-busy",String(Boolean(communityLoading)));
    $("leaderboardStatus").textContent = leaderboard ? (leaderboard.length ? `${leaderboard.length} players · Ranked by challenges completed, then level unlocked.` : "No players yet. Start your first match to join the leaderboard.") : communityError ? "Leaderboard could not be loaded. Please retry." : "Loading leaderboard…";
    $("leaderboardRows").innerHTML = (leaderboard || []).map((row,i) => `<tr><td>${i+1}</td><th scope="row"><span class="botLeaderboardIdentity"><img class="botLeaderboardPhoto" src="${escape(leaderboardPhoto(row))}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${escape(row.name)}</span>${row.flag ? `<span class="botLeaderboardFlag" role="img" aria-label="${escape(row.nationality || "Nationality")}" title="${escape(row.nationality || "Nationality")}">${escape(row.flag)}</span>` : ""}</span></th><td>${row.level>10?`T2 · ${E.localLevel(row.level)}`:row.level}</td><td class="challengesTotal">${row.completed}</td><td class="flawlessTotal">★ ${row.flawless ?? 0}</td><td class="trophiesTotal">${trophyIcon}<span>${row.trophies??0}</span></td></tr>`).join("");
    $("retryLeaderboard").hidden = !communityError;
    $("refreshLeaderboard").disabled = Boolean(communityLoading);
    $("refreshLeaderboard").setAttribute("aria-busy",String(Boolean(communityLoading)));
  }
  function showTab(board) {
    $("ladderTab").setAttribute("aria-label","Play ladder");
    $("casualPanel").hidden=true;$("casualTab").setAttribute("aria-selected","false");
    const hash = board ? "#leaderboard" : "#game";
    if (window.location.hash !== hash) window.history?.replaceState(null,"",hash);
    $("botPageTitle").textContent = board ? "Leaderboard" : "Monster Bot Game";
    document.title = `${board ? "Leaderboard" : "Monster Bot Game"} | Oche Ness Monsters`;
    $("ladderPanel").hidden = board; $("leaderboardPanel").hidden = !board;
    $("ladderTab").setAttribute("aria-selected", String(!board));
    window.dispatchEvent?.(new Event("onm-mode-change"));
    $("leaderboardTab").setAttribute("aria-selected", String(board));
    if (board) { renderLeaderboard(); loadCommunity(Boolean(user)); }
    else focusUnlocked();
  }
  function showCompletionList() {
    if (!completionKey) return;
    const parts = completionKey.split("-");
    const level = parts[0] === "level" ? Number(parts[1]) : Number(parts[0]);
    $("completionTitle").textContent = `${botName(level)} · ${parts[0] === "level" ? "All formats" : E.modeLabel(Number(parts[1]))}`;
    const ownScore = bestScores[completionKey], beaten = Boolean(user && progress.has(completionKey));
    const flawless = beaten && E.validWinningScore(completionKey,ownScore) && ownScore.lost === 0;
    $("completionYourResult").hidden = !beaten;
    $("completionYourResult").className = `completionYourResult ${flawless ? "gold" : "won"}`;
    $("completionYourResult").textContent = beaten ? `${flawless ? "★ Flawless win" : "✓ You've beaten this challenge"}${E.validWinningScore(completionKey,ownScore) ? ` · ${ownScore.won}–${ownScore.lost}` : ""}` : "";
    $("completionYourAttempts").hidden=!user||!ready;
    if(user&&ready){
      const counts=window.ONMBotAttempts?.counts(user.uid)||{};
      const attempts=parts[0]==="level"?E.MODES.reduce((sum,mode)=>sum+(counts[`${level}-${mode}`]||0),0):counts[completionKey]||0;
      $("completionYourAttempts").textContent=`Your attempts: ${attempts}`;
    }
    const names = community?.[completionKey] || [];
    $("completionStatus").textContent = community ? `${names.length} ${names.length === 1 ? "player has" : "players have"} won${names.length ? ":" : " this challenge yet."}` : communityError ? "Completion counts could not be loaded. Please retry." : "Loading completions…";
    $("completionNames").innerHTML = names.map(value=>{
      const row=typeof value==="string"?{name:value,results:[]}:value;
      const results=row.results||[],gold=parts[0]==="level"?E.MODES.every(mode=>results.some(result=>result.mode===mode&&result.flawless)):results.some(result=>result.flawless);
      return `<li class="completionPlayerRow"><span class="botLeaderboardIdentity"><img class="botLeaderboardPhoto" src="${escape(leaderboardPhoto(row))}" alt="" loading="lazy" referrerpolicy="no-referrer"><strong>${escape(row.name)}</strong>${row.flag?`<span class="botLeaderboardFlag" role="img" aria-label="${escape(row.nationality||"Nationality")}">${escape(row.flag)}</span>`:""}</span><span class="completionAward ${gold?"gold":"won"}" aria-label="${gold?"Flawless win":"Beaten"}">${gold?"★":"✓"}</span></li>`;
    }).join("");
    $("retryCompletions").hidden = !communityError;
  }
  async function loadCommunity(refresh = false) {
    if (communityLoading) return communityLoading;
    communityError = false;
    renderLeaderboard(); showCompletionList();
    $("refreshLeaderboard").disabled = true;
    $("refreshLeaderboard").setAttribute("aria-busy","true");
    $("leaderboardStatus").setAttribute("aria-busy","true");
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
    $("botProfileLink").href=ready&&user?"account.html":authUrl("register");
    $("botProfileLink").setAttribute("aria-label",ready&&user?"My account":"Sign up or sign in");
    if(!ready||!user){$("completionYourAttempts").hidden=true;$("completionYourResult").hidden=true;}
    renderCasual();
    const tier2Visible=ready&&user&&E.tier2EntryUnlocked(progress,bestScores);
    $("ladderTierTabs").hidden=!tier2Visible;$("ladderTierTwo").hidden=!tier2Visible;
    if(!tier2Visible)selectedTier=1;
    renderPlayerSummary();
    $("ladderTierOne").setAttribute("aria-selected",String(selectedTier===1));$("ladderTierTwo").setAttribute("aria-selected",String(selectedTier===2));
    $("accountLoading").hidden = ready;
    $("guestLanding").hidden = !ready || Boolean(user);
    $("botLevels").hidden = !ready || !user;
    $("progressSummary").hidden = !ready;
    if (!ready) { $("botLevels").innerHTML = ""; return; }
    let complete = 0;
    const scrollTop = $("botLevels").scrollTop;
    const highest=E.highestUnlocked(progress,bestScores,selectedTier,survivalBest());
    const visibleThrough = selectedTier===2?Math.min(20,(highest||10)+1):Math.min(10,highest+1);
    $("botLevels").innerHTML = allBots.filter(p => E.tierOf(p.level)===selectedTier&&p.level <= visibleThrough).reverse().map(p => {
      const wins = E.MODES.filter(mode => progress.has(`${p.level}-${mode}`));
      const flawless = wins.filter(mode => {
        const key = `${p.level}-${mode}`;
        return E.validWinningScore(key,bestScores[key]) && bestScores[key].lost === 0;
      }).length;
      const previous=modes.get(p.level);
      const selectedMode = previous&&!isFlawless(p.level,previous)?previous:E.MODES.find(mode=>!progress.has(`${p.level}-${mode}`))||E.MODES.find(mode=>!isFlawless(p.level,mode))||null;
      const replay = progress.has(`${p.level}-${selectedMode}`);
      const beaten = wins.length === E.MODES.length;
      const gold = flawless === E.MODES.length;
      const unlocked = E.isUnlocked(p.level, progress, bestScores,survivalBest());
      if (!unlocked) return `<article class="botLevel locked mysteryBot" id="bot-level-${p.level}" aria-labelledby="bot-title-${p.level}"><div class="mysteryPreview" aria-hidden="true"><img src="${botAvatar(p.level)}" alt=""><div>?????<br>Monster Bot</div></div><div class="mysteryLock"><span aria-hidden="true">🔒</span><h3 id="bot-title-${p.level}">Level ${E.localLevel(p.level)} · ${p.level===11?"George Bot":"Mystery Bot"}</h3><p>${p.level===11?"37.5–42.5 average · Earn three trophies and 20 gold stars to enter.":"Unlock this level to reveal your opponent."}</p></div>${requirements(p.level)}</article>`;
      if (gold) complete++;
      const avatar = botAvatar(p.level) ? `<img class="botAvatar" src="${botAvatar(p.level)}" alt="${p.name} ${p.level>20?"avatar coming soon":"cartoon avatar"}">` : "";
      return `<article class="botLevel ${gold ? "complete flawlessComplete" : beaten ? "beatenComplete" : ""} ${unlocked ? "unlocked" : "locked"}" id="bot-level-${p.level}" aria-labelledby="bot-title-${p.level}">
        <div class="botCardHeading">${avatar}<div><span class="levelNumber">Level ${E.localLevel(p.level)}</span><div class="levelTitle"><h3 id="bot-title-${p.level}">${p.name}</h3><div class="completionMedals"><span class="${wins.length ? "won beatenCount" : ""}">${wins.length ? `✓ Beaten ${wins.length}/${E.MODES.length}` : unlocked ? "" : "🔒 Locked"}</span>${wins.length ? `<span class="gold flawlessCount">★ Flawless ${flawless}/${E.MODES.length}</span>` : ""}${gold?`<span class="monsterComplete"><span class="monsterMasterTrophy" role="img" aria-label="${p.name} mastery trophy: all five modes flawless" title="Monster Mastery · All five modes flawless">${trophyIcon}</span> Trophy 1</span>`:""}</div></div><span class="levelStats">${p.average}–${p.average + 5} average</span></div></div>
        <div class="modeMarks" role="group" aria-label="Match formats for ${p.name}">${E.MODES.map(mode => modeChip(p.level, mode, selectedMode)).join("")}</div>
        ${selectedMode!==null?`<div class="botCardControls pillPlayControls"><input id="bot-mode-${p.level}" type="hidden" value="${selectedMode}">${!user ? "" : `<button id="play-bot-${p.level}" type="button" class="primary" data-play-level="${p.level}" ${canPlay(p.level,selectedMode) ? "" : "disabled"}>${replay ? `Replay ${p.name} · ${E.modeLabel(selectedMode)}` : `Play ${p.name} · ${selectedMode===E.BULL_MODE ? "Bull or Bust" : `Best of ${selectedMode}`}`}</button>`}</div>`:""}
        ${selectedMode===E.BULL_MODE && !E.isFormatUnlocked(p.level,E.BULL_MODE,progress) ? '<p class="lockedHint">🔒 Beat BO1, BO3, BO5 and BO7 on this bot first to unlock Bull or Bust.</p>' : ""}
        ${requirements(p.level)}</article>`;
    }).join("");
    complete = E.LEVELS.filter(p => E.MODES.every(mode => progress.has(`${p.level}-${mode}`))).length;
    $("progressSummary").textContent = `${progress.size} formats won · ★ ${E.goldStars(progress,bestScores)} gold stars · ${E.trophies(progress,bestScores)} trophies`;
    $("botLevels").scrollTop = scrollTop;
  }
  async function loadProgress() {
    ready = false;
    $("botLaunchText").textContent="Loading your Monster Bot ladder…";
    $("botLaunchSplash").hidden=true;
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
      renderLevels(); $("botLaunchSplash").hidden=true; loadCommunity(); return;
    }
    storageKey = user ? `onm-monster-bot-${user.uid}` : "onm-monster-bot-guest";
    playerProfile={};try{const cached=JSON.parse(localStorage.getItem("onmUser")||"null");if(user&&cached?.uid===user.uid)playerProfile=cached;}catch{}
    progress = new Set(user ? safeLoad(storageKey) : []);
    bestScores = user ? readScores(storageKey + "-scores") : {};
    if (user) {
      try {
        const { db, firestoreSdk: sdk } = await window.ONMBotData.withTimeout(window.ONMFirebase.ready);
        const snap = await window.ONMBotData.withTimeout(sdk.getDoc(sdk.doc(db, "users", user.uid)));
        playerProfile = snap.data() || {};
        window.ONMBotAttempts?.load(user.uid,playerProfile);
        if(window.ONMBotAttempts&&Object.keys(window.ONMBotAttempts.counts(user.uid)).length){
          window.ONMBotAttempts.sync(user.uid,db,sdk).then(()=>showCompletionList()).catch(()=>{});
        }
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
        renderLevels(); $("botLaunchSplash").hidden=true; return;
      }
    } else $("saveStatus").innerHTML = `No active sign-in was found in this browser. <a href="${authUrl("login")}">Sign in and return to the game</a> or <a href="${authUrl("register")}">sign up</a>.`;
    ready = true;
    renderLevels();
    $("botLaunchSplash").hidden=true;
    focusUnlocked();
    showUnlockNotices();
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
  function newPlayer(start = 501) { return { remaining: start, legs: 0, points: 0, darts: 0, legDarts: 0 }; }
  function begin(level, bestOf) {
    if (!canPlay(level,bestOf)) return;
    clearTimeout(timer);
    const startingScore = E.startScore(level,bestOf);
    match = { level, bestOf, leg: 1, starter: "player", player: newPlayer(startingScore), bot: newPlayer(startingScore), history: [], ended: false, legEnded: false };
    match.turn = match.starter;
    const playingUid = user.uid;
    window.ONMFirebase.ready.then(({db,firestoreSdk:sdk}) => sdk.updateDoc(sdk.doc(db,"users",playingUid),{monsterBotStarted:true})).then(() => loadCommunity(true)).catch(() => {});
    undo = null; busy = false;
    $("challengeSetup").hidden = true; $("matchPanel").hidden = false;
    $("matchFormat").textContent = match.bestOf === E.BULL_MODE ? `${startingScore} · Bull or Bust · BO1 · Bull out only` : `501 · Best of ${match.bestOf} · First to ${E.legsNeeded(match.bestOf)} ${match.bestOf === 1 ? "leg" : "legs"}`;
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
      if (score === 0 && E.checkoutPossible(match.player.remaining,3)) { loseBull("You lose — one-shot Bull or Bust: a zero visit on a finish ends the game. Better luck next time!"); return; }
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
      if(isFlawless(level,mode)){completionKey=`${level}-${mode}`;showCompletionList();$("completionDialog").showModal();return;}
      modes.set(level,mode); renderLevels();
      $("bot-level-"+level)?.querySelector?.(`[data-choose-mode="${mode}"]`)?.focus();
      return;
    }
    const completion = event.target.closest("[data-community-key]");
    if (completion) { const key=completion.dataset.communityKey,[level,mode]=key.split("-").map(Number);if(!isFlawless(level,mode))return;completionKey=key;showCompletionList();$("completionDialog").showModal();return; }
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
  $("confirmBullStart").addEventListener("click",()=>{
    const game=pendingBullGame;pendingBullGame=null;$("bullStartDialog").close();
    if(game)playGame(game.level,game.format,true);
  });
  $("cancelBullStart").addEventListener("click",()=>{pendingBullGame=null;$("bullStartDialog").close();});
  $("bullStartDialog").addEventListener("cancel",()=>{pendingBullGame=null;});
  $("closeLadderUnlocked").addEventListener("click",()=>{
    if(typeof unlockNoticeLevel==="string")try{localStorage.setItem(`onm-intro-${unlockNoticeLevel}-v1-${user.uid}`,"1");}catch{}
    if(unlockNoticeLevel===11)try{localStorage.setItem(`onm-tier2-announced-${user.uid}`,"1");}catch{}
    let queue=[];try{queue=JSON.parse(localStorage.getItem(unlockQueueKey())||"[]");}catch{}
    try{localStorage.setItem(unlockQueueKey(),JSON.stringify(Array.isArray(queue)?queue.filter(level=>level!==unlockNoticeLevel):[]));}catch{}
    $("ladderUnlockedDialog").close();unlockNoticeLevel=null;showUnlockNotices();
  });
  $("ladderUnlockedDialog").addEventListener("cancel",event=>{event.preventDefault();$("closeLadderUnlocked").click();});
  $("completionDialog").addEventListener("click", event => {
    if (event.target === $("completionDialog")) { $("completionDialog").close(); return; }
  });
  $("retryCompletions").addEventListener("click", () => { $("completionStatus").textContent = "Loading completions…"; loadCommunity(Boolean(user)); });
  $("scoreForm").addEventListener("submit", event => { event.preventDefault(); humanVisit(); });
  $("bustVisit").addEventListener("click", () => humanVisit(true));
  $("undoVisit").addEventListener("click", () => { if (!undo || busy || match.ended) return; match = undo; undo = null; $("scoreError").textContent = ""; renderMatch(); $("visitScore").focus(); });
  $("nextLeg").addEventListener("click", () => {
    if (!match?.legEnded || match.ended) return;
    match.leg++; match.starter = match.leg % 2 === 1 ? "player" : "bot";
    match.turn = match.starter; match.legEnded = false; undo = null;
    for (const side of ["player", "bot"]) { match[side].remaining = E.startScore(match.level,match.bestOf); match[side].legDarts = 0; }
    renderMatch(); scheduleBot();
  });
  $("leaveMatch").addEventListener("click", levels); $("backToLevels").addEventListener("click", levels);
  $("ladderTab").addEventListener("click", () => window.location.hash==="#casual"?openCasual():showTab(false));
  $("leaderboardTab").addEventListener("click", () => showTab(true));
  $("casualTab").addEventListener("click",openCasual);
  $("ladderTierOne").addEventListener("click",()=>{selectedTier=1;renderLevels();focusUnlocked();});
  $("ladderTierTwo").addEventListener("click",()=>{if(!ready||!user||!E.tier2EntryUnlocked(progress,bestScores))return;selectedTier=2;renderLevels();focusUnlocked();});
  $("casualBots").addEventListener("click",event=>{
    const button=event.target.closest("[data-casual-bot]");if(!button)return;
    $("casualBot").value=button.dataset.casualBot;renderCasual();
  });
  const adjustLegs=change=>{const value=Number($("casualLegs").value)||1;$("casualLegs").value=String(Math.max(1,value+change));};
  $("casualLegsDown").addEventListener("click",()=>adjustLegs(-2));
  $("casualLegsUp").addEventListener("click",()=>adjustLegs(2));
  $("casualForm").addEventListener("submit",event=>{
    event.preventDefault();const level=Number($("casualBot").value),legs=Number($("casualLegs").value),start=Number($("casualStart").value)||501;
    if(!casualUnlocked()||!Number.isSafeInteger(legs)||legs<1||legs%2!==1||![301,501,701].includes(start)||!allBots.some(p=>p.level===level&&E.isUnlocked(level,progress,bestScores,survivalBest()))){$("casualError").textContent="Choose an unlocked bot and an odd best-of length: 1, 3, 5, 7…";return;}
    launch(`dart-scorer.html?mode=bot&casual=1&level=${level}&format=1&legs=${legs}&start=${start}`,`Loading casual ${botName(level)} · BO${legs}`);
  });
  window.ONMMonsterLadder={returnToLadder:async(casual)=>{
    window.ONMBotLaunch?.close?.();if(casual)openCasual();else showTab(false);
    await loadProgress();
  }};
  $("retryLeaderboard").addEventListener("click", () => loadCommunity(Boolean(user)));
  $("refreshLeaderboard").addEventListener("click", () => loadCommunity(true));
  $("playerSummaryPhoto").addEventListener("error",()=>{
    if($("playerSummaryPhoto").getAttribute("src")!=="graphics/logoWoText.png") $("playerSummaryPhoto").src="graphics/logoWoText.png";
  });
  [$("leaderboardRows"),$("completionNames")].forEach(container=>container.addEventListener("error",event=>{
    if(event.target.classList?.contains("botLeaderboardPhoto") && event.target.getAttribute("src")!=="graphics/logoWoText.png") event.target.src="graphics/logoWoText.png";
  },true));
  $("retryAccount").addEventListener("click", () => loadProgress());
  window.addEventListener("beforeunload", event => { if (match && !match.ended) { event.preventDefault(); event.returnValue = ""; } });
  loadCommunity();
  if(typeof fetch==="function") fetch("data/player-photo-map.json").then(response=>response.ok?response.json():{}).then(photos=>{leaderboardPhotos=photos||{};renderLeaderboard();renderPlayerSummary();showCompletionList();}).catch(()=>{});
  if(window.location.hash==="#casual")openCasual();else showTab(window.location.hash === "#leaderboard");
  window.addEventListener("hashchange",()=>window.location.hash==="#casual"?openCasual():showTab(window.location.hash === "#leaderboard"));
  loadProgress().then(async () => {
    try {
      const {auth, authSdk} = await window.ONMFirebase.ready;
      if (!authSdk?.onAuthStateChanged) return;
      let authRevision=0;
      authSdk.onAuthStateChanged(auth, async current => {
        const revision=++authRevision;
        if ((current?.uid || null) === (user?.uid || null)) return;
        if(!current&&user){
          try{current=await window.ONMFirebase.currentFirebaseUser();}catch{return;}
          if(revision!==authRevision||(current?.uid||null)===(user?.uid||null))return;
        }
        clearTimeout(timer); match = null; undo = null; busy = false; pendingCheckout = null;
        $("bullCheckoutDialog").close(); $("matchPanel").hidden = true; $("challengeSetup").hidden = false;
        user = null; progress = new Set(); bestScores = {}; ready = false;
        loadProgress();
      });
    } catch { /* A failed auth connection never enables guest play. */ }
  });
})();
