const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const E=require("../scripts/monster-bot-engine");
async function harness({format=1,level=1,account={uid:"member"},botFinish=false}={}){
  const nodes=new Map(),timers=new Map(),writes=[],stored=new Map();let nextTimer=0,bullSelected=false,authChanged;
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,value:"",textContent:"",hidden:false,disabled:false,dataset:{},classList:{add(){},remove(){},toggle(){}},querySelector(){return element("kicker");},querySelectorAll(){return [];},before(){},after(){},blur(){}});return nodes.get(id);};
  const player=()=>({score:501,legs:0,totalScored:0,dartsThrown:0,currentLegDarts:0,firstNineScored:0,firstNineDarts:0,currentLegFirstNineScored:0,currentLegFirstNineDarts:0,highScore:0,checkoutHits:0,checkoutAttempts:0,highestOut:0,oneEightys:0,bullOuts:0,legDarts:[],lastScore:null});
  const state={players:[player(),player()],currentPlayer:0,winnerIndex:null,visitHistory:[],legJustWon:false};
  const els=new Proxy({names:[element("name0"),element("name1")]},{get:(o,k)=>o[k]||element(k)});
  const wins=E.LEVELS.flatMap(p=>E.MODES.map(m=>`${p.level}-${m}`));
  const scores=Object.fromEntries(E.LEVELS.flatMap(p=>E.MODES.map(m=>[`${p.level}-${m}`,{won:E.legsNeeded(m),lost:0}])));
  const sdk={doc:(_db,c,id)=>`${c}/${id}`,getDoc:async()=>({data:()=>({firstName:"Nick",nickname:"Nickname",monsterBotWins:wins,monsterBotBestScores:scores})}),updateDoc:async(path,data)=>writes.push({path,data}),arrayUnion:(...a)=>a,runTransaction:async(_db,fn)=>fn({get:async()=>({data:()=>({})}),update:(path,data)=>writes.push({path,data})})};
  const ctx={BOT_MODE:true,params:new URLSearchParams(`level=${level}&format=${format}`),state,els,STARTING_SCORE:501,LEGS_TO_WIN:E.legsNeeded(format),MATCH_MODE:"local",STATS_MODE:"casual",pendingCheckoutPrompt:null,
    window:{MonsterBotEngine:{...E,botVisit:(remaining,darts,profile)=>{ctx.lastBotProfile=profile.level;return botFinish?{score:remaining,remaining:0,darts:3,attempts:1,hits:[remaining]}:{score:30,remaining:remaining-30,darts:3,attempts:0,hits:[10,10,10]};}},ONMFirebase:{currentFirebaseUser:async()=>account,ready:Promise.resolve({db:{},firestoreSdk:sdk,auth:{},authSdk:{onAuthStateChanged:(_auth,fn)=>{authChanged=fn;}}})},location:{href:"",reload(){ctx.reloaded=true;}},addEventListener(){}},
    document:{body:{classList:{add(){},remove(){}}},getElementById:element,createElement:()=>element(`created${nodes.size}`),querySelector:()=>bullSelected?{dataset:{value:"Yes"}}:null},
    localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),Date,
    enterScorerFullscreen(){ctx.fullscreen=true;},syncMainViews(){},applyMatchSettings(){},newGame(){},setVisiblePlayerNames:(a,b)=>{els.names[0].value=a;els.names[1].value=b;},
    render:()=>ctx.window.ONMMonsterScorer?.onRender(),switchPlayer(){state.currentPlayer=state.currentPlayer===0?1:0;},updateLegTarget(){ctx.LEGS_TO_WIN=E.legsNeeded(format);},resetLeg(){for(const p of state.players){p.score=501;p.currentLegDarts=0;}},
    isDartCalloutBusy:()=>Boolean(ctx.audioBusy),launchFireworks(){},announceLegWon(){},announceDartVisit(){},announceRequiredScore:score=>{ctx.requiredCalls.push(score);},requiredCalls:[],shouldPlayFinishHim:()=>false,playDartCallout(){},
    showImpossibleMessage:message=>{ctx.error=message;},getBullOutPromptConfig:()=>({bullOutOptions:["No","Yes"],bullOutDefault:"No"}),
    openCheckoutPrompt:config=>{ctx.pendingCheckoutPrompt=config;},closeCheckoutPrompt:()=>{ctx.pendingCheckoutPrompt=null;},getSelectedPromptValue:()=>3,
    buildLocalMatchStatsData:()=>({}),openMolVictoryScreen:()=>{ctx.resultOpened=true;ctx.window.ONMMonsterScorer.showResult();}
  };
  vm.createContext(ctx);
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
test("bot games open fullscreen with the player's first name and the bot's name",async()=>{
  const g=await harness();
  assert.equal(g.els.names[0].value,"Nick");
  assert.equal(g.els.names[1].value,"Billy Bot");
  assert.equal(g.ctx.fullscreen,true);
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
test("human checkout uses the existing prompt, saves a gold win and never schedules a bot after victory",async()=>{
  const g=await harness();g.score(180);g.bot();g.score(180);g.bot();g.score(141);
  assert.equal(g.ctx.pendingCheckoutPrompt.monsterBot,true);assert.equal(g.state.winnerIndex,null);
  g.confirm();await new Promise(r=>setImmediate(r));
  assert.equal(g.state.winnerIndex,0);assert.equal(g.state.players[0].legs,1);
  assert.ok(g.writes.some(w=>w.data.monsterBotBestScores?.["1-1"]?.lost===0));
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,0);
  assert.ok(g.writes.every(w=>w.path==="users/member"));
});
test("every new leg starts with the player and a bot checkout ends the match",async()=>{
  const g=await harness({format:3});g.score(180);g.bot();g.score(180);g.bot();g.score(141);g.confirm();
  assert.equal(g.state.players[0].legs,1);assert.equal(g.state.players[0].score,501);assert.equal(g.state.currentPlayer,0);
  assert.equal([...g.timers.values()].filter(t=>t.delay===1000).length,0);
  const losing=await harness({botFinish:true});losing.score(60);losing.bot();assert.equal(losing.state.winnerIndex,1);
  assert.equal(losing.writes.some(w=>w.data.monsterBotWins),false);
});
test("Bull or Bust enforces below-50 losses and an explicitly confirmed Bull finish",async()=>{
  const below=await harness({format:9});below.score(180);below.bot();below.score(180);below.bot();below.score(100);
  assert.equal(below.state.winnerIndex,1);
  const other=await harness({format:9});other.score(180);other.bot();other.score(180);other.bot();other.score(141);other.confirm(false);
  assert.equal(other.state.winnerIndex,1);
  const win=await harness({format:9});win.score(180);win.bot();win.score(180);win.bot();win.score(141);win.confirm(true);
  await new Promise(r=>setImmediate(r));assert.equal(win.state.winnerIndex,0);assert.ok(win.writes.some(w=>w.data.monsterBotBestScores?.["1-9"]?.won===1));
});
test("sign-out and quitting cancel a pending bot throw; guests must log in with a return URL",async()=>{
  const g=await harness();g.score(60);g.signOut();g.bot();assert.equal(g.state.players[1].score,501);assert.equal(g.ctx.window.location.href,"monster-bot.html");
  const guest=await harness({account:null});assert.match(guest.ctx.window.location.href,/auth.html\?mode=login&redirect=dart-scorer.html%3Fmode%3Dbot/);
});
