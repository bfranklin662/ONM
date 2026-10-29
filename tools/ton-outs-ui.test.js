const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),E=require("../scripts/ton-outs-engine");
const tick=()=>new Promise(r=>setImmediate(r));
async function app(signedIn=true,{holdProgress=false}={}){
 const nodes=new Map(),writes=[],events={};let data={status:"Active",tonOutsProgress:{}},watch;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,innerHTML:"",textContent:"",listeners:{},setAttribute(){},addEventListener(k,fn){this.listeners[k]=fn},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id);};
 const sdk={doc:()=>"users/member",onSnapshot:(_ref,fn)=>{watch=fn;if(!holdProgress)fn({data:()=>data});return ()=>{}},runTransaction:async(_db,fn)=>fn({get:async()=>({data:()=>data}),update:(_ref,fields)=>{data={...data,...fields};writes.push(fields)}})};
 const ctx={document:{getElementById:node},location:{hash:"#play"},window:{ONMTonOuts:E,ONMFirebase:{config:{projectId:"test"},ready:Promise.resolve({db:{},firestoreSdk:sdk}),authReady:Promise.resolve({auth:{},authSdk:{onAuthStateChanged:(_auth,fn)=>fn(signedIn?{uid:"member",getIdToken:async()=>"token"}:null)}})},ONMBotData:{fetchCommunity:async()=>({tonOutsLeaderboard:[]})},addEventListener:(k,fn)=>events[k]=fn}};
 vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/ton-outs.js"),"utf8"),ctx);await tick();await tick();return {node,writes,data:()=>data,open:n=>node("tonGrid").listeners.click({target:{closest:()=>({dataset:{total:String(n)},disabled:false})}}),watch,ctx};
}
test("signed-in visit saves misses, successful hits, next unlock and review without duplicate awards",async()=>{
 const a=await app();a.open(100);assert.equal(a.node("tonChallenge").open,true);await a.node("tonMiss").listeners.click();await tick();assert.equal(a.data().tonOutsProgress[100].misses,1);assert.equal(a.node("tonAttempts").textContent,"1");await a.node("tonHit").listeners.click();await tick();assert.equal(a.node("tonProgress").textContent,"1 / 64 complete");assert.equal(a.node("tonAttempts").textContent,"2");assert.equal(a.node("tonNext").hidden,false);assert.equal(a.node("tonHit").disabled,true);a.node("tonNext").listeners.click();assert.equal(a.node("tonChallengeTitle").textContent,"101 checkout");
});
test("guests see locked challenge controls and do not write any progress",async()=>{const a=await app(false);assert.match(a.node("tonStatus").innerHTML,/Sign up or log in/);a.node("tonHit").listeners.click();await tick();assert.equal(a.writes.length,0);});
test("Ton+ Outs shows signed-in identity and completion progress in the shared player card",async()=>{
 const a=await app();a.watch({data:()=>({firstName:"Nick",tonOutsProgress:{100:{hit:true}}})});assert.equal(a.node("tonSummaryName").textContent,"Nick");assert.equal(a.node("tonPlayerSummary").hidden,false);assert.equal(a.node("tonSummaryPercent").textContent,"2% complete");const guest=await app(false);assert.equal(guest.node("tonPlayerSummary").hidden,true);
});
test("all script element IDs exist in the game page",()=>{const script=fs.readFileSync(require.resolve("../scripts/ton-outs.js"),"utf8"),html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");for(const [,id] of script.matchAll(/\$\("([^"]+)"\)/g))assert.ok(html.includes(`id="${id}"`),`Missing ${id}`);});
test("the grid contains only 64 checkouts, with SVG locks and no duplicate page navigation buttons",async()=>{
 const a=await app(),grid=a.node("tonGrid").innerHTML;assert.equal((grid.match(/data-total=/g)||[]).length,64);for(const n of [159,162,163,165,166,168,169])assert.ok(!grid.includes(`data-total="${n}"`));assert.doesNotMatch(grid,/🔒/);assert.match(grid,/<svg viewBox="0 0 24 24"/);
 const html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8");assert.doesNotMatch(html,/id="showTonBoard"/);assert.match(html,/id="tonLoading" class="accountLoading"/);assert.match(html,/id="tonBoardLoading" class="accountLoading"/);
});
test("progress spinner stays visible until account data arrives and leaderboard has its own spinner",async()=>{
 const a=await app(true,{holdProgress:true});assert.equal(a.node("tonLoading").hidden,false);assert.equal(a.node("tonGame").hidden,true);a.watch({data:()=>({tonOutsProgress:{100:{hit:true}}})});assert.equal(a.node("tonLoading").hidden,true);assert.equal(a.node("tonGame").hidden,false);assert.equal(a.node("tonProgress").textContent,"1 / 64 complete");
 let release;a.ctx.window.ONMBotData.fetchCommunity=()=>new Promise(r=>{release=r});const pending=a.node("refreshTonBoard").listeners.click();assert.equal(a.node("tonBoardLoading").hidden,false);assert.equal(a.node("tonBoardTable").hidden,true);release({tonOutsLeaderboard:[]});await pending;assert.equal(a.node("tonBoardLoading").hidden,true);assert.equal(a.node("tonBoardTable").hidden,false);
});
test("miss and hit feedback unlocks audio on the gesture and plays distinct saved-result tones",async()=>{
 const a=await app(),tones=[];a.ctx.window.AudioContext=function(){this.state="running";this.currentTime=0;this.destination={};this.createOscillator=()=>({frequency:{value:0},connect(){},disconnect(){},start(){tones.push(this.frequency.value)},stop(){}});this.createGain=()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}});};
 a.open(100);assert.deepEqual(tones,[880]);tones.length=0;await a.node("tonMiss").listeners.click();assert.deepEqual(tones,[220,164.81]);tones.length=0;await a.node("tonHit").listeners.click();assert.deepEqual(tones,[523.25,659.25,783.99]);tones.length=0;a.node("tonNext").listeners.click();assert.deepEqual(tones,[880]);
});
test("checkout requests a screen wake lock, reacquires it after release and stops on close",async()=>{
 const a=await app(),locks=[],timers=new Map();let requests=0;
 a.ctx.window.navigator={wakeLock:{request:async kind=>{assert.equal(kind,"screen");requests++;const lock={released:false,addEventListener(_type,fn){this.onrelease=fn},async release(){this.released=true;this.onrelease?.()}};locks.push(lock);return lock;}}};a.ctx.window.setInterval=fn=>{timers.set(1,fn);return 1};a.ctx.window.clearInterval=id=>timers.delete(id);
 a.open(100);await tick();assert.equal(requests,1);await locks[0].release();await timers.get(1)();assert.equal(requests,2);a.node("tonChallenge").close();a.node("tonChallenge").listeners.close();await tick();assert.equal(locks[1].released,true);assert.equal(timers.size,0);
});
test("wake lock refusal does not block the checkout or add an error message",async()=>{const a=await app();a.ctx.window.navigator={wakeLock:{request:async()=>{throw Error("Not allowed")}}};a.open(100);await tick();assert.equal(a.node("tonChallenge").open,true);assert.doesNotMatch(a.node("tonChallengeStatus").textContent,/Not allowed|wake lock/i);});
