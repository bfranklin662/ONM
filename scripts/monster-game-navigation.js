(function(){
  "use strict";
  const modes=[{key:"ladder",name:"Ladder",icon:"▰",href:"monster-bot.html#game"},{key:"survival",name:"Survival",icon:"⚡",href:"monster-survival.html"},{key:"casual",name:"Casual",icon:"⚄",href:"monster-bot.html#casual"},{key:"leaderboard",name:"Leaderboard",icon:"♜",href:"monster-bot.html#leaderboard"}];
  const active=()=>window.location.hash==="#leaderboard"?"leaderboard":window.location.pathname.endsWith("monster-survival.html")?"survival":window.location.hash==="#casual"?"casual":"ladder";
  const mount=document.getElementById("modeNavigation");if(!mount)return;
  const paths={ladder:'<path d="M7 3v18M17 3v18M7 6h10M7 12h10M7 18h10"/>',survival:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',casual:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',leaderboard:'<path d="M8 3h8v5a4 4 0 0 1-8 0Zm4 9v6m-4 3h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4"/>'};
  const help={ladder:{title:"Monster Bot Ladder",body:"<p>Beat five formats against each Monster: BO1, BO3, BO5, BO7 and Bull or Bust.</p><ul><li>A win earns a green tick. Win without dropping a leg to earn a gold star. Flawless all five formats on a Monster to earn its mastery trophy. Click a gold-star pill to view completions.</li><li>Each locked bot lists its unlock requirements. Tier 2 unlocks with three Tier 1 mastery trophies and 20 Tier 1 gold stars. Tier 2 progression uses its own challenges and stars.</li><li>Bull or Bust unlocks after the four standard modes: 301, one leg, finish on Bull. Below 50, a bust or zero on a finish loses.</li></ul>"},survival:{title:"Survival",body:"<p>Beat ten Monsters in a row in the selected tier. Tier 1 starts with Billy Bot; Tier 2 starts with George Bot and appears alongside Tier 2 on the ladder. Each Survival tier requires Level 3 on its matching ladder to play.</p><ul><li>One 501, double-out leg per opponent. You throw first.</li><li>Win to reveal the next Monster. Lose, restart, quit or refresh and the next run starts with the first bot in that tier.</li><li>Beat all ten to complete Survival.</li><li>Each tier has its own best run and leaderboard. Survival does not add ladder stars or attempts.</li></ul>"},casual:{title:"Casual",body:"<p>Play casual games immediately, starting with Billy Bot.</p><ul><li>Unlock additional bots on the Monster Bot Ladder. Survival progress does not unlock casual opponents.</li><li>Pick 301, 501 or 701 and an odd best-of length.</li><li>Checkout stats appear at the end. No match data, stars or ladder progress are saved.</li></ul>"},leaderboard:{title:"Leaderboards",body:"<p>Switch between Ladder and Survival rankings.</p><ul><li>Ladder ranks challenges completed, then level reached.</li><li>Survival ranks the most Monsters beaten in one run, out of ten. Beat all ten to mark Survival complete.</li><li>Casual games are not ranked.</li></ul>"}};
  let helpDialog=null,helpButton=null;
  const heading=document.querySelector("h1");
  if(heading?.parentElement){
    helpButton=document.createElement("button");helpButton.type="button";helpButton.className="gameHelpButton";helpButton.textContent="?";helpButton.setAttribute("aria-label","How it works");helpButton.setAttribute("aria-haspopup","dialog");heading.parentElement.appendChild(helpButton);
    helpDialog=document.createElement("dialog");helpDialog.className="modeHelpDialog";helpDialog.setAttribute("aria-labelledby","modeHelpTitle");helpDialog.innerHTML='<div class="modeHelpHeading"><h2 id="modeHelpTitle"></h2><button type="button" aria-label="Close explanation">✕</button></div><div class="modeHelpBody"></div>';
    document.body.appendChild(helpDialog);helpButton.addEventListener("click",()=>helpDialog.showModal());helpDialog.querySelector("button").addEventListener("click",()=>helpDialog.close());helpDialog.addEventListener("close",()=>helpButton.focus());
  }
  function render(){
    mount.innerHTML=modes.map(mode=>`<a href="${mode.href}" ${active()===mode.key?'aria-current="page"':""}><svg viewBox="0 0 24 24" aria-hidden="true">${paths[mode.key]}</svg><span>${mode.name}</span>${mode.key==="survival"?'<small class="modeNewBadge" aria-hidden="true">NEW</small>':""}</a>`).join("");
    if(helpDialog){const copy=help[active()];helpDialog.querySelector("h2").textContent=copy.title+" · How it works";helpDialog.querySelector(".modeHelpBody").innerHTML=copy.body;}
    const board=document.getElementById("boardNavigation");
    if(board){const survival=window.location.pathname.endsWith("monster-survival.html");board.innerHTML=`<a href="monster-bot.html#leaderboard" ${!survival?'aria-current="page"':""}>Ladder</a><a href="monster-survival.html#leaderboard" ${survival?'aria-current="page"':""}>Survival</a>`;}
  }
  render();window.addEventListener("hashchange",render);window.addEventListener("onm-mode-change",render);
  // Mode navigation remains available as ordinary links for keyboard and desktop.
  let start=null;
  const surface=document.querySelector("main");
  surface.addEventListener("touchstart",event=>{
    if(event.touches.length!==1||event.target.closest("a,button,input,select,textarea,table,[role=dialog]")){start=null;return;}
    start={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  surface.addEventListener("touchend",event=>{
    if(!start||event.changedTouches.length!==1)return;const point=event.changedTouches[0],dx=point.clientX-start.x,dy=point.clientY-start.y;start=null;
    if(Math.abs(dx)<90||Math.abs(dx)<Math.abs(dy)*1.8||window.getSelection?.().toString())return;
    const index=modes.findIndex(mode=>mode.key===active()),next=index+(dx<0?1:-1);if(modes[next])window.location.href=modes[next].href;
  },{passive:true});
  surface.addEventListener("touchcancel",()=>{start=null;},{passive:true});
})();
