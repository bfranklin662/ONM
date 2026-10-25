const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {boost,measure}=require("./boost-nick-audio.cjs"),root=path.resolve(__dirname,"..");
function wave(amplitude){const b=Buffer.alloc(44+16000);b.write("RIFF");b.writeUInt32LE(b.length-8,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(16000,40);for(let i=0;i<8000;i++)b.writeInt16LE(Math.round(Math.sin(i*.3)*amplitude*32767),44+i*2);return b;}
test("quiet and loud Nick audio both gain loudness without clipping or changing duration",()=>{
  const quiet=wave(.02),result=boost(quiet);assert.ok(result.gainDb>=6&&result.gainDb<=16);assert.ok(result.after.peakDb<=-1.99);assert.equal(result.before.duration,result.after.duration);
  assert.ok(measure(result.buffer).rmsDb>measure(quiet).rmsDb);
  const loud=wave(.25);assert.equal(boost(loud).gainDb,6);assert.ok(boost(loud).after.rmsDb>measure(loud).rmsDb);assert.ok(boost(loud).after.peakDb<=-1.99);
});
test("every Nick number has a verified asset, with safe peaks and unchanged timing",()=>{
  const source=fs.readFileSync(path.join(root,"scripts/dart-scorer.js"),"utf8"),files=[...[...source.matchAll(/"(score-\d+\.mp3)": "Nick/g)].map(m=>m[1]),...require("../scripts/dart-nick-clips").announcements];
  const report=JSON.parse(fs.readFileSync(path.join(root,"audio/darts/nick-boosted/normalization.json"),"utf8"));assert.equal(report.clips.length,files.length);
  for(const file of files){const row=report.clips.find(r=>r.file===file);assert.ok(row);assert.ok(row.gainDb>=6&&row.gainDb<=16);assert.ok(row.encoded.rmsDb-row.before.rmsDb>=3,`${file} must be louder`);assert.ok(row.encoded.peakDb<=-.5);assert.ok(Math.abs(row.encoded.duration-row.before.duration)<.06);assert.ok(fs.statSync(path.join(root,"audio/darts/nick-boosted",file.replace(/\.mp3$/,".m4a"))).size>0);}
});
test("only Nick callouts use the boosted assets",()=>{
  const source=fs.readFileSync(path.join(root,"scripts/dart-scorer.js"),"utf8"),ctx={window:{ONMNickAudio:require("../scripts/dart-nick-clips")},DART_VOICE_CREDITS:{"score-100.mp3":"Nick 🔊","score-45.mp3":"Ricky 🔊"}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf("function dartCalloutSource("),source.indexOf("function playDartCallout(")),ctx);
  assert.match(ctx.dartCalloutSource("score-100.mp3"),/nick-boosted\/score-100.m4a/);assert.equal(ctx.dartCalloutSource("score-45.mp3"),"audio/darts/score-45.mp3");assert.match(ctx.dartCalloutSource("game-on.mp3"),/nick-boosted\/game-on.m4a/);assert.match(ctx.dartCalloutSource("game-shot.mp3"),/nick-boosted\/game-shot.m4a/);
});
