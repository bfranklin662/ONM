const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountLinker } = require("./account-link");

function setup({ actor = { status: "Active", role: "owner" }, user = { role: "member", firstName: "Phil", photoUrl: "photo", botProgress: { wins: 10 } }, player = { publicName: "Phil L" }, taken = false } = {}) {
  const writes = [];
  const db = {
    collection: collection => ({ doc: id => ({ collection, id }), where: () => ({ query: true }) }),
    runTransaction: work => work({
      get: async ref => ref.query ? { docs: taken ? [{ id: "other" }] : [] } : {
        exists: ref.collection === "players" ? !!player : ref.id === "actor" ? !!actor : !!user,
        data: () => ref.collection === "players" ? player : ref.id === "actor" ? actor : user
      },
      update: (ref, values) => writes.push({ ref, values }),
      set: (ref, values, options) => writes.push({ ref, values, options })
    })
  };
  return { writes, link: createAccountLinker({ db, timestamp: () => "now", fail: (code, message) => Object.assign(new Error(message), { code }) }) };
}
const request = { auth: { uid: "actor" }, data: { accountId: "account", playerKey: "phil-l", expectedPlayerKey: "" } };
test("owner links both account records atomically without overwriting progress or payments", async () => {
  const { link, writes } = setup();
  assert.equal((await link(request)).linkedPlayerName, "Phil L");
  assert.equal(writes.length, 3);
  assert.equal(writes[0].values.linkedPlayerKey, "phil-l");
  assert.equal(writes[0].values.team, "Oche Ness Monsters");
  assert.equal(writes[0].values.role, undefined);
  assert.equal(writes[0].values.botProgress, undefined);
  assert.equal(writes[1].ref.collection, "players");
  assert.equal(writes[2].ref.collection, "linkedPlayers");
  assert.equal(writes[2].values.photoUrl, "photo");
  assert.deepEqual(writes[2].options, { merge: true });
});
test("active admins can link ordinary player accounts", async () => {
  await setup({ actor: { role: "admin", status: "Active" } }).link(request);
});
test("guests, members, inactive admins and admins editing owners cannot link", async () => {
  await assert.rejects(setup().link({}), { code: "unauthenticated" });
  for (const actor of [{ role: "member", status: "Active" }, { role: "admin", status: "Inactive" }]) {
    const { link, writes } = setup({ actor });
    await assert.rejects(link(request), { code: "permission-denied" });
    assert.equal(writes.length, 0);
  }
  await assert.rejects(setup({ actor: { role: "admin", status: "Active" }, user: { role: "owner" } }).link(request), { code: "permission-denied" });
});
test("duplicates, stale changes, invalid ids and missing players cause no writes", async () => {
  for (const [settings, code] of [[{ taken: true }, "already-exists"], [{ user: { linkedPlayerKey: "old" } }, "failed-precondition"], [{ player: null }, "not-found"]]) {
    const { link, writes } = setup(settings);
    await assert.rejects(link(request), { code });
    assert.equal(writes.length, 0);
  }
  await assert.rejects(setup().link({ ...request, data: { ...request.data, playerKey: "bad/id" } }), { code: "invalid-argument" });
});
test("relinking updates the existing account projection rather than creating a new player", async () => {
  const { link, writes } = setup({ user: { role: "member", linkedPlayerKey: "old", firstName: "Phil" } });
  await link({ ...request, data: { ...request.data, expectedPlayerKey: "old" } });
  assert.equal(writes[0].values.linkedPlayerKey, "phil-l");
  assert.equal(writes.filter(write => write.ref.collection === "linkedPlayers").length, 1);
});
