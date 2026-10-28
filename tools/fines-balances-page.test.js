const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
async function harness({admin=false,registrationPaid=false,linked=true,fail=false}={}){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:"",listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};let authChanged;const requests=[];
 const balance={playerKey:"nick",name:"Nick Horne",appearances:2,issuedPence:500,paidPence:100,owedPence:400,registrationPaid},viewer={isAdmin:admin,name:"Nick",balance:linked?balance:null,automaticMatching:true,bank:{name:"Nicholas Horne",sortCode:"60-83-71",accountNumber:"78664226"}};
 const ctx={document:{getElementById:node},window:{ONMFirebase:{config:{projectId:"test"},ready:Promise.resolve({auth:{},authSdk:{onAuthStateChanged:(_,fn)=>{authChanged=fn;}}})},addEventListener(){}},AbortSignal,setInterval:()=>1,clearInterval(){},fetch:async(url,options)=>{const data=JSON.parse(options.body).data;requests.push({url,data});return {ok:!fail,json:async()=>fail?{error:{message:"Please retry"}}:{result:url.includes("Instructions")?{amountPence:data.type==="registration"?1500:400,reference:data.type==="registration"?"Reg-NH":"Fines-NH",expiresAt:"2026-11-04T00:00:00Z"}:{viewer,updatedAt:new Date().toISOString()}}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/fines-balances-page.js"),"utf8"),ctx);await new Promise(r=>setImmediate(r));authChanged({uid:"nick",getIdToken:async()=>"test"});await new Promise(r=>setImmediate(r));return {node,requests,signOut:()=>authChanged(null)};
}
test("personal cards show only own fines and registration, including for admins",async()=>{
 for(const admin of [false,true]){const g=await harness({admin});assert.equal(g.node("finesAmount").textContent,"£4.00");assert.equal(g.node("registrationAmount").textContent,"£15.00");assert.equal(g.node("myTotal").textContent,"£19.00");assert.equal(g.node("loading").hidden,true);assert.equal(g.node("balances").hidden,false);}
});
test("payment prompts request distinct types and references",async()=>{
 const g=await harness();await g.node("payRegistration").listeners.click();assert.equal(g.requests.at(-1).data.type,"registration");assert.match(g.node("paymentDetails").textContent,/Reg-NH/);assert.match(g.node("paymentDetails").textContent,/£15.00/);await g.node("payFines").listeners.click();assert.equal(g.requests.at(-1).data.type,"fines");assert.match(g.node("paymentDetails").textContent,/Fines-NH/);assert.match(g.node("paymentDetails").textContent,/£4.00/);
 g.signOut();assert.equal(g.node("balances").hidden,true);assert.equal(g.node("paymentDialog").open,false);assert.equal(g.node("paymentDetails").textContent,"");assert.equal(g.node("myName").textContent,"");
});
test("paid registration hides its payment button; unlinked accounts do not see payment cards",async()=>{
 const paid=await harness({registrationPaid:true});assert.equal(paid.node("registrationAmount").textContent,"£0.00");assert.equal(paid.node("payRegistration").hidden,true);
 const unlinked=await harness({linked:false});assert.equal(unlinked.node("paymentCards").hidden,true);assert.equal(unlinked.node("unlinked").hidden,false);
});
test("load failure removes spinner and offers retry",async()=>{const g=await harness({fail:true});assert.equal(g.node("loading").hidden,true);assert.equal(g.node("retry").hidden,false);assert.equal(g.node("balances").hidden,true);});
