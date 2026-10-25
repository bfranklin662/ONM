const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
function pcm(buffer){
  let at=12,format,data;
  while(at+8<=buffer.length){const size=buffer.readUInt32LE(at+4),type=buffer.toString("ascii",at,at+4);if(type==="fmt ")format={encoding:buffer.readUInt16LE(at+8),channels:buffer.readUInt16LE(at+10),rate:buffer.readUInt32LE(at+12),bits:buffer.readUInt16LE(at+22)};if(type==="data")data={offset:at+8,length:size};at+=8+size+(size%2);}
  if(![1,65534].includes(format?.encoding)||format.bits!==16||!data)throw Error("Expected PCM16 WAV");
  return{...format,...data};
}
function measure(buffer){
  const info=pcm(buffer),block=Math.round(info.rate*info.channels*.02),powers=[];let peak=0;
  for(let start=0;start<info.length/2;start+=block){let sum=0,n=0;for(let i=start;i<Math.min(start+block,info.length/2);i++){const value=buffer.readInt16LE(info.offset+i*2)/32768;sum+=value*value;n++;peak=Math.max(peak,Math.abs(value));}powers.push([sum,n]);}
  const max=Math.max(...powers.map(([sum,n])=>sum/n)),active=powers.filter(([sum,n])=>sum/n>Math.max(1e-7,max/1000));
  const power=active.reduce((sum,[s])=>sum+s,0)/active.reduce((sum,[,n])=>sum+n,0);
  return{rmsDb:10*Math.log10(power),peakDb:20*Math.log10(peak),duration:info.length/(2*info.channels*info.rate)};
}
function boost(buffer){
  const before=measure(buffer),info=pcm(buffer),gainDb=Math.max(6,Math.min(16,-13-before.rmsDb)),gain=10**(gainDb/20),output=Buffer.from(buffer);
  const frames=info.length/(2*info.channels),lookahead=Math.ceil(info.rate*.005),ceiling=10**(-2/20),release=Math.exp(-1/(info.rate*.05));
  const peaks=new Float64Array(frames);for(let frame=0;frame<frames;frame++)for(let channel=0;channel<info.channels;channel++)peaks[frame]=Math.max(peaks[frame],Math.abs(buffer.readInt16LE(info.offset+(frame*info.channels+channel)*2)/32768*gain));
  const deque=[];let head=0,right=0,envelope=1;
  for(let frame=0;frame<frames;frame++){
    while(right<Math.min(frames,frame+lookahead+1)){while(deque.length>head&&peaks[deque.at(-1)]<=peaks[right])deque.pop();deque.push(right++);}
    while(deque[head]<frame)head++;
    const desired=Math.min(1,ceiling/Math.max(1e-10,peaks[deque[head]]));envelope=desired<envelope?desired:desired+(envelope-desired)*release;
    for(let channel=0;channel<info.channels;channel++){const at=info.offset+(frame*info.channels+channel)*2;output.writeInt16LE(Math.round(buffer.readInt16LE(at)*gain*envelope),at);}
  }
  return{buffer:output,gainDb,before,after:measure(output)};
}
if(require.main===module){
  const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"scripts/dart-scorer.js"),"utf8"),files=[...[...source.matchAll(/"(score-\d+\.mp3)": "Nick/g)].map(m=>m[1]),...require("../scripts/dart-nick-clips").announcements],temporary=fs.mkdtempSync(path.join(os.tmpdir(),"onm-nick-audio-")),results=[];
  const outputFolder=path.join(root,"audio/darts/nick-boosted"),write=process.argv.includes("--write");if(write)fs.mkdirSync(outputFolder,{recursive:true});
  for(const file of files){
    const wav=path.join(temporary,file+".wav");cp.execFileSync("/usr/bin/afconvert",[path.join(root,"audio/darts",file),wav,"-f","WAVE","-d","LEI16"]);
    const result=boost(fs.readFileSync(wav));
    if(write){
      const boosted=path.join(temporary,"boosted-"+file+".wav"),output=path.join(outputFolder,file.replace(/\.mp3$/,".m4a"));fs.writeFileSync(boosted,result.buffer);
      cp.execFileSync("/usr/bin/afconvert",[boosted,output,"-f","m4af","-d","aac","-b","192000","-q","127"]);
      const check=path.join(temporary,"check-"+file+".wav");cp.execFileSync("/usr/bin/afconvert",[output,check,"-f","WAVE","-d","LEI16"]);
      const measured=measure(fs.readFileSync(check));if(measured.peakDb>-.5)throw Error(`Encoded peak too high: ${file}`);
      if(Math.abs(measured.duration-result.before.duration)>.06)throw Error(`Duration changed: ${file}`);
      result.encoded=measured;
    }
    results.push({file,gainDb:result.gainDb,before:result.before,after:result.after,...(result.encoded?{encoded:result.encoded}:{})});
  }
  if(write)fs.writeFileSync(path.join(outputFolder,"normalization.json"),JSON.stringify({targetRmsDb:-13,peakCeilingDb:-2,minGainDb:6,maxGainDb:16,limiterLookaheadMs:5,limiterReleaseMs:50,clips:results},null,2)+"\n");
  console.log(JSON.stringify({count:results.length,boosted:results.filter(r=>r.gainDb>.5).length,maxGainDb:Math.max(...results.map(r=>r.gainDb)),outputFolder:write?outputFolder:null},null,2));
}
module.exports={pcm,measure,boost};
