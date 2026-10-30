(function(root){
  "use strict";
  const SEASON="26-27",MAX=100000000;
  function amount(value,{signed=false}={}){
    const text=String(value??"").trim();
    if(!(signed?/^-?\d+(?:\.\d{1,2})?$/:/^\d+(?:\.\d{1,2})?$/).test(text))throw Error("Enter a valid amount with up to two decimal places.");
    const pence=Math.round(Number(text)*100);
    if(!Number.isSafeInteger(pence)||Math.abs(pence)>MAX||(!signed&&pence<=0))throw Error("Enter an amount greater than zero and no more than £1,000,000.");
    return pence;
  }
  function finesOwed(players=[],results=[],payments=[]){
    const key=v=>String(v??"").trim().toLowerCase().replace(/\s+/g," "),aliases=new Map(),balances=new Map();
    for(const p of players){const id=p.id||p.playerKey;if(!id)continue;balances.set(id,{issued:0,paid:0});for(const name of [p.publicName,p.fullName])if(key(name))aliases.set(key(name),id);}
    for(const match of results.filter(r=>r.season===SEASON))for(let i=1;i<=12;i++){
      const row=match.sheetRow||{},name=key(row[`Player${i}`]??row[`Player ${i}`]);if(!name)continue;
      const id=aliases.get(name)||`unmatched:${name}`;if(!balances.has(id))balances.set(id,{issued:0,paid:0});
      const value=Number(String(row[`F${i}`]??row[`F ${i}`]??"").replace(/[£,\s]/g,""));if(Number.isFinite(value)&&value>0)balances.get(id).issued+=Math.round(value*100);
    }
    for(const p of payments){const row=balances.get(p.playerKey),value=Number(p.amountPaidPence);if(p.season===SEASON&&row&&Number.isSafeInteger(value)&&value>0)row.paid+=value;}
    return [...balances.values()].reduce((total,row)=>total+Math.max(0,row.issued-row.paid),0);
  }
  function summary({payments=[],players=[],entries=[],results=[],openingPence=0}={}){
    const valid=n=>Number.isSafeInteger(n)&&n>=0;
    const fines=payments.filter(p=>p.season===SEASON&&valid(p.amountPaidPence)).reduce((n,p)=>n+p.amountPaidPence,0);
    const registrations=players.filter(p=>p.registrationPaidSeasons?.includes(SEASON)).length*1500;
    const active=entries.filter(e=>e.season===SEASON&&!e.voided&&valid(e.amountPence));
    const other=active.filter(e=>e.type==="income").reduce((n,e)=>n+e.amountPence,0);
    const expenses=active.filter(e=>e.type==="expense").reduce((n,e)=>n+e.amountPence,0);
    const opening=Number.isSafeInteger(openingPence)?openingPence:0;
    return {opening,fines,registrations,other,expenses,owed:finesOwed(players,results,payments),income:fines+registrations+other,balance:opening+fines+registrations+other-expenses};
  }
  const api={SEASON,amount,summary,finesOwed};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ONMClubBank=api;
})(typeof window!=="undefined"?window:globalThis);
