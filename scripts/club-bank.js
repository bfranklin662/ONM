(function(){
 "use strict";
 const $=id=>document.getElementById(id),E=window.ONMClubBank,season=E.SEASON;
 const money=p=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
 const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let user=null,profile=null,revision=0,stops=[],profileStop=null,saving=false,failed=false;
 let data={payments:[],players:[],entries:[],results:[],settings:{}};const loaded=new Set();
 function clear(){for(const stop of stops)stop();stops=[];loaded.clear();data={payments:[],players:[],entries:[],results:[],settings:{}};$("bankContent").hidden=true;for(const id of ["bankPayments","bankEntries"])$(id).innerHTML="";}
 function message(text){$("bankStatus").textContent=text;}
 function error(error){failed=true;$("bankContent").hidden=true;$("bankLoading").hidden=true;message(error.code==="permission-denied"?"Bank access denied. Only active club administrators can view these accounts.":"Couldn’t load the club accounts. Please try Refresh.");}
 function render(){
   if(!profile||failed||loaded.size!==5)return;
   const totals=E.summary({...data,openingPence:data.settings.openingPence});
   for(const [id,key] of Object.entries({bankBalance:"balance",bankIncome:"income",bankExpenses:"expenses",bankFines:"fines",bankRegistrations:"registrations",bankOther:"other",bankOwed:"owed"}))$(id).textContent=money(totals[key]);
   const names=new Map(data.players.map(p=>[p.id,p.fullName||p.publicName||"Player"]));
   const receipts=[...data.payments.filter(p=>p.amountPaidPence>0).map(p=>({name:names.get(p.playerKey)||p.playerName||"Player",type:"Fines",pence:p.amountPaidPence})),...data.players.filter(p=>p.registrationPaidSeasons?.includes(season)).map(p=>({name:p.fullName||p.publicName||"Player",type:"Registration",pence:1500}))];
   receipts.sort((a,b)=>a.name.localeCompare(b.name)||a.type.localeCompare(b.type));
   $("bankPayments").innerHTML=receipts.map(p=>`<tr><td>${escape(p.name)}</td><td>${p.type}</td><td>${money(p.pence)}</td></tr>`).join("")||'<tr><td colspan="3">No payments recorded yet.</td></tr>';
   $("bankEntries").innerHTML=[...data.entries].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr class="${e.voided?'voided':''}"><td>${escape(e.date.split('-').reverse().join('/'))}</td><td>${escape(e.description)}<small>${escape(e.createdByName||"Administrator")}${e.voided?` · Voided by ${escape(e.voidedByName||"Administrator")}`:''}</small></td><td class="${e.type==='income'?'income':'expense'}">${e.type==='income'?'+':'−'}${money(e.amountPence)}</td><td>${e.voided?'Voided':`<button type="button" data-void="${escape(e.id)}">Void</button>`}</td></tr>`).join("")||'<tr><td colspan="4">No income or expenses recorded yet.</td></tr>';
   $("bankContent").hidden=false;$("bankLoading").hidden=true;
 }
 async function subscribe(){
   const rev=revision;clear();failed=false;message("");$("bankLoading").hidden=false;
   try{
     const {db,firestoreSdk:s}=await window.ONMFirebase.ready;if(rev!==revision||!profile)return;
     const listen=(key,ref,document=false)=>{const stop=s.onSnapshot(ref,snapshot=>{if(rev!==revision)return;data[key]=document?(snapshot.data()||{}):snapshot.docs.map(d=>({...d.data(),id:d.id}));loaded.add(key);render();},err=>{if(rev===revision)error(err);});stops.push(stop);};
     listen("payments",s.query(s.collection(db,"finePayments"),s.where("season","==",season)));
     listen("players",s.collection(db,"players"));
     listen("results",s.query(s.collection(db,"results"),s.where("season","==",season)));
     listen("entries",s.query(s.collection(db,"clubBankEntries"),s.where("season","==",season)));
     listen("settings",s.doc(db,"clubBankSettings",season),true);
   }catch(err){if(rev===revision)error(err);}
 }
 function disableForms(disabled){for(const form of [$("bankEntryForm")])for(const field of form.elements)field.disabled=disabled;}
 async function save(action){
   if(saving||!user||!profile||failed||loaded.size!==5)return;
   const rev=revision;saving=true;disableForms(true);message("Saving…");
   try{const {db,firestoreSdk:s}=await window.ONMFirebase.ready;if(rev!==revision)return;await action(s,db);if(rev===revision)message("Saved. Club balance updated.");}
   catch(err){if(rev===revision)message(err.message||"Couldn’t save. Please try again.");}
   finally{saving=false;if(rev===revision)disableForms(false);}
 }
 const actor=()=>({createdBy:user.uid,createdByName:profile.fullName||profile.firstName||user.displayName||"Administrator"});
 $("bankEntryForm").addEventListener("submit",event=>{event.preventDefault();
   let amount;try{amount=E.amount($("entryAmount").value);}catch(err){message(err.message);return;}
   const description=$("entryDescription").value.trim(),date=$("entryDate").value,type=$("entryType").value;
   if(!description||description.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>localDate()||!["income","expense"].includes(type)){message("Choose a date up to today and enter a description.");return;}
   save(async(s,db)=>{await s.setDoc(s.doc(s.collection(db,"clubBankEntries")),{season,type,date,description,amountPence:amount,voided:false,...actor(),createdAt:s.serverTimestamp()});if(user){$("entryAmount").value="";$("entryDescription").value="";}});
 });
 $("bankEntries").addEventListener("click",event=>{const button=event.target.closest("[data-void]");if(!button||saving)return;const entry=data.entries.find(e=>e.id===button.dataset.void);if(!entry||entry.voided||!window.confirm(`Void “${entry.description}” (${money(entry.amountPence)})? It will stay in the history but no longer affect the balance.`))return;
   save(async(s,db)=>{const by=actor();await s.updateDoc(s.doc(db,"clubBankEntries",entry.id),{voided:true,voidedAt:s.serverTimestamp(),voidedBy:by.createdBy,voidedByName:by.createdByName});});
 });
 function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 $("entryDate").value=localDate();$("entryDate").max=localDate();
 $("refreshBank").addEventListener("click",()=>{if(!saving&&profile)subscribe();});
 function deny(text,login=false){clear();profile=null;$("bankApp").hidden=true;$("bankGate").hidden=false;$("bankGate").innerHTML=`<img src="graphics/logoWText.png" alt="Oche Ness Monsters" width="100"><p>${escape(text)}</p>${login?'<a class="btn btnGhost" href="auth.html?redirect=bank.html">Log in</a>':''}`;}
 (window.ONMFirebase.authReady||window.ONMFirebase.ready).then(({auth,authSdk})=>authSdk.onAuthStateChanged(auth,async value=>{
   const rev=++revision;profileStop?.();profileStop=null;clear();user=value;profile=null;saving=false;disableForms(false);$("bankApp").hidden=true;
   if(!value){deny("Log in with a club administrator account to view the bank.",true);return;}
   try{const {db,firestoreSdk:s}=await window.ONMFirebase.ready;if(rev!==revision)return;
     profileStop=s.onSnapshot(s.doc(db,"users",value.uid),snap=>{
       if(rev!==revision)return;const next=snap.data();if(next?.status!=="Active"||!["admin","owner"].includes(next.role)){deny("This page is for active club administrators only.");return;}
       const first=!profile;profile=next;$("bankGate").hidden=true;$("bankApp").hidden=false;if(first)subscribe();
     },()=>{if(rev===revision)deny("Couldn’t check administrator access. Please reload.");});
   }catch{if(rev===revision)deny("Couldn’t connect. Please reload.");}
 })).catch(()=>deny("Couldn’t connect to sign-in. Please reload."));
 window.addEventListener("pagehide",()=>{clear();profileStop?.();});
 window.addEventListener("pageshow",event=>{if(event.persisted)window.location.reload();});
})();
