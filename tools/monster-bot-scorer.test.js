const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const E=require("../scripts/monster-bot-engine");
async function harness({format=1,level=1,account={uid:"member"},botFinish=false,seedWins=null,profilePhoto=null,audioBlocked=false,introPlayed=false,casual=false,legs=3,start=501,completed=false}={}){
  const nodes=new Map(),timers=new Map(),writes=[],stored=new Map();let nextTimer=0,bullSelected=false,authChanged;
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,value:"",textContent:"",hidden:false,disabled:false,dataset:{},children:[],style:{setProperty(){}},setAttribute(){},appendChild(child){this.children.push(child);},remove(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return element("kicker");},querySelectorAll(){return [];},before(){},after(){},blur(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(event,fn){(this.listeners ||= {})[event]=fn;}});return nodes.get(id);};
  const player=()=>({score:501,legs:0,totalScored:0,dartsThrown:0,currentLegDarts:0,firstNineScored:0,firstNineDarts:0,currentLegFirstNineScored:0,currentLegFirstNineDarts:0,highScore:0,checkoutHits:0,checkoutAttempts:0,highestOut:0,oneEightys:0,bullOuts:0,legDarts:[],lastScore:null});
  const state={players:[player(),player()],currentPlayer:0,winnerIndex:null,visitHistory:[],legJustWon:false};
  const els=new Proxy({names:[element("name0"),element("name1")]},{get:(o,k)=>o[k]||element(k)});
  const wins=seedWins || E.LEVELS.flatMap(p=>E.MODES.map(m=>`${p.level}-${m}`));
  const scores=Object.fromEntries(E.LEVELS.flatMap(p=>E.MODES.map(m=>[`${p.level}-${m}`,{won:E.legsNeeded(m),lost:0}])));
  if(!completed&&!casual)delete scores[`${level}-${format}`];
  const sdk={doc:(_db,c,id)=>`${c}/${id}`,getDoc:async()=>({data:()=>({firstName:"Nick",nickname:"Nickname",monsterBotWins:wins,monsterBotBestScores:scores})}),updateDoc:async(path,data)=>writes.push({path,data}),arrayUnion:(...a)=>a,runTransaction:async(_db,fn)=>fn({get:async()=>({data:()=>({})}),update:(path,data)=>writes.push({path,data})})};
  const ctx={BOT_MODE:true,params:new URLSearchParams(`level=${level}&format=${format}${casual?`&casual=1&legs=${legs}&start=${start}`:""}`),state,els,STARTING_SCORE:501,LEGS_TO_WIN:E.legsNeeded(format),MATCH_MODE:"local",STATS_MODE:"casual",pendingCheckoutPrompt:null,
    window:{MonsterBotEngine:{...E,botVisit:(remaining,darts,profile)=>{ctx.lastBotProfile=profile.level;return botFinish?{score:remaining,remaining:0,darts:3,attempts:1,hits:[remaining]}:{score:30,remaining:remaining-30,darts:3,attempts:0,hits:[10,10,10]};}},ONMFirebase:{currentFirebaseUser:async()=>account,ready:Promise.resolve({db:{},firestoreSdk:sdk,auth:{},authSdk:{onAuthStateChanged:(_auth,fn)=>{authChanged=fn;}}})},location:{href:"",reload(){ctx.reloaded=true;}},eventHandlers:{},addEventListener(type,fn){(this.eventHandlers[type] ||= []).push(fn);}},
    document:{body:{classList:{add(){},remove(){}}},getElementById:element,createElement:()=>element(`created${nodes.size}`),querySelector:()=>bullSelected?{dataset:{value:"Yes"}}:null},
    localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),Date,
    enterScorerFullscreen(){ctx.fullscreen=true;},syncMainViews(){},applyMatchSettings(settings){ctx.STARTING_SCORE=settings.startScore;ctx.targetLegs=settings.gameType==="firstTo"?settings.legsCount:Math.floor(settings.legsCount/2)+1;ctx.LEGS_TO_WIN=ctx.targetLegs;for(const p of state.players)p.score=settings.startScore;},newGame(){state.players=[player(),player()];for(const p of state.players)p.score=ctx.STARTING_SCORE;state.visitHistory=[];state.legJustWon=false;},setVisiblePlayerNames:(a,b)=>{els.names[0].value=a;els.names[1].value=b;},
    render:()=>ctx.window.ONMMonsterScorer?.onRender(),switchPlayer(){state.currentPlayer=state.currentPlayer===0?1:0;},updateLegTarget(){ctx.LEGS_TO_WIN=ctx.targetLegs||E.legsNeeded(format);},resetLeg(){for(const p of state.players){p.score=ctx.STARTING_SCORE;p.currentLegDarts=0;}},
    isDartCalloutBusy:()=>Boolean(ctx.audioBusy),launchFireworks(){},announceLegWon(){},announceDartVisit(){},announceRequiredScore:score=>{ctx.requiredCalls.push(score);},requiredCalls:[],shouldPlayFinishHim:()=>false,playDartCallout:(file,fallback,onBlocked,onReady)=>{ctx.callouts.push({file,onBlocked});if(ctx.audioBlocked)onBlocked?.();else onReady?.(true);},callouts:[],audioBlocked,
    showImpossibleMessage:message=>{ctx.error=message;},getBullOutPromptConfig:()=>({bullOutOptions:["No","Yes"],bullOutDefault:"No"}),
    getMinimumCheckoutDarts:score=>E.checkoutPossible(score,1)?1:E.checkoutPossible(score,2)?2:3,getDoubleOptionsForMissedVisit:(before,score)=>before-score<=50?[0,1,2,3]:null,
    openCheckoutPrompt:config=>{ctx.pendingCheckoutPrompt=config;},closeCheckoutPrompt:()=>{ctx.pendingCheckoutPrompt=null;},getSelectedPromptValue:()=>3,
    buildLocalMatchStatsData:()=>({}),openMolVictoryScreen:()=>{ctx.resultOpened=true;ctx.window.ONMMonsterScorer.showResult();ctx.window.ONMMonsterScorer.showUnlock();}
  };
  if(introPlayed){ctx.params.set("intro","played");ctx.URL=URL;ctx.window.location.href=`https://ochenessmonsters.com/dart-scorer.html?mode=bot&level=${level}&format=${format}&intro=played`;ctx.window.history={replaceState(_state,_title,url){ctx.cleanedUrl=url;}};}
  vm.createContext(ctx);
  ctx.window.ONMBotData=require("../scripts/monster-bot-data");
  if(profilePhoto) ctx.window.ONMSession={resolveProfileImage:async()=>profilePhoto};
  const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
  vm.runInContext(source.slice(source.indexOf("function applyVisit({"),source.indexOf("function resetLeg()")),ctx);
  vm.runInContext(fs.readFileSync(require.resolve("../scripts/monster-bot-scorer.js"),"utf8"),ctx);
  await new Promise(r=>setImmediate(r));
  const api=ctx.window.ONMMonsterScorer;
  const score=n=>{els.input.value=String(n);api.submit();};
  const bot=()=>{const entry=[...timers].find(([,t])=>t.delay===1000);if(entry){timers.delete(entry[0]);entry[1].fn();}};
  return{ctx,state,els,api,writes,stored,timers,score,bot,confirm:(bull=false)=>{bullSelected=bull;api.confirmCheckout();},signOut:()=>authChanged(null)};
}
test("shared scorer applies the human score, waits exactly one second, then returns control",async()=>{
  const g=await harness({level:6});g.score(60);
  assert.equal(g.state.players[0].score,441);assert.equal(g.state.players[1].score,501);
  assert.equal(g.state.currentPlayer,1);assert.equal(g.els.submit.disabled,true);
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,1);
  g.score(60);assert.equal(g.state.players[0].score,441);
  g.bot();assert.equal(g.state.players[1].score,471);assert.equal(g.ctx.lastBotProfile,6);
  assert.equal(g.state.currentPlayer,0);assert.equal(g.els.submit.disabled,false);
});
test("Bull or Bust starts at 301 on every level; standard modes remain 501",async()=>{
  for(let level=1;level<=10;level++) for(const format of E.MODES) {
    const g=await harness({level,format}), expected=format===9?301:501;
    assert.equal(g.ctx.STARTING_SCORE,expected);
    assert.equal(g.state.players[0].score,expected);assert.equal(g.state.players[1].score,expected);
    assert.ok(g.els.gameTitleText.textContent.startsWith(String(expected)));
    g.api.showResult();assert.ok(g.els.molVictoryTitle.textContent.startsWith(String(expected)));
  }
});
test("Undo restores both visits and all stats, then replays the original bot score",async()=>{
  const g=await harness();let calls=0;
  g.ctx.window.MonsterBotEngine.botVisit=remaining=>{const score=++calls*30;return{score,remaining:remaining-score,darts:3,hits:[10,10,10]};};
  const before=JSON.stringify(g.state.players);
  g.score(180);g.bot();assert.equal(calls,1);
  assert.equal(g.state.players[1].score,471);
  g.api.undo();
  assert.equal(JSON.stringify(g.state.players),before);
  assert.equal(g.state.visitHistory.length,0);assert.equal(g.state.currentPlayer,0);
  g.score(60);g.bot();
  assert.equal(g.state.players[0].score,441);assert.equal(g.state.players[0].highScore,60);
  assert.equal(g.state.players[1].score,471);assert.equal(calls,1);
  g.api.undo();g.score(45);g.bot();
  assert.equal(g.state.players[0].score,456);assert.equal(g.state.players[1].score,471);assert.equal(calls,1);
  g.score(60);g.bot();assert.equal(calls,2);assert.equal(g.state.players[1].score,411);
  assert.equal(g.state.players[0].dartsThrown,6);assert.equal(g.state.players[1].dartsThrown,6);
});
test("Undo during the bot delay cancels the pending throw and enables correction",async()=>{
  const g=await harness();
  const undoButton={dataset:{action:"undo"},disabled:true};
  g.els.keypad.querySelectorAll=()=>[undoButton];g.api.onRender();assert.equal(undoButton.disabled,true);
  g.score(60);assert.equal(undoButton.disabled,false);
  g.api.undo();assert.equal(undoButton.disabled,true);
  g.bot();assert.equal(g.state.players[1].score,501);
  assert.equal(g.state.players[0].score,501);
  g.score("");g.bot();assert.equal(g.state.players[0].score,501);assert.equal(g.state.players[1].score,471);
  assert.equal(g.state.visitHistory.length,2);
});
test("bot undo routing is enabled without changing other scorer modes",()=>{
  const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
  assert.match(source,/if \(BOT_MODE\) \{ window.ONMMonsterScorer\?\.undo\(\); return; \}/);
  assert.match(source,/BOT_MODE && button.dataset.action === "undo"/);
});
test("bot games open fullscreen with the player's first name and the bot's name",async()=>{
  const g=await harness();
  assert.equal(g.els.names[0].value,"Nick");
  assert.equal(g.els.names[1].value,"Billy Bot");
  assert.equal(g.ctx.fullscreen,true);
  assert.equal(g.ctx.document.getElementById("monsterBotSplash").hidden,true);
  assert.equal(g.ctx.callouts[0].file,"game-on.mp3");
});
test("a Game on clip already heard during launch is not announced twice",async()=>{
  const g=await harness({introPlayed:true});
  assert.equal(g.ctx.callouts.length,0);assert.equal(g.api.canPlay(),true);
  assert.ok(!g.ctx.cleanedUrl.includes("intro="));
});
test("Monsters splash names the selected bot and format without affecting league games",()=>{
  const source=fs.readFileSync(require.resolve("../scripts/monster-bot-splash.js"),"utf8");
  for(const [query,label] of [["?mode=bot&level=1&format=3","Loading Billy Bot · BO3"],["?mode=bot&level=7&format=9","Loading Aussie Bot · Bull or Bust"],["?mode=bot&level=999&format=999","Loading Monster Bot…"],["?mode=online",null]]){
    const nodes={monsterBotSplash:{hidden:true},monsterBotLoadingText:{textContent:""}};
    const ctx={URLSearchParams,window:{location:{search:query}},document:{body:{classList:{add(){}}},getElementById:id=>nodes[id]}};
    vm.runInNewContext(source,ctx);
    assert.equal(nodes.monsterBotSplash.hidden,label===null);
    assert.equal(nodes.monsterBotLoadingText.textContent,label||"");
  }
});
test("launch and scorer share branded avatars and an axial dart-roll loader",()=>{
  for(const file of ["monster-bot.html","dart-scorer.html"]){
    const html=fs.readFileSync(require.resolve(`../${file}`),"utf8");
    assert.match(html,/monster-bot-splash\.css/);assert.match(html,/class="splashBotAvatar" src="graphics\/bots\/billy-bot.png"/);
    assert.match(html,/class="splashBotAvatar" src="graphics\/bots\/croft-bot.png"/);
    assert.match(html,/Monster Bot<span>Game<\/span>/);assert.match(html,/class="dartFlightRoll"/);
  }
  const css=fs.readFileSync(require.resolve("../styles/monster-bot-splash.css"),"utf8");
  assert.match(css,/rotateX\(360deg\)/);assert.doesNotMatch(css,/rotateZ\(|rotate\(360deg\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
test("games start automatically even when autoplay is blocked, without a late Game on retry",async()=>{
  const g=await harness({audioBlocked:true});
  assert.equal(g.api.canPlay(),true);assert.equal(g.els.submit.disabled,false);
  assert.equal(g.ctx.document.getElementById("monsterBotSplash").hidden,true);
  for(const fn of g.ctx.window.eventHandlers.pointerdown||[]) fn();
  for(const fn of g.ctx.window.eventHandlers.keydown||[]) fn();
  assert.equal(g.ctx.callouts.length,1);
  g.score(60);assert.equal(g.state.players[0].score,441);
  const guest=await harness({account:null});assert.equal(guest.ctx.callouts.length,0);
});
test("human and bot busts both announce No score",async()=>{
  const g=await harness(),announced=[];
  g.ctx.announceDartVisit=n=>announced.push(n);
  g.ctx.window.MonsterBotEngine.botVisit=remaining=>({score:0,remaining,darts:3,bust:true,hits:[60,60,60]});
  g.score(60);g.bot();assert.deepEqual(announced,[60,0]);
  assert.equal(g.state.players[1].score,501);
  g.state.players[0].score=20;g.score(26);
  assert.deepEqual(announced,[60,0,0]);assert.equal(g.state.players[0].score,20);
});
test("bot waits for the announcement to finish, then pauses another second",async()=>{
  const g=await harness();g.ctx.audioBusy=true;g.score(60);
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,0);
  assert.equal(g.state.players[1].score,501);
  const poll=()=>{const [id,t]=[...g.timers].find(([,t])=>t.delay===100);g.timers.delete(id);t.fn();};
  poll();assert.equal(g.state.players[1].score,501);
  g.ctx.audioBusy=false;poll();
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,1);
  g.bot();assert.equal(g.state.players[1].score,471);
});
test("empty Submit records a zero-score visit and hands the turn to the bot",async()=>{
  const g=await harness();g.score("");
  assert.equal(g.state.players[0].score,501);
  assert.equal(g.state.players[0].dartsThrown,3);
  assert.equal(g.state.players[0].lastScore,0);
  assert.equal(g.state.currentPlayer,1);
  g.bot();assert.equal(g.state.currentPlayer,0);
});
test("required-score announcements are for the human only, not the bot",async()=>{
  const g=await harness();g.score(60);
  assert.equal(g.ctx.requiredCalls.length,0);
  g.bot();assert.deepEqual(g.ctx.requiredCalls,[441]);
});
test("a standard checkout ends the leg immediately without a prompt or checkout tracking",async()=>{
  const g=await harness();g.score(180);g.bot();g.score(180);g.bot();g.score(141);
  assert.equal(g.ctx.pendingCheckoutPrompt,null);
  await new Promise(r=>setImmediate(r));
  assert.equal(g.state.winnerIndex,0);assert.equal(g.state.players[0].legs,1);
  assert.equal(g.state.players[0].checkoutHits,0);assert.equal(g.state.players[0].checkoutAttempts,0);
  assert.ok(g.writes.some(w=>w.data.monsterBotBestScores?.["1-1"]?.lost===0));
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,0);
  assert.ok(g.writes.every(w=>w.path==="users/member"));
  const saved=g.writes.find(w=>w.data.monsterBotBestScores)?.data;
  assert.deepEqual(Object.keys(saved).sort(),["monsterBotBestScores","monsterBotStarted","monsterBotWins"]);
  assert.deepEqual(Object.keys(saved.monsterBotBestScores["1-1"]).sort(),["lost","won"]);
  const localScores=JSON.parse(g.stored.get("onm-monster-bot-member-scores"));
  assert.deepEqual(localScores,{"1-1":{won:1,lost:0}});
});
test("bot result identity uses the linked account photo and leaves the bot avatar unchanged",async()=>{
  const g=await harness({profilePhoto:"https://example.test/linked-player.jpg"});
  assert.equal(g.api.photo(0),"https://example.test/linked-player.jpg");
  assert.equal(g.api.photo(1),"graphics/bots/billy-bot.png");
  const fallback=await harness();assert.equal(fallback.api.photo(0),"graphics/logoWoText.png");
});
test("winning a new unlock celebrates the right bot once, without celebrating replays",async()=>{
  const g=await harness({format:3,seedWins:["1-1"]});
  for(let leg=0;leg<2;leg++){
    if(leg) g.bot();
    g.score(180);g.bot();g.score(180);g.bot();g.score(141);
  }
  g.ctx.openMolVictoryScreen();
  const dialog=g.ctx.document.getElementById("botUnlockedDialog");
  assert.notEqual(dialog.open,true);
  assert.deepEqual(JSON.parse(g.stored.get("onm-monster-bot-member-unlocks")),[2]);
  assert.equal(g.els.molVictoryRematchBtn.hidden,true);
  assert.equal(g.els.molVictoryCloseBtn.textContent,"Back to ladder");
  const replay=await harness({seedWins:["1-1","1-3"]});
  replay.score(180);replay.bot();replay.score(180);replay.bot();replay.score(141);replay.ctx.openMolVictoryScreen();
  assert.notEqual(replay.ctx.document.getElementById("botUnlockedDialog").open,true);
});
test("highest visit is retained across legs and reported in final stats",async()=>{
  const g=await harness({format:3});
  g.score(180);g.bot();g.score(180);g.bot();g.score(141);
  g.bot();
  for(const score of [140,140,140,81]){g.score(score);if(g.state.winnerIndex===null) g.bot();}
  assert.equal(g.state.winnerIndex,0);
  const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
  vm.runInContext(source.slice(source.indexOf("function getPlayerStats(player)"),source.indexOf("async function submitCompetitiveResult()")),g.ctx);
  const stats=g.ctx.getPlayerStats(g.state.players[0]);
  assert.equal(stats.highScore,180);assert.equal(stats.highestOut,141);
  assert.equal(g.ctx.getPlayerStats(g.state.players[1]).highScore,30);
});
test("bot matches cannot upload detailed statistics through the league save route",async()=>{
  const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
  let uploads=0;
  const ctx={BOT_MODE:true,MATCH_MODE:"online",window:{ONMFirebase:{post:async()=>{uploads++;return{success:true};}}}};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("async function postDartMatch(payload)"),source.indexOf("function cleanStatNumber")),ctx);
  vm.runInContext(source.slice(source.indexOf("async function saveFinishedDartMatch()"),source.indexOf('els.checkoutOverlay.addEventListener("click"')),ctx);
  assert.equal((await ctx.postDartMatch({action:"saveDartMatch",match:{average:55}})).success,false);
  assert.equal(await ctx.saveFinishedDartMatch(),true);
  assert.equal(uploads,0);
  ctx.BOT_MODE=false;
  assert.equal((await ctx.postDartMatch({action:"saveDartMatch",match:{average:55}})).success,true);
  assert.equal(uploads,1);
});
test("bot result pages omit checkout totals and rate without changing league results",()=>{
  const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
  const ctx={BOT_MODE:true,window:{},els:{molStatsPageOne:{},molStatsPageTwo:{}},buildStatsRowsHtml:rows=>rows.map(row=>row[0]).join("|"),setMolStatsPage(){}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("function populateMolVictoryStats("),source.indexOf("function getOnlineMatchId()")),ctx);
  const result={players:[{stats:{}},{stats:{}}]};ctx.populateMolVictoryStats(result);
  const botRows=ctx.els.molStatsPageOne.innerHTML+ctx.els.molStatsPageTwo.innerHTML;
  assert.doesNotMatch(botRows,/Checkouts|Checkout rate/);assert.match(botRows,/3-dart avg./);
  ctx.BOT_MODE=false;ctx.populateMolVictoryStats(result);
  assert.match(ctx.els.molStatsPageOne.innerHTML+ctx.els.molStatsPageTwo.innerHTML,/Checkouts.*Checkout rate/);
});
test("the bot starts leg two automatically and a bot checkout can end the match",async()=>{
  const g=await harness({format:3});g.score(180);g.bot();g.score(180);g.bot();g.score(141);g.confirm();
  assert.equal(g.state.players[0].legs,1);assert.equal(g.state.players[0].score,501);assert.equal(g.state.currentPlayer,1);
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,1);
  assert.equal(g.els.submit.disabled,true);g.score(60);assert.equal(g.state.players[0].score,501);
  g.bot();assert.equal(g.state.currentPlayer,0);assert.equal(g.state.players[1].score,471);
  const losing=await harness({botFinish:true});losing.score(60);losing.bot();assert.equal(losing.state.winnerIndex,1);
  assert.equal(losing.writes.some(w=>w.data.monsterBotWins),false);
});
test("leg starters alternate regardless of who won the previous leg",async()=>{
  const g=await harness({format:7});
  for(let leg=1;leg<=3;leg++){
    if(leg===2) g.bot();
    g.score(180);g.bot();g.score(180);g.bot();g.score(141);g.confirm();
    assert.equal(g.state.currentPlayer,leg%2);
    assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,leg%2);
  }
  const botWins=await harness({format:7,botFinish:true});
  botWins.score(60);botWins.bot();assert.equal(botWins.state.players[1].legs,1);assert.equal(botWins.state.currentPlayer,1);
  botWins.bot();assert.equal(botWins.state.players[1].legs,2);assert.equal(botWins.state.currentPlayer,0);
});
test("Bull or Bust enforces below-50 losses and an explicitly confirmed Bull finish",async()=>{
  const below=await harness({format:9});below.score(180);below.bot();below.score(100);
  assert.equal(below.state.winnerIndex,1);
  const other=await harness({format:9});other.score(180);other.bot();other.score(121);other.confirm(false);
  assert.equal(other.state.winnerIndex,1);
  const win=await harness({format:9});win.score(180);win.bot();win.score(121);win.confirm(true);
  await new Promise(r=>setImmediate(r));assert.equal(win.state.winnerIndex,0);assert.ok(win.writes.some(w=>w.data.monsterBotBestScores?.["1-9"]?.won===1));
});
test("zero or blank visits on any finish lose Bull or Bust, but not standard modes",async()=>{
  for(const remaining of [50,60,100,170]) for(const value of [0,""]) {
    const g=await harness({format:9});g.state.players[0].score=remaining;g.score(value);
    assert.equal(g.state.winnerIndex,1);assert.equal(g.api.canPlay(),false);
    assert.match(g.ctx.document.getElementById("monsterBotResultStatus").textContent,/one-shot Bull or Bust/);
    assert.ok(g.writes.every(w=>!w.data.monsterBotWins));
  }
  const early=await harness({format:9});early.score(0);assert.equal(early.state.winnerIndex,null);
  const standard=await harness({format:1});standard.state.players[0].score=50;standard.score(0);assert.equal(standard.state.winnerIndex,null);
});
test("losses announce You lose once where speech is supported and offer Restart",async()=>{
  const g=await harness({format:9}),spoken=[];
  g.ctx.window.SpeechSynthesisUtterance=function(text){this.text=text;};
  g.ctx.window.speechSynthesis={speak:utterance=>spoken.push(utterance.text),cancel(){}};
  g.state.players[0].score=50;g.score(0);g.api.afterVisit();
  assert.deepEqual(spoken,["You lose"]);assert.equal(g.els.molVictoryRematchBtn.textContent,"Restart");
});
test("Restart keeps the authenticated scorer and cancels the previous bot throw",async()=>{
  const g=await harness();g.score(60);
  assert.equal(g.ctx.document.getElementById("botRestartGame").hidden,false);
  await g.ctx.document.getElementById("botRestartGame").listeners.click();g.bot();
  assert.notEqual(g.ctx.reloaded,true);assert.equal(g.ctx.window.location.href,"");assert.equal(g.state.players[1].score,501);
  assert.equal(g.state.players[0].score,501);assert.equal(g.api.canPlay(),true);assert.equal(g.state.visitHistory.length,0);
});
test("Venton can be retried repeatedly without navigation or another sign-in check",async()=>{
  const g=await harness({level:3});let announcements=0;
  g.ctx.window.ONMFirebase.currentFirebaseUser=()=>assert.fail("Retry must retain the existing authenticated client");
  g.ctx.window.parent={ONMBotLaunch:{open:()=>assert.fail("Retry must not rebuild the iframe"),resetAnnouncement:()=>announcements++,ready:()=>true}};
  for(let retry=0;retry<2;retry++){
    g.score(60);await g.api.rematch();g.bot();
    assert.equal(g.state.players[0].score,501);assert.equal(g.state.players[1].score,501);assert.equal(g.api.canPlay(),true);
    assert.equal(g.ctx.window.location.href,"");
  }
  assert.equal(announcements,2);
});
test("sign-out and quitting cancel a pending bot throw; guests must log in with a return URL",async()=>{
  const g=await harness();g.score(60);g.signOut();g.bot();assert.equal(g.state.players[1].score,501);assert.equal(g.ctx.window.location.href,"monster-bot.html");
  const guest=await harness({account:null});assert.match(guest.ctx.window.location.href,/auth.html\?mode=login&redirect=dart-scorer.html%3Fmode%3Dbot/);
});
test("a direct Bull or Bust scorer URL requires all four standard wins",async()=>{
  const locked=await harness({format:9,seedWins:["1-1","1-3","1-5"]});
  assert.equal(locked.ctx.window.location.href,"monster-bot.html");
  assert.equal(locked.api.canPlay(),false);
  const unlocked=await harness({format:9,seedWins:["1-1","1-3","1-5","1-7"]});
  assert.equal(unlocked.api.canPlay(),true);
});
test("flawless ladder modes cannot be replayed through direct scorer URLs",async()=>{
  const g=await harness({completed:true});assert.equal(g.api.canPlay(),false);assert.equal(g.ctx.window.location.href,"monster-bot.html");assert.equal(g.writes.length,0);
});
test("casual games allow custom leg targets and completed bots without storing results",async()=>{
  const g=await harness({casual:true,legs:1,completed:true});
  assert.equal(g.api.canPlay(),true);assert.equal(g.api.tracksCheckouts(),true);assert.equal(g.ctx.LEGS_TO_WIN,1);
  g.score(180);g.bot();g.score(180);g.bot();g.score(141);
  assert.ok(g.ctx.pendingCheckoutPrompt);g.confirm();await new Promise(done=>setImmediate(done));
  assert.equal(g.state.winnerIndex,0);assert.equal(g.state.players[0].checkoutHits,1);assert.equal(g.state.players[0].checkoutAttempts,3);
  assert.equal(g.writes.length,0);assert.equal(g.stored.size,0);
  g.api.showResult();
  assert.match(g.ctx.document.getElementById("monsterBotResultStatus").textContent,/no stats or progress saved/);
  assert.equal(g.els.molVictoryRematchBtn.textContent,"Restart");
  const long=await harness({casual:true,legs:23});assert.equal(long.ctx.LEGS_TO_WIN,12);assert.equal(long.api.canPlay(),true);
  const nine=await harness({casual:true,legs:9});assert.equal(nine.ctx.LEGS_TO_WIN,5);
});
test("casual mode requires level three and validates the chosen leg target",async()=>{
  const locked=await harness({casual:true,seedWins:["1-1"]});assert.equal(locked.api.canPlay(),false);assert.equal(locked.writes.length,0);
  for(const legs of [0,-1,1.5,2,8]){const g=await harness({casual:true,legs});assert.equal(g.api.canPlay(),false);}
});
test("casual starting score is selectable and results still earn no ladder awards",async()=>{
  const g=await harness({casual:true,legs:1,start:301});
  assert.equal(g.ctx.STARTING_SCORE,301);g.score(180);g.bot();g.score(121);g.confirm();
  await new Promise(done=>setImmediate(done));g.api.showResult();
  assert.equal(g.state.winnerIndex,0);assert.equal(g.writes.length,0);assert.equal(g.stored.size,0);
  assert.equal(g.els.molVictoryRematchBtn.hidden,false);
  assert.equal((await harness({casual:true,start:302})).api.canPlay(),false);
});
test("Back to ladder returns to the host instead of opening an unlock over results",async()=>{
  const g=await harness();const returned=[];
  g.ctx.window.parent={ONMMonsterLadder:{returnToLadder:casual=>returned.push(casual)}};
  g.api.exit();assert.deepEqual(returned,[false]);
});
test("reaching level three celebrates Casual mode in the unlock modal",async()=>{
  const g=await harness({level:2,format:3,seedWins:[...E.MODES.map(mode=>`1-${mode}`),"2-1"]});
  for(let leg=0;leg<2;leg++){if(leg)g.bot();g.score(180);g.bot();g.score(180);g.bot();g.score(141);}
  await new Promise(done=>setImmediate(done));g.api.showUnlock();
  assert.notEqual(g.ctx.document.getElementById("botUnlockedDialog").open,true);
  assert.deepEqual(JSON.parse(g.stored.get("onm-monster-bot-member-unlocks")),[3]);
  assert.ok(!g.writes.some(w=>w.data.monsterBotCasualNoticeSeen));
});
