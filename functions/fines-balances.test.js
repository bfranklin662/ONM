const test=require("node:test"),assert=require("node:assert/strict"),{buildFineBalances}=require("./fines-balances");
test("private balances reject guests and inactive accounts before financial collections are read",async()=>{
  const fs=require("node:fs"),vm=require("node:vm"),source=fs.readFileSync(require.resolve("./index"),"utf8"),start=source.indexOf("exports.getFinesBalances="),end=source.indexOf("\n});",start)+4;
  let reads=0;const ctx={exports:{},options:{},onCall:(_options,handler)=>handler,HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}},getFirestore:()=>({collection:name=>{if(name!=="users")reads++;return {doc:()=>({get:async()=>({exists:true,data:()=>({status:"Inactive"})})})};}}),buildFineBalances};
  vm.runInNewContext(source.slice(start,end),ctx);
  await assert.rejects(ctx.exports.getFinesBalances({}),e=>e.code==="unauthenticated");await assert.rejects(ctx.exports.getFinesBalances({auth:{uid:"member"}}),e=>e.code==="permission-denied");assert.equal(reads,0);
});
test("balances use season results, subtract payments and count each appearance once",()=>{
  const rows=buildFineBalances([{id:"nick",publicName:"Nick H",fullName:"Nick Horne",email:"private"}],[{season:"26-27",sheetRow:{Player1:"Nick H",F1:"£3.50",Player2:"Nick Horne",F2:"1"}},{season:"26-27",sheetRow:{Player1:"Nick H",F1:"2"}},{season:"25-26",sheetRow:{Player1:"Nick H",F1:100}}],[{season:"26-27",playerKey:"nick",amountPaidPence:300}]);
  assert.deepEqual(rows,[{playerKey:"nick",name:"Nick Horne",appearances:2,issuedPence:650,paidPence:300,owedPence:350}]);assert.ok(!JSON.stringify(rows).includes("private"));
});
test("unmatched players remain visible, invalid fines are ignored, and overpayments never produce negative debt",()=>{
  const rows=buildFineBalances([{id:"a",publicName:"Alex"}],[{season:"26-27",sheetRow:{"Player 1":"Guest","F 1":"1.25",Player2:"Alex",F2:"bad"}}],[{season:"26-27",playerKey:"a",amountPaidPence:400}]);
  assert.equal(rows[0].name,"Guest");assert.equal(rows[0].owedPence,125);assert.equal(rows[1].owedPence,0);assert.equal(rows[1].paidPence,400);
});
