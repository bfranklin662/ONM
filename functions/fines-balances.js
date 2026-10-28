"use strict";
const clean=v=>String(v??"").trim(),key=v=>clean(v).toLowerCase().replace(/\s+/g," ");
function buildFineBalances(players,results,payments,season="26-27",includeUnused=false){
  const rows=new Map(),aliases=new Map();
  for(const p of players){const id=p.id||p.playerKey;if(!id)continue;rows.set(id,{playerKey:id,name:clean(p.fullName||p.publicName)||"Player",registrationPaid:p.registrationPaidSeasons?.includes(season)||false,appearances:0,issuedPence:0,paidPence:0,owedPence:0});for(const name of [p.publicName,p.fullName])if(key(name))aliases.set(key(name),id);}
  for(const match of results.filter(r=>r.season===season)){
    const row=match.sheetRow||{},seen=new Set();
    for(let i=1;i<=12;i++){const name=clean(row[`Player${i}`]??row[`Player ${i}`]);if(!name)continue;const id=aliases.get(key(name))||`unmatched:${key(name)}`;if(!rows.has(id))rows.set(id,{playerKey:id,name,appearances:0,issuedPence:0,paidPence:0,owedPence:0});const total=rows.get(id);if(!seen.has(id)){total.appearances++;seen.add(id);}const amount=Number(clean(row[`F${i}`]??row[`F ${i}`]).replace(/[£,\s]/g,""));if(Number.isFinite(amount)&&amount>0)total.issuedPence+=Math.round(amount*100);}
  }
  for(const p of payments){const row=rows.get(p.playerKey),amount=Number(p.amountPaidPence);if(p.season===season&&row&&Number.isSafeInteger(amount)&&amount>0)row.paidPence+=amount;}
  return [...rows.values()].filter(r=>includeUnused||r.appearances>0).map(r=>({...r,registrationPaid:Boolean(r.registrationPaid),owedPence:Math.max(0,r.issuedPence-r.paidPence)})).sort((a,b)=>b.owedPence-a.owedPence||b.appearances-a.appearances||a.name.localeCompare(b.name));
}
function buildFineHistory(player,results,season="26-27"){
  if(!player)return [];
  const aliases=new Set([player.fullName,player.publicName].map(key).filter(Boolean));
  const number=v=>{const n=Number(clean(v).replace(/[£,\s]/g,""));return Number.isFinite(n)&&n>=0?n:0;};
  const stamp=date=>{const match=date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);if(match)return Date.UTC(Number(match[3])+(match[3].length===2?2000:0),Number(match[2])-1,Number(match[1]));return Date.parse(date)||0;};
  return results.filter(r=>r.season===season).flatMap(match=>{
    const r=match.sheetRow||{};let found=false,checkouts=0,finesPence=0;
    for(let i=1;i<=12;i++)if(aliases.has(key(r[`Player${i}`]??r[`Player ${i}`]))){found=true;checkouts+=number(r[`C${i}`]??r[`C ${i}`]);finesPence+=Math.round(number(r[`F${i}`]??r[`F ${i}`])*100);}
    if(!found)return [];
    const home=clean(r.HomeTeam),away=clean(r.AwayTeam),atHome=/oche\s+ness\s+monsters/i.test(home),date=clean(r["Date Played"]||r["Match Date"]||r.Date),hs=r.HomeScore??r.HS??r["Home Score"],as=r.AwayScore??r.AS??r["Away Score"];
    const result=clean(r.Result).toLowerCase();
    const validScores=hs!=null&&as!=null&&clean(hs)!==""&&clean(as)!==""&&Number.isFinite(Number(hs))&&Number.isFinite(Number(as));
    const outcome=result.startsWith("w")?"win":result.startsWith("l")?"loss":validScores?(Number(hs)===Number(as)?"draw":((atHome?Number(hs)>Number(as):Number(as)>Number(hs))?"win":"loss")):"unknown";
    return [{date,opponent:(atHome?away:home)||"Unknown opponent",side:atHome?"Home":"Away",competition:clean(r.Competition||r.League),score:validScores?`${hs}–${as}`:"—",outcome,appearances:1,checkouts,finesPence}];
  }).sort((a,b)=>stamp(b.date)-stamp(a.date));
}
module.exports={buildFineBalances,buildFineHistory};
