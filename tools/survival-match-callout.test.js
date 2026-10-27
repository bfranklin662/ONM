const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
test("Survival says match shot only for the final bot in either tier",()=>{
  const source=fs.readFileSync(require.resolve("../scripts/dart-scorer.js"),"utf8"),fn=source.slice(source.indexOf("function announceLegWon("),source.indexOf("function announceGameOn("));
  for(const level of [1,4,10,11,19,20]){const calls=[],ctx={BOT_MODE:true,params:new URLSearchParams(`survival=1&level=${level}`),clearDartAudioQueue(){},playDartCallout:file=>calls.push(file)};vm.runInNewContext(fn,ctx);ctx.announceLegWon(true);assert.equal(calls[0],level%10===0?"match-shot.mp3":"game-shot.mp3");}
});
