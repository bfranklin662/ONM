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
  let verified = false;
  try {
    if (window.ONMFirebase?.firebasePrimary) {
      const current = await window.ONMFirebase.currentFirebaseUser();
      if (!current) {
        localStorage.removeItem("onmUser");
        return null;
      }
      if(user&&current.uid!==user.uid)localStorage.removeItem("onmUser");
      verified = true;
      if(window.ONMFirebase.loadOwnUser){
        const fresh=await window.ONMFirebase.loadOwnUser();
        if(!fresh||fresh.uid!==current.uid||fresh.status!=="Active"){localStorage.removeItem("onmUser");return null;}
        localStorage.setItem("onmUser",JSON.stringify(fresh));return fresh;
      }
      if(!user||user.uid!==current.uid)return null;
    }
    if(!user)return null;
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
    return !window.ONMFirebase?.firebasePrimary || (verified&&getOnmUser()?.uid===user?.uid) ? user : null;
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
  for(const candidate of [...new Set(candidates.map(normaliseProfileImageUrl).filter(Boolean))])if(await imageLoads(candidate))return candidate;
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
  initial.setAttribute("aria-hidden", "true");
  authBtn.appendChild(initial);
}

function updateAuthHeader(user) {
  const authBtn = document.getElementById("authNavBtn");
  if (!authBtn) return;

  authBtn.onclick = async event => {
    event.preventDefault();

    authBtn.classList.add("isProfileLoading");

    try {
      const current=window.ONMFirebase?.firebasePrimary?await window.ONMFirebase.currentFirebaseUser():user;
      window.location.href=current?"account.html":"auth.html?mode=register";
    } catch {
      // A slow/offline verification is not evidence of being signed out.
      window.location.href="account.html";
    } finally {
      authBtn.classList.remove("isProfileLoading");
    }
  };

  if (!user) {
    authBtn.setAttribute("href", "auth.html?mode=register");
    authBtn.setAttribute("aria-label", "Sign up or sign in");
    authBtn.className = "authProfileBtn";
    authBtn.innerHTML = `<span class="authProfileInitial">👤</span>`;
    return;
  }

  const profileName = user.linkedPlayerName || user.firstName || "Profile";
  authBtn.setAttribute("href", "account.html");
  authBtn.setAttribute("aria-label", "My account");
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
  let refreshed=false;

  // A cached profile is not proof of an active Firebase session.
  let verifiedUser = cachedUser;
  if (window.ONMFirebase?.firebasePrimary) {
    try {
      const current = await window.ONMFirebase.currentFirebaseUser();
      verifiedUser = current && current.uid === cachedUser?.uid ? cachedUser : null;
      if (!current) localStorage.removeItem("onmUser");
      else if(!verifiedUser){verifiedUser=await checkOnmSession();refreshed=true;}
    } catch { verifiedUser = null; }
  }
  updateAuthHeader(verifiedUser);
  if (verifiedUser) {
    const authBtn = document.getElementById("authNavBtn");
    const profileName = verifiedUser.linkedPlayerName || verifiedUser.firstName || "Profile";
    loadHeaderProfileImage(authBtn, verifiedUser, profileName);
  }

  // background refresh, don't block page
  if(!refreshed)checkOnmSession().then(async freshUser => {
    if (!freshUser) {
      updateAuthHeader(null);
      return;
    }

    updateAuthHeader(freshUser);

    const authBtn = document.getElementById("authNavBtn");
    const profileName = freshUser.linkedPlayerName || freshUser.firstName || "Profile";
    loadHeaderProfileImage(authBtn, freshUser, profileName);
  });

  return verifiedUser;
}

window.ONMSession = {
  getUser: getOnmUser,
  clearUser: clearOnmUser,
  check: checkOnmSession,
  init: initOnmSession,
  updateHeader: updateAuthHeader,
  resolveProfileImage: resolveLinkedPlayerImage
};

// Make the icon usable while Firebase restores the session in the background.
updateAuthHeader(null);
document.addEventListener("DOMContentLoaded", () => {
  initOnmSession();
});
