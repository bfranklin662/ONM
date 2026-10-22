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

// Publish only shortened player names, never account emails or private full names.
const { buildCompletions } = require("./bot-completions");
let botCompletionCache = null;
let botCompletionCacheAt = 0;
exports.getMonsterBotCompletions = onCall(options, async request => {
  const response = () => request.data?.version === 2 ? botCompletionCache : { ...botCompletionCache, completions: Object.fromEntries(Object.entries(botCompletionCache.completions).map(([key,rows]) => [key, rows.map(row => row.name)])) };
  if (botCompletionCache && Date.now() - botCompletionCacheAt < 30000 && !(request.auth && request.data?.refresh === true)) return response();
  const db = getFirestore();
  const [accounts, profiles] = await Promise.all([
    db.collection("users").select("monsterBotWins", "monsterBotBestScores", "linkedPlayerKey").get(),
    db.collection("publicPlayers").select("publicName").get()
  ]);
  botCompletionCache = { completions: buildCompletions(accounts.docs.map(doc => ({ id: doc.id, ...doc.data() })), new Map(profiles.docs.map(doc => [doc.id, doc.data()]))), updatedAt: new Date().toISOString() };
  botCompletionCacheAt = Date.now();
  return response();
});
