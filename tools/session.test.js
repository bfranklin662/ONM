const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function harness(current, fail = false) {
  const user = {uid:"member",userId:"member",firstName:"Member"};
  const storage = new Map([["onmUser",JSON.stringify(user)]]);
  let signOuts=0;
  const context={window:{ONMFirebase:{firebasePrimary:true,currentFirebaseUser:async()=>{if(fail)throw Error("Offline");return current;},post:async()=>({success:true,user}),signOut:async()=>{signOuts++;}}},document:{getElementById:()=>null,addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/session.js"),"utf8"),context);
  return {session:context.window.ONMSession,storage,context,signOuts:()=>signOuts};
}
test("an expired cached profile is not treated as signed in or used to sign out a session",async()=>{
  const g=harness(null);
  assert.equal(await g.session.init(),null);
  assert.equal(g.storage.has("onmUser"),false);
  assert.equal(g.signOuts(),0);
});
test("a verified persisted account is recognised",async()=>{
  const g=harness({uid:"member"});
  assert.equal((await g.session.init()).uid,"member");
  assert.equal((await g.session.check()).uid,"member");
});
test("failed or mismatched auth verification does not trust a stale cache",async()=>{
  assert.equal(await harness(null,true).session.init(),null);
  assert.equal(await harness({uid:"someone-else"}).session.check(),null);
});
test("embedded bot scorers reuse the authenticated same-origin Firebase client",()=>{
  const firebase={firebasePrimary:true,ready:Promise.resolve({}),currentFirebaseUser:async()=>({uid:"member"})};
  const ctx={URLSearchParams,window:{location:{origin:"https://example.test",search:"?mode=bot"},parent:{location:{origin:"https://example.test"},ONMFirebase:firebase}}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/firebase-client.js"),"utf8"),ctx);
  assert.equal(ctx.window.ONMFirebase,firebase);
});
test("a valid Firebase session restores a missing profile cache without sending the player to sign up",async()=>{
 const g=harness({uid:"member"});g.storage.clear();g.context.window.ONMFirebase.loadOwnUser=async()=>({uid:"member",userId:"member",firstName:"Member",status:"Active"});
 assert.equal((await g.session.init()).uid,"member");assert.equal(JSON.parse(g.storage.get("onmUser")).uid,"member");assert.equal(g.signOuts(),0);
});
test("a freshly inactive account is not accepted as an active cached session",async()=>{
 const g=harness({uid:"member"});g.context.window.ONMFirebase.loadOwnUser=async()=>({uid:"member",status:"Inactive"});assert.equal(await g.session.check(),null);assert.equal(g.storage.has("onmUser"),false);
});
test("auth and account loading are independent of optional photo/storage loading",()=>{
 const firebase=fs.readFileSync(require.resolve("../scripts/firebase-client.js"),"utf8"),account=fs.readFileSync(require.resolve("../scripts/account.js"),"utf8"),session=fs.readFileSync(require.resolve("../scripts/session.js"),"utf8");
 assert.match(firebase,/const authReady=Promise.all\(\[appReady,import\(`\$\{BASE\}\/firebase-auth.js`\)\]/);assert.match(firebase,/if\(ownUserRead&&ownUserUid===firebaseUser.uid\)return ownUserRead/);
 assert.match(account,/app.classList.remove\("hidden"\);\s*linkedProfileLoading=loadLinkedPlayerProfile\(\)/);assert.doesNotMatch(account,/await loadLinkedPlayerProfile/);assert.match(account,/!touchedFields.has\(field\)/);assert.match(session,/const current=window.ONMFirebase\?\.firebasePrimary\?await window.ONMFirebase.currentFirebaseUser\(\)/);
});
test("clicking an unrestored header verifies Firebase instead of following the temporary sign-up link",async()=>{
 const g=harness({uid:"member"}),button={setAttribute(){},classList:{add(){},remove(){}}};g.context.document.getElementById=()=>button;g.context.window.location={href:""};g.session.updateHeader(null);await button.onclick({preventDefault(){}});assert.equal(g.context.window.location.href,"account.html");
});
test("simultaneous account readers share one fetch and discard it if the user signs out",async()=>{
 const source=fs.readFileSync(require.resolve("../scripts/firebase-client.js"),"utf8"),start=source.indexOf("  let ownUserRead="),end=source.indexOf("\n  async function register",start);
 let release,reads=0;const gate=new Promise(r=>{release=r;}),auth={currentUser:{uid:"member"}},context={currentFirebaseUser:async()=>auth.currentUser,authReady:Promise.resolve({auth}),firestoreReady:Promise.resolve({db:{},firestoreSdk:{doc:()=>({}),getDoc:async()=>{reads++;return gate;}}}),publicUser:(uid,data)=>({uid,...data})};vm.runInNewContext(source.slice(start,end),context);
 const first=context.loadOwnUser(),second=context.loadOwnUser();await new Promise(r=>setImmediate(r));assert.equal(reads,1);auth.currentUser=null;release({exists:()=>true,data:()=>({status:"Active"})});assert.equal(await first,null);assert.equal(await second,null);
});
