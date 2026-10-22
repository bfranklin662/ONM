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
          return data;
        })(),timeoutMs,"Leaderboard connection timed out. Please retry.");
      }catch(error){
        controller.abort();
        if(attempt===1)throw error;
        await delay(500);
      }
    }
  }
  return {withTimeout,fetchCommunity};
});
