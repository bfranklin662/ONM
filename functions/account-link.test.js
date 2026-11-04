const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountLinker } = require("./account-link");

function setup({ actor = { status: "Active", role: "owner" }, user = { role: "member", firstName: "Phil", photoUrl: "photo", botProgress: { wins: 10 } }, player = { publicName: "Phil L" }, taken = false, roster = [] } = {}) {
  const writes = [];
  const db = {
    collection: collection => ({ collection, doc: id => ({ collection, id }), where: () => ({ query: true }) }),
    runTransaction: work => work({
      get: async ref => ref.query ? { docs: taken ? [{ id: "other" }] : [] } : !ref.id ? { docs: roster.map(data => ({ data: () => data })) } : {
        exists: ref.collection === "players" ? !!player : ref.id === "actor" ? !!actor : !!user,
        data: () => ref.collection === "players" ? player : ref.id === "actor" ? actor : user
      },
      update: (ref, values) => writes.push({ ref, values }),
      create: (ref, values) => writes.push({ ref, values, created: true }),
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
const createRequest = { ...request, data: { accountId: "account", expectedPlayerKey: "", newPlayer: { fullName: "New Monster", publicName: "New M" } } };
test("creates and links a Monster with no appearances, payments or invented match history", async () => {
  const { link, writes } = setup({ player: null });
  const result = await link(createRequest);
  assert.equal(result.player.playerKey, "new-m");
  assert.equal(writes.length, 4);
  const privatePlayer = writes.find(write => write.ref.collection === "players");
  assert.equal(privatePlayer.created, true);
  assert.deepEqual(privatePlayer.values.registrationPaidSeasons, []);
  assert.equal(privatePlayer.values.appearances, undefined);
  assert.equal(writes.some(write => ["results", "finePayments"].includes(write.ref.collection)), false);
  assert.equal(writes.find(write => write.ref.collection === "publicPlayers").values.publicName, "New M");
});
test("new Monster creation rejects existing ids, names and aliases without any writes", async () => {
  for (const settings of [{}, { player: null, roster: [{ fullName: "new monster" }] }, { player: null, roster: [{ aliases: ["New M"] }] }]) {
    const { link, writes } = setup(settings);
    await assert.rejects(link(createRequest), { code: "already-exists" });
    assert.equal(writes.length, 0);
  }
});
test("new Monsters need both valid names and an authorized administrator", async () => {
  await assert.rejects(setup().link({ ...createRequest, data: { ...createRequest.data, newPlayer: { fullName: "New" } } }), { code: "invalid-argument" });
  const { link, writes } = setup({ player: null, actor: { status: "Active", role: "member" } });
  await assert.rejects(link(createRequest), { code: "permission-denied" });
  assert.equal(writes.length, 0);
});
