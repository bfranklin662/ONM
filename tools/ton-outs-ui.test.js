const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),E=require("../scripts/ton-outs-engine");
const tick=()=>new Promise(r=>setImmediate(r));
test("timer pauses on phone sleep, pagehide and closing a checkout, then resumes without counting time away",async()=>{
 const a=await app();let now=0,id=0;const timers=new Map();a.ctx.Date={now:()=>now};a.ctx.window.setInterval=fn=>{timers.set(++id,fn);return id;};a.ctx.window.clearInterval=key=>timers.delete(key);const draw=()=>{for(const fn of timers.values())fn();};
 a.open(100);now=5000;a.ctx.document.visibilityState="hidden";a.events["document:visibilitychange"]();assert.equal(a.node("tonTimer").textContent,"0:05");
 now=65000;draw();assert.equal(a.node("tonTimer").textContent,"0:05");a.ctx.document.visibilityState="visible";a.events["document:visibilitychange"]();now=68000;draw();assert.equal(a.node("tonTimer").textContent,"0:08");
 a.node("tonChallenge").close();a.node("tonChallenge").listeners.close();now=100000;a.open(100);assert.equal(a.node("tonTimer").textContent,"0:08");now=102000;draw();assert.equal(a.node("tonTimer").textContent,"0:10");
 a.events.pagehide();now=200000;draw();assert.equal(a.node("tonTimer").textContent,"0:10");a.events.pageshow();now=201000;draw();assert.equal(a.node("tonTimer").textContent,"0:11");
 await a.node("tonHit").listeners.click();a.ctx.document.visibilityState="hidden";a.events["document:visibilitychange"]();now=300000;a.ctx.document.visibilityState="visible";a.events["document:visibilitychange"]();now=400000;draw();assert.equal(a.node("tonTimer").textContent,"0:11");
});
test("checkout timer survives counter updates, stops on hit and resets for next checkout",async()=>{
 const a=await app();let now=10000,id=0;const timers=new Map();
 a.ctx.Date={now:()=>now};a.ctx.window.setInterval=fn=>{timers.set(++id,fn);return id;};a.ctx.window.clearInterval=key=>timers.delete(key);
 const draw=()=>{for(const fn of timers.values())fn();};
 a.open(100);assert.equal(a.node("tonTimer").textContent,"0:00");
 now+=65000;draw();assert.equal(a.node("tonTimer").textContent,"1:05");
 await a.node("tonNearMiss").listeners.click();now+=2000;draw();assert.equal(a.node("tonTimer").textContent,"1:07");
 await a.node("tonMiss").listeners.click();assert.equal(a.node("tonTimer").textContent,"1:07");
 await a.node("tonHit").listeners.click();now+=10000;draw();assert.equal(a.node("tonTimer").textContent,"1:07");assert.equal(a.node("tonCompletionTime").textContent,"1:07");
 assert.doesNotMatch(JSON.stringify(a.data()),/elapsed|timer|duration/);
 a.node("tonNext").listeners.click();assert.equal(a.node("tonTimer").textContent,"0:00");
 now+=3000;draw();assert.equal(a.node("tonTimer").textContent,"0:03");
 a.node("tonChallenge").close();a.node("tonChallenge").listeners.close();assert.equal(timers.size,0);
});
test("completed checkout review does not run a timer; practice gets a fresh timer",async()=>{
 const a=await app();let now=0,id=0;const timers=new Map();a.ctx.Date={now:()=>now};a.ctx.window.setInterval=fn=>{timers.set(++id,fn);return id;};a.ctx.window.clearInterval=key=>timers.delete(key);
 a.open(100);now=9000;await a.node("tonHit").listeners.click();a.open(100);now=19000;for(const fn of timers.values())fn();assert.equal(a.node("tonTimer").textContent,"0:09");assert.equal(a.node("tonCompletionTimeRow").hidden,true);
 a.node("tonTryAgain").listeners.click();now=23000;for(const fn of timers.values())fn();assert.equal(a.node("tonTimer").textContent,"0:04");await a.node("tonHit").listeners.click();assert.equal(a.node("tonCompletionTime").textContent,"0:04");
});
async function app(signedIn=true,{holdProgress=false}={}){
 const nodes=new Map(),writes=[],events={};let data={status:"Active",tonOutsProgress:{}},watch;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,innerHTML:"",textContent:"",listeners:{},setAttribute(){},addEventListener(k,fn){this.listeners[k]=fn},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id);};
 const sdk={doc:()=>"users/member",onSnapshot:(_ref,fn)=>{watch=fn;if(!holdProgress)fn({data:()=>data});return ()=>{}},runTransaction:async(_db,fn)=>fn({get:async()=>({data:()=>data}),update:(_ref,fields)=>{data={...data,...fields};writes.push(fields)}})};
 const ctx={document:{getElementById:node,visibilityState:"visible",addEventListener:(k,fn)=>events[`document:${k}`]=fn},location:{hash:"#play"},window:{ONMTonOuts:E,ONMFirebase:{config:{projectId:"test"},ready:Promise.resolve({db:{},firestoreSdk:sdk}),authReady:Promise.resolve({auth:{},authSdk:{onAuthStateChanged:(_auth,fn)=>fn(signedIn?{uid:"member",getIdToken:async()=>"token"}:null)}})},ONMBotData:{fetchCommunity:async()=>({tonOutsLeaderboard:[]})},addEventListener:(k,fn)=>events[k]=fn}};
 vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/ton-outs.js"),"utf8"),ctx);await tick();await tick();return {node,writes,data:()=>data,open:n=>node("tonGrid").listeners.click({target:{closest:()=>({dataset:{total:String(n)},disabled:false})}}),watch,ctx,events};
}
test("signed-in visit saves misses, successful hits, next unlock and review without duplicate awards",async()=>{
 const a=await app();a.open(100);assert.equal(a.node("tonChallenge").open,true);await a.node("tonMiss").listeners.click();await tick();assert.equal(a.data().tonOutsProgress[100].misses,1);assert.equal(a.node("tonAttempts").textContent,"1");await a.node("tonHit").listeners.click();await tick();assert.equal(a.node("tonProgress").textContent,"1 / 64 complete");assert.equal(a.node("tonAttempts").textContent,"2");assert.equal(a.node("tonNext").hidden,false);assert.equal(a.node("tonHit").disabled,true);a.node("tonNext").listeners.click();assert.equal(a.node("tonChallengeTitle").textContent,"101 checkout");
});
test("completion stats use three vertically stacked labelled rows",()=>{
 const html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8"),css=fs.readFileSync(require.resolve("../styles/ton-outs.css"),"utf8");
 assert.match(html,/<dl><div><dt>Attempts<\/dt><dd id="tonCompletionAttempts"/);
 assert.match(html,/<div><dt>Near misses<\/dt><dd id="tonCompletionNearMisses"/);
 assert.match(html,/<div id="tonCompletionTimeRow" hidden><dt>Time<\/dt>/);
 assert.match(css,/\.tonCompletionStats dl\{[^}]*display:grid/);
});
test("fresh completion shows both counters and only Next; reopening offers Try again without Next",async()=>{
 const a=await app();a.open(100);await a.node("tonNearMiss").listeners.click();await a.node("tonHit").listeners.click();
 assert.equal(a.node("tonCompletionAttempts").textContent,"2");assert.equal(a.node("tonCompletionNearMisses").textContent,"1");assert.equal(a.node("tonNext").hidden,false);assert.equal(a.node("tonTryAgain").hidden,true);assert.equal(a.node("tonCompletionPlayers").hidden,true);
 a.open(100);assert.equal(a.node("tonNext").hidden,true);assert.equal(a.node("tonTryAgain").hidden,false);assert.equal(a.node("tonCompletionPlayers").hidden,false);
 a.node("tonTryAgain").listeners.click();await a.node("tonNearMiss").listeners.click();await a.node("tonNearMiss").listeners.click();await a.node("tonHit").listeners.click();assert.equal(a.node("tonCompletionAttempts").textContent,"3");assert.equal(a.node("tonCompletionNearMisses").textContent,"2");assert.equal(a.node("tonTryAgain").hidden,true);
});
test("guests see locked challenge controls and do not write any progress",async()=>{const a=await app(false);assert.match(a.node("tonStatus").innerHTML,/Sign up or log in/);a.node("tonHit").listeners.click();await tick();assert.equal(a.writes.length,0);});
test("Ton+ Outs shows signed-in identity and completion progress in the shared player card",async()=>{
 const a=await app();a.watch({data:()=>({firstName:"Nick",tonOutsProgress:{100:{hit:true}}})});assert.equal(a.node("tonSummaryName").textContent,"Nick");assert.equal(a.node("tonPlayerSummary").hidden,false);assert.equal(a.node("tonSummaryPercent").textContent,"2% complete");const guest=await app(false);assert.equal(guest.node("tonPlayerSummary").hidden,true);
});
test("all script element IDs exist in the game page",()=>{const script=fs.readFileSync(require.resolve("../scripts/ton-outs.js"),"utf8"),html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");for(const [,id] of script.matchAll(/\$\("([^"]+)"\)/g))assert.ok(html.includes(`id="${id}"`),`Missing ${id}`);});
test("alternate routes appear underneath the primary only when supplied, without changing attempts",async()=>{
 const a=await app();a.open(100);assert.equal(a.node("tonAlternate").hidden,false);assert.equal(a.node("tonAlternateLabel").textContent,"Alternate route");assert.match(a.node("tonAlternateRoute").innerHTML,/>D20</);assert.equal(a.node("tonAttempts").textContent,"0");assert.equal(a.writes.length,0);
 a.open(125);assert.equal(a.node("tonAlternate").hidden,true);assert.equal(a.node("tonAlternateRoute").innerHTML,"");
});
test("near miss counter sits alongside attempts and includes practice attempts",async()=>{
 const a=await app();a.open(100);assert.equal(a.node("tonNearMisses").textContent,"0");
 await a.node("tonNearMiss").listeners.click();assert.equal(a.node("tonAttempts").textContent,"1");assert.equal(a.node("tonNearMisses").textContent,"1");
 await a.node("tonMiss").listeners.click();assert.equal(a.node("tonAttempts").textContent,"2");assert.equal(a.node("tonNearMisses").textContent,"1");
 await a.node("tonNearMiss").listeners.click();assert.equal(a.node("tonAttempts").textContent,"3");assert.equal(a.node("tonNearMisses").textContent,"2");
 await a.node("tonHit").listeners.click();a.node("tonTryAgain").listeners.click();assert.equal(a.node("tonNearMisses").textContent,"0");
 await a.node("tonNearMiss").listeners.click();await a.node("tonMiss").listeners.click();assert.equal(a.node("tonAttempts").textContent,"2");assert.equal(a.node("tonNearMisses").textContent,"1");assert.equal(a.data().tonOutsProgress[100].nearMisses,2);
 a.open(101);assert.equal(a.node("tonNearMisses").textContent,"0");
});
test("near misses save separately; completed cards show original attempts and retries cannot add awards",async()=>{
 const a=await app();a.open(100);await a.node("tonNearMiss").listeners.click();assert.equal(a.data().tonOutsProgress[100].nearMisses,1);assert.equal(a.node("tonAttempts").textContent,"1");await a.node("tonHit").listeners.click();assert.equal(a.node("tonCompletion").hidden,false);assert.equal(a.node("tonPlayArea").hidden,true);assert.equal(a.node("tonCompletionAttempts").textContent,"2");
 const original=JSON.stringify(a.data().tonOutsProgress),writes=a.writes.length;a.node("tonTryAgain").listeners.click();assert.equal(a.node("tonPlayArea").hidden,false);await a.node("tonNearMiss").listeners.click();await a.node("tonHit").listeners.click();assert.equal(a.writes.length,writes);assert.equal(JSON.stringify(a.data().tonOutsProgress),original);assert.equal(a.node("tonProgress").textContent,"1 / 64 complete");assert.equal(a.node("tonCompletionTitle").textContent,"✓ Practice complete");assert.equal(a.node("tonCompletionAttempts").textContent,"2");
});
test("checkout leaderboard uses shared title, toolbar, refresh icon and table layout",()=>{
 const html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");assert.doesNotMatch(html,/Ton\+ Outs leaderboard<\/h2>|class="tonBoardHeading"/);assert.match(html,/class="leaderboardToolbar"/);assert.match(html,/id="refreshTonBoard"[^>]*class="refreshLeaderboard"/);assert.match(html,/class="leaderboardScroll"/);assert.match(html,/id="tonBoardTable" class="leaderboardTable"/);
});
test("grid uses tick, play and lock icons without redundant labels or a key",async()=>{
 const a=await app();let grid=a.node("tonGrid").innerHTML;assert.match(grid,/<small><svg[^>]*><path d="m9 5/);assert.doesNotMatch(grid,/<small>Play/);
 await a.open(100);await a.node("tonHit").listeners.click();grid=a.node("tonGrid").innerHTML;assert.match(grid,/<small>✓<\/small>/);assert.doesNotMatch(grid,/✓ Complete/);
 const html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");assert.doesNotMatch(html,/class="tonLegend"/);
});
test("the grid contains only 64 checkouts, with SVG locks and no duplicate page navigation buttons",async()=>{
 const a=await app(),grid=a.node("tonGrid").innerHTML;assert.equal((grid.match(/data-total=/g)||[]).length,64);for(const n of [159,162,163,165,166,168,169])assert.ok(!grid.includes(`data-total="${n}"`));assert.doesNotMatch(grid,/🔒/);assert.match(grid,/<svg viewBox="0 0 24 24"/);
 const html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");assert.doesNotMatch(html,/id="showTonBoard"/);assert.match(html,/id="tonLoading" class="accountLoading"/);assert.match(html,/id="tonBoardLoading" class="accountLoading"/);
});
test("progress spinner stays visible until account data arrives and leaderboard has its own spinner",async()=>{
 const a=await app(true,{holdProgress:true});assert.equal(a.node("tonLoading").hidden,false);assert.equal(a.node("tonGame").hidden,true);a.watch({data:()=>({tonOutsProgress:{100:{hit:true}}})});assert.equal(a.node("tonLoading").hidden,true);assert.equal(a.node("tonGame").hidden,false);assert.equal(a.node("tonProgress").textContent,"1 / 64 complete");
 let release;a.ctx.window.ONMBotData.fetchCommunity=()=>new Promise(r=>{release=r});const pending=a.node("refreshTonBoard").listeners.click();assert.equal(a.node("tonBoardLoading").hidden,false);assert.equal(a.node("tonBoardTable").hidden,true);release({tonOutsLeaderboard:[]});await pending;assert.equal(a.node("tonBoardLoading").hidden,true);assert.equal(a.node("tonBoardTable").hidden,false);
});
test("near miss plays a distinct clip in both normal and practice games",async()=>{
 const a=await app(),played=[];a.ctx.window.Audio=function(src){this.pause=()=>{};this.play=()=>{played.push(src);return Promise.resolve();};};a.open(100);await a.node("tonMiss").listeners.click();await a.node("tonNearMiss").listeners.click();assert.match(played.at(-2),/\/miss\.wav/);assert.match(played.at(-1),/\/near-miss\.wav/);await a.node("tonHit").listeners.click();a.node("tonTryAgain").listeners.click();await a.node("tonNearMiss").listeners.click();assert.match(played.at(-1),/\/near-miss\.wav/);
});
test("start, miss and hit use audible media clips directly in the tap gesture",async()=>{
 const a=await app(),played=[];a.ctx.window.Audio=function(src){this.src=src;this.pause=()=>{};this.play=()=>{assert.equal(this.volume,1);assert.equal(this.muted,false);played.push(src.match(/(start|miss|hit)\.wav/)[1]);return Promise.resolve();};};
 a.open(100);assert.deepEqual(played,["start"]);const miss=a.node("tonMiss").listeners.click();assert.deepEqual(played,["start","miss"]);await miss;const hit=a.node("tonHit").listeners.click();assert.deepEqual(played,["start","miss","hit"]);await hit;a.node("tonNext").listeners.click();assert.deepEqual(played,["start","miss","hit","start"]);
});
test("repeated misses use fresh full-volume playback rather than seeking the previous clip",async()=>{
 const a=await app(),played=[];a.ctx.window.Audio=function(src){this.cloneNode=()=>{const clip={volume:0,muted:true,pause(){},play(){assert.equal(this.volume,1);assert.equal(this.muted,false);played.push({src,clip});return Promise.resolve();}};return clip;};};a.open(100);await a.node("tonMiss").listeners.click();await a.node("tonMiss").listeners.click();assert.match(played.at(-1).src,/\/miss\.wav/);assert.notEqual(played.at(-1).clip,played.at(-2).clip);
});
test("blocked playback is visible and retries successfully on the next tap",async()=>{const a=await app();let reject=true;a.ctx.window.Audio=function(){this.pause=()=>{};this.play=()=>reject?Promise.reject(Error("Blocked")):Promise.resolve();};a.open(100);await tick();assert.equal(a.node("tonAudioStatus").hidden,false);reject=false;await a.node("tonMiss").listeners.click();await tick();assert.equal(a.node("tonAudioStatus").hidden,true);});
test("checkout requests a screen wake lock, reacquires it after release and stops on close",async()=>{
 const a=await app(),locks=[],timers=new Map();let requests=0;
 a.ctx.window.navigator={wakeLock:{request:async kind=>{assert.equal(kind,"screen");requests++;const lock={released:false,addEventListener(_type,fn){this.onrelease=fn},async release(){this.released=true;this.onrelease?.()}};locks.push(lock);return lock;}}};a.ctx.window.setInterval=fn=>{timers.set(1,fn);return 1};a.ctx.window.clearInterval=id=>timers.delete(id);
 a.open(100);await tick();assert.equal(requests,1);await locks[0].release();await timers.get(1)();assert.equal(requests,2);a.node("tonChallenge").close();a.node("tonChallenge").listeners.close();await tick();assert.equal(locks[1].released,true);assert.equal(timers.size,0);
});
test("wake lock refusal does not block the checkout or add an error message",async()=>{const a=await app();a.ctx.window.navigator={wakeLock:{request:async()=>{throw Error("Not allowed")}}};a.open(100);await tick();assert.equal(a.node("tonChallenge").open,true);assert.doesNotMatch(a.node("tonChallengeStatus").textContent,/Not allowed|wake lock/i);});
