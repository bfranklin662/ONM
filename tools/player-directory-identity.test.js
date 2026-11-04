const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../scripts/firebase-client.js'),'utf8');
test('result sync reuses existing player IDs, full names and short names instead of Phil L2',async()=>{
 const directory=[{id:'phil-l',playerKey:'phil-l',fullName:'Phil Lee',publicName:'Phil L',aliases:['Phil L2']}],writes=[];
 const sdk={collection:()=>null,getDocs:async()=>({docs:directory.map(d=>({id:d.id,data:()=>d}))}),doc:(_db,c,id)=>c+'/'+id,setDoc:async(ref,v)=>writes.push({ref,v}),serverTimestamp:()=>null};
 const ctx={ready:Promise.resolve({db:{},firestoreSdk:sdk}),clean:v=>String(v??'').trim(),normaliseName:v=>String(v??'').trim().toLowerCase(),playerKey:v=>v.toLowerCase().replace(/\s+/g,'-')};
 const start=source.indexOf('  function makeAutomaticPublicName('),end=source.indexOf('  async function uploadResultImages(',start);vm.runInNewContext(source.slice(start,end),ctx);
 await ctx.syncPlayers([{fullName:'Phil L',name:'Phil'},{fullName:'Phil Lee',playerKey:'phil-l'},{fullName:'Phil L2',name:'Phil L2'}]);assert.equal(writes.length,0);
 await ctx.syncPlayers([{fullName:'Brodie Example',name:'Brodie'}]);assert.equal(writes.length,2);assert.equal(writes[0].v.fullName,'Brodie Example');assert.equal(writes[0].v.publicName,'Brodie');
});
test('directory waits for restored Firebase auth and retries on focus instead of relying on a cached user',()=>{
 const s=fs.readFileSync(require.resolve('../scripts/fines.js'),'utf8'),loader=s.slice(s.indexOf('async function loadSignedInPlayerDirectory('),s.indexOf('  let resultSubmitData'));
 assert.match(loader,/await window.ONMFirebase.currentFirebaseUser\(\)/);assert.doesNotMatch(loader,/ONMSession\?\.getUser/);assert.match(s,/if \(!signedInPlayerDirectory.length\) loadSignedInPlayerDirectory\(\)/);assert.match(s,/player.aliases \|\| \[\]/);
});
test('both match routes request fresh identity and directory scripts',()=>{
 for(const file of ['match.html','match/index.html']){const html=fs.readFileSync(require.resolve('../'+file),'utf8');assert.match(html,/firebase-client.js\?v=20261104-player-identity/);assert.match(html,/scripts\/fines.js\?v=20261104-player-directory/);}
});
