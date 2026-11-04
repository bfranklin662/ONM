"use strict";

function createAccountLinker({ db, timestamp, fail }) {
  return async (request) => {
    if (!request.auth?.uid) throw fail("unauthenticated", "Sign in as an administrator.");
    const { accountId, playerKey, expectedPlayerKey } = request.data || {};
    const validId = value => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");
    if (!validId(accountId) || !validId(playerKey) || typeof expectedPlayerKey !== "string") {
      throw fail("invalid-argument", "Choose an account and an existing Monsters player.");
    }
    return db.runTransaction(async transaction => {
      const actorRef = db.collection("users").doc(request.auth.uid);
      const accountRef = db.collection("users").doc(accountId);
      const playerRef = db.collection("players").doc(playerKey);
      const actor = await transaction.get(actorRef);
      if (!actor.exists || actor.data().status !== "Active" || !["owner", "admin"].includes(actor.data().role)) {
        throw fail("permission-denied", "Administrator access required.");
      }
      const account = await transaction.get(accountRef);
      const player = await transaction.get(playerRef);
      if (!account.exists || !player.exists) throw fail("not-found", "That account or player no longer exists. Refresh and try again.");
      const user = account.data();
      if (user.role === "owner" && actor.data().role !== "owner") throw fail("permission-denied", "Only the site owner can change their own player link.");
      if ((user.linkedPlayerKey || "") !== expectedPlayerKey) throw fail("failed-precondition", "This account's link has changed. Refresh accounts and try again.");
      const linked = await transaction.get(db.collection("users").where("linkedPlayerKey", "==", playerKey));
      if (linked.docs.some(doc => doc.id !== accountId)) throw fail("already-exists", "That Monster is already linked to another account. No changes were made.");
      const name = String(player.data().publicName || player.data().fullName || "").trim();
      if (!name) throw fail("failed-precondition", "This player needs a name before linking.");
      const updatedAt = timestamp();
      transaction.update(accountRef, { linkedPlayerKey: playerKey, linkedPlayerName: name, linkedAt: updatedAt, linkedBy: request.auth.uid, accountType: "player", team: "Oche Ness Monsters" });
      // Also write the shared player document so concurrent admin links to the
      // same player cannot both pass the uniqueness check.
      transaction.update(playerRef, { accountLinkUpdatedAt: updatedAt });
      transaction.set(db.collection("linkedPlayers").doc(accountId), {
        userId: accountId, firstName: user.firstName || "", surname: user.surname || "",
        fullName: `${user.firstName || ""} ${user.surname || ""}`.trim(),
        playerName: name, playerKey, linkedPlayerName: name, linkedPlayerKey: playerKey,
        nickname: user.nickname || "", bio: user.bio || "", walkoutSong: user.walkoutSong || "",
        nationality: user.nationality || "", photoUrl: user.photoUrl || "", photo: user.photoUrl || "", updatedAt
      }, { merge: true });
      return { success: true, linkedPlayerKey: playerKey, linkedPlayerName: name };
    });
  };
}

module.exports = { createAccountLinker };
