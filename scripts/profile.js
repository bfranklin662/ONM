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
    if (!user.photoUrl && user.linkedPlayerName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
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

function profileLoadingStatHtml(label) {
  return `
    <div class="profileStatItem profileStatLoading">
      <span>${label}</span>
      <strong>—</strong>
    </div>
  `;
}

function getProfileDisplayName(user) {
  return (
    user.linkedPlayerName ||
    `${user.firstName || ""} ${user.surname || user.lastName || ""}`.trim() ||
    user.fullName ||
    user.name ||
    "Player"
  );
}

async function loadProfileJson(user) {
  try {
    const res = await fetch(`data/player-profile.json?t=${Date.now()}`);
    const profiles = await res.json();
    return profiles[user.linkedPlayerName] || {};
  } catch (err) {
    console.warn("Could not load player-profile.json", err);
    return {};
  }
}

async function loadProfileAverages(user) {
  const linkedPlayerName = user.linkedPlayerName || getProfileDisplayName(user);
  const linkedPlayerKey = user.linkedPlayerKey || user.playerKey || user.userId || "";

  if (!linkedPlayerName && !linkedPlayerKey) return null;

  const result = await profilePostToAppScript({
    action: "getUserStats",
    linkedPlayerName,
    linkedPlayerKey
  });

  if (!result.success) {
    throw new Error(result.error || "Could not load profile stats.");
  }

  return result.stats || {};
}

function readProfileImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",").pop() : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderProfileAverages(stats = {}) {
  const tab = document.getElementById("profileAveragesTab");
  if (!tab) return;

  tab.innerHTML = `
    <div class="profileStatGrid">
      ${profileStatHtml("3-dart average", stats.average)}
      ${profileStatHtml("Games played", stats.gamesPlayed)}
      ${profileStatHtml("Wins", stats.wins)}
      ${profileStatHtml("Losses", stats.losses)}
      ${profileStatHtml("Darts thrown", stats.dartsThrown)}
      ${profileStatHtml("Checkouts", stats.checkouts)}
      ${profileStatHtml("Checkout rate", stats.checkoutRate)}
      ${profileStatHtml("Highest out", stats.highestOut)}
      ${profileStatHtml("High score", stats.highScore)}
      ${profileStatHtml("Best leg", stats.bestLeg)}
      ${profileStatHtml("Worst leg", stats.worstLeg)}
      ${profileStatHtml("180s", stats.oneEightys)}
      ${profileStatHtml("Bull-outs", stats.bullOuts)}
    </div>
  `;
}

function renderProfileAveragesLoading() {
  const tab = document.getElementById("profileAveragesTab");
  if (!tab) return;

  tab.innerHTML = `
    <div class="profileStatGrid">
      ${[
        "3-dart average",
        "Games played",
        "Wins",
        "Losses",
        "Darts thrown",
        "Checkouts",
        "Checkout rate",
        "Highest out",
        "High score",
        "Best leg",
        "Worst leg",
        "180s",
        "Bull-outs"
      ].map(profileLoadingStatHtml).join("")}
    </div>
  `;
}

function profileOnmStatsHtml(user) {
  const linkedName = user.linkedPlayerName || getProfileDisplayName(user);
  const isOnmUser = String(user.team || "").toLowerCase() === "oche ness monsters";

  if (user.linkedPlayerName) {
    return `
      <div class="profileLinkedStatsCard">
        <strong>ONM match stats</strong>
        <p>Open the full ONM player profile for match stats, appearances, fines, medals, and season filters.</p>
        <a class="btn btnPrimary" href="player-profile.html?name=${encodeURIComponent(linkedName)}">
          View match stats
        </a>
      </div>
    `;
  }

  if (isOnmUser) {
    return `
      <div class="profileLinkedStatsCard">
        <strong>Link your ONM player</strong>
        <p>Link your account to your ONM player profile to unlock match stats from Sheets.</p>
        <button type="button" class="btn btnPrimary" id="profileLinkOnmPlayerBtn">
          Link ONM player
        </button>
        <div id="profileLinkPlayerResults" class="profileLinkPlayerResults hidden"></div>
      </div>
    `;
  }

  return `
    <div class="profileLinkedStatsCard">
      <strong>No linked ONM player</strong>
      <p>ONM match stats are available to Oche Ness Monsters players linked to a player profile.</p>
    </div>
  `;
}

async function openProfileLinkPlayerPrompt(user) {
  const resultsEl = document.getElementById("profileLinkPlayerResults");
  if (!resultsEl) return;

  resultsEl.classList.remove("hidden");
  resultsEl.innerHTML = `
    <div class="profileLinkLoading">
      <span class="inlineSpinner"></span>
      Loading players...
    </div>
  `;

  try {
    const result = await profilePostToAppScript({
      action: "findPlayers",
      firstName: user.firstName || getProfileDisplayName(user)
    });

    if (!result.success || !Array.isArray(result.players) || !result.players.length) {
      resultsEl.innerHTML = `<div class="profilePhotoHelp">No matching ONM players found.</div>`;
      return;
    }

    let drivePhotos = {};

    if (window.PlayerData?.fetchPlayerPhotosFromDrive) {
      drivePhotos = await window.PlayerData.fetchPlayerPhotosFromDrive();
    }

    resultsEl.innerHTML = result.players.map(player => {
      const key = window.PlayerData?.photoKey
        ? window.PlayerData.photoKey(player.playerName)
        : player.playerKey;
      const imageUrl = drivePhotos[key] || "graphics/logoWoText.png";

      return `
        <button type="button" class="profileLinkPlayerBtn" data-name="${escapeProfileHtml(player.playerName)}" data-key="${escapeProfileHtml(player.playerKey)}">
          <img src="${escapeProfileHtml(imageUrl)}" alt="">
          <span>${escapeProfileHtml(player.playerName)}</span>
          <strong>Link</strong>
        </button>
      `;
    }).join("");

    resultsEl.querySelectorAll(".profileLinkPlayerBtn").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.querySelector("strong").innerHTML = `<span class="btnSpinner"></span>`;

        const linkResult = await profilePostToAppScript({
          action: "linkPlayer",
          userId: user.userId,
          playerName: button.dataset.name,
          playerKey: button.dataset.key
        });

        if (!linkResult.success) {
          button.disabled = false;
          button.querySelector("strong").textContent = "Link";
          resultsEl.insertAdjacentHTML("afterbegin", `<div class="profilePhotoHelp">${escapeProfileHtml(linkResult.error || "Could not link player.")}</div>`);
          return;
        }

        const linkedPlayer = linkResult.linkedPlayer || {
          playerName: button.dataset.name,
          playerKey: button.dataset.key
        };
        const updatedUser = {
          ...user,
          linkedPlayerName: linkedPlayer.playerName,
          linkedPlayerKey: linkedPlayer.playerKey
        };

        localStorage.setItem("onmUser", JSON.stringify(updatedUser));
        resultsEl.innerHTML = `<div class="profilePhotoHelp">${escapeProfileHtml(linkedPlayer.playerName)} linked to your account.</div>`;

        setTimeout(() => {
          openProfileModal();
        }, 900);
      });
    });
  } catch (err) {
    resultsEl.innerHTML = `<div class="profilePhotoHelp">Could not connect to player list.</div>`;
  }
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

  if (!user && window.ONMSession?.check) {
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

  const profileData = {
    name: getProfileDisplayName(user),
    nickname: user.nickname || "",
    email: user.email || "",
    team: user.team || "",
    bio: user.bio || "",
    walkoutSong: user.walkoutSong || user.song || ""
  };

  content.innerHTML = `
    <div class="profileTopCard">
      <div class="profileImageEditor">
        <img id="profileTopImage" class="profileTopImage" src="${escapeProfileHtml(user.photoUrl || "graphics/logoWoText.png")}" alt="">
        <button type="button" id="editProfilePhotoBtn" class="profilePhotoEditBtn" aria-label="Edit profile picture">✎</button>
      </div>

      <div class="profileTopInfo">
        <div class="profileTopName">${escapeProfileHtml(profileData.name)}</div>
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

    <div id="profilePhotoEditor" class="profilePhotoEditor hidden">
      <label for="profilePhotoFileInput">Upload profile picture</label>
      <input id="profilePhotoFileInput" class="profileFileInput" type="file" accept="image/*">
      <div class="profilePhotoHelp">Choose a JPG, PNG, or WebP image. It will be saved to the ONM Google Drive.</div>
      <div class="profileEditActions">
        <button type="button" class="btn btnGhost" id="cancelProfilePhotoBtn">Cancel</button>
        <button type="button" class="btn btnPrimary" id="saveProfilePhotoBtn">Upload photo</button>
      </div>
    </div>

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
      ${profileOnmStatsHtml(user)}
    </div>

    <div id="profileAveragesTab" class="hidden">
    </div>

    <button type="button" id="logoutProfileBtn" class="btn btnGhost profileLogoutBtn">
      Log out
    </button>
  `;

  attachProfileModalListeners(user);
  renderProfileAveragesLoading();

  getProfileImage(user).then(imageUrl => {
    const image = document.getElementById("profileTopImage");
    if (image) image.src = imageUrl;
  }).catch(err => console.warn("Could not load profile image", err));

  loadProfileJson(user).then(jsonProfile => {
    const updates = {
      nickname: user.nickname || jsonProfile.nickname || "",
      bio: user.bio || jsonProfile.bio || "",
      walkoutSong: user.walkoutSong || user.song || jsonProfile.song || ""
    };

    Object.entries(updates).forEach(([key, value]) => {
      const field = content.querySelector(`[data-profile-field="${key}"]`);
      if (!field) return;

      field.querySelector(".profileFieldValue").textContent = value || "—";
      const input = field.querySelector(`[data-profile-input="${key}"]`);
      if (input) input.value = value || "";
    });

    const nicknameEl = content.querySelector(".profileTopNickname");
    if (nicknameEl && updates.nickname) {
      nicknameEl.textContent = `"${updates.nickname}"`;
    }
  });

  loadProfileAverages(user)
    .then(stats => renderProfileAverages(stats || {}))
    .catch(err => {
      console.warn("Could not load profile averages", err);
      renderProfileAverages({});
    });
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

  document.getElementById("editProfilePhotoBtn")?.addEventListener("click", () => {
    document.getElementById("profilePhotoEditor")?.classList.toggle("hidden");
  });

  document.getElementById("cancelProfilePhotoBtn")?.addEventListener("click", () => {
    document.getElementById("profilePhotoEditor")?.classList.add("hidden");
  });

  document.getElementById("profileLinkOnmPlayerBtn")?.addEventListener("click", () => {
    openProfileLinkPlayerPrompt(user);
  });

  document.getElementById("saveProfilePhotoBtn")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    const input = document.getElementById("profilePhotoFileInput");
    const file = input?.files?.[0] || null;

    if (!file) {
      msg.textContent = "Choose an image first.";
      msg.classList.remove("hidden");
      return;
    }

    if (!file.type.startsWith("image/")) {
      msg.textContent = "Please choose an image file.";
      msg.classList.remove("hidden");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      msg.textContent = "Please choose an image under 4MB.";
      msg.classList.remove("hidden");
      return;
    }

    button.disabled = true;
    button.innerHTML = `<span class="btnSpinner"></span> Uploading`;

    try {
      const base64 = await readProfileImageFile(file);
      const result = await profilePostToAppScript({
        action: "uploadProfilePhoto",
        userId: user.userId,
        linkedPlayerName: user.linkedPlayerName || "",
        fileName: file.name,
        mimeType: file.type,
        imageBase64: base64
      });

      if (!result.success) {
        msg.textContent = result.error || "Could not upload profile picture.";
        msg.classList.remove("hidden");
        return;
      }

      const photoUrl = result.photoUrl || result.imageUrl || result.fileUrl || "";

      if (!photoUrl) {
        msg.textContent = "Photo uploaded, but no image URL was returned.";
        msg.classList.remove("hidden");
        return;
      }

      const updatedUser = {
        ...user,
        photoUrl
      };

      localStorage.setItem("onmUser", JSON.stringify(updatedUser));

      const image = document.getElementById("profileTopImage");
      if (image) image.src = photoUrl;

      document.getElementById("profilePhotoEditor")?.classList.add("hidden");
      msg.textContent = "Profile picture updated.";
      msg.classList.remove("hidden");

      setTimeout(() => {
        msg.classList.add("hidden");
      }, 1600);
    } catch (err) {
      msg.textContent = "Could not connect to upload profile picture.";
      msg.classList.remove("hidden");
    } finally {
      button.disabled = false;
      button.textContent = "Upload photo";
    }
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
