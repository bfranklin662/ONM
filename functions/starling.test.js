"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readStarlingAccounts,eligiblePayment}=require("./starling");
test("Starling adapter sends credentials only to the fixed live HTTPS endpoint and returns GBP accounts",async()=>{
  const accounts=await readStarlingAccounts("test-only-secret",async(url,options)=>{
    assert.equal(url,"https://api.starlingbank.com/api/v2/accounts");
    assert.equal(options.headers.Authorization,"Bearer test-only-secret");assert.equal(options.redirect,"error");
    return {ok:true,json:async()=>({accounts:[{currency:"GBP",accountUid:"a",defaultCategory:"c"},{currency:"EUR",accountUid:"e",defaultCategory:"d"}]})};
  });assert.equal(accounts.length,1);
});
test("Starling adapter does not expose upstream banking errors or accept malformed tokens",async()=>{
  await assert.rejects(readStarlingAccounts("test",async()=>({ok:false,status:401,text:async()=>"private bank data"})),/^Error: STARLING_HTTP_401$/);
  await assert.rejects(readStarlingAccounts("test\n"),/TOKEN_INVALID/);
});
const item={feedItemUid:"tx1",direction:"IN",status:"SETTLED",source:"FASTER_PAYMENTS_IN",amount:{currency:"GBP",minorUnits:500},reference:"Fines-NH",transactionTime:"2026-10-28T12:00:00Z"};
const refs=[{reference:"Fines-NH",playerKey:"nick"}],start="2026-10-28T00:00:00Z";
test("matching accepts only exact unique references on new settled incoming GBP transfers",()=>{
  assert.deepEqual(eligiblePayment(item,refs,start),{transactionId:"tx1",playerKey:"nick",amountPence:500});
  for(const change of [{direction:"OUT"},{status:"PENDING"},{status:"REVERSED"},{source:"INTERNAL_TRANSFER"},{reference:"Fines NH"},{transactionTime:"invalid"},{transactionTime:"2026-10-27T00:00:00Z"},{amount:{currency:"EUR",minorUnits:500}},{amount:{currency:"GBP",minorUnits:-1}}])assert.equal(eligiblePayment({...item,...change},refs,start),null);
  assert.equal(eligiblePayment(item,[...refs,...refs],start),null);
  assert.equal(eligiblePayment(item,refs,"invalid"),null);
});
