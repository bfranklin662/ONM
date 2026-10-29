(function(){
  "use strict";
  const $=id=>document.getElementById(id),E=window.ONMTonOuts,escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let user=null,progress={},accountData={},selected=100,busy=false,boardBusy=false,stop=null,revision=0,accountReady=false,audio=null;
  const lockIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  let screenLock=null,screenRequest=null,screenWatch=null,wakeActive=false;
  const wantsScreen=()=>wakeActive&&$("tonChallenge").open&&document.visibilityState!=="hidden";
  async function keepScreenOn(){
    if(!wantsScreen()||!window.navigator?.wakeLock?.request)return;
    if(screenLock&&!screenLock.released||screenRequest)return;
    screenRequest=(async()=>{try{
      const lock=await window.navigator.wakeLock.request("screen");
      if(!wantsScreen()){await lock.release();return;}
      screenLock=lock;lock.addEventListener("release",()=>{if(screenLock===lock)screenLock=null;});
    }catch{/* Power-saving settings or browser policy can refuse a wake lock. */}})();
    try{await screenRequest;}finally{screenRequest=null;}
  }
  function startScreenOn(){wakeActive=true;keepScreenOn();if(screenWatch===null&&window.setInterval)screenWatch=window.setInterval(keepScreenOn,5000);}
  function stopScreenOn(){wakeActive=false;if(screenWatch!==null){window.clearInterval(screenWatch);screenWatch=null;}const lock=screenLock;screenLock=null;if(lock)lock.release().catch(()=>{});}
  $("tonChallenge").addEventListener("close",stopScreenOn);
  document.addEventListener?.("visibilitychange",()=>{if(document.visibilityState==="hidden")stopScreenOn();else if($("tonChallenge").open)startScreenOn();});
  document.addEventListener?.("pointerdown",()=>{if($("tonChallenge").open)startScreenOn();},{passive:true});
  window.addEventListener("pageshow",()=>{if($("tonChallenge").open)startScreenOn();});
  function unlockAudio(){try{const Context=window.AudioContext||window.webkitAudioContext;if(!audio&&Context)audio=new Context();if(audio?.state==="suspended")audio.resume().catch(()=>{});}catch{}}
  function startDing(){
    unlockAudio();if(!audio)return;
    const play=()=>{if(audio.state!=="running")return;try{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime;oscillator.type="sine";oscillator.frequency.value=880;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.12);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.14);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}catch{}};
    if(audio.state==="suspended")audio.resume().then(play).catch(()=>{});else play();
  }
  function playFeedback(hit){
    if(!audio||audio.state!=="running")return;
    try{const notes=hit?[523.25,659.25,783.99]:[220,164.81];notes.forEach((frequency,i)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+i*.085;oscillator.type=hit?'sine':'triangle';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(hit ? 0.15 : 0.09,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.14);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.16);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};});}catch{}
  }
  const current=()=>E.totals[E.completed(progress).length];
  function render(){
    const wins=E.completed(progress);$("tonProgress").textContent=`${wins.length} / ${E.totals.length} complete`;$("tonProgressBar").value=wins.length;
    $("tonPlayerSummary").hidden=!user||!accountReady;$("tonSummaryPercent").textContent=`${Math.round(wins.length/E.totals.length*100)}% complete`;
    if(user){$("tonSummaryName").textContent=accountData.firstName||user.displayName?.split(" ")[0]||"Player";window.ONMGameSummaryIdentity?.render("tonSummary",user,accountData);}
    $("tonGrid").innerHTML=E.totals.map(n=>{const done=wins.includes(n),available=E.unlocked(n,progress);return `<button type="button" data-total="${n}" class="tonCell ${done?'complete':available?'available':'locked'}" ${available&&user&&accountReady?'':'disabled'} aria-label="${n}: ${done?'complete':available?'play checkout':'locked'}"><strong>${n}</strong><small>${done?'✓ Complete':available?'Play':lockIcon}</small></button>`;}).join("");
  }
  function challenge(){
    const done=E.completed(progress).includes(selected);$("tonChallengeTitle").textContent=`${selected} checkout`;
    $("tonRoute").innerHTML=E.routes[selected].map((dart,i)=>`<span><small>${i+1}</small>${dart}</span>`).join("");$("tonDartboard").innerHTML=E.board(selected);$("tonAttempts").textContent=String(E.attempts(progress[selected]));
    $("tonMiss").disabled=busy||done;$("tonHit").disabled=busy||done;$("tonChallengeActions").hidden=done;$("tonNext").hidden=!done||!current();
    $("tonChallengeStatus").textContent=busy?'Saving…':done?(current()?`✓ Complete! ${current()} is now unlocked.`:'✓ All 64 finishes complete!'):"One visit of up to three darts. Miss or hit the finish?";
  }
  async function record(hit){
    if(busy||!user)return;busy=true;const who=user,rev=revision,total=selected;challenge();
    try{
      const {db,firestoreSdk:sdk}=await window.ONMFirebase.ready;
      const saved=await sdk.runTransaction(db,async tx=>{const ref=sdk.doc(db,"users",who.uid),snap=await tx.get(ref),data=snap.data();if(!data||data.status!=="Active")throw Error("An active account is required.");const next=E.record(data.tonOutsProgress||{},total,hit);tx.update(ref,{tonOutsProgress:next});return next;});
      if(rev!==revision)return;progress=saved;render();
    }catch(error){if(rev===revision){$("tonChallengeStatus").textContent="Couldn’t save that attempt. Check your connection and try again.";busy=false;$("tonMiss").disabled=false;$("tonHit").disabled=false;}return;}
    finally{if(rev===revision)busy=false;}
    if(rev===revision){challenge();playFeedback(hit);}
  }
  async function leaderboard(){
    if(boardBusy)return;boardBusy=true;$("refreshTonBoard").disabled=true;$("tonBoardStatus").textContent="";$("tonBoardLoading").hidden=false;$("tonBoardTable").hidden=true;$("tonBoardRows").innerHTML="";$("tonLeaderboard").setAttribute("aria-busy","true");
    try{const data=await window.ONMBotData.fetchCommunity({projectId:window.ONMFirebase.config.projectId,refresh:true,getToken:user?()=>user.getIdToken():null});if(!Array.isArray(data.tonOutsLeaderboard))throw Error("Service update required");$("tonBoardRows").innerHTML=data.tonOutsLeaderboard.map((row,i)=>`<tr><td>${i+1}</td><td><span class="tonBoardPlayer">${row.photoUrl?`<img src="${escape(row.photoUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span>${escape(row.name)}</span><span>${escape(row.flag||'')}</span></span></td><td>${Number(row.completed)||0} / 64</td></tr>`).join("");$("tonBoardStatus").textContent=data.tonOutsLeaderboard.length?'Ranked by checkouts completed. Attempts are private.':'No completed checkouts yet. Be the first!';}
    catch{$("tonBoardStatus").textContent="Couldn’t load the leaderboard. Please try Refresh.";}
    finally{boardBusy=false;$("refreshTonBoard").disabled=false;$("tonBoardLoading").hidden=true;$("tonBoardTable").hidden=!$("tonBoardRows").innerHTML&&$("tonBoardStatus").textContent.startsWith("Couldn’t");$("tonLeaderboard").setAttribute("aria-busy","false");}
  }
  function view(){const board=location.hash==="#leaderboard";$("tonLeaderboard").hidden=!board;$("tonGame").hidden=board||!accountReady;$("tonLoading").hidden=board||accountReady;$("tonPageTitle").textContent=board?'Leaderboard':'Ton+ Outs';if(board)leaderboard();}
  window.addEventListener("hashchange",view);
  $("tonGrid").addEventListener("click",event=>{const button=event.target.closest("[data-total]");if(!button||button.disabled)return;selected=Number(button.dataset.total);challenge();$("tonChallenge").showModal();startScreenOn();startDing();});
  $("tonMiss").addEventListener("click",()=>{unlockAudio();return record(false);});$("tonHit").addEventListener("click",()=>{unlockAudio();return record(true);});$("closeTonChallenge").addEventListener("click",()=>{if(!busy)$("tonChallenge").close();});$("tonChallenge").addEventListener("cancel",event=>{if(busy)event.preventDefault();});
  $("tonNext").addEventListener("click",()=>{if(current()){selected=current();challenge();startDing();}});$("refreshTonBoard").addEventListener("click",leaderboard);
  (window.ONMFirebase.authReady||window.ONMFirebase.ready).then(({auth,authSdk})=>authSdk.onAuthStateChanged(auth,async value=>{
    const rev=++revision;stop?.();stop=null;user=value;progress={};accountData={};busy=false;accountReady=false;$("tonChallenge").close();render();view();
    if(!user){accountReady=true;$("tonStatus").innerHTML='<a href="auth.html?mode=register&amp;redirect=ton-outs.html">Sign up or log in to save your Ton+ Outs progress.</a>';view();return;}
    $("tonStatus").textContent="";
    try{const {db,firestoreSdk:sdk}=await window.ONMFirebase.ready;if(rev!==revision)return;stop=sdk.onSnapshot(sdk.doc(db,"users",user.uid),snap=>{if(rev!==revision)return;accountData=snap.data()||{};progress=accountData.tonOutsProgress||{};accountReady=true;$("tonStatus").textContent="";render();$("tonGame").hidden=location.hash==="#leaderboard";$("tonLoading").hidden=true;if($("tonChallenge").open&&!busy)challenge();},()=>{if(rev!==revision)return;$("tonLoading").hidden=true;$("tonStatus").textContent="Couldn’t load your progress. Refresh to retry.";});}
    catch{if(rev===revision){$("tonLoading").hidden=true;$("tonStatus").textContent="Couldn’t load your account. Please refresh.";}}
  })).catch(()=>{$("tonLoading").hidden=true;$("tonStatus").textContent="Couldn’t connect to sign-in. Please refresh.";});
  view();
  window.addEventListener("pagehide",()=>{stopScreenOn();stop?.();});
})();
