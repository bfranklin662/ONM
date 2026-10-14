(function () {
  "use strict";

  const loading = document.getElementById("accountLoading");
  const app = document.getElementById("accountApp");
  const form = document.getElementById("accountForm");
  const message = document.getElementById("accountMessage");
  let user = null;
  let linkedProfile = null;

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
    document.getElementById("accountPhoto").src = user.photoUrl || user.photo || user.linkedPhotoUrl || "graphics/logoWoText.png";
    document.getElementById("accountRole").textContent = clean(user.role || "member").replace(/^./, character => character.toUpperCase());
    document.getElementById("accountStatus").textContent = user.status || "Active";
    document.getElementById("accountPlayer").textContent = user.linkedPlayerName || "Not linked";
    document.getElementById("accountAdminCard").classList.toggle("hidden", !["owner", "admin"].includes(user.role));

    ["firstName", "surname", "email", "team", "nationality", "nickname", "walkoutSong", "bio", "playerRole", "highestCheckout", "accolades"].forEach(field => {
      const input = form.elements[field];
      if (input) input.value = user[field] || "";
    });
    form.elements.gooch.checked = user.gooch === "yes" || user.gooch === true;

    const actions = document.getElementById("accountHeroActions");
    actions.innerHTML = user.linkedPlayerName
      ? `<a class="btn btnGhost" href="player-profile.html?name=${encodeURIComponent(user.linkedPlayerName)}">View player profile</a>`
      : "";
  }

  async function loadLinkedPlayerProfile() {
    if (!user.linkedPlayerName) return;
    try {
      const result = await window.ONMFirebase.post({ action: "getPublicPlayerProfiles" });
      linkedProfile = (result.profiles || []).find(profile =>
        profile.playerKey === user.linkedPlayerKey || profile.publicName === user.linkedPlayerName
      );
    } catch { }
    if (!linkedProfile) return;

    const profileValues = {
      nickname: linkedProfile.nickname || user.nickname || "",
      bio: linkedProfile.bio || user.bio || "",
      walkoutSong: linkedProfile.song || user.walkoutSong || "",
      playerRole: linkedProfile.role || "",
      highestCheckout: linkedProfile.highestCheckout || "",
      accolades: (linkedProfile.accolades || []).join(", "),
      gooch: linkedProfile.gooch || ""
    };
    Object.assign(user, profileValues);
    populate();

    let photoUrl = user.photoUrl || user.photo || linkedProfile.photoUrl || linkedProfile.photo || "";
    if (/^\/?images\/players\//i.test(photoUrl) || !photoUrl) {
      try {
        const photos = await window.PlayerData?.fetchPlayerPhotosFromDrive?.();
        photoUrl = photos?.[window.PlayerData.photoKey(user.linkedPlayerName)] || "";
      } catch { }
    }
    if (photoUrl) {
      user.linkedPhotoUrl = photoUrl;
      document.getElementById("accountPhoto").src = photoUrl;
    }
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
      const playerValues = {
        nickname: profile.nickname,
        bio: profile.bio,
        song: profile.walkoutSong,
        role: clean(data.get("playerRole")),
        highestCheckout: clean(data.get("highestCheckout")),
        accolades: clean(data.get("accolades")).split(",").map(value => value.trim()).filter(Boolean),
        gooch: data.get("gooch") === "on",
        photoUrl: linkedProfile?.photoUrl || linkedProfile?.photo || "",
        profileVisible: linkedProfile?.profileVisible !== false
      };
      if (user.linkedPlayerKey) {
        const playerResult = await window.ONMFirebase.post({ action: "updatePlayerProfile", playerKey: user.linkedPlayerKey, profile: playerValues });
        if (!playerResult.success) throw new Error(playerResult.error || "Your account saved, but the player profile could not be updated.");
        linkedProfile = { ...(linkedProfile || {}), ...playerValues };
      }
      updateLocalUser({ ...profile, playerRole: playerValues.role, highestCheckout: playerValues.highestCheckout, accolades: playerValues.accolades.join(", "), gooch: playerValues.gooch ? "yes" : "" });
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
    if (file.size > 5 * 1024 * 1024) {
      showMessage("Please choose an image smaller than 5 MB.", true);
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
      linkedProfile = { ...(linkedProfile || {}), photoUrl: result.photoUrl };
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
      await loadLinkedPlayerProfile();
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
