(function(){
  "use strict";
  const normalise=value=>String(value||"").trim().toLowerCase().replace(/\s+/g," ");
  function played(lineup,names){const aliases=new Set(names.map(normalise).filter(Boolean));return lineup.some(name=>aliases.has(normalise(name)));}
  if(typeof module!=="undefined"&&module.exports){module.exports={played,normalise};return;}
  const grid=document.getElementById("resultsGrid");if(!grid)return;
  let aliases=[],revision=0,stopAccount=()=>{},stopProfile=()=>{};
  function update(){
    grid.querySelectorAll("[data-result-lineup]").forEach(card=>{
      let lineup=[];try{lineup=JSON.parse(decodeURIComponent(card.dataset.resultLineup));}catch(_){}
      const visible=Array.isArray(lineup)&&played(lineup,aliases),existing=card.querySelector(".resultPlayedBadge");
      if(!visible){existing?.remove();return;}if(existing)return;
      const badge=document.createElement("span");badge.className="resultPlayedBadge";badge.textContent="✓ You played";card.prepend(badge);
    });
  }
  new MutationObserver(update).observe(grid,{childList:true,subtree:true});
  window.ONMFirebase.ready.then(({auth,authSdk,db,firestoreSdk:sdk})=>{
    authSdk.onAuthStateChanged(auth,user=>{
      const current=++revision;stopAccount();stopProfile();aliases=[];update();if(!user)return;
      stopAccount=sdk.onSnapshot(sdk.doc(db,"users",user.uid),snapshot=>{
        if(current!==revision)return;stopProfile();aliases=[];
        const account=snapshot.data();if(!snapshot.exists()||account?.status!=="Active"||!account.linkedPlayerKey){update();return;}
        const ownNames=[account.linkedPlayerName].filter(Boolean);aliases=ownNames;update();
        stopProfile=sdk.onSnapshot(sdk.doc(db,"publicPlayers",account.linkedPlayerKey),profile=>{if(current!==revision)return;aliases=[...ownNames,profile.data()?.publicName].filter(Boolean);update();},()=>{if(current===revision){aliases=ownNames;update();}});
      },()=>{if(current===revision){stopProfile();aliases=[];update();}});
    });
  }).catch(()=>{aliases=[];update();});
})();
