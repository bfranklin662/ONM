const ONM_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";

function getOnmUser() {
  try {
    return JSON.parse(localStorage.getItem("onmUser"));
  } catch {
    return null;
  }
}

function clearOnmUser() {
  localStorage.removeItem("onmUser");
}

async function postToOnmAppScript(payload) {
  const response = await fetch(ONM_APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    }
  });

  return response.json();
}

async function checkOnmSession() {
  const user = getOnmUser();

  if (!user) return null;

  try {
    const result = await postToOnmAppScript({
      action: "checkUser",
      userId: user.userId,
      email: user.email
    });

    if (!result.success) {
      clearOnmUser();
      return null;
    }

    localStorage.setItem("onmUser", JSON.stringify(result.user));
    return result.user;

  } catch {
    return user;
  }
}

function getCachedProfileImage(user) {
  if (!user) return "";
  return localStorage.getItem(`onmProfileImage:${user.userId}`) || "";
}

function setCachedProfileImage(user, imageUrl) {
  if (!user || !imageUrl) return;
  localStorage.setItem(`onmProfileImage:${user.userId}`, imageUrl);
}

function updateAuthHeader(user) {
  const authBtn = document.getElementById("authNavBtn");
  if (!authBtn) return;

  authBtn.onclick = async event => {
    event.preventDefault();

    authBtn.classList.add("isProfileLoading");

    try {
      if (user) await openProfileModal();
      else openLoggedOutProfileModal();
    } finally {
      authBtn.classList.remove("isProfileLoading");
    }
  };

  if (!user) {
    authBtn.className = "authProfileBtn";
    authBtn.innerHTML = `<span class="authProfileInitial">👤</span>`;
    return;
  }

  const profileName = user.linkedPlayerName || user.firstName || "Profile";
  const cachedImage = user.photoUrl || getCachedProfileImage(user);

  authBtn.className = "authProfileBtn";

  authBtn.innerHTML = cachedImage
    ? `<img src="${cachedImage}" alt="${profileName}">`
    : `<span class="authProfileInitial">${profileName.charAt(0).toUpperCase()}</span>`;
}

async function loadHeaderProfileImage(authBtn, user, profileName) {
  let imageUrl = "graphics/logoWoText.png";

  try {
    if (user.linkedPlayerName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
      const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
      const key = window.PlayerData.photoKey(user.linkedPlayerName);
      imageUrl = photos[key] || imageUrl;
    }
  } catch (err) {
    console.warn("Could not load header image", err);
  }

  authBtn.classList.remove("isLoading");
  authBtn.innerHTML = `<img src="${imageUrl}" alt="${profileName}">`;
}

async function initOnmSession() {
  const cachedUser = getOnmUser();

  // instant UI
  updateAuthHeader(cachedUser);

  // background refresh, don't block page
  checkOnmSession().then(async freshUser => {
    if (!freshUser) {
      updateAuthHeader(null);
      return;
    }

    updateAuthHeader(freshUser);

    try {
      if (freshUser.linkedPlayerName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
        const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
        const key = window.PlayerData.photoKey(freshUser.linkedPlayerName);
        const imageUrl = photos[key];

        if (imageUrl) {
          freshUser.photoUrl = imageUrl;
          localStorage.setItem("onmUser", JSON.stringify(freshUser));
          setCachedProfileImage(freshUser, imageUrl);
          updateAuthHeader(freshUser);
        }
      }
    } catch { }
  });

  return cachedUser;
}

window.ONMSession = {
  getUser: getOnmUser,
  clearUser: clearOnmUser,
  check: checkOnmSession,
  init: initOnmSession,
  updateHeader: updateAuthHeader
};

document.addEventListener("DOMContentLoaded", () => {
  initOnmSession();
});