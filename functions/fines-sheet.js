"use strict";
const {buildFineBalances}=require("./fines-balances");
function outstandingFineRows(players,results,payments){
  const names=new Map(players.map(p=>[p.id,p.publicName||p.fullName]));
  return buildFineBalances(players,results,payments,"26-27").filter(p=>p.owedPence>0).map(p=>[names.get(p.playerKey)||p.name,p.owedPence/100]);
}
async function syncFinesSheet({db,write}){
  const [p,r,f]=await Promise.all([db.collection("players").select("fullName","publicName").get(),db.collection("results").where("season","==","26-27").select("season","sheetRow").get(),db.collection("finePayments").where("season","==","26-27").select("season","playerKey","amountPaidPence").get()]);
  const unpack=s=>s.docs.map(d=>({id:d.id,...d.data()}));
  const rows=outstandingFineRows(unpack(p),unpack(r),unpack(f));
  if(rows.length>196)throw Error("Fines sheet capacity exceeded; no data was changed.");
  await write([
    {range:"'Fines 26-27'!A2",values:[["Outstanding fines only · recorded payments deducted · registration fees excluded."]]},
    {range:"'Fines 26-27'!A4:B200",values:[["Player","Fines owed"],...rows,...Array.from({length:196-rows.length},()=>["",""])]}
  ]);
}
module.exports={outstandingFineRows,syncFinesSheet};
