const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),{pcm}=require("./boost-nick-audio.cjs");
function wave(samples,rate=48000){const b=Buffer.alloc(44+samples.length);b.write("RIFF");b.writeUInt32LE(b.length-8,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(samples.length,40);samples.copy(b,44);return b;}
function trim(buffer,headMs=20,tailMs=55){
  const info=pcm(buffer);if(info.channels!==1)throw Error("Expected mono");
  const samples=buffer.subarray(info.offset,info.offset+info.length),size=Math.round(info.rate*.01),energy=[];
  for(let start=0;start<samples.length/2;start+=size){let sum=0,n=0;for(let i=start;i<Math.min(start+size,samples.length/2);i++){const v=samples.readInt16LE(i*2)/32768;sum+=v*v;n++;}energy.push(sum/n);}
  const threshold=Math.max(1e-7,Math.max(...energy)*10**(-3.2)),active=energy.map((v,i)=>v>threshold?i:-1).filter(i=>i>=0);
  if(!active.length)return{samples,rate:info.rate,removedMs:0};
  const first=Math.max(0,Math.floor(active[0]*size-info.rate*headMs/1000)),last=Math.min(samples.length/2,Math.ceil((active.at(-1)+1)*size+info.rate*tailMs/1000));
  return{samples:samples.subarray(first*2,last*2),rate:info.rate,removedMs:(samples.length/2-last+first)/info.rate*1000};
}
if(require.main===module){
  const root=path.resolve(__dirname,".."),folder=path.join(root,"audio/darts"),out=path.join(folder,"flow"),temp=fs.mkdtempSync(path.join(os.tmpdir(),"onm-audio-flow-")),nick=require("../scripts/dart-nick-clips"),E=require("../scripts/monster-bot-engine"),source=fs.readFileSync(path.join(root,"scripts/dart-scorer.js"),"utf8");
  const credits=Object.fromEntries([...source.matchAll(/"(score-\d+\.mp3)": "([^"\n]+)"/g)].map(m=>[m[1],m[2]])),decoded=new Map(),report={scores:[],checkouts:[]};fs.mkdirSync(out,{recursive:true});
  function decode(file){if(!decoded.has(file)){const input=nick.isNick(file,credits[file])?path.join(folder,"nick-boosted",file.replace(/\.mp3$/,".m4a")):path.join(folder,file),wav=path.join(temp,file+".wav");cp.execFileSync("/usr/bin/afconvert",[input,wav,"-f","WAVE","-d","LEI16@48000","-c","1"]);decoded.set(file,fs.readFileSync(wav));}return decoded.get(file);}
  function encode(name,samples){const wav=path.join(temp,name+".wav");fs.writeFileSync(wav,wave(samples));cp.execFileSync("/usr/bin/afconvert",[wav,path.join(out,name+".m4a"),"-f","m4af","-d","aac","-b","128000","-q","127"]);}
  for(const file of fs.readdirSync(folder).filter(f=>/^score-\d+\.mp3$/.test(f))){const t=trim(decode(file));encode(file.replace(/\.mp3$/,""),t.samples);report.scores.push({file,removedMs:t.removedMs,duration:t.samples.length/96000});}
  const prefix=trim(decode("you-require.mp3"),20,35);
  for(let n=2;n<=170;n++)if(E.checkoutPossible(n,3)){
    const file=fs.existsSync(path.join(folder,`score-${n}-short.mp3`))?`score-${n}-short.mp3`:`score-${n}.mp3`,number=trim(decode(file),20,55),gap=Buffer.alloc(2400);
    const samples=Buffer.concat([prefix.samples,gap,number.samples]);encode(`require-${n}`,samples);report.checkouts.push({score:n,numberSource:file,gapMs:25,duration:samples.length/96000});
  }
  fs.writeFileSync(path.join(out,"timing.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({scores:report.scores.length,joinedCheckouts:report.checkouts.length,medianRemovedMs:report.scores.map(s=>s.removedMs).sort((a,b)=>a-b)[Math.floor(report.scores.length/2)]}));
}
module.exports={wave,trim};
