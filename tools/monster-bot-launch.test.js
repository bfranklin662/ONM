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
