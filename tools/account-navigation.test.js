const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=file=>fs.readFileSync(require.resolve("../scripts/"+file),"utf8");
async function account(team,linked=false){
  const nodes=new Map(),fields={},calls=[],stored=new Map();
  function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,value:"",listeners:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},insertAdjacentHTML(){},addEventListener(type,fn){this.listeners[type]=fn;},closest(){return node(id+"-label");}});return nodes.get(id);}
  for(const field of ["firstName","surname","email","team","nationality","bio","nickname","walkoutSong","playerRole","highestCheckout","accolades","gooch"])fields[field]=node(field);
  const form=node("accountForm");form.elements=fields;form.querySelector=()=>node("saveButton");
  const user={uid:"member",firstName:"Alex",surname:"Player",email:"alex@example.test",team,nickname:"Keep nickname",walkoutSong:"Keep song",...(linked?{linkedPlayerKey:"alex",linkedPlayerName:"Alex Player"}:{})};
  const context={document:{getElementById:node},localStorage:{setItem:(k,v)=>stored.set(k,v)},FormData:function(){this.get=k=>fields[k]?.value??null;},window:{scrollTo(){},ONMFirebase:{loadOwnUser:async()=>user,post:async payload=>{calls.push(payload);return{success:true,profiles:linked?[{playerKey:"alex",publicName:"Alex Player"}]:[]};}}}};
  vm.runInNewContext(source("account.js"),context);await new Promise(resolve=>setImmediate(resolve));
  return{node,fields,calls,stored,save:()=>form.listeners.submit({preventDefault(){}})};
}
test("outside-team and unaffiliated accounts get basic details without club fields or fixtures",async()=>{
  for(const team of ["Other Darts Team","No affiliated team"]){
    const g=await account(team,true);
    for(const key of ["bio","nickname","walkoutSong","highestCheckout","playerRole","gooch","accolades"]){assert.equal(g.fields[key].closest().hidden,true);assert.equal(g.fields[key].disabled,true);}
    assert.equal(g.node("accountFixturesTab").hidden,true);
    assert.equal(g.node("accountLinkedPlayer").textContent,team);
    await g.save();
    const update=g.calls.find(call=>call.action==="updateProfile");
    assert.equal(update.profile.firstName,"Alex");assert.equal(update.profile.bio,undefined);assert.equal(update.profile.nickname,undefined);assert.equal(update.profile.walkoutSong,undefined);
    assert.equal(g.calls.some(call=>call.action==="updatePlayerProfile"),false);
    const saved=JSON.parse(g.stored.get("onmUser"));assert.equal(saved.nickname,"Keep nickname");assert.equal(saved.walkoutSong,"Keep song");
  }
});
test("Monsters accounts retain club profile fields, linked updates and fixtures",async()=>{
  const g=await account("Oche Ness Monsters",true);
  assert.equal(g.node("accountFixturesTab").hidden,false);assert.equal(g.fields.highestCheckout.disabled,false);
  await g.save();assert.equal(g.calls.some(call=>call.action==="updatePlayerProfile"),true);
});
test("profile navigation opens registration for guests and account for members",async()=>{
  const button={classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v;},appendChild(){}};
  const context={document:{getElementById:()=>button,createElement:()=>({})},window:{location:{href:""}},getCachedProfileImage:()=>"",renderAuthInitial(){}};
  const session=source("session.js");vm.runInNewContext(session.slice(session.indexOf("function updateAuthHeader("),session.indexOf("async function loadHeaderProfileImage(")),context);
  context.updateAuthHeader(null);await button.onclick({preventDefault(){}});assert.equal(context.window.location.href,"auth.html?mode=register");
  context.updateAuthHeader({firstName:"Alex"});await button.onclick({preventDefault(){}});assert.equal(context.window.location.href,"account.html");
  const handler=button.onclick;context.window.ONMSession={};const profile=source("profile.js");
  vm.runInNewContext(profile.slice(profile.indexOf("function initProfileButton()"),profile.indexOf('document.addEventListener("DOMContentLoaded", initProfileButton)')),context);
  context.initProfileButton();assert.equal(button.onclick,handler);
});
test("registration branding is a home link",()=>{
  const html=fs.readFileSync(require.resolve("../auth.html"),"utf8");assert.match(html,/<a class="authBrand authBrandCentered" href="index.html"/);
});
