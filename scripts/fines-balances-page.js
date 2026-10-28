(function(){
  "use strict";
  const $=id=>document.getElementById(id),money=p=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
  let user=null,viewer={},busy=false,timer=null,revision=0,paying=false;
  async function call(name,data={},who=user){
    const token=await who.getIdToken(),response=await fetch(`https://europe-west2-${window.ONMFirebase.config.projectId}.cloudfunctions.net/${name}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({data}),signal:AbortSignal.timeout(15000)}),payload=await response.json();
    if(!response.ok||payload.error)throw Error(payload.error?.message||"Could not load your account. Please retry.");
    return payload.result||payload.data;
  }
  function render(){
    const mine=viewer.balance;$("myName").textContent=viewer.name||"My account";$("unlinked").hidden=Boolean(mine);$("paymentCards").hidden=!mine;
    if(!mine)return;
    const registration=mine.registrationPaid?0:1500;
    $("registrationAmount").textContent=money(registration);$("registrationStatus").textContent=mine.registrationPaid?"✓ Registration paid":"2026/27 registration fee";
    $("finesAmount").textContent=money(mine.owedPence);$("finesStatus").textContent=mine.owedPence?"Outstanding fines":"✓ All fines paid";
    $("finesBreakdown").textContent=`Fines issued ${money(mine.issuedPence)} · Paid ${money(mine.paidPence)}`;
    $("registrationAmount").className=registration?"amount owed":"amount paid";$("finesAmount").className=mine.owedPence?"amount owed":"amount paid";
    $("payRegistration").hidden=!registration;$("payFines").hidden=!mine.owedPence;
    $("myTotal").textContent=money(registration+mine.owedPence);
    $("matchingNote").textContent=viewer.automaticMatching?"Matching bank transfers are checked every five minutes. Your balance updates after payment is confirmed.":"Bank confirmation may be delayed. An admin can confirm your payment if needed.";
  }
  async function pay(type){
    if(!user||!viewer.bank||paying)return;paying=true;const current=revision,bank=viewer.bank,button=$(type==="registration"?"payRegistration":"payFines");button.disabled=true;const label=button.textContent;button.textContent="Loading payment details…";
    try{const info=await call("getFinesPaymentInstructions",{type});if(current!==revision)return;$("paymentTitle").textContent=type==="registration"?"Pay registration":"Pay my fines";$("paymentDetails").textContent=`Amount: ${money(info.amountPence)}\nAccount name: ${bank.name}\nSort code: ${bank.sortCode}\nAccount number: ${bank.accountNumber}\nReference: ${info.reference}\n\nValid until ${new Date(info.expiresAt).toLocaleDateString("en-GB")}.`;$("paymentDialog").showModal();}
    catch(error){if(current===revision)$("status").textContent=error.message;}finally{paying=false;button.disabled=false;button.textContent=label;}
  }
  async function refresh(){
    if(!user||busy)return;busy=true;const current=revision,who=user;$("loading").hidden=false;$("refresh").disabled=true;$("retry").hidden=true;$("status").textContent="Loading what you owe…";
    try{const data=await call("getFinesBalances",{},who);if(current!==revision)return;if(!data?.viewer)throw Error("Could not load your account. Please retry.");viewer=data.viewer;render();$("balances").hidden=false;$("status").textContent=`Updated ${new Date(data.updatedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`;}
    catch(error){if(current===revision){$("status").textContent=error.name==="TimeoutError"?"The connection timed out. Please retry.":error.message;$("retry").hidden=false;}}
    finally{busy=false;if(current===revision){$("loading").hidden=true;$("refresh").disabled=false;}else if(user)refresh();}
  }
  function startTimer(){clearInterval(timer);if(user)timer=setInterval(()=>{if(!document.hidden)refresh();},30000);}
  function setUser(value){revision++;user=value;viewer={};$("balances").hidden=true;$("gate").hidden=Boolean(user);$("retry").hidden=true;$("loading").hidden=!user;$("paymentDialog").close();$("paymentDetails").textContent="";$("myName").textContent="";$("myTotal").textContent="";$("status").textContent=user?"Loading what you owe…":"Sign in to see your own registration and fines.";startTimer();if(user)refresh();}
  $("payRegistration").addEventListener("click",()=>pay("registration"));$("payFines").addEventListener("click",()=>pay("fines"));$("closePayment").addEventListener("click",()=>$("paymentDialog").close());$("refresh").addEventListener("click",refresh);$("retry").addEventListener("click",refresh);
  window.ONMFirebase.ready.then(({auth,authSdk})=>authSdk.onAuthStateChanged(auth,setUser)).catch(()=>{$("loading").hidden=true;$("status").textContent="Couldn't connect to sign-in. Please refresh.";});
  window.addEventListener("pagehide",()=>clearInterval(timer));window.addEventListener("pageshow",()=>{startTimer();if(user)refresh();});
})();
