(function(root){
 "use strict";
 const clean=v=>String(v??'').trim();
 function players(profiles=[],matches=[]){
   const rows=new Map();
   for(const p of profiles){if(!p.playerKey)continue;rows.set(p.playerKey,{...p,playerName:p.playerName||p.name||'Player',totalScored:0,dartsThrown:0,trackedGames:0});}
   for(const match of matches){
     if(match.mode==='bot'||match.botMode||match.casual===true||(match.matchMode&&match.matchMode!=='online'))continue;
     for(const prefix of ['playerOne','playerTwo']){
       const id=clean(match[prefix+'Id']);if(!id)continue;
       if(!rows.has(id))rows.set(id,{playerKey:id,playerName:match[prefix+'Name']||'Player',photo:'',nationality:'',totalScored:0,dartsThrown:0,trackedGames:0});
       const row=rows.get(id),scored=Number(match[prefix+'TotalScored']),darts=Number(match[prefix+'DartsThrown']);
       if(!Number.isFinite(scored)||scored<0||!Number.isFinite(darts)||darts<=0)continue;
       row.totalScored+=scored;row.dartsThrown+=darts;row.trackedGames++;
     }
   }
   return [...rows.values()].filter(p=>p.trackedGames>0||p.gamesPlayed>0).map(p=>({...p,average:p.dartsThrown>0?(p.totalScored*3/p.dartsThrown).toFixed(2):null})).sort((a,b)=>a.playerName.localeCompare(b.playerName,'en',{sensitivity:'base'}));
 }
 const api={players};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ONMVersusPlayers=api;
})(typeof window!=='undefined'?window:globalThis);
