(function () {
  "use strict";

  const loading = document.getElementById("accountLoading");
  const app = document.getElementById("accountApp");
  const form = document.getElementById("accountForm");
  const message = document.getElementById("accountMessage");
  let user = null;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
  }

  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
    message.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function displayName(value) {
    return clean(`${value.firstName || ""} ${value.surname || ""}`) || value.linkedPlayerName || "My account";
  }

  function updateLocalUser(changes) {
    user = { ...user, ...changes };
    localStorage.setItem("onmUser", JSON.stringify(user));
  }

  function populate() {
    document.getElementById("accountName").textContent = displayName(user);
    document.getElementById("accountLinkedPlayer").textContent = user.linkedPlayerName
      ? `Linked to ${user.linkedPlayerName}`
      : "This account is not linked to an ONM player yet.";
    document.getElementById("accountPhoto").src = user.photoUrl || user.photo || "graphics/logoWoText.png";
    document.getElementById("accountRole").textContent = clean(user.role || "member").replace(/^./, character => character.toUpperCase());
    document.getElementById("accountStatus").textContent = user.status || "Active";
    document.getElementById("accountPlayer").textContent = user.linkedPlayerName || "Not linked";
    document.getElementById("accountAdminCard").classList.toggle("hidden", !["owner", "admin"].includes(user.role));

    ["firstName", "surname", "email", "team", "nationality", "nickname", "walkoutSong", "bio"].forEach(field => {
      const input = form.elements[field];
      if (input) input.value = user[field] || "";
    });

    const actions = document.getElementById("accountHeroActions");
    actions.innerHTML = user.linkedPlayerName
      ? `<a class="btn btnGhost" href="player-profile.html?name=${encodeURIComponent(user.linkedPlayerName)}">View player profile</a>`
      : "";
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const data = new FormData(form);
      const profile = Object.fromEntries(["firstName", "surname", "email", "team", "nationality", "nickname", "walkoutSong", "bio"]
        .map(field => [field, clean(data.get(field))]));
      const result = await window.ONMFirebase.post({ action: "updateProfile", profile });
      if (!result.success) throw new Error(result.error || "Could not save your profile.");
      updateLocalUser(profile);
      populate();
      showMessage("Your account details have been saved.");
    } catch (error) {
      showMessage(error.message || "Could not save your profile.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Save changes";
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showMessage("Please choose a JPG, PNG, or WebP image.", true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showMessage("Please choose an image smaller than 8 MB.", true);
      return;
    }
    try {
      showMessage("Uploading your new profile picture…");
      const result = await window.ONMFirebase.post({
        action: "uploadProfilePhoto",
        imageBase64: await fileAsBase64(file),
        fileName: file.name,
        mimeType: file.type
      });
      if (!result.success) throw new Error(result.error || "Could not upload your picture.");
      updateLocalUser({ photoUrl: result.photoUrl, photo: result.photoUrl });
      document.getElementById("accountPhoto").src = result.photoUrl;
      showMessage("Your profile picture has been updated.");
    } catch (error) {
      showMessage(error.message || "Could not upload your picture.", true);
    } finally {
      event.target.value = "";
    }
  }

  async function logout() {
    const button = document.getElementById("accountLogout");
    button.disabled = true;
    button.textContent = "Logging out…";
    try {
      await window.ONMFirebase.signOut();
    } finally {
      localStorage.removeItem("onmUser");
      window.location.href = "index.html";
    }
  }

  async function initialise() {
    try {
      user = await window.ONMFirebase.loadOwnUser();
      if (!user) {
        const redirect = encodeURIComponent("account.html");
        window.location.replace(`auth.html?redirect=${redirect}&mode=login`);
        return;
      }
      localStorage.setItem("onmUser", JSON.stringify(user));
      populate();
      form.addEventListener("submit", saveProfile);
      document.getElementById("accountPhotoInput").addEventListener("change", uploadPhoto);
      document.getElementById("accountLogout").addEventListener("click", logout);
      loading.classList.add("hidden");
      app.classList.remove("hidden");
    } catch (error) {
      loading.innerHTML = `<h2>Could not load your account</h2><p>${escapeHtml(error.message || "Please try again.")}</p><a class="btn btnGhost" href="index.html">Back to website</a>`;
    }
  }

  initialise();
})();
