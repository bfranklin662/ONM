function getOnmUser() {
  try {
    return JSON.parse(localStorage.getItem("onmUser"));
  } catch {
    return null;
  }
}

function clearOnmUser() {
  localStorage.removeItem("onmUser");
  window.ONMFirebase?.signOut?.().catch(() => {});
}

async function postToOnmAppScript(payload) {
  if (!window.ONMFirebase?.post) throw new Error("Firebase is not ready.");
  return window.ONMFirebase.post(payload);
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

function normaliseProfileImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(images|graphics)\//i.test(value)) return `/${value}`;
  return value;
}

function imageLoads(url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

async function resolveLinkedPlayerImage(user) {
  if (!user) return "";

  const candidates = [user.photoUrl, getCachedProfileImage(user)];
  const linkedName = user.linkedPlayerName || "";

  if (linkedName && window.PlayerData?.fetchPublicPlayerProfiles) {
    const profiles = await window.PlayerData.fetchPublicPlayerProfiles();
    candidates.push(profiles?.[linkedName]?.photo || "");
  }

  if (linkedName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
    const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
    const key = window.PlayerData.photoKey(linkedName);
    candidates.push(photos[key] || "");
  }

  if (linkedName) {
    try {
      const response = await fetch("/data/player-profile.json");
      const profiles = response.ok ? await response.json() : {};
      candidates.push(profiles?.[linkedName]?.photo || "");
    } catch { }
  }

  const uniqueCandidates = [...new Set(candidates.map(normaliseProfileImageUrl).filter(Boolean))];
  for (const candidate of uniqueCandidates) {
    if (await imageLoads(candidate)) return candidate;
  }
  return "";
}

function renderAuthInitial(authBtn, profileName) {
  authBtn.innerHTML = "";
  const initial = document.createElement("span");
  initial.className = "authProfileInitial";
  initial.textContent = String(profileName || "P").charAt(0).toUpperCase();
  authBtn.appendChild(initial);
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

  if (!cachedImage) {
    renderAuthInitial(authBtn, profileName);
    return;
  }

  authBtn.innerHTML = "";
  const image = document.createElement("img");
  image.src = normaliseProfileImageUrl(cachedImage);
  image.alt = profileName;
  image.addEventListener("error", () => renderAuthInitial(authBtn, profileName), { once: true });
  authBtn.appendChild(image);
}

async function loadHeaderProfileImage(authBtn, user, profileName) {
  if (!authBtn || !user) return;
  try {
    const imageUrl = await resolveLinkedPlayerImage(user);
    if (!imageUrl) {
      renderAuthInitial(authBtn, profileName);
      return;
    }

    user.photoUrl = imageUrl;
    localStorage.setItem("onmUser", JSON.stringify(user));
    setCachedProfileImage(user, imageUrl);
    updateAuthHeader(user);
  } catch (err) {
    console.warn("Could not load header image", err);
    renderAuthInitial(authBtn, profileName);
  }
}

async function initOnmSession() {
  const cachedUser = getOnmUser();

  // instant UI
  updateAuthHeader(cachedUser);
  if (cachedUser) {
    const authBtn = document.getElementById("authNavBtn");
    const profileName = cachedUser.linkedPlayerName || cachedUser.firstName || "Profile";
    loadHeaderProfileImage(authBtn, cachedUser, profileName);
  }

  // background refresh, don't block page
  checkOnmSession().then(async freshUser => {
    if (!freshUser) {
      updateAuthHeader(null);
      return;
    }

    updateAuthHeader(freshUser);

    const authBtn = document.getElementById("authNavBtn");
    const profileName = freshUser.linkedPlayerName || freshUser.firstName || "Profile";
    loadHeaderProfileImage(authBtn, freshUser, profileName);
  });

  return cachedUser;
}

window.ONMSession = {
  getUser: getOnmUser,
  clearUser: clearOnmUser,
  check: checkOnmSession,
  init: initOnmSession,
  updateHeader: updateAuthHeader,
  resolveProfileImage: resolveLinkedPlayerImage
};

document.addEventListener("DOMContentLoaded", () => {
  initOnmSession();
});
