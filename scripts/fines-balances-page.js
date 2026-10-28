(function(){
  "use strict";
  const $=id=>document.getElementById(id),money=p=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
  let user=null,viewer={},busy=false,timer=null,revision=0,paying=false,photoMapPromise=null,paymentType=null,pendingUntil=0,successUntil=0,lastBalance=null;
  const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const matchDate=value=>`<span class="fullMatchDate">${escape(value)}</span><span class="shortMatchDate" title="${escape(value)}">${escape(String(value||"").replace(/\/(\d{4})$/, ""))}</span>`;
  async function showPhoto(){
    const current=revision,photo=$("myPhoto");photo.src=viewer.photoUrl||"graphics/logoWoText.png";
    if((!viewer.photoUrl||/^\/?images\/players\//i.test(viewer.photoUrl))&&viewer.photoName)try{photoMapPromise ||= fetch("data/player-photo-map.json").then(r=>r.json());const photos=await photoMapPromise,key=String(viewer.photoName).trim().toLowerCase().replace(/\s+/g,"");if(current===revision&&photos[key])photo.src=photos[key];}catch(_){}
  }
  $("myPhoto").addEventListener("error",()=>{if(!String($("myPhoto").src).endsWith("graphics/logoWoText.png"))$("myPhoto").src="graphics/logoWoText.png";});
  async function call(name,data={},who=user){
    const token=await who.getIdToken(),response=await fetch(`https://europe-west2-${window.ONMFirebase.config.projectId}.cloudfunctions.net/${name}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({data}),signal:AbortSignal.timeout(15000)}),payload=await response.json();
    if(!response.ok||payload.error)throw Error(payload.error?.message||"Could not load your account. Please retry.");
    return payload.result||payload.data;
  }
  function render(){
    const mine=viewer.balance;$("myName").textContent=viewer.name||"My account";showPhoto();$("unlinked").hidden=Boolean(mine);$("paymentCards").hidden=!mine;
    $("registrationCard").hidden=!mine||Boolean(mine.registrationPaid);
    $("registeredBadge").hidden=!mine?.registrationPaid;$("matchHistory").hidden=!mine;
    if(!mine)return;
    if(lastBalance){
      const registrationConfirmed=!lastBalance.registrationPaid&&mine.registrationPaid;
      const finesConfirmed=Number(mine.paidPence)>Number(lastBalance.paidPence);
      if(registrationConfirmed||finesConfirmed){
        $("paymentSuccess").textContent=registrationConfirmed&&finesConfirmed?"✓ Registration and fines payment confirmed. Thank you!":registrationConfirmed?"✓ Registration payment confirmed. You’re registered!":"✓ Fines payment confirmed. Thank you!";
        successUntil=Date.now()+10000;$("paymentSuccess").hidden=false;
        if((paymentType==="registration"&&registrationConfirmed)||(paymentType==="fines"&&finesConfirmed)){pendingUntil=0;$("paymentPending").hidden=true;}
      }
    }
    lastBalance={registrationPaid:mine.registrationPaid,paidPence:mine.paidPence};
    const history=viewer.history||[];
    $("historyRows").innerHTML=history.map(r=>`<tr><td>${matchDate(r.date)}</td><td>${escape(r.opponent)}<small>${escape(r.side)} · ${escape(r.competition)}</small></td><td><span class="matchScore ${["win","loss","draw"].includes(r.outcome)?r.outcome:"unknown"}" aria-label="${escape(r.score)} · ${r.outcome==="win"?"Won":r.outcome==="loss"?"Lost":"Result"}">${escape(r.score)}</span></td><td>${escape(r.checkouts)}</td><td>${money(r.finesPence)}</td></tr>`).join("")||'<tr><td colspan="5">No appearances this season yet.</td></tr>';
    $("historyApps").textContent=String(mine.appearances);$("historyCheckouts").textContent=String(history.reduce((n,r)=>n+Number(r.checkouts||0),0));
    $("totalFines").textContent=money(mine.issuedPence);$("finesPaid").textContent=money(mine.paidPence);$("finesOwed").textContent=money(mine.owedPence);
    const registration=mine.registrationPaid?0:1500;
    $("registrationAmount").textContent=money(registration);$("registrationStatus").textContent=mine.registrationPaid?"✓ Registration paid":"2026/27 registration fee";
    $("finesAmount").textContent=money(mine.owedPence);$("finesStatus").textContent=mine.owedPence?"Outstanding fines":"✓ All fines paid";
    $("finesBreakdown").textContent=`Fines issued ${money(mine.issuedPence)} · Paid ${money(mine.paidPence)}`;
    $("registrationAmount").className=registration?"amount owed":"amount paid";$("finesAmount").className=mine.owedPence?"amount owed":"amount paid";
    $("payRegistration").hidden=!registration;$("payFines").hidden=!mine.owedPence;
    $("myTotal").textContent=money(registration+mine.owedPence);
    $("matchingNote").textContent=viewer.automaticMatching?"Bank transfers are checked every minute. Your balance updates once confirmed.":"Bank confirmation may be delayed. An admin can confirm your payment if needed.";
  }
  async function pay(type){
    paymentType=type;
    if(!user||!viewer.bank||paying)return;paying=true;const current=revision,bank=viewer.bank,button=$(type==="registration"?"payRegistration":"payFines");button.disabled=true;button.className="paymentLoading";button.setAttribute("aria-busy","true");const label=button.textContent;button.textContent="Loading payment details…";
    try{const info=await call("getFinesPaymentInstructions",{type});if(current!==revision)return;$("paymentTitle").textContent=type==="registration"?"Pay registration":"Pay my fines";$("paymentDetails").innerHTML=`<div class="transferAmount"><span>Amount to pay</span><strong>${money(info.amountPence)}</strong></div><dl class="transferBank"><div><dt>Account name</dt><dd>${escape(bank.name)}</dd></div><div><dt>Sort code</dt><dd>${escape(bank.sortCode)}</dd></div><div><dt>Account number</dt><dd>${escape(bank.accountNumber)}</dd></div></dl><div class="transferReference"><span>Payment reference · use exactly</span><strong>${escape(info.reference)}</strong></div><small class="transferExpiry">Valid until ${escape(new Date(info.expiresAt).toLocaleDateString("en-GB"))}</small>`;$("paymentDialog").showModal();}
    catch(error){if(current===revision)$("status").textContent=error.message;}finally{paying=false;button.disabled=false;button.className="";button.setAttribute("aria-busy","false");button.textContent=label;}
  }
  async function refresh(){
    if(!user||busy)return;busy=true;const current=revision,who=user;$("loading").hidden=false;$("refresh").disabled=true;$("retry").hidden=true;$("status").textContent="Loading what you owe…";
    try{const data=await call("getFinesBalances",{},who);if(current!==revision)return;if(!data?.viewer)throw Error("Could not load your account. Please retry.");viewer=data.viewer;render();$("balances").hidden=false;$("status").textContent="";$("updatedAt").textContent=`Updated ${new Date(data.updatedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`;}
    catch(error){if(current===revision){$("status").textContent=error.name==="TimeoutError"?"The connection timed out. Please retry.":error.message;$("retry").hidden=false;}}
    finally{busy=false;if(current===revision){$("loading").hidden=true;$("refresh").disabled=false;}else if(user)refresh();}
  }
  function startTimer(){clearInterval(timer);let ticks=0;if(user)timer=setInterval(()=>{
    const now=Date.now();if(successUntil&&now>=successUntil){$("paymentSuccess").hidden=true;successUntil=0;}
    if(pendingUntil&&now>=pendingUntil){pendingUntil=0;$("paymentPending").textContent="Not confirmed yet. You can check again shortly—please don’t pay twice.";}
    if(!document.hidden&&(++ticks%3===0||(pendingUntil&&ticks%1===0)))refresh();
  },10000);}
  function clearHistory(){
    lastBalance=null;pendingUntil=0;successUntil=0;paymentType=null;$("paymentSuccess").hidden=true;$("paymentPending").hidden=true;
    $("updatedAt").textContent="";
    $("myPhoto").src="graphics/logoWoText.png";
    $("registeredBadge").hidden=true;$("matchHistory").hidden=true;$("historyRows").innerHTML="";
    for(const id of ["historyApps","historyCheckouts","totalFines","finesPaid","finesOwed"])$(id).textContent="";
  }
  function setUser(value){revision++;clearHistory();user=value;viewer={};$("balances").hidden=true;$("gate").hidden=Boolean(user);$("retry").hidden=true;$("loading").hidden=!user;$("paymentDialog").close();$("paymentDetails").textContent="";$("myName").textContent="";$("myTotal").textContent="";$("status").textContent=user?"Loading what you owe…":"";startTimer();if(user)refresh();}
  $("payRegistration").addEventListener("click",()=>pay("registration"));$("payFines").addEventListener("click",()=>pay("fines"));$("closePayment").addEventListener("click",()=>$("paymentDialog").close());$("refresh").addEventListener("click",refresh);$("retry").addEventListener("click",refresh);
  $("confirmPaid").addEventListener("click",()=>{
    $("paymentDialog").close();pendingUntil=Date.now()+180000;$("paymentPending").textContent="Checking for your bank transfer… We’ll confirm it once received. Please don’t pay twice.";$("paymentPending").hidden=false;startTimer();refresh();
  });
  (window.ONMFirebase.authReady||window.ONMFirebase.ready).then(({auth,authSdk})=>authSdk.onAuthStateChanged(auth,setUser)).catch(()=>{$("loading").hidden=true;$("status").textContent="Couldn't connect to sign-in. Please refresh.";});
  window.addEventListener("pagehide",()=>clearInterval(timer));window.addEventListener("pageshow",()=>{startTimer();if(user)refresh();});
})();
