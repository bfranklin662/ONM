const test=require("node:test"),assert=require("node:assert/strict");
const {withTimeout,fetchCommunity}=require("../scripts/monster-bot-data");
const result={completions:{"1-1":[]},leaderboard:[]};
const ok=()=>({ok:true,json:async()=>({result})});
test("public leaderboard loads without waiting for account or Firebase SDK readiness",async()=>{
  let request;
  const data=await fetchCommunity({projectId:"oche-ness-monsters",fetchImpl:async(url,options)=>{request={url,options};return ok();}});
  assert.deepEqual(data,result);assert.equal(request.options.headers.Authorization,undefined);
  assert.match(request.url,/\/getMonsterBotCompletions$/);
  assert.equal(JSON.parse(request.options.body).data.version,3);
});
test("temporary server failures retry once and then recover",async()=>{
  let calls=0;
  const data=await fetchCommunity({projectId:"oche-ness-monsters",fetchImpl:async()=>++calls===1?{ok:false}:ok(),delay:async()=>{}});
  assert.equal(calls,2);assert.deepEqual(data,result);
});
test("hanging requests time out, abort, and finish after a bounded retry",async()=>{
  const signals=[];
  await assert.rejects(fetchCommunity({projectId:"oche-ness-monsters",timeoutMs:5,fetchImpl:async(_url,options)=>{signals.push(options.signal);return new Promise(()=>{});},delay:async()=>{}}),/timed out/);
  assert.equal(signals.length,2);assert.ok(signals.every(signal=>signal.aborted));
});
test("malformed service responses fail instead of silently showing an empty leaderboard",async()=>{
  await assert.rejects(fetchCommunity({projectId:"oche-ness-monsters",fetchImpl:async()=>({ok:true,json:async()=>({result:{}})}),delay:async()=>{}}),/response is unavailable/);
});
test("account operations cannot wait indefinitely",async()=>{
  assert.equal(await withTimeout(Promise.resolve("signed in"),5),"signed in");
  await assert.rejects(withTimeout(new Promise(()=>{}),5),/timed out/);
});
test("a verified user token is included for signed-in refreshes",async()=>{
  let headers;
  await fetchCommunity({projectId:"oche-ness-monsters",refresh:true,getToken:async()=>"test-token",fetchImpl:async(_url,options)=>{headers=options.headers;assert.equal(JSON.parse(options.body).data.refresh,true);return ok();}});
  assert.equal(headers.Authorization,"Bearer test-token");
});
