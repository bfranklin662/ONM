const PROFILE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";

async function profilePostToAppScript(payload) {
  const response = await fetch(PROFILE_APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    }
  });

  return response.json();
}

function getLoggedInUser() {
  const savedUser = localStorage.getItem("onmUser");
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("onmUser");
    return null;
  }
}

function escapeProfileHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function profileFieldHtml(label, key, value, type = "text") {
  return `
    <div class="profileField" data-profile-field="${key}">
      <label>${label}</label>

      <div class="profileFieldView">
        <span class="profileFieldValue">${escapeProfileHtml(value) || "—"}</span>
        <button type="button" class="profileEditBtn" data-edit-profile="${key}" aria-label="Edit ${label}">✎</button>
      </div>

      <div class="profileFieldEdit hidden">
        <input 
          type="${type}" 
          class="profileEditInput" 
          value="${escapeProfileHtml(value)}"
          data-profile-input="${key}"
        >
        <div class="profileEditActions">
          <button type="button" class="btn btnGhost profileCancelBtn" data-cancel-profile="${key}">Cancel</button>
          <button type="button" class="btn btnPrimary profileSaveBtn" data-save-profile="${key}">Save</button>
        </div>
      </div>
    </div>
  `;
}

async function getProfileImage(user) {
  let imageUrl = user.photoUrl || "graphics/logoWoText.png";

  try {
    if (user.linkedPlayerName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
      const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
      const key = window.PlayerData.photoKey(user.linkedPlayerName);
      imageUrl = photos[key] || imageUrl;
    }
  } catch (err) {
    console.warn("Could not load profile image", err);
  }

  return imageUrl;
}

function profileStatHtml(label, value) {
  return `
    <div class="profileStatItem">
      <span>${label}</span>
      <strong>${escapeProfileHtml(value) || "—"}</strong>
    </div>
  `;
}

function openLoggedOutProfileModal() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const overlay = document.getElementById("profileOverlay");
  const content = document.getElementById("profileModalContent");

  if (!overlay || !content) return;

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  content.innerHTML = `
    <div class="loggedOutProfile">
      <div class="loggedOutIcon">👤</div>
      <h3>Profile</h3>
      <p>Log in or register to save your details and track competitive dart stats.</p>

      <div class="profileAuthActions">
        <a class="btn btnPrimary" href="auth.html?redirect=${encodeURIComponent(currentPage)}&mode=login">Log in</a>
        <a class="btn btnGhost" href="auth.html?redirect=${encodeURIComponent(currentPage)}&mode=register">Register</a>
      </div>
    </div>
  `;
}

window.openLoggedOutProfileModal = openLoggedOutProfileModal;

async function openProfileModal() {
  let user = getLoggedInUser();

  if (window.ONMSession?.check) {
    user = await window.ONMSession.check();
  }
  if (!user) {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `auth.html?redirect=${encodeURIComponent(currentPage)}`;
    return;
  }

  const overlay = document.getElementById("profileOverlay");
  const content = document.getElementById("profileModalContent");

  if (!overlay || !content) return;

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  content.innerHTML = `
    <div class="profileLoading">
      <span class="inlineSpinner"></span>
      Loading profile...
    </div>
  `;

  const imageUrl = await getProfileImage(user);

  let jsonProfile = {};

  try {
    const res = await fetch(`data/player-profile.json?t=${Date.now()}`);
    const profiles = await res.json();
    jsonProfile = profiles[user.linkedPlayerName] || {};
  } catch (err) {
    console.warn("Could not load player-profile.json", err);
  }

  const profileData = {
    name: user.linkedPlayerName || `${user.firstName || ""} ${user.surname || ""}`.trim(),
    nickname: user.nickname || jsonProfile.nickname || "",
    email: user.email || "",
    team: user.team || "",
    bio: user.bio || jsonProfile.bio || "",
    walkoutSong: user.walkoutSong || user.song || jsonProfile.song || ""
  };

  content.innerHTML = `
    <div class="profileTopCard">
      <img class="profileTopImage" src="${imageUrl}" alt="">

      <div class="profileTopInfo">
        <div class="profileTopName">${escapeProfileHtml(user.firstName || "")} ${escapeProfileHtml(user.surname || "")}</div>
        <div class="profileTopNickname">
          ${profileData.nickname ? `"${escapeProfileHtml(profileData.nickname)}"` : ""}
        </div>
        ${user.average ? `<div class="profileTopAverage">${escapeProfileHtml(user.average)}</div>` : ""}
      </div>
    </div>

    <div class="profileSwitch">
      <button type="button" class="profileSwitchBtn active" data-profile-tab="details">Details</button>
      <button type="button" class="profileSwitchBtn" data-profile-tab="averages">Averages</button>
    </div>

    <div id="profileSaveMsg" class="profileSaveMsg hidden"></div>

    <div id="profileDetailsTab">
      ${profileFieldHtml("Nickname", "nickname", profileData.nickname)}
      ${profileFieldHtml("Email", "email", profileData.email, "email")}
      ${profileFieldHtml("Team", "team", profileData.team)}
      
      <div class="profileField" data-profile-field="bio">
        <label>Bio</label>
        <div class="profileFieldView">
          <span class="profileFieldValue">${escapeProfileHtml(profileData.bio) || "—"}</span>
          <button type="button" class="profileEditBtn" data-edit-profile="bio">✎</button>
        </div>
        <div class="profileFieldEdit hidden">
          <textarea class="profileEditTextarea" data-profile-input="bio">${escapeProfileHtml(profileData.bio)}</textarea>
          <div class="profileEditActions">
            <button type="button" class="btn btnGhost profileCancelBtn" data-cancel-profile="bio">Cancel</button>
            <button type="button" class="btn btnPrimary profileSaveBtn" data-save-profile="bio">Save</button>
          </div>
        </div>
      </div>

      ${profileFieldHtml("Walkout song Spotify link", "walkoutSong", profileData.walkoutSong, "url")}
    </div>

    <div id="profileAveragesTab" class="hidden">
      <div class="profileStatGrid">
        ${profileStatHtml("3-dart average", user.average)}
        ${profileStatHtml("Games played", user.gamesPlayed)}
        ${profileStatHtml("Wins", user.wins)}
        ${profileStatHtml("Losses", user.losses)}
        ${profileStatHtml("Darts thrown", user.dartsThrown)}
        ${profileStatHtml("Checkouts", user.checkouts)}
        ${profileStatHtml("Checkout rate", user.checkoutRate)}
        ${profileStatHtml("Highest out", user.highestOut)}
        ${profileStatHtml("High score", user.highScore)}
        ${profileStatHtml("Best leg", user.bestLeg)}
        ${profileStatHtml("Worst leg", user.worstLeg)}
        ${profileStatHtml("180s", user.oneEightys)}
        ${profileStatHtml("Bull-outs", user.bullOuts)}
      </div>
    </div>

    <button type="button" id="logoutProfileBtn" class="btn btnGhost profileLogoutBtn">
      Log out
    </button>
  `;

  attachProfileModalListeners(user);
}

function attachProfileModalListeners(user) {
  const content = document.getElementById("profileModalContent");
  const msg = document.getElementById("profileSaveMsg");

  if (!content) return;

  content.querySelectorAll(".profileSwitchBtn").forEach(button => {
    button.addEventListener("click", () => {
      content.querySelectorAll(".profileSwitchBtn").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      document.getElementById("profileDetailsTab").classList.toggle("hidden", button.dataset.profileTab !== "details");
      document.getElementById("profileAveragesTab").classList.toggle("hidden", button.dataset.profileTab !== "averages");
    });
  });

  content.querySelectorAll("[data-edit-profile]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.editProfile;
      const field = content.querySelector(`[data-profile-field="${key}"]`);

      field.querySelector(".profileFieldView").classList.add("hidden");
      field.querySelector(".profileFieldEdit").classList.remove("hidden");
    });
  });

  content.querySelectorAll("[data-cancel-profile]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.cancelProfile;
      const field = content.querySelector(`[data-profile-field="${key}"]`);

      field.querySelector(".profileFieldEdit").classList.add("hidden");
      field.querySelector(".profileFieldView").classList.remove("hidden");
    });
  });

  content.querySelectorAll("[data-save-profile]").forEach(button => {
    button.addEventListener("click", async () => {
      const key = button.dataset.saveProfile;
      const field = content.querySelector(`[data-profile-field="${key}"]`);
      const input = field.querySelector(`[data-profile-input="${key}"]`);
      const value = input.value.trim();

      button.disabled = true;
      button.innerHTML = `<span class="btnSpinner"></span> Saving`;

      try {
        const result = await profilePostToAppScript({
          action: "updateProfile",
          userId: user.userId,
          profile: {
            [key]: value
          }
        });

        if (!result.success) {
          msg.textContent = result.error || "Could not save profile.";
          msg.classList.remove("hidden");
          button.disabled = false;
          button.textContent = "Save";
          return;
        }

        const updatedUser = {
          ...user,
          [key]: value
        };

        if (key === "walkoutSong") {
          updatedUser.song = value;
        }

        localStorage.setItem("onmUser", JSON.stringify(updatedUser));

        field.querySelector(".profileFieldValue").textContent = value || "—";
        field.querySelector(".profileFieldEdit").classList.add("hidden");
        field.querySelector(".profileFieldView").classList.remove("hidden");

        msg.textContent = "Profile updated.";
        msg.classList.remove("hidden");

        setTimeout(() => {
          msg.classList.add("hidden");
        }, 1600);

      } catch (err) {
        msg.textContent = "Could not connect to the server.";
        msg.classList.remove("hidden");
      }

      button.disabled = false;
      button.textContent = "Save";
    });
  });

  const logoutBtn = document.getElementById("logoutProfileBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("onmUser");
      window.location.reload();
    });
  }
}

function closeProfileModal() {
  const overlay = document.getElementById("profileOverlay");
  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeProfileBtn");
  const overlay = document.getElementById("profileOverlay");

  closeBtn?.addEventListener("click", closeProfileModal);

  overlay?.addEventListener("click", event => {
    if (event.target !== overlay) return;
    closeProfileModal();
  });
});

window.openProfileModal = openProfileModal;

function initProfileButton() {
  const authBtn = document.getElementById("authNavBtn");
  if (!authBtn) return;

  authBtn.onclick = async event => {
    event.preventDefault();

    authBtn.classList.add("isLoading");

    try {
      await openProfileModal();
    } finally {
      authBtn.classList.remove("isLoading");
    }
  };
}

document.addEventListener("DOMContentLoaded", initProfileButton);