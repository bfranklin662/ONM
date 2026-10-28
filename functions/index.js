"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const starlingToken = defineSecret("STARLING_ACCESS_TOKEN");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { GoogleAuth } = require("google-auth-library");
const { SPREADSHEET_ID, createAvailabilityService } = require("./availability");

initializeApp();
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
async function request(url, options = {}) {
  const client = await auth.getClient();
  return (await client.request({ url, ...options })).data;
}
const service = createAvailabilityService({
  db: getFirestore(),
  sheets: {
    metadata: () => request(`${base}?fields=sheets(properties(sheetId,title,gridProperties))`),
    values: async range => (await request(`${base}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`)).values || [],
    cell: async range => {
      const data = await request(`${base}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets(data(rowData(values(userEnteredValue,dataValidation))))`);
      return data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0] || {};
    },
    update: (range, value) => request(`${base}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT", data: { range, majorDimension: "ROWS", values: [[value]] }
    })
  }
});

const options = { region: "europe-west2", maxInstances: 2, concurrency: 10, timeoutSeconds: 30, memory: "256MiB", serviceAccount: "765901984167-compute@developer.gserviceaccount.com" };
// Connection check only. Does not read a transaction feed or change balances.
exports.checkStarlingConnection = onCall({...options,secrets:[starlingToken]}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in as an administrator.");
  const account = await getFirestore().collection("users").doc(request.auth.uid).get();
  if (!account.exists || account.data().status !== "Active" || !["admin","owner"].includes(account.data().role))
    throw new HttpsError("permission-denied", "Administrator access required.");
  try {
    const {readStarlingAccounts} = require("./starling");
    const accounts = await readStarlingAccounts(starlingToken.value());
    return {connected:accounts.length>0,gbpAccounts:accounts.length,automaticMatching:false};
  } catch (_) {
    throw new HttpsError("unavailable", "Starling connection could not be verified. Check the token, its permissions and expiry securely.");
  }
});
function callable(handler) {
  return onCall(options, async request => {
    try {
      return await handler(request.auth?.uid, request.data);
    } catch (error) {
      const codes = ["unauthenticated", "permission-denied", "failed-precondition", "invalid-argument", "aborted"];
      if (codes.includes(error.code)) throw new HttpsError(error.code, error.message);
      console.error("Availability sheet request failed", error.message);
      throw new HttpsError("unavailable", "The availability sheet could not be reached. Please try again, or use the sheet directly.");
    }
  });
}
exports.getPlayerAvailability = callable(uid => service.get(uid));
exports.setPlayerAvailability = callable((uid, data) => service.set(uid, data));

const {buildFineBalances}=require("./fines-balances");
exports.matchStarlingPayments=onSchedule({...options,secrets:[starlingToken],schedule:"every 5 minutes",timeoutSeconds:120,maxInstances:1,concurrency:1},async()=>{
  const db=getFirestore();
  try {await require("./starling-matching").syncStarling({db,token:starlingToken.value()});}
  catch (_) {await db.collection("bankMatching").doc("starling").set({healthy:false,lastErrorAt:new Date().toISOString()},{merge:true});throw new Error("Starling matching failed; administrator attention required.");}
});
exports.getFinesPaymentInstructions=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in to pay.");
  const db=getFirestore(),account=await db.collection("users").doc(request.auth.uid).get(),user=account.data();
  if(!account.exists||user.status!=="Active"||!user.linkedPlayerKey)throw new HttpsError("permission-denied","Link your active account to your player first.");
  const type=request.data?.type||"combined";
  if(!["fines","registration","combined"].includes(type))throw new HttpsError("invalid-argument","Choose registration or fines.");
  const key=user.linkedPlayerKey,season="26-27";
  const [p,r,pay,ref]=await Promise.all([db.collection("players").doc(key).get(),db.collection("results").where("season","==",season).get(),db.collection("finePayments").where("season","==",season).get(),db.collection("finePaymentReferences").doc(key).get()]);
  if(!p.exists||!ref.exists)throw new HttpsError("failed-precondition","Refresh your fines page to create payment instructions.");
  const unpack=s=>s.docs.map(d=>({id:d.id,...d.data()})),mine=buildFineBalances([{id:p.id,...p.data()}],unpack(r),unpack(pay),season,true).find(row=>row.playerKey===key);
  const finesPence=type==="registration"?0:mine?.owedPence||0,registrationPence=type==="fines"||p.data().registrationPaidSeasons?.includes(season)?0:1500;
  if(!finesPence&&!registrationPence)throw new HttpsError("failed-precondition","You have nothing to pay.");
  const baseline=pay.docs.find(d=>d.id===`${season}__${key}`)?.data().amountPaidPence||0;
  const intentId=type==="combined"?key:`${key}__${type}`;
  let reference=ref.data().reference;
  if(type==="registration"){
    reference=reference.replace(/^Fines-/i,"Reg-");
    await db.runTransaction(async tx=>{const owner=db.collection("fineReferenceOwners").doc(reference),existing=await tx.get(owner);if(existing.exists&&existing.data().playerKey!==key)throw new HttpsError("failed-precondition","Contact an admin to assign your registration reference.");tx.set(owner,{playerKey:key});tx.set(db.collection("finePaymentReferences").doc(intentId),{playerKey:key,reference,intentId});});
  }
  const intent={type,playerKey:key,reference,amountPence:finesPence+registrationPence,finesPence,registrationPence,paidBaselinePence:baseline,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7*86400000).toISOString(),status:"open"};
  // Reopening instructions must not move the valid-from date past an incoming transfer.
  const saved=await db.runTransaction(async tx=>{const doc=db.collection("finePaymentIntents").doc(intentId),old=await tx.get(doc),v=old.data();if(v?.status==="open"&&v.amountPence===intent.amountPence&&(type==="registration"||v.paidBaselinePence===baseline)&&Date.parse(v.expiresAt)>Date.now())return v;tx.set(doc,intent);return intent;});
  return {amountPence:saved.amountPence,reference:saved.reference,finesPence:saved.finesPence,registrationPence:saved.registrationPence,expiresAt:saved.expiresAt};
});
exports.getFinesBalances=onCall(options,async request=>{
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in to view fines.");
  const db=getFirestore(),account=await db.collection("users").doc(request.auth.uid).get();
  if(!account.exists||account.data().status!=="Active")throw new HttpsError("permission-denied","An active account is required to view fines.");
  const season="26-27";
  const [players,results,payments]=await Promise.all([db.collection("players").select("fullName","publicName","registrationPaidSeasons").get(),db.collection("results").where("season","==",season).select("season","sheetRow").get(),db.collection("finePayments").where("season","==",season).select("season","playerKey","amountPaidPence").get()]);
  const unpack=snap=>snap.docs.map(doc=>({id:doc.id,...doc.data()}));
  const allRows=buildFineBalances(unpack(players),unpack(results),unpack(payments),season,true),rows=allRows.filter(p=>p.appearances>0),data=account.data(),isAdmin=["admin","owner"].includes(data.role),mine=allRows.find(p=>p.playerKey===data.linkedPlayerKey);
  let reference=null;
  if(mine){
    const initials=mine.name.split(/\s+/).map(word=>word[0]).join("").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4)||"P",base=`Fines-${initials}`;
    const assigned=db.collection("finePaymentReferences").doc(mine.playerKey);
    reference=await db.runTransaction(async tx=>{const existing=await tx.get(assigned);if(existing.exists)return existing.data().reference;
      for(let index=0;index<100;index++){const candidate=base+(index?String(index+1):""),claim=db.collection("fineReferenceOwners").doc(candidate),snap=await tx.get(claim);if(snap.exists&&snap.data().playerKey!==mine.playerKey)continue;tx.set(claim,{playerKey:mine.playerKey});tx.set(assigned,{reference:candidate,playerKey:mine.playerKey});return candidate;}throw new HttpsError("resource-exhausted","Could not assign a payment reference. Contact an admin.");});
  }
  const matching=(await db.collection("bankMatching").doc("starling").get()).data(),automaticMatching=Boolean(matching?.healthy&&matching.enabled!==false&&Date.now()-Date.parse(matching.lastSuccessAt)<15*60000);
  return {season,viewer:{isAdmin,name:data.firstName||"Player",playerKey:mine?.playerKey||null,balance:mine||null,reference,bank:mine?{name:"Nicholas Horne",accountNumber:"78664226",sortCode:"60-83-71"}:null,automaticMatching},updatedAt:new Date().toISOString()};
});

// Publish linked players' public names or unlinked accounts' first names, never emails or surnames.
const { buildCompletions, buildLeaderboard, buildSurvivalLeaderboard } = require("./bot-completions");
let botCompletionCache = null;
let botCompletionCacheAt = 0;
const getMonsterBotCompletions = async request => {
  const response = () => [2,3].includes(request.data?.version) ? botCompletionCache : { ...botCompletionCache, completions: Object.fromEntries(Object.entries(botCompletionCache.completions).map(([key,rows]) => [key, rows.map(row => row.name)])) };
  if (botCompletionCache && Date.now() - botCompletionCacheAt < 30000 && !(request.auth && request.data?.refresh === true)) return response();
  const db = getFirestore();
  const [accounts, profiles] = await Promise.all([
    db.collection("users").select("monsterBotWins", "monsterBotBestScores", "monsterBotStarted", "monsterSurvivalTier2Started", "monsterSurvivalTier2Best", "monsterSurvivalTier2Completed", "monsterSurvivalStarted", "monsterSurvivalBest", "monsterSurvivalCompleted", "linkedPlayerKey", "firstName", "photoUrl", "nationality").get(),
    db.collection("publicPlayers").select("publicName", "photoUrl", "nationality").get()
  ]);
  const users = accounts.docs.map(doc => ({id:doc.id,...doc.data()})), publicProfiles = new Map(profiles.docs.map(doc => [doc.id,doc.data()]));
  botCompletionCache = { completions: buildCompletions(users,publicProfiles), leaderboard: buildLeaderboard(users,publicProfiles), survivalLeaderboard:buildSurvivalLeaderboard(users,publicProfiles), survivalTier2Leaderboard:buildSurvivalLeaderboard(users,publicProfiles,2), updatedAt: new Date().toISOString() };
  botCompletionCacheAt = Date.now();
  return response();
};
exports.getMonsterBotCompletions = onCall(options, getMonsterBotCompletions);
exports.getMonsterBotCommunityEurope = onCall({ ...options, region: "europe-west1" }, getMonsterBotCompletions);
