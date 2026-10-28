"use strict";
const clean=v=>String(v??"").trim(),key=v=>clean(v).toLowerCase().replace(/\s+/g," ");
function buildFineBalances(players,results,payments,season="26-27"){
  const rows=new Map(),aliases=new Map();
  for(const p of players){const id=p.id||p.playerKey;if(!id)continue;rows.set(id,{playerKey:id,name:clean(p.fullName||p.publicName)||"Player",appearances:0,issuedPence:0,paidPence:0,owedPence:0});for(const name of [p.publicName,p.fullName])if(key(name))aliases.set(key(name),id);}
  for(const match of results.filter(r=>r.season===season)){
    const row=match.sheetRow||{},seen=new Set();
    for(let i=1;i<=12;i++){const name=clean(row[`Player${i}`]??row[`Player ${i}`]);if(!name)continue;const id=aliases.get(key(name))||`unmatched:${key(name)}`;if(!rows.has(id))rows.set(id,{playerKey:id,name,appearances:0,issuedPence:0,paidPence:0,owedPence:0});const total=rows.get(id);if(!seen.has(id)){total.appearances++;seen.add(id);}const amount=Number(clean(row[`F${i}`]??row[`F ${i}`]).replace(/[£,\s]/g,""));if(Number.isFinite(amount)&&amount>0)total.issuedPence+=Math.round(amount*100);}
  }
  for(const p of payments){const row=rows.get(p.playerKey),amount=Number(p.amountPaidPence);if(p.season===season&&row&&Number.isSafeInteger(amount)&&amount>0)row.paidPence+=amount;}
  return [...rows.values()].map(r=>({...r,owedPence:Math.max(0,r.issuedPence-r.paidPence)})).sort((a,b)=>b.owedPence-a.owedPence||b.appearances-a.appearances||a.name.localeCompare(b.name));
}
module.exports={buildFineBalances};
