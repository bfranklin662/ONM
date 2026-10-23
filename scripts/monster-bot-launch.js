(function(root){
  "use strict";
  const audio=typeof Audio==="function"?new Audio("audio/darts/game-on.mp3"):null;
  if(audio){audio.preload="auto";audio.playsInline=true;}
  let busy=false;
  let frame=null, context=null;
  function prime(){
    const AudioContext=root.AudioContext||root.webkitAudioContext;
    try{if(AudioContext){context ||= new AudioContext();context.resume()?.catch(()=>{});}}catch{}
    if(audio){audio.volume=0;audio.loop=true;try{audio.play()?.catch(()=>{});}catch{}}
  }
  function tone(frequency,start,duration){
    if(!context)return;
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type="sine";oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0, start);gain.gain.linearRampToValueAtTime(.12,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  function open(url,wait){
    prime();
    if(wait){Promise.resolve(wait).then(()=>open(url));return;}
    const target=new URL(url,root.location.href);
    if(target.origin!==root.location.origin||!target.pathname.endsWith("/dart-scorer.html"))return;
    frame?.remove();
    frame=document.createElement("iframe");frame.title="Monster Bot Game";
    frame.allow="autoplay; fullscreen; screen-wake-lock";frame.allowFullscreen=true;
    frame.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:19000;background:#080f17";
    frame.onload=()=>{const splash=document.getElementById("botLaunchSplash");if(splash)splash.hidden=true;};
    frame.src=target.href;document.body.appendChild(frame);
    document.body.style.overflow="hidden";
  }
  function ready(source){
    if(!frame||frame.contentWindow!==source)return false;
    const splash=document.getElementById("botLaunchSplash");if(splash)splash.hidden=true;
    if(context)tone(880,context.currentTime,.12);
    if(audio){audio.loop=false;audio.pause();audio.currentTime=0;audio.volume=1;
      try{audio.play()?.catch(()=>{});}catch{}
    }
    return true;
  }
  function celebrate(){
    try{context?.resume()?.catch(()=>{});if(context)[523.25,659.25,783.99,1046.5].forEach((note,i)=>tone(note,context.currentTime+i*.12,.28));}catch{}
  }
  function stop(){if(audio){audio.pause();audio.loop=false;}}
  function start(done){
    if(busy)return;
    if(!audio){done(false);return;}
    busy=true;
    let finished=false;
    const finish=played=>{
      if(finished)return;
      finished=true;busy=false;clearTimeout(watchdog);
      audio.onended=null;audio.onerror=null;audio.pause();
      done(played);
    };
    const watchdog=setTimeout(()=>finish(false),6000);
    audio.onended=()=>finish(true);audio.onerror=()=>finish(false);
    audio.currentTime=0;audio.volume=1;
    // This call must stay synchronous inside the user's Play/Restart click.
    try{audio.play()?.catch(()=>finish(false));}catch{finish(false);}
  }
  root.ONMBotLaunch={start,open,ready,celebrate,stop,isPlaying:()=>Boolean(audio&&!audio.paused&&audio.volume>0)};
})(typeof window!=="undefined"?window:globalThis);
