(function(){
  "use strict";
  const $=id=>document.getElementById(id),money=pence=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);
  let user=null,players=[],busy=false,timer=null,revision=0;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(){const query=$("search").value.trim().toLowerCase();$("rows").innerHTML=players.filter(p=>p.name.toLowerCase().includes(query)).map(p=>`<tr><td>${escape(p.name)}</td><td>${p.appearances}</td><td>${money(p.issuedPence)}</td><td class="paid">${money(p.paidPence)}</td><td class="owed">${money(p.owedPence)}</td></tr>`).join("")||'<tr><td colspan="5">No matching players.</td></tr>';$("totalOwed").textContent=money(players.reduce((n,p)=>n+p.owedPence,0));$("totalPaid").textContent=money(players.reduce((n,p)=>n+p.paidPence,0));}
  async function refresh(){
    if(busy||!user)return;busy=true;const current=revision,requestUser=user;$("refresh").disabled=true;$("retry").hidden=true;$("status").textContent="Loading live fines…";
    try{const token=await requestUser.getIdToken(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;try{response=await fetch(`https://europe-west2-${window.ONMFirebase.config.projectId}.cloudfunctions.net/getFinesBalances`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({data:{}}),signal:controller.signal});}finally{clearTimeout(timeout);}const payload=await response.json(),data=payload.result||payload.data;if(!response.ok||payload.error||!Array.isArray(data?.players))throw Error(payload.error?.message||"Fines could not be loaded. Please retry.");if(current!==revision)return;players=data.players;render();$("balances").hidden=false;$("status").textContent=`Live balances · Updated ${new Date(data.updatedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`;
    }catch(error){if(current!==revision)return;$("status").textContent=error.name==="AbortError"?"The connection timed out. Please retry.":error.message;$("retry").hidden=false;}finally{busy=false;$("refresh").disabled=false;if(current!==revision&&user)refresh();}
  }
  function setUser(current){revision++;user=current;players=[];$("rows").innerHTML="";$("balances").hidden=true;$("retry").hidden=true;$("gate").hidden=Boolean(user);$("status").textContent=user?"Loading live fines…":"Sign in to view the private player balances.";clearInterval(timer);if(user){refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},30000);}}
  $("search").addEventListener("input",render);$("refresh").addEventListener("click",refresh);$("retry").addEventListener("click",refresh);
  window.ONMFirebase.ready.then(({auth,authSdk})=>authSdk.onAuthStateChanged(auth,setUser)).catch(()=>{$("status").textContent="Couldn't connect to sign-in. Please refresh the page.";});
  window.addEventListener("pagehide",()=>clearInterval(timer));window.addEventListener("pageshow",()=>{if(user){clearInterval(timer);refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},30000);}});
})();
