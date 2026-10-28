(function(){
  "use strict";
  const header=document.querySelector(".botHeader,.accountHeader"),existing=document.querySelector(".hamburger");
  if(header&&!existing){
    const button=document.createElement("button");button.className="compactMenu";button.type="button";button.setAttribute("aria-label","Open menu");button.setAttribute("aria-expanded","false");button.setAttribute("aria-controls","compactSiteMenu");button.textContent="☰";
    const menu=document.createElement("nav");menu.id="compactSiteMenu";menu.className="compactSiteMenu";menu.setAttribute("aria-label","Website navigation");menu.hidden=true;
    for(const [label,path] of [["Home","/"],["Results & Stats","/results.html"],["Players","/players-landing.html"],["Play","/games.html"],["Monster Bot Game","/monster-bot.html"],["Fines","/fines.html"],["My account","/account.html"]]){const link=document.createElement("a");link.textContent=label;link.href=path;menu.append(link);}
    header.append(button,menu);button.addEventListener("click",()=>{menu.hidden=!menu.hidden;button.setAttribute("aria-expanded",String(!menu.hidden));});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"){menu.hidden=true;button.setAttribute("aria-expanded","false");}});
  }
  const back=document.querySelector(".backWebsiteButton");
  if(back){back.textContent="← Back";back.addEventListener("click",event=>{let previous;try{previous=new URL(document.referrer);}catch(_){return;}if(previous.origin===location.origin&&previous.pathname!==location.pathname&&history.length>1){event.preventDefault();history.back();}});}
})();
