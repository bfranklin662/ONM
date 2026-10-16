(function () {
  "use strict";
  const cache = new Map();
  const thumbnails = new Map();
  let dialog, currentResultId, currentUser, changed = false, busy = false;
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

  function setup() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "resultPhotoDialog";
    dialog.setAttribute("aria-labelledby", "resultPhotoTitle");
    dialog.innerHTML = `<div class="resultPhotoHeading"><h2 id="resultPhotoTitle">Match photos</h2><button type="button" data-close-photos aria-label="Close match photos">×</button></div>
      <p>Add your photos to this result. Photos are resized for the website and visible to everyone.</p>
      <div id="resultPhotoUploadControls"><label class="resultPhotoPicker">Choose photos<input id="resultPhotoFiles" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><span>Up to 10 photos at a time · JPG, PNG or WebP</span></div>
      <p id="resultPhotoStatus" role="status" aria-live="polite"></p><div id="resultPhotoList" class="resultPhotoList"></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close-photos]").addEventListener("click", () => { if (!busy) dialog.close(); });
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    dialog.addEventListener("close", () => {
      if (changed) document.dispatchEvent(new CustomEvent("onm-result-photos-changed", { detail: { resultId: currentResultId } }));
    });
    dialog.querySelector("#resultPhotoFiles").addEventListener("change", upload);
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

  function status(message) { dialog.querySelector("#resultPhotoStatus").textContent = message; }
  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll("button,input").forEach(input => { input.disabled = value; });
  }
  async function render(force = false) {
    const photos = await list(currentResultId, force);
    dialog.querySelector("#resultPhotoList").innerHTML = photos.map(photo => `<figure>
      <a href="${escape(photo.url)}" target="_blank" rel="noopener"><img src="${escape(photo.thumbnailUrl)}" alt="Match photo" loading="lazy"></a>
      ${currentUser && (photo.uploaderUid === currentUser.uid || ["admin", "owner"].includes(currentUser.role)) ? `<button type="button" data-remove-photo="${escape(photo.id)}"${busy ? " disabled" : ""}>Remove photo</button>` : ""}</figure>`).join("") || "<p>No member photos yet. Existing match photos remain in the result gallery.</p>";
  }

  async function open(resultId) {
    if (busy) return;
    setup();
    currentResultId = resultId;
    currentUser = null;
    changed = false;
    dialog.querySelector("#resultPhotoList").innerHTML = "";
    dialog.querySelector("#resultPhotoUploadControls").hidden = true;
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
    } catch { status("Photos could not be loaded. Please close and try again."); }
    finally { setBusy(false); }
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

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || busy) return;
    if (files.length > 10) { status("Choose up to 10 photos at a time."); return; }
    setBusy(true);
    let added = 0, failed = 0, firstError = "";
    try {
      for (const file of files) {
        status(`Uploading photo ${added + failed + 1} of ${files.length}…`);
        try {
          const [image, thumbnail] = await compress(file);
          await window.ONMFirebase.resultPhotos.upload(currentResultId, image, thumbnail);
          added++;
        } catch (error) { failed++; firstError ||= error.message; console.warn("Match photo upload failed:", error.message); }
      }
      changed = true;
      await render(true);
      status(`${added} ${added === 1 ? "photo added" : "photos added"}.${failed ? ` ${failed} could not be uploaded. ${firstError}` : " Close to see the updated result gallery."}`);
    } catch { status("Could not refresh the gallery. Close and reopen to check which photos were saved."); }
    finally { setBusy(false); }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-add-result-photos]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    open(decodeURIComponent(button.dataset.addResultPhotos));
  });
  window.ONMResultPhotos = { list, thumbnail: url => thumbnails.get(url) || url };
})();
