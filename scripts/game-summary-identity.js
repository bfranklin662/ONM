(function(){
  "use strict";
  const fallback='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#183e2a"/><g fill="none" stroke="#bfdfcb" stroke-width="3"><circle cx="32" cy="23" r="10"/><path d="M13 58v-5a19 19 0 0 1 38 0v5"/></g></svg>');
  const profiles=new Map(),requests=new Map();let photos;
  const key=v=>String(v||"").toLowerCase().replace(/\.[^/.]+$/,"").replace(/[^a-z0-9]/g,"");
  const safePhoto=v=>typeof v==="string"&&(/^(?:https:\/\/|\/\/?(?:graphics|images)\/|(?:graphics|images)\/)/i.test(v))?v:"";
  function render(prefix,user,data={}){
    const photo=document.getElementById(prefix+"Photo"),name=document.getElementById(prefix+"Name");if(!photo||!name||!user)return;
    const token=JSON.stringify([user.uid,data.firstName,data.photoUrl,data.linkedPlayerKey,data.linkedPlayerName]);
    if(requests.get(prefix)===token)return;requests.set(prefix,token);
    name.textContent=data.firstName||user.displayName?.split(" ")[0]||"Player";
    photo.src=safePhoto(data.photoUrl)||fallback;photo.onerror=()=>{photo.onerror=null;photo.src=fallback;};
    (async()=>{
      let profile={};if(data.linkedPlayerKey){if(!profiles.has(data.linkedPlayerKey))profiles.set(data.linkedPlayerKey,window.ONMFirebase.ready.then(({db,firestoreSdk:sdk})=>sdk.getDoc(sdk.doc(db,"publicPlayers",data.linkedPlayerKey))).then(s=>s.data()||{}).catch(()=>({})));profile=await profiles.get(data.linkedPlayerKey);}
      let url=safePhoto(data.photoUrl||profile.photoUrl);
      if(!url||/^\/?images\/players\//i.test(url)){photos ||= fetch("data/player-photo-map.json").then(r=>r.ok?r.json():{}).catch(()=>({}));const map=await photos;url=safePhoto(map[key(url.split('/').pop())]||map[key(data.linkedPlayerName||profile.publicName||data.firstName)])||url;}
      if(requests.get(prefix)===token)photo.src=url||fallback;
    })().catch(()=>{});
  }
  window.ONMGameSummaryIdentity={render};
})();
