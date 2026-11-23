(function () {
  "use strict";
  const cache = new Map();
  const thumbnails = new Map();
  const existingPhotos = new Map();
  let dialog, currentResultId, currentUser, changed = false, busy = false;
  let pendingPhotos = [];
  const heicConverterUrl = new URL("vendor/heic-to/heic-to.mjs", document.currentScript.src).href;
  let heicConverter;
  const isHeicPhoto = file => /^image\/(heic|heif)(-sequence)?$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || "");

  async function preparePhoto(file) {
    if (!isHeicPhoto(file)) return file;
    // Prefer the phone's decoder before loading the fallback converter.
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (_) {}
    if (bitmap) {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .9));
        if (jpeg) return jpeg;
      } finally { bitmap.close(); }
    }
    try {
      heicConverter ||= import(heicConverterUrl).catch(error => { heicConverter = null; throw error; });
      const { heicTo } = await heicConverter;
      return await heicTo({ blob: file, type: "image/jpeg", quality: .9 });
    } catch (_) { throw new Error("This HEIC photo could not be converted. Try another photo or export it as JPG."); }
  }
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  async function list(resultId, force = false) {
    if (!resultId || !window.ONMFirebase?.resultPhotos) return [];
    if (force) cache.delete(resultId);
    if (!cache.has(resultId)) cache.set(resultId, window.ONMFirebase.resultPhotos.list(resultId).then(photos => {
      photos.forEach(photo => thumbnails.set(photo.url, photo.thumbnailUrl));
      return photos;
    }).catch(error => { cache.delete(resultId); throw error; }));
    return cache.get(resultId);
  }

  const legacyPhotoCache = new Map();
  async function legacyPhotos(value, force = false) {
    if (!value) return [];
    if (force) legacyPhotoCache.delete(value);
    if (!legacyPhotoCache.has(value)) legacyPhotoCache.set(value, (async () => {
      const folder = value.match(/(?:[?&]id=|\/folders\/)([a-zA-Z0-9_-]+)/);
      if (!/drive\.google\.com\/drive\/folders/i.test(value) || !folder) return value.split(/\r?\n/).map(url => url.trim()).filter(url => /^https?:\/\//i.test(url));
      const query = new URLSearchParams({ q: `'${folder[1]}' in parents and mimeType contains 'image/'`, key: "AIzaSyDlAZ7wv_8BNA1Nes1uBMrbZWhL0aaz1xw", fields: "files(id,name,mimeType)", pageSize: "1000" });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Older match photos are temporarily unavailable.");
        const data = await response.json();
        return (data.files || []).map(file => `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`);
      } finally { clearTimeout(timer); }
    })().catch(error => { legacyPhotoCache.delete(value); throw error; }));
    return legacyPhotoCache.get(value);
  }
  async function loadMatchPhotos(row, force = false) {
    const [existing, shared] = await Promise.allSettled([legacyPhotos(String(row.IMGFOLDER || "").trim(), force), list(row._resultId, force)]);
    const original = existing.status === "fulfilled" ? existing.value : [];
    if (row._resultId) existingPhotos.set(row._resultId, original);
    const member = shared.status === "fulfilled" ? shared.value.map(photo => photo.url) : [];
    return { urls: [...new Set([...original, ...member])], partial: existing.status === "rejected" || shared.status === "rejected" };
  }

  function setup() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "resultPhotoDialog";
    dialog.setAttribute("aria-labelledby", "resultPhotoTitle");
    dialog.innerHTML = `<div class="resultPhotoHeading"><h2 id="resultPhotoTitle">Match photos</h2><button type="button" data-close-photos aria-label="Close match photos">×</button></div>
      <p>Add your photos to this result. Photos are resized for the website and visible to everyone.</p>
      <div id="resultPhotoUploadControls" class="resultPhotoDropzone"><strong>Drop photos here or choose files</strong><label class="resultPhotoPicker">Choose photos<input id="resultPhotoFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"></label><span>Up to 10 photos at a time · JPG, PNG, WebP or HEIC</span><div id="resultPhotoPending" class="resultPhotoList"></div><button id="resultPhotoSubmit" type="button" disabled>Upload photos</button></div>
      <div id="resultPhotoProgress" class="resultPhotoProgress" hidden>
        <label id="resultPhotoProgressLabel" for="resultPhotoProgressBar">Preparing photos…</label>
        <progress id="resultPhotoProgressBar" max="100" value="0" aria-labelledby="resultPhotoProgressLabel"></progress>
        <span id="resultPhotoProgressPercent">0%</span>
      </div>
      <p id="resultPhotoStatus" role="status" aria-live="polite"></p>
      <p id="resultPhotoGalleryNotice" role="status" aria-live="polite"></p>
      <div id="resultPhotoList" class="resultPhotoList"></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close-photos]").addEventListener("click", () => { if (!busy) dialog.close(); });
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    dialog.addEventListener("close", () => {
      clearPending();
      if (changed) document.dispatchEvent(new CustomEvent("onm-result-photos-changed", { detail: { resultId: currentResultId } }));
    });
    dialog.querySelector("#resultPhotoFiles").addEventListener("change", event => {
      stagePhotos(Array.from(event.target.files || []));
      event.target.value = "";
    });
    dialog.querySelector("#resultPhotoSubmit").addEventListener("click", upload);
    dialog.querySelector("#resultPhotoPending").addEventListener("click", event => {
      const button = event.target.closest("[data-remove-pending]");
      if (!button || busy) return;
      const index = Number(button.dataset.removePending);
      URL.revokeObjectURL(pendingPhotos[index].url);
      pendingPhotos.splice(index, 1);
      renderPending();
    });
    dialog.querySelector("#resultPhotoList").addEventListener("click", async event => {
      const button = event.target.closest("button[data-remove-photo]");
      if (!button || busy || !window.confirm("Remove this photo from the match gallery?")) return;
      setBusy(true);
      try {
        await window.ONMFirebase.resultPhotos.remove(currentResultId, button.dataset.removePhoto);
        changed = true;
        await render(true);
        status("Photo removed.");
      } catch (error) { status(error.message || "Could not remove that photo."); }
      finally { setBusy(false); }
    });
  }

  function status(message, success = false) {
    const element = dialog.querySelector("#resultPhotoStatus");
    element.textContent = message;
    element.classList.toggle("resultPhotoSuccess", success);
  }
  function clearPending() {
    pendingPhotos.forEach(photo => URL.revokeObjectURL(photo.url));
    pendingPhotos = [];
    renderPending();
  }
  function renderPending() {
    dialog.querySelector("#resultPhotoPending").innerHTML = pendingPhotos.map((photo, index) => `<figure><img src="${escape(photo.url)}" alt="${escape(photo.file.name)}"><figcaption>${escape(photo.file.name)}</figcaption><button type="button" data-remove-pending="${index}"${busy ? " disabled" : ""}>Remove</button></figure>`).join("");
    const submit = dialog.querySelector("#resultPhotoSubmit");
    submit.disabled = busy || !pendingPhotos.length;
    submit.hidden = !pendingPhotos.length;
    submit.textContent = `Upload ${pendingPhotos.length} ${pendingPhotos.length === 1 ? "photo" : "photos"}`;
  }
  async function stagePhotos(files) {
    if (busy || !currentUser || !files.length) return;
    if (files.length + pendingPhotos.length > 10) { status("Choose up to 10 photos at a time. Remove some before adding more."); return; }
    let rejected = 0, conversionError = "";
    setBusy(true);
    try {
      for (const [index, file] of files.entries()) {
        if ((!isHeicPhoto(file) && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 20 * 1024 * 1024 || !file.size) { rejected++; continue; }
        if (pendingPhotos.some(photo => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified)) continue;
        try {
          if (isHeicPhoto(file)) { status(`Converting iPhone photo ${index + 1} of ${files.length}…`); progress(index / files.length * 100, "Preparing HEIC preview…"); }
          const prepared = await preparePhoto(file);
          pendingPhotos.push({ file, prepared, url: URL.createObjectURL(prepared) });
          renderPending();
        } catch (error) { rejected++; conversionError ||= error.message; }
      }
    } finally { setBusy(false); }
    dialog.querySelector("#resultPhotoProgress").hidden = true;
    renderPending();
    status(rejected ? `${rejected} files were not added. ${conversionError || "Use JPG, PNG, WebP or HEIC under 20 MB."}` : "Preview your photos, then select Upload photos to save them.");
  }
  function progress(value, label) {
    dialog.querySelector("#resultPhotoProgress").hidden = false;
    const percent = Math.max(0, Math.min(100, Math.round(value)));
    dialog.querySelector("#resultPhotoProgressBar").value = percent;
    dialog.querySelector("#resultPhotoProgressPercent").textContent = `${percent}%`;
    dialog.querySelector("#resultPhotoProgressLabel").textContent = label;
  }
  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll("button,input").forEach(input => { input.disabled = value; });
    renderPending();
  }
  async function render(force = false) {
    const oldPhotos = (existingPhotos.get(currentResultId) || []).map(url => ({ url, thumbnailUrl: thumbnails.get(url) || url }));
    const draw = photos => {
      const combined = [...new Map([...oldPhotos, ...photos].map(photo => [photo.url, photo])).values()];
      dialog.querySelector("#resultPhotoList").innerHTML = combined.map(photo => `<figure>
      <a href="${escape(photo.url)}" target="_blank" rel="noopener"><img src="${escape(photo.thumbnailUrl)}" alt="Match photo" loading="lazy"></a>
      ${photo.id && currentUser && (photo.uploaderUid === currentUser.uid || ["admin", "owner"].includes(currentUser.role)) ? `<button type="button" data-remove-photo="${escape(photo.id)}"${busy ? " disabled" : ""}>Remove photo</button>` : ""}</figure>`).join("");
      return combined.length;
    };
    draw([]);
    const notice = dialog.querySelector("#resultPhotoGalleryNotice");
    notice.textContent = "";
    try {
      const photos = await list(currentResultId, force);
      if (!draw(photos)) dialog.querySelector("#resultPhotoList").innerHTML = "<p>No photos added to this match yet.</p>";
    } catch (error) {
      // Gallery reads are independent of uploads. Keep older photos visible.
      console.warn("Could not load member photo gallery:", error.message);
      notice.textContent = "Some match photos are temporarily unavailable. Existing photos are shown below where available.";
    }
  }

  async function open(resultId, files = []) {
    if (busy) return;
    setup();
    clearPending();
    currentResultId = resultId;
    currentUser = null;
    changed = false;
    dialog.querySelector("#resultPhotoList").innerHTML = "";
    dialog.querySelector("#resultPhotoUploadControls").hidden = true;
    dialog.querySelector("#resultPhotoProgress").hidden = true;
    dialog.querySelector("#resultPhotoGalleryNotice").textContent = "";
    status("Loading photos…");
    dialog.showModal();
    setBusy(true);
    try {
      currentUser = await window.ONMFirebase.loadOwnUser();
      if (currentUser?.status !== "Active") currentUser = null;
      dialog.querySelector("#resultPhotoUploadControls").hidden = !currentUser;
      await render(true);
      if (currentUser) status("Choose photos to add to this result.");
      else {
        status("Sign in to add photos. ");
        const link = document.createElement("a");
        link.href = `auth.html?mode=login&redirect=${encodeURIComponent(location.pathname + location.search)}`;
        link.textContent = "Sign in";
        dialog.querySelector("#resultPhotoStatus").appendChild(link);
      }
    } catch { status("Could not check your sign-in. Please close and try again."); }
    finally { setBusy(false); }
    if (files.length) stagePhotos(files);
  }

  async function compress(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose JPG, PNG or WebP photos.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Choose an original photo smaller than 20 MB.");
    let image;
    try { image = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { throw new Error("This photo could not be opened. Try saving it as a JPG first."); }
    async function encode(maxSide, maxBytes) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= maxBytes) return blob;
      }
      throw new Error("This photo could not be compressed enough. Try a smaller image.");
    }
    try { return await Promise.all([encode(1600, 800 * 1024), encode(400, 100 * 1024)]); }
    finally { image.close(); }
  }

  async function upload() {
    const batch = [...pendingPhotos];
    const files = batch.map(photo => photo.file);
    if (!files.length || busy || !currentUser) return;
    setBusy(true);
    progress(0, "Preparing photos…");
    let added = 0, failed = 0, firstError = "";
    try {
      for (const [index, file] of files.entries()) {
        const label = `Photo ${index + 1} of ${files.length}`;
        progress(index / files.length * 100, `${label}: preparing…`);
        status(`Uploading ${files.length} ${files.length === 1 ? "photo" : "photos"}…`);
        try {
          const [image, thumbnail] = await compress(batch[index].prepared || file);
          await window.ONMFirebase.resultPhotos.upload(currentResultId, image, thumbnail, update => {
            const fraction = update.phase === "complete" ? 1 : update.phase === "saving" ? 0.95 : 0.1 + 0.85 * update.bytesTransferred / update.totalBytes;
            progress((index + fraction) / files.length * 100, `${label}: ${update.phase === "saving" ? "saving…" : "uploading…"}`);
          });
          added++;
          const saved = batch[index];
          URL.revokeObjectURL(saved.url);
          pendingPhotos = pendingPhotos.filter(photo => photo !== saved);
        } catch (error) { failed++; firstError ||= error.message; console.warn("Match photo upload failed:", error.message); }
        progress((index + 1) / files.length * 100, `${index + 1} of ${files.length} processed`);
      }
      changed = changed || added > 0;
      renderPending();
      await render(true);
      status(`${added} ${added === 1 ? "photo added" : "photos added"}.${failed ? ` ${failed} could not be uploaded. ${firstError}` : " ✓ Upload complete. Your photos are saved."}`, failed === 0);
    } catch { status("Could not refresh the gallery. Close and reopen to check which photos were saved."); }
    finally { setBusy(false); }
  }

  let canAddPhotos = false;
  function updatePhotoButtons() {
    document.querySelectorAll(".match-image-grid[data-photo-count]").forEach(grid => {
      const canUpload = canAddPhotos && Boolean(grid.querySelector("[data-add-result-photos]"));
      const limit = canUpload ? 7 : 8;
      const count = Number(grid.dataset.photoCount);
      grid.querySelectorAll("[data-photo-index]").forEach(slot => {
        const index = Number(slot.dataset.photoIndex);
        slot.hidden = index >= limit;
        const extra = Math.max(0, count - limit);
        slot.classList.toggle("image-count-overlay", index === Math.min(count, limit) - 1 && extra > 0);
        slot.dataset.extra = index === limit - 1 && extra > 0 ? `+${extra}` : "";
      });
    });
    document.querySelectorAll("[data-add-result-photos]").forEach(button => {
      button.hidden = !canAddPhotos;
    });
  }
  new MutationObserver(updatePhotoButtons).observe(document.getElementById("resultsGrid") || document.body, { childList: true, subtree: true });
  window.ONMFirebase?.ready.then(({ auth, authSdk }) => {
    authSdk.onAuthStateChanged(auth, user => {
      canAddPhotos = Boolean(user);
      updatePhotoButtons();
    });
  }).catch(() => { canAddPhotos = false; updatePhotoButtons(); });
  updatePhotoButtons();

  const dropTarget = event => event.target.closest?.("[data-add-result-photos], #resultPhotoUploadControls");
  document.addEventListener("dragover", event => {
    const target = dropTarget(event);
    if (!target || !canAddPhotos || target.hidden || busy) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    target.classList.add("resultPhotoDragging");
  });
  document.addEventListener("dragleave", event => {
    const target = dropTarget(event);
    if (target && !target.contains(event.relatedTarget)) target.classList.remove("resultPhotoDragging");
  });
  document.addEventListener("drop", async event => {
    const target = dropTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("resultPhotoDragging");
    if (!canAddPhotos || target.hidden || busy) return;
    const files = Array.from(event.dataTransfer.files || []);
    if (target.matches("[data-add-result-photos]")) await open(decodeURIComponent(target.dataset.addResultPhotos), files);
    else stagePhotos(files);
  });

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-add-result-photos]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    open(decodeURIComponent(button.dataset.addResultPhotos));
  });
  window.ONMResultPhotos = {
    list,
    loadMatchPhotos,
    thumbnail: url => thumbnails.get(url) || url,
    setExisting(resultId, urls) { if (resultId) existingPhotos.set(resultId, urls); }
  };
})();
