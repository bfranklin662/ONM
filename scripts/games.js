async function initGamesPageLeagueStats(){
  const playersEl=document.getElementById("molGamePlayers");if(!playersEl)return;
  try{const {db,ref,get}=window.ONMLiveDarts,snapshot=await get(ref(db,"ratings"));playersEl.textContent=snapshot.exists()?Object.values(snapshot.val()).filter(p=>Number(p.gamesPlayed)>0).length:"0";}
  catch{playersEl.textContent="—";}
}
async function initGamesPage(){if(window.ONMSession?.init)await window.ONMSession.init();initGamesPageLeagueStats();}
if(window.ONMLiveDarts)initGamesPage();else window.addEventListener("onmLiveDartsReady",initGamesPage,{once:true});
