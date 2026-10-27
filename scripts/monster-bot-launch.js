(function(root){
  "use strict";
  const GAME_ON=root.ONMNickAudio?.source("game-on.mp3")||"audio/darts/nick-boosted/game-on.m4a?v=20261025-all-nick-v2";
  const audio=typeof Audio==="function"?new Audio(GAME_ON):null;
  if(audio){audio.preload="auto";audio.playsInline=true;}
  let busy=false;
  let frame=null, context=null;
  let announcedSource=null,opening=false,generation=0;
  // Actual silence: do not loop the announcement at volume zero to prime audio.
  // Some media implementations don't honour per-element volume changes.
  const SILENCE="data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  function prime(){
    const AudioContext=root.AudioContext||root.webkitAudioContext;
    try{if(AudioContext){context ||= new AudioContext();context.resume()?.catch(()=>{});}}catch{}
    if(audio){audio.pause();audio.src=SILENCE;audio.volume=1;audio.loop=true;try{audio.play()?.catch(()=>{});}catch{}}
  }
  function tone(frequency,start,duration){
    if(!context)return;
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type="sine";oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0, start);gain.gain.linearRampToValueAtTime(.12,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  function open(url,wait){
    const target=new URL(url,root.location.href);
    if(target.origin!==root.location.origin||!target.pathname.endsWith("/dart-scorer.html"))return;
    if(opening)return;
    opening=true;const id=++generation;prime();
    const mount=()=>{
    if(id!==generation)return;
    frame?.remove();
    announcedSource=null;
    frame=document.createElement("iframe");frame.title="Monster Bot Game";
    frame.allow="autoplay; fullscreen; screen-wake-lock";frame.allowFullscreen=true;
    frame.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:19000;background:#080f17";
    // Keep the branded splash until the scorer explicitly reports readiness.
    frame.src=target.href;document.body.appendChild(frame);
    document.body.style.overflow="hidden";
    };
    if(wait)Promise.resolve(wait).then(mount,()=>{if(id===generation){opening=false;stop();}});
    else mount();
  }
  function ready(source){
    if(!frame||frame.contentWindow!==source)return false;
    if(announcedSource===source)return true;
    announcedSource=source;opening=false;
    const splash=document.getElementById("botLaunchSplash");if(splash)splash.hidden=true;
    if(context)tone(880,context.currentTime,.12);
    if(audio){audio.loop=false;audio.pause();audio.src=GAME_ON;audio.currentTime=0;audio.volume=1;
      try{audio.play()?.catch(()=>{});}catch{}
    }
    return true;
  }
  function celebrate(dialog){
    try{context?.resume()?.catch(()=>{});if(context)[523.25,659.25,783.99,1046.5].forEach((note,i)=>tone(note,context.currentTime+i*.12,.28));}catch{}
    if(!dialog||root.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    for(let i=0;i<42;i++){
      const spark=document.createElement("span");spark.className="botUnlockSpark";spark.setAttribute("aria-hidden","true");
      const angle=Math.PI*2*i/14,distance=70+Math.random()*100;
      spark.style.setProperty("--x",`${Math.cos(angle)*distance}px`);spark.style.setProperty("--y",`${Math.sin(angle)*distance}px`);
      spark.style.setProperty("--delay",`${Math.floor(i/14)*.35}s`);spark.style.setProperty("--spark-color",["#ffd740","#67e0bd","#fff"][i%3]);
      dialog.appendChild(spark);setTimeout(()=>spark.remove(),2000);
    }
  }
  function close(){++generation;opening=false;announcedSource=null;stop();frame?.remove();frame=null;document.body.style.overflow="";}
  function stop(){if(audio){audio.pause();audio.loop=false;}}
  function resetAnnouncement(source){if(frame?.contentWindow===source){stop();announcedSource=null;try{context?.resume()?.catch(()=>{});}catch{}}}
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
    audio.loop=false;audio.src=GAME_ON;audio.currentTime=0;audio.volume=1;
    // This call must stay synchronous inside the user's Play/Restart click.
    try{audio.play()?.catch(()=>finish(false));}catch{finish(false);}
  }
  root.ONMBotLaunch={start,open,ready,celebrate,stop,close,resetAnnouncement,isPlaying:()=>Boolean(audio&&!audio.paused&&audio.src.includes("/game-on.m4a"))};
})(typeof window!=="undefined"?window:globalThis);
