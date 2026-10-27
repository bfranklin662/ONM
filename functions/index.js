"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
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
