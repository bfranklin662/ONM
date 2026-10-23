(function(root){
  "use strict";
  const audio=typeof Audio==="function"?new Audio("audio/darts/game-on.mp3"):null;
  if(audio){audio.preload="auto";audio.playsInline=true;}
  let busy=false;
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
  root.ONMBotLaunch={start};
})(typeof window!=="undefined"?window:globalThis);
