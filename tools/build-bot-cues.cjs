// Recorded cues avoid iOS speech-synthesis ducking and suspended Web Audio beeps.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {pcm,boost,measure}=require('./boost-nick-audio.cjs'),{wave,trim}=require('./build-flow-audio.cjs');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'onm-bot-cues-')),out=path.join(root,'audio/darts');
const decode=(input,name)=>{const target=path.join(tmp,name+'.wav');cp.execFileSync('/usr/bin/afconvert',[input,target,'-f','WAVE','-d','LEI16@48000','-c','1']);return fs.readFileSync(target);};
const game=trim(decode(path.join(out,'nick-boosted/game-on.m4a'),'game'));
const beep=Buffer.alloc(Math.round(48000*.15)*2);
for(let i=0;i<beep.length/2;i++){const t=i/48000,envelope=Math.min(1,t/.008)*Math.min(1,(.15-t)/.025);beep.writeInt16LE(Math.round(Math.sin(2*Math.PI*880*t)*envelope*.65*32767),i*2);}
const start=wave(Buffer.concat([beep,Buffer.alloc(480),game.samples]));
const loss=path.join(tmp,'lose.aiff');cp.execFileSync('/usr/bin/say',['-v','Daniel','-r','165','-o',loss,'You lose']);
const lose=wave(trim(decode(loss,'lose')).samples);
for(const [name,buffer] of [['bot-start',start],['bot-lose',lose]]){const boosted=name==="bot-lose"?boost(boost(buffer).buffer).buffer:boost(buffer).buffer,wav=path.join(tmp,name+'.wav');fs.writeFileSync(wav,boosted);cp.execFileSync('/usr/bin/afconvert',[wav,path.join(out,name+'.m4a'),'-f','m4af','-d','aac','-b','128000','-q','127']);console.log(name,JSON.stringify(measure(decode(path.join(out,name+'.m4a'),name+'-check'))));}
