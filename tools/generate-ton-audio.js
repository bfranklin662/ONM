"use strict";
// Deterministic, speech-free PCM effects. No external audio dependencies.
const fs=require("node:fs"),path=require("node:path"),rate=44100;
const specs={start:{notes:[880],step:0,duration:.23},miss:{notes:[260,185],step:.12,duration:.2},hit:{notes:[523.25,659.25,783.99],step:.1,duration:.24}};
const directory=path.join(__dirname,"..","audio","ton-outs");fs.mkdirSync(directory,{recursive:true});
for(const [name,spec] of Object.entries(specs)){
 const length=Math.ceil((spec.duration+spec.step*(spec.notes.length-1))*rate),pcm=Buffer.alloc(length*2);
 for(let i=0;i<length;i++){const time=i/rate;let sample=0;spec.notes.forEach((frequency,n)=>{const t=time-n*spec.step;if(t<0||t>spec.duration)return;const envelope=Math.min(1,t/.008)*Math.pow(1-t/spec.duration,1.6);sample+=(Math.sin(2*Math.PI*frequency*t)+.2*Math.sin(4*Math.PI*frequency*t))*envelope*.62;});pcm.writeInt16LE(Math.round(Math.max(-.94,Math.min(.94,sample))*32767),i*2);}
 const header=Buffer.alloc(44);header.write("RIFF");header.writeUInt32LE(36+pcm.length,4);header.write("WAVEfmt ",8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);
 fs.writeFileSync(path.join(directory,name+".wav"),Buffer.concat([header,pcm]));
}
