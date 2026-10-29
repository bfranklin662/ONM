const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),S=require("../scripts/monster-survival-state"),E=require("../scripts/monster-bot-engine");
test("Survival requires ten consecutive single-leg wins in order",()=>{
  let run=S.fresh("run");
  for(let level=1;level<=10;level++){
    assert.equal(run.level,level);run=S.begin(run);
    assert.throws(()=>S.finish(run,"other",level,true));assert.throws(()=>S.finish(run,"run",level===10?9:level+1,true));
    run=S.finish(run,"run",level,true);assert.equal(run.beaten,level);
    assert.equal(run.status,level===10?"complete":"between");
  }
  assert.throws(()=>S.begin(run));
});
test("a loss at any opponent ends the run and a fresh run always starts at Billy",()=>{
  for(let fail=1;fail<=10;fail++){
    let run=S.fresh("run");for(let level=1;level<fail;level++)run=S.finish(S.begin(run),"run",level,true);
    run=S.finish(S.begin(run),"run",fail,false);assert.equal(run.status,"lost");assert.throws(()=>S.begin(run));
    assert.equal(S.fresh("new").level,1);assert.equal(S.fresh("new").beaten,0);
  }
});
async function page(account={uid:"member"},community=[],profile={monsterBotWins:["1-1","1-3","1-5","1-7","1-9","2-1","2-3"],monsterBotBestScores:Object.fromEntries(E.MODES.map(mode=>[`1-${mode}`,{won:E.legsNeeded(mode),lost:0}]))}){
  const nodes=new Map(),timers=new Map(),urls=[],writes=[],stored=new Map();let timer=0,id=0,accountChanged;
  const node=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,disabled:false,listeners:{},setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(type,fn){this.listeners[type]=fn;}});return nodes.get(key);};
  const sdk={onSnapshot:(_ref,fn)=>{accountChanged=fn;return ()=>{};},doc:(_db,c,id)=>`${c}/${id}`,getDoc:async()=>({data:()=>profile}),updateDoc:async(ref,data)=>writes.push({ref,data}),runTransaction:async(_db,fn)=>fn({get:async()=>({data:()=>({})}),update:(ref,data)=>writes.push({ref,data})})};
  const ctx={document:{getElementById:node},crypto:{randomUUID:()=>`run-${++id}`},localStorage:{getItem:key=>stored.get(key),setItem:(k,v)=>stored.set(k,v)},setTimeout:(fn,ms)=>{timers.set(++timer,{fn,ms});return timer;},clearTimeout:id=>timers.delete(id),window:{MonsterBotEngine:E,ONMSurvivalState:S,ONMBotData:{withTimeout:promise=>promise,fetchCommunity:async()=>({survivalLeaderboard:community})},ONMFirebase:{config:{projectId:"test-project"},currentFirebaseUser:async()=>account,ready:Promise.resolve({db:{},firestoreSdk:sdk})},ONMBotLaunch:{open:url=>urls.push(url),close(){},celebrate(){}},addEventListener(){},matchMedia:()=>({matches:false})}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/monster-survival.js"),"utf8"),ctx);await new Promise(r=>setImmediate(r));
  return{updateAccount:data=>accountChanged({data:()=>data}),api:ctx.window.ONMMonsterSurvival,node,urls,writes,stored,start:()=>node("startSurvival").listeners.click(),next:()=>node("continueSurvivalTransition").listeners.click(),current:()=>new URL(urls.at(-1),"https://example.test").searchParams};
}
test("opening Survival and launching a scorer do not record participation until a valid score is submitted",async()=>{
 const g=await page();assert.equal(g.writes.length,0);g.start();await new Promise(r=>setImmediate(r));assert.equal(g.writes.length,0);
 const p=g.current();assert.equal(g.api.recordAttempt({id:"wrong",level:1}),false);assert.equal(g.api.recordAttempt({id:p.get("run"),level:1}),true);await new Promise(r=>setImmediate(r));assert.ok(g.writes.some(w=>w.data.monsterSurvivalAttempted===true));const count=g.writes.length;g.api.recordAttempt({id:p.get("run"),level:1});await new Promise(r=>setImmediate(r));assert.equal(g.writes.length,count);
});
test("Survival animates between rounds, reaches Filip and saves only best progress and trophy",async()=>{
  const g=await page();g.start();
  for(let level=1;level<=10;level++){
    const q=g.current();assert.equal(Number(q.get("level")),level);assert.equal(q.get("format"),"1");assert.equal(q.get("survival"),"1");
    assert.equal(g.api.authorize(q.get("run"),level,"member"),true);assert.equal(g.api.authorize(q.get("run"),level,"other"),false);
    assert.equal(g.api.recordResult({id:q.get("run"),level,won:true}),true);
    assert.equal(g.api.recordResult({id:q.get("run"),level,won:true}),false);
    g.api.returnFromGame();if(level<10){assert.equal(g.node("survivalTransition").hidden,false);g.next();}
  }
  await new Promise(r=>setImmediate(r));assert.equal(g.node("survivalChampionDialog").open,true);
  assert.equal(g.stored.get("onm-survival-complete-member"),"earned");assert.ok(g.writes.some(w=>w.data.monsterSurvivalCompleted&&w.data.monsterSurvivalBest===10));
  assert.ok(g.writes.every(w=>Object.keys(w.data).every(key=>["monsterSurvivalStarted","monsterSurvivalAttempted","monsterSurvivalBest","monsterSurvivalCompleted","monsterSurvivalPrevious"].includes(key))));
});
test("loss, quit and restart cannot bypass Billy or continue to the next opponent",async()=>{
  const g=await page();g.start();let q=g.current();g.api.recordResult({id:q.get("run"),level:1,won:true});g.api.returnFromGame();g.next();
  q=g.current();g.api.recordResult({id:q.get("run"),level:2,won:false});g.api.returnFromGame();g.start();assert.equal(g.current().get("level"),"1");
  g.api.returnFromGame(true);assert.equal(g.current().get("level"),"1");assert.notEqual(g.current().get("run"),q.get("run"));
  g.api.returnFromGame();g.start();assert.equal(g.current().get("level"),"1");await new Promise(r=>setImmediate(r));assert.ok(g.writes.every(w=>!Object.hasOwn(w.data,"monsterSurvivalBest")||w.data.monsterSurvivalBest<=1));
});
test("four trophies unlock a separate ten-round Tier 2 Survival starting at George",async()=>{
  const wins=[1,2,3,4,5,11,12].flatMap(level=>E.MODES.map(mode=>`${level}-${mode}`)),scores=Object.fromEntries(wins.map(key=>[key,{won:E.legsNeeded(Number(key.split("-")[1])),lost:0}]));
  const locked=await page();assert.equal(locked.node("survivalTierTwo").hidden,true);locked.node("survivalTierTwo").listeners.click();locked.start();assert.equal(locked.current().get("level"),"1");
  const g=await page({uid:"member"},[],{monsterBotWins:wins,monsterBotBestScores:scores});assert.equal(g.node("survivalTierTwo").hidden,false);g.node("survivalTierTwo").listeners.click();g.start();
  for(let round=1;round<=10;round++){
    const q=g.current(),level=round+10;assert.equal(q.get("tier"),"2");assert.equal(Number(q.get("level")),level);
    assert.equal(g.api.authorize(q.get("run"),level,"member"),true);assert.equal(g.api.authorize(q.get("run"),round,"member"),false);
    assert.equal(g.api.recordResult({id:q.get("run"),level,won:true}),true);g.api.returnFromGame();if(round<10)g.next();
  }
  await new Promise(r=>setImmediate(r));assert.ok(g.writes.some(w=>w.data.monsterSurvivalTier2Completed&&w.data.monsterSurvivalTier2Best===10));assert.ok(g.writes.every(w=>!Object.hasOwn(w.data,"monsterSurvivalBest")));
  assert.equal(g.stored.get("onm-survival-complete-tier2-member"),"earned");
});
test("each Survival tier requires level three on its own ladder",async()=>{
  const fresh=await page({uid:"member"},[],{});fresh.start();assert.equal(fresh.urls.length,0);assert.match(fresh.node("startSurvival").textContent,/Reach Level 3 · Tier 1/);
  const wins=[1,2,3,4].flatMap(level=>E.MODES.map(mode=>`${level}-${mode}`)),scores=Object.fromEntries(wins.map(key=>[key,{won:E.legsNeeded(Number(key.split("-")[1])),lost:0}]));
  const second=await page({uid:"member"},[],{monsterBotWins:wins,monsterBotBestScores:scores});assert.equal(second.node("survivalTierTwo").hidden,false);second.node("survivalTierTwo").listeners.click();second.start();assert.equal(second.urls.length,0);assert.match(second.node("startSurvival").textContent,/Reach Level 3 · Tier 2/);
});
test("Survival unlock updates without refresh and locked players cannot see the route",async()=>{
  const g=await page({uid:"member"},[],{});assert.equal(g.node("survivalRoute").hidden,true);assert.equal(g.node("startSurvival").disabled,true);
  const wins=["1-1","1-3","1-5","1-7","1-9","2-1","2-3"],scores=Object.fromEntries(wins.map(key=>[key,{won:E.legsNeeded(Number(key.split("-")[1])),lost:0}]));
  g.updateAccount({monsterBotWins:wins,monsterBotBestScores:scores});assert.equal(g.node("survivalRoute").hidden,false);assert.equal(g.node("startSurvival").disabled,false);g.start();assert.equal(g.current().get("level"),"1");
});
test("Best and Previous badges mark the next round and completion has its own card",async()=>{
  const wins=["1-1","1-3","1-5","1-7","1-9","2-1","2-3"],scores=Object.fromEntries(wins.map(key=>[key,{won:E.legsNeeded(Number(key.split("-")[1])),lost:0}]));
  const profile={monsterBotWins:wins,monsterBotBestScores:scores,monsterSurvivalBest:4,monsterSurvivalPrevious:2};
  const g=await page({uid:"member"},[],profile),html=g.node("survivalRoute").innerHTML;
  assert.match(html,/Nick Bot<span class="survivalRoundBadges"><small class="survivalBestBadge">BEST/);
  assert.match(html,/Venton Bot<span class="survivalRoundBadges"><small class="survivalPreviousBadge">PREVIOUS/);
  assert.doesNotMatch(html,/survivalCompleted/);
  const done=await page({uid:"member"},[],{...profile,monsterSurvivalBest:10,monsterSurvivalPrevious:10,monsterSurvivalCompleted:true});
  assert.match(done.node("survivalRoute").innerHTML,/class="survivalCompleted"[\s\S]*BEST[\s\S]*PREVIOUS/);
});
test("guests see signup and cannot begin a Survival run",async()=>{
  const g=await page(null);assert.equal(g.node("survivalSignUp").hidden,false);g.start();assert.equal(g.urls.length,0);
});
test("upcoming opponents are mystery slots until reached",async()=>{
  const g=await page();assert.match(g.node("survivalRoute").innerHTML,/Billy Bot/);
  assert.doesNotMatch(g.node("survivalRoute").innerHTML,/Croft Bot|Filip Bot|croft-bot.png|filip-bot.png/);
  assert.equal((g.node("survivalRoute").innerHTML.match(/Mystery Monster/g)||[]).length,9);
  g.start();const q=g.current();g.api.recordResult({id:q.get("run"),level:1,won:true});
  assert.match(g.node("survivalRoute").innerHTML,/Croft Bot/);assert.doesNotMatch(g.node("survivalRoute").innerHTML,/Venton Bot/);
});
test("Survival has Play and Leaderboard views with progress and trophies",async()=>{
  const g=await page({uid:"member"},[{name:"Alex <test>",best:7,complete:false},{name:"Winner",best:10,complete:true}]);
  g.node("survivalBoardTab").listeners.click();await new Promise(r=>setImmediate(r));
  assert.equal(g.node("survivalPlayPanel").hidden,true);assert.equal(g.node("survivalBoardPanel").hidden,false);
  assert.match(g.node("survivalBoardRows").innerHTML,/7\/10/);assert.match(g.node("survivalBoardRows").innerHTML,/✓/);assert.doesNotMatch(g.node("survivalBoardRows").innerHTML,/🏆/);assert.match(g.node("survivalBoardRows").innerHTML,/Alex &lt;test&gt;/);
  g.node("survivalPlayTab").listeners.click();assert.equal(g.node("survivalPlayPanel").hidden,false);
});
test("missing Survival service support gives a retry message, not a fake empty leaderboard",async()=>{
  const g=await page({uid:"member"},null);g.node("survivalBoardTab").listeners.click();await new Promise(r=>setImmediate(r));
  assert.match(g.node("survivalBoardStatus").textContent,/couldn't load/);assert.equal(g.node("refreshSurvivalBoard").disabled,false);
});
test("the ladder has a distinct scroll frame without duplicate promo or footer links",()=>{
  const html=fs.readFileSync(require.resolve("../monster-bot.html"),"utf8");
  assert.doesNotMatch(html,/class="survivalPromo"|id="openRules"/);assert.match(html,/class="ladderScrollFrame"/);assert.match(html,/Scroll to explore Monsters/);
  assert.doesNotMatch(html,/id="openBotGameMenu"|id="botGameMenu"/);
  assert.doesNotMatch(html.slice(html.indexOf('class="botIntro"'),html.indexOf('id="challengeSetup"')),/openRules/);
  const css=fs.readFileSync(require.resolve("../styles/monster-game-navigation.css"),"utf8");assert.match(css,/\.survivalRoute\{display:flex;flex-direction:column/);assert.match(css,/content:"↓"/);
});
