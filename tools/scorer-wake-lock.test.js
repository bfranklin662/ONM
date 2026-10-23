const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
function harness({fail=false}={}) {
  const events={},locks=[],timers=[],intervals=new Map(),warnings=[];let fullscreen=true,requests=0,nextInterval=0;
  const ctx={document:{visibilityState:"visible",body:{classList:{contains:()=>fullscreen}},addEventListener:(name,fn)=>{events[name]=fn;}},window:{addEventListener:(name,fn)=>{events[name]=fn;}},navigator:{wakeLock:{request:async()=>{
    requests++;if(fail){fail=false;throw Error("Initial request denied");}
    let onRelease;const lock={released:false,addEventListener:(_event,fn)=>{onRelease=fn;},release:async()=>{lock.released=true;onRelease?.();}};locks.push(lock);return lock;
  }}},console:{warn(){}},showOnlineNotice:message=>warnings.push(message),setInterval:(fn,delay)=>{const id=++nextInterval;intervals.set(id,{fn,delay});return id;},clearInterval:id=>intervals.delete(id),setTimeout:fn=>timers.push(fn)};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("let wakeLock = null;"),source.indexOf("function enterScorerFullscreen()")),ctx);
  return{ctx,events,locks,timers,intervals,warnings,requests:()=>requests,fullscreen:value=>{fullscreen=value;}};
}
test("fullscreen keeps one screen lock, reacquires it after release, and releases on exit",async()=>{
  const g=harness();await Promise.all([g.ctx.requestWakeLock(),g.ctx.requestWakeLock()]);assert.equal(g.requests(),1);
  await g.locks[0].release();assert.equal(g.timers.length,1);await g.timers.shift()();assert.equal(g.requests(),2);
  g.fullscreen(false);await g.ctx.releaseWakeLock();assert.equal(g.locks[1].released,true);assert.equal(g.timers.length,0);
});
test("screen lock retries on interaction and returning to a visible game",async()=>{
  const g=harness({fail:true});await g.ctx.requestWakeLock();assert.equal(g.locks.length,0);
  g.events.pointerdown();await new Promise(r=>setImmediate(r));assert.equal(g.locks.length,1);
  g.ctx.document.visibilityState="hidden";await g.locks[0].release();assert.equal(g.timers.length,0);
  g.ctx.document.visibilityState="visible";g.events.visibilitychange();await new Promise(r=>setImmediate(r));assert.equal(g.locks.length,2);
});
test("unsupported browsers and non-fullscreen screens do not request a lock",async()=>{
  const g=harness();g.fullscreen(false);await g.ctx.requestWakeLock();assert.equal(g.requests(),0);
  g.fullscreen(true);g.ctx.navigator={};await g.ctx.requestWakeLock();assert.equal(g.requests(),0);
  assert.equal(g.warnings.length,0);
});
test("a failed lock is retried automatically while idle without a visible warning",async()=>{
  const g=harness({fail:true});await g.ctx.requestWakeLock();
  assert.equal(g.warnings.length,0);assert.equal(g.intervals.size,1);
  const watchdog=[...g.intervals.values()][0];assert.equal(watchdog.delay,10000);
  watchdog.fn();await new Promise(r=>setImmediate(r));assert.equal(g.requests(),2);assert.equal(g.locks.length,1);
  watchdog.fn();await new Promise(r=>setImmediate(r));assert.equal(g.requests(),2);assert.equal(g.warnings.length,0);
  g.fullscreen(false);await g.ctx.releaseWakeLock();assert.equal(g.intervals.size,0);
});
test("hidden pages stop polling and resume it when the game becomes visible",async()=>{
  const g=harness();await g.ctx.requestWakeLock();
  g.ctx.document.visibilityState="hidden";g.events.visibilitychange();assert.equal(g.intervals.size,0);
  await g.locks[0].release();g.ctx.document.visibilityState="visible";g.events.visibilitychange();
  await new Promise(r=>setImmediate(r));assert.equal(g.intervals.size,1);assert.equal(g.locks.length,2);
});
test("announcement busy state includes queued clips, but not suppressed audio",()=>{
  const ctx={dartAudioPlaying:false,dartAudioQueue:[],isDartAudioSuppressed:()=>false};vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("function isDartCalloutBusy()"),source.indexOf("function playNextDartCallout()")),ctx);
  assert.equal(ctx.isDartCalloutBusy(),false);ctx.dartAudioPlaying=true;assert.equal(ctx.isDartCalloutBusy(),true);
  ctx.dartAudioPlaying=false;ctx.dartAudioQueue.push({});assert.equal(ctx.isDartCalloutBusy(),true);
  ctx.isDartAudioSuppressed=()=>true;assert.equal(ctx.isDartCalloutBusy(),false);
});
test("callout readiness distinguishes playback from autoplay denial and missing audio",async()=>{
  for(const outcome of ["playing","blocked","missing"]) {
    const ready=[],blocked=[];
    const player={pause(){},play:()=>outcome==="playing"?Promise.resolve():Promise.reject(Object.assign(new Error(outcome),{name:outcome==="blocked"?"NotAllowedError":"NotSupportedError"}))};
    const ctx={dartAudioPlaying:false,dartAudioQueue:[{src:"game-on.mp3",onPlaybackReady:value=>ready.push(value),onAutoplayBlocked:()=>blocked.push(true)}],dartAudioPlayer:player,isDartAudioSuppressed:()=>false,unlockDartAudio(){},console:{warn(){}}};
    vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("function playNextDartCallout()"),source.indexOf("function announceDartVisit(")),ctx);
    ctx.playNextDartCallout();await new Promise(done=>setImmediate(done));
    assert.deepEqual(ready,outcome==="blocked"?[]:[outcome==="playing"]);
    assert.equal(blocked.length,outcome==="blocked"?1:0);
    if(outcome==="playing") {player.onerror();assert.equal(ready.length,1);}
  }
});
