"use strict";
const {readStarlingAccounts, eligiblePayment}=require("./starling");
const {createHash}=require("node:crypto");
const season="26-27";
const ledgerId=(account,id)=>createHash("sha256").update(`${account}:${id}`).digest("hex");

function allocation(intent, player, payment, now) {
  if(intent.status!=="open" || !Number.isFinite(Date.parse(intent.expiresAt)) || Date.parse(intent.expiresAt)<now ||
     !Number.isSafeInteger(intent.finesPence)||intent.finesPence<0 ||
     ![0,1500].includes(intent.registrationPence)||
     intent.amountPence!==intent.finesPence+intent.registrationPence ||
     !Number.isSafeInteger(intent.amountPence)||intent.amountPence<=0) return "invalid-or-expired-instructions";
  if((intent.type==="fines"&&intent.registrationPence!==0)||(intent.type==="registration"&&(intent.finesPence!==0||intent.registrationPence!==1500)))return "invalid-payment-type";
  if(intent.type!=="registration"&&(Number(payment.amountPaidPence)||0)!==intent.paidBaselinePence) return "balance-changed";
  if(intent.type!=="fines"&&Boolean(player.registrationPaidSeasons?.includes(season)) !== (intent.registrationPence===0)) return "registration-changed";
  return null;
}

async function syncStarling({db,token,fetcher=fetch,now=new Date()}) {
  const state=db.collection("bankMatching").doc("starling"), stateSnap=await state.get();
  const activatedAt=stateSnap.data()?.activatedAt || now.toISOString();
  // No implicit choice of bank account when a token exposes multiple GBP accounts.
  const accounts=await readStarlingAccounts(token,fetcher);
  if(accounts.length!==1) throw new Error("STARLING_ACCOUNT_SELECTION_REQUIRED");
  const account=accounts[0];
  if(stateSnap.data()?.accountUid && stateSnap.data().accountUid!==account.accountUid) throw new Error("STARLING_ACCOUNT_CHANGED");
  if(!stateSnap.data()?.activatedAt)await state.set({activatedAt,accountUid:account.accountUid,enabled:true},{merge:true});
  if(stateSnap.data()?.enabled===false)return {disabled:true};
  const since=new Date(Math.max(Date.parse(activatedAt),Date.parse(stateSnap.data()?.lastSuccessAt||activatedAt)-86400000)).toISOString();
  const path=`https://api.starlingbank.com/api/v2/feed/account/${encodeURIComponent(account.accountUid)}/category/${encodeURIComponent(account.defaultCategory)}?changesSince=${encodeURIComponent(since)}`;
  const response=await fetcher(path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json","User-Agent":"ONM-Fines-Matching"},signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!response.ok)throw new Error("STARLING_FEED_UNAVAILABLE");
  const data=await response.json();if(!Array.isArray(data.feedItems))throw new Error("STARLING_FEED_INVALID");
  const refs=(await db.collection("finePaymentReferences").get()).docs.map(d=>d.data());
  let matched=0,review=0;
  for(const item of data.feedItems){
    const ledger=db.collection("bankTransferLedger").doc(ledgerId(account.accountUid,item.feedItemUid||""));
    // Updated/reversed previously matched transfers are flagged, never silently erased.
    if(item.feedItemUid && item.status!=="SETTLED"){
      await db.runTransaction(async tx=>{const prior=await tx.get(ledger);if(prior.exists&&prior.data().status==="matched")tx.set(ledger,{reviewRequired:true,bankStatus:item.status||"unknown"},{merge:true});});
      continue;
    }
    const match=eligiblePayment(item,refs,activatedAt);if(!match)continue;
    const outcome=await db.runTransaction(async tx=>{
      const prior=await tx.get(ledger);if(prior.exists)return "duplicate";
      let intentRef=db.collection("finePaymentIntents").doc(match.intentId||`${match.playerKey}__fines`),intentSnap=await tx.get(intentRef),intent=intentSnap.data();
      // Honour combined instructions already issued before separate payment cards.
      if(!match.intentId&&(!intent||intent.amountPence!==match.amountPence||Date.parse(intent.createdAt)>Date.parse(item.transactionTime))){intentRef=db.collection("finePaymentIntents").doc(match.playerKey);intentSnap=await tx.get(intentRef);intent=intentSnap.data();}
      const playerRef=db.collection("players").doc(match.playerKey),paymentRef=db.collection("finePayments").doc(`${season}__${match.playerKey}`);
      const player=await tx.get(playerRef),payment=await tx.get(paymentRef);
      let reason=!intent||!player.exists?"missing-instructions":allocation(intent,player.data(),payment.data()||{},now.getTime());
      if(!reason&&(match.amountPence!==intent.amountPence || Date.parse(item.transactionTime)<Date.parse(intent.createdAt)))reason="amount-or-date-mismatch";
      const record={playerKey:match.playerKey,season,amountPence:match.amountPence,receivedAt:item.transactionTime,processedAt:now.toISOString(),status:reason?"review":"matched",reason:reason||null};
      tx.set(ledger,record);
      if(reason)return "review";
      if(intent.finesPence)tx.set(paymentRef,{season,playerKey:match.playerKey,playerName:player.data().fullName||player.data().publicName||"Player",amountPaidPence:intent.paidBaselinePence+intent.finesPence,updatedAt:now,updatedBy:"starling-matching"},{merge:true});
      if(intent.registrationPence){
        const seasons=[...new Set([...(player.data().registrationPaidSeasons||[]),season])];
        tx.set(playerRef,{registrationPaidSeasons:seasons},{merge:true});
        tx.set(db.collection("publicPlayers").doc(match.playerKey),{registrationPaidSeasons:seasons},{merge:true});
      }
      tx.set(intentRef,{status:"paid",paidAt:now.toISOString()},{merge:true});
      return "matched";
    });
    if(outcome==="matched")matched++;if(outcome==="review")review++;
  }
  await state.set({accountUid:account.accountUid,lastSuccessAt:now.toISOString(),matched,review,healthy:true},{merge:true});
  return {matched,review};
}
module.exports={syncStarling,allocation,ledgerId};
