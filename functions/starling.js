"use strict";

// Only this server-side adapter receives the secret. Never return API bodies or
// upstream errors to clients: either can contain private banking information.
async function readStarlingAccounts(token, fetcher = fetch) {
  if (!token || token !== token.trim() || /[\r\n]/.test(token)) throw new Error("STARLING_TOKEN_INVALID");
  const response = await fetcher("https://api.starlingbank.com/api/v2/accounts", {
    headers: {Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "ONM-Fines-Matching"},
    signal: AbortSignal.timeout(15000), redirect: "error"
  });
  if (!response.ok) throw new Error(`STARLING_HTTP_${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.accounts)) throw new Error("STARLING_RESPONSE_INVALID");
  return data.accounts.filter(a => a.currency === "GBP" && a.accountUid && a.defaultCategory);
}

// Deliberately exact (except letter case and surrounding whitespace): no fuzzy
// names/initials matching, pending payments, debits or non-GBP payments.
function eligiblePayment(item, references, activatedAt) {
  const amount = item.amount?.minorUnits;
  const date = Date.parse(item.transactionTime);
  if (!item.feedItemUid || item.direction !== "IN" || item.status !== "SETTLED" ||
      item.source !== "FASTER_PAYMENTS_IN" || item.amount?.currency !== "GBP" ||
      !Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(date) ||
      !Number.isFinite(Date.parse(activatedAt)) || date < Date.parse(activatedAt)) return null;
  const reference = String(item.reference || "").trim().toUpperCase();
  const matches = references.filter(r => String(r.reference || "").trim().toUpperCase() === reference && r.playerKey);
  if (!reference || matches.length !== 1) return null;
  return {transactionId: item.feedItemUid, playerKey: matches[0].playerKey, amountPence: amount};
}
module.exports = {readStarlingAccounts, eligiblePayment};
