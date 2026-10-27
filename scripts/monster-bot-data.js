(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.ONMBotData=api;})(typeof window!=="undefined"?window:globalThis,function(){
  function withTimeout(promise,ms=10000,message="The connection timed out. Please retry.") {
    let timer;
    return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]).finally(()=>clearTimeout(timer));
  }
  async function fetchCommunity({projectId,refresh=false,getToken,fetchImpl=fetch,timeoutMs=8000,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
    if(!/^[a-z][a-z0-9-]+$/.test(projectId||""))throw new Error("Leaderboard configuration is unavailable.");
    let token="";
    if(getToken)try{token=await withTimeout(getToken(),2000);}catch{ /* Public results do not require sign-in. */ }
    for(let attempt=0;attempt<2;attempt++){
      const controller=new AbortController();
      try{
        return await withTimeout((async()=>{
          const response=await fetchImpl(`https://europe-west1-${projectId}.cloudfunctions.net/getMonsterBotCommunityEurope`,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data:{refresh,version:3}}),signal:controller.signal});
          if(!response.ok)throw new Error("Leaderboard service is temporarily unavailable.");
          const payload=await response.json(),data=payload.result||payload.data;
          if(payload.error||!data||!Array.isArray(data.leaderboard)||!data.completions||typeof data.completions!=="object"||Array.isArray(data.completions))throw new Error("Leaderboard response is unavailable.");
          return {...data,leaderboard:backfillTrophies(data.leaderboard,data.completions)};
        })(),timeoutMs,"Leaderboard connection timed out. Please retry.");
      }catch(error){
        controller.abort();
        if(attempt===1)throw error;
        await delay(500);
      }
    }
  }
  // Older deployed responses have no trophy field. Derive it from their public
  // per-bot results without guessing from star totals or exposing account IDs.
  function backfillTrophies(rows,completions={}) {
    return rows.map(row=>{
      if(Number.isInteger(row.trophies)&&row.trophies>=0)return row;
      let trophies=0;
      for(let level=1;level<=20;level++){
        const matches=(completions[`level-${level}`]||[]).filter(p=>p.name===row.name&&(p.photoUrl||"")===(row.photoUrl||"")&&(p.nationality||"")===(row.nationality||""));
        if(matches.length!==1)continue;
        if([1,3,5,7,9].every(mode=>matches[0].results?.some(r=>r.mode===mode&&r.flawless===true&&r.won===(mode===9?1:(mode+1)/2)&&r.lost===0)))trophies++;
      }
      return {...row,trophies};
    });
  }
  return {withTimeout,fetchCommunity,backfillTrophies};
});
