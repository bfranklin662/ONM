const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../scripts/monster-bot-launch"),"utf8");
function harness(fail=false){
  let audio,plays=0;const timers=new Map();
  const ctx={window:{},Audio:function(src){audio=this;this.src=src;this.pause=()=>{};this.play=()=>{plays++;return fail?Promise.reject(Error("Blocked")):Promise.resolve();};},setTimeout:fn=>{timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,ctx);return{api:ctx.window.ONMBotLaunch,audio,timers,plays:()=>plays};
}
test("launch audio starts synchronously and navigation waits until the recording ends",()=>{
  const g=harness(),results=[];g.api.start(played=>results.push(played));
  assert.equal(g.plays(),1);assert.deepEqual(results,[]);
  g.api.start(()=>assert.fail("Duplicate click must not launch again"));assert.equal(g.plays(),1);
  g.audio.onended();assert.deepEqual(results,[true]);assert.equal(g.timers.size,0);
});
test("blocked or broken launch audio never traps the player on the splash",async()=>{
  const g=harness(true),results=[];g.api.start(value=>results.push(value));
  await new Promise(done=>setImmediate(done));assert.deepEqual(results,[false]);
  const h=harness();h.api.start(value=>results.push(value));[...h.timers.values()][0]();
  assert.deepEqual(results,[false,false]);
});
test("embedded scorer reveals and announces only when its own ready signal arrives",()=>{
  let audio,frame;const splash={hidden:false},calls=[];
  const ctx={URL,window:{location:{href:"https://example.test/monster-bot.html",origin:"https://example.test"}},Audio:function(){audio=this;this.paused=true;this.pause=()=>{this.paused=true;};this.play=()=>{calls.push(this.src);this.paused=false;return Promise.resolve();};},document:{body:{style:{},appendChild(node){frame=node;}},createElement(){return{style:{},contentWindow:{},remove(){}};},getElementById:()=>splash},setTimeout,clearTimeout};
  vm.runInNewContext(source,ctx);
  ctx.window.ONMBotLaunch.open("dart-scorer.html?mode=bot&level=1&format=3");
  assert.equal(calls.length,1);assert.match(calls[0],/^data:audio\/wav;base64,/);assert.equal(splash.hidden,false);
  assert.equal(ctx.window.ONMBotLaunch.isPlaying(),false);
  const silent=Buffer.from(calls[0].split(",")[1],"base64");assert.equal(silent.length,204);assert.ok(silent.subarray(44).every(byte=>byte===0));
  ctx.window.ONMBotLaunch.open("dart-scorer.html?mode=bot&level=1&format=3");assert.equal(calls.length,1);
  assert.equal(ctx.window.ONMBotLaunch.ready({}),false);assert.equal(calls.length,1);
  assert.equal(ctx.window.ONMBotLaunch.ready(frame.contentWindow),true);
  assert.equal(splash.hidden,true);assert.equal(calls[1],"audio/darts/nick-boosted/game-on.m4a?v=20261025-all-nick-v2");assert.equal(audio.loop,false);assert.equal(audio.currentTime,0);
  assert.equal(ctx.window.ONMBotLaunch.isPlaying(),true);
  ctx.window.ONMBotLaunch.ready(frame.contentWindow);ctx.window.ONMBotLaunch.ready(frame.contentWindow);
  assert.equal(calls.filter(src=>src==="audio/darts/nick-boosted/game-on.m4a?v=20261025-all-nick-v2").length,1);
  ctx.window.ONMBotLaunch.close();ctx.window.ONMBotLaunch.open("dart-scorer.html?mode=bot&level=1&format=3");ctx.window.ONMBotLaunch.ready(frame.contentWindow);
  assert.equal(calls.filter(src=>src==="audio/darts/nick-boosted/game-on.m4a?v=20261025-all-nick-v2").length,2);
});
