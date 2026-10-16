"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../scripts/firebase-client.js"), "utf8");

function harness() {
  const user = { uid: "member-one", status: "Active", role: "member", accountType: "supporter" };
  const documents = new Map([["results/match-one", { season: "26-27", sheetRow: { HomeScore: 4, AwayScore: 5, F1: 6.8 } }]]);
  const objects = new Map(), deleted = [], writes = [];
  const settings = { loggedIn: true, uploadFailure: false, metadataFailure: "", cannotReadMetadata: false };
  let counter = 0;
  const sdk = {
    collection: (_, ...segments) => ({ path: segments.join("/") }),
    doc(first, ...segments) {
      const path = segments.length ? segments.join("/") : `${first.path}/photo${++counter}`;
      return { path, id: path.split("/").at(-1) };
    },
    async getDoc(ref) {
      if (settings.cannotReadMetadata && ref.path.includes("/photos/")) throw new Error("unavailable");
      return { exists: () => documents.has(ref.path), data: () => documents.get(ref.path) };
    },
    async getDocs(ref) { return { docs: [...documents].filter(([key]) => key.startsWith(ref.path + "/")).map(([key, data]) => ({ id: key.split("/").at(-1), data: () => data })) }; },
    async setDoc(ref, data) {
      writes.push(ref.path);
      if (settings.metadataFailure === "before") throw new Error("save failed");
      documents.set(ref.path, data);
      if (settings.metadataFailure === "after") throw new Error("response timed out");
    },
    async deleteDoc(ref) { documents.delete(ref.path); },
    serverTimestamp: () => ({ toMillis: () => counter })
  };
  const storageSdk = {
    ref: (_, path) => path,
    async uploadBytes(ref, blob) {
      if (settings.uploadFailure && ref.endsWith("thumbnail.jpg")) throw new Error("upload failed");
      objects.set(ref, blob);
    },
    async deleteObject(ref) { deleted.push(ref); objects.delete(ref); },
    async getDownloadURL(ref) { if (!objects.has(ref)) throw new Error("missing image"); return `https://example.test/${ref}`; }
  };
  const context = { Blob, Promise, loadOwnUser: async () => settings.loggedIn ? user : null,
    ready: Promise.resolve({ db: {}, storage: {}, firestoreSdk: sdk, storageSdk }) };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("  function validResultPhotoPath("), source.indexOf("  async function getPublicSeasonResults(")), context);
  const image = new Blob(["jpeg-image"], { type: "image/jpeg" });
  return { user, documents, objects, deleted, writes, settings, context, image };
}

test("active signed-in supporters can add photos without touching scores or fines", async () => {
  const h = harness();
  const before = JSON.stringify(h.documents.get("results/match-one"));
  const id = await h.context.uploadSharedResultPhoto("match-one", h.image, h.image);
  assert.equal(id, "photo1");
  assert.deepEqual(h.writes, ["results/match-one/photos/photo1"]);
  assert.equal(h.objects.size, 2);
  assert.equal(JSON.stringify(h.documents.get("results/match-one")), before);
  const photos = await h.context.listResultPhotos("match-one");
  assert.equal(photos.length, 1);
  assert(photos[0].thumbnailUrl.endsWith("thumbnail.jpg"));
});

test("each contribution has unique paths, even when uploading the same image", async () => {
  const h = harness();
  await h.context.uploadSharedResultPhoto("match-one", h.image, h.image);
  await h.context.uploadSharedResultPhoto("match-one", h.image, h.image);
  assert.equal(h.objects.size, 4);
  assert.equal((await h.context.listResultPhotos("match-one")).length, 2);
});

test("visitors, inactive users, missing results and oversize images are rejected", async () => {
  const h = harness();
  h.settings.loggedIn = false;
  await assert.rejects(h.context.uploadSharedResultPhoto("match-one", h.image, h.image), /Sign in/);
  h.settings.loggedIn = true;
  h.user.status = "Inactive";
  await assert.rejects(h.context.uploadSharedResultPhoto("match-one", h.image, h.image), /active account/);
  h.user.status = "Active";
  await assert.rejects(h.context.uploadSharedResultPhoto("missing", h.image, h.image), /no longer exists/);
  const large = new Blob([new Uint8Array(1024 * 1024 + 1)], { type: "image/jpeg" });
  await assert.rejects(h.context.uploadSharedResultPhoto("match-one", large, h.image), /too large/);
  assert.equal(h.objects.size, 0);
});

test("partial uploads and failed metadata saves clean up only their own files", async () => {
  for (const failure of ["upload", "metadata"]) {
    const h = harness();
    h.settings.uploadFailure = failure === "upload";
    h.settings.metadataFailure = failure === "metadata" ? "before" : "";
    await assert.rejects(h.context.uploadSharedResultPhoto("match-one", h.image, h.image));
    assert.equal(h.objects.size, 0);
    assert(h.documents.has("results/match-one"));
  }
});

test("a lost success response never deletes successfully published photos", async () => {
  const h = harness();
  h.settings.metadataFailure = "after";
  await assert.rejects(h.context.uploadSharedResultPhoto("match-one", h.image, h.image));
  assert.equal(h.objects.size, 2);
  assert.equal((await h.context.listResultPhotos("match-one")).length, 1);
  assert.equal(h.deleted.length, 0);
});

test("uploaders and admins can remove photos but another member cannot", async () => {
  const h = harness();
  const id = await h.context.uploadSharedResultPhoto("match-one", h.image, h.image);
  h.user.uid = "another-member";
  await assert.rejects(h.context.removeSharedResultPhoto("match-one", id), /Only the uploader/);
  assert.equal(h.objects.size, 2);
  h.user.role = "admin";
  await h.context.removeSharedResultPhoto("match-one", id);
  assert.equal(h.objects.size, 0);
  assert(h.documents.has("results/match-one"));
  assert(!h.documents.has(`results/match-one/photos/${id}`));
});

test("forged storage paths cannot list or delete another match's files", async () => {
  const h = harness();
  h.documents.set("results/match-one/photos/forged", { uploaderUid: h.user.uid, storagePath: "result-photos/other-match/member-one/photo" });
  assert.equal((await h.context.listResultPhotos("match-one")).length, 0);
  await assert.rejects(h.context.removeSharedResultPhoto("match-one", "forged"), /needs checking/);
  assert.equal(h.deleted.length, 0);
});

test("a partially removed photo remains manageable and removal can be retried", async () => {
  const h = harness();
  const id = await h.context.uploadSharedResultPhoto("match-one", h.image, h.image);
  h.objects.delete(`result-photos/match-one/${h.user.uid}/${id}/image.jpg`);
  const photos = await h.context.listResultPhotos("match-one");
  assert.equal(photos.length, 1);
  assert(photos[0].url.endsWith("thumbnail.jpg"));
  await h.context.removeSharedResultPhoto("match-one", id);
  assert.equal(h.objects.size, 0);
  assert(!h.documents.has(`results/match-one/photos/${id}`));
});

test("existing Drive photos and direct images are combined with shared uploads", async () => {
  const resultSource = fs.readFileSync(path.join(__dirname, "../scripts/results.js"), "utf8");
  const context = { window: { ONMResultPhotos: { list: async () => [{ url: "https://example.test/shared.jpg" }] } },
    fetchDriveImages: async () => ["https://example.test/drive.jpg"], console };
  vm.createContext(context);
  vm.runInContext(resultSource.slice(resultSource.indexOf("async function fetchMatchImages("), resultSource.indexOf("// 🔹 Restore saved preferences")), context);
  assert.equal((await context.fetchMatchImages({ _resultId: "match-one" })).length, 1);
  assert.deepEqual(Array.from(await context.fetchMatchImages({ IMGFOLDER: "https://drive.google.com/drive/folders/abc" })), ["https://example.test/drive.jpg", "https://example.test/shared.jpg"]);
  assert.equal((await context.fetchMatchImages({ IMGFOLDER: "https://example.test/shared.jpg" })).length, 1);
});

test("compression limits dimensions, produces thumbnails and rejects unsupported files", async () => {
  const ui = fs.readFileSync(path.join(__dirname, "../scripts/result-photos.js"), "utf8");
  const canvases = [];
  let closed = false;
  const context = { createImageBitmap: async () => ({ width: 4000, height: 3000, close() { closed = true; } }),
    document: { createElement() { const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob(callback) { callback(new Blob(["jpeg"], { type: "image/jpeg" })); } }; canvases.push(canvas); return canvas; } }, Blob };
  vm.createContext(context);
  vm.runInContext(ui.slice(ui.indexOf("  async function compress("), ui.indexOf("  async function upload(")), context);
  const pair = await context.compress({ type: "image/jpeg", size: 5000000 });
  assert.equal(canvases[0].width, 1600);
  assert.equal(canvases[0].height, 1200);
  assert.equal(canvases[1].width, 400);
  assert(pair.every(blob => blob.type === "image/jpeg"));
  assert(closed);
  await assert.rejects(context.compress({ type: "image/heic", size: 1000 }), /JPG, PNG or WebP/);
  await assert.rejects(context.compress({ type: "image/jpeg", size: 21000000 + 1024 * 1024 }), /smaller than 20 MB/);
});
