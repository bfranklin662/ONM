const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),E=require("../scripts/monster-bot-engine"),Nick=require("../scripts/dart-nick-clips"),{wave,trim}=require("./build-flow-audio.cjs");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"scripts/dart-scorer.js"),"utf8");
test("each legal checkout has one joined announcement, avoiding missing short-file requests",()=>{
  const calls=[],ctx={POSSIBLE_CHECKOUTS:new Set(Array.from({length:169},(_,i)=>i+2).filter(n=>E.checkoutPossible(n,3))),playDartCallout:file=>calls.push(file)};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("function announceRequiredScore("),source.indexOf("function announceLegWon(")),ctx);
  for(const n of ctx.POSSIBLE_CHECKOUTS){ctx.announceRequiredScore(n);assert.ok(fs.existsSync(path.join(root,"audio/darts/flow",`require-${n}.m4a`)));}
  assert.equal(calls.length,162);assert.ok(calls.every(file=>/^require-\d+\.m4a$/.test(file)));ctx.announceRequiredScore(159);assert.equal(calls.length,162);
});
test("queue preloads score and checkout audio without playing an extra voice",()=>{
  const warmed=[],ctx={window:{ONMNickAudio:Nick},Audio:function(){this.load=()=>warmed.push(this.src);this.play=()=>assert.fail("Prefetch must be silent");},DART_VOICE_CREDITS:{"score-40.mp3":"Nick 🔊"},dartAudioQueue:[],showDartVoiceToast(){},playNextDartCallout(){}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("function dartCalloutSource("),source.indexOf("function playLayeredDartAudio(")),ctx);
  ctx.playDartCallout("score-40.mp3");ctx.playDartCallout("require-60.m4a");assert.equal(warmed.length,2);assert.match(warmed[1],/flow\/require-60.m4a/);assert.equal(ctx.dartAudioQueue[1].fallbackSequence.length,2);
});
test("silence trimming retains the voiced samples and their pitch",()=>{
  const samples=Buffer.alloc(48000*2);for(let i=12000;i<36000;i++)samples.writeInt16LE(Math.round(Math.sin(i*.2)*5000),i*2);
  const result=trim(wave(samples));assert.ok(result.removedMs>300);assert.ok(result.samples.includes(samples.subarray(12000*2,36000*2)));
});
test("all score callouts have a trimmed source with the original voice retained",()=>{
  for(const file of fs.readdirSync(path.join(root,"audio/darts")).filter(f=>/^score-\d+\.mp3$/.test(f)))assert.ok(fs.existsSync(path.join(root,"audio/darts/flow",file.replace(/\.mp3$/,".m4a"))));
});
