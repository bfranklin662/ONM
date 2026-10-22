const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8");
function harness({fail=false}={}) {
  const events={},locks=[],timers=[];let fullscreen=true,requests=0;
  const ctx={document:{visibilityState:"visible",body:{classList:{contains:()=>fullscreen}},addEventListener:(name,fn)=>{events[name]=fn;}},window:{addEventListener:(name,fn)=>{events[name]=fn;}},navigator:{wakeLock:{request:async()=>{
    requests++;if(fail){fail=false;throw Error("Initial request denied");}
    let onRelease;const lock={released:false,addEventListener:(_event,fn)=>{onRelease=fn;},release:async()=>{lock.released=true;onRelease?.();}};locks.push(lock);return lock;
  }}},console:{warn(){}},setTimeout:fn=>timers.push(fn)};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("let wakeLock = null;"),source.indexOf("function enterScorerFullscreen()")),ctx);
  return{ctx,events,locks,timers,requests:()=>requests,fullscreen:value=>{fullscreen=value;}};
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
});
test("announcement busy state includes queued clips, but not suppressed audio",()=>{
  const ctx={dartAudioPlaying:false,dartAudioQueue:[],isDartAudioSuppressed:()=>false};vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("function isDartCalloutBusy()"),source.indexOf("function playNextDartCallout()")),ctx);
  assert.equal(ctx.isDartCalloutBusy(),false);ctx.dartAudioPlaying=true;assert.equal(ctx.isDartCalloutBusy(),true);
  ctx.dartAudioPlaying=false;ctx.dartAudioQueue.push({});assert.equal(ctx.isDartCalloutBusy(),true);
  ctx.isDartAudioSuppressed=()=>true;assert.equal(ctx.isDartCalloutBusy(),false);
});
