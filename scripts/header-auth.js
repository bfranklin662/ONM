async function updateAuthHeader() {
  const authBtn = document.getElementById("authNavBtn");
  if (!authBtn) return;

  const savedUser = localStorage.getItem("onmUser");

  if (!savedUser) {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    authBtn.textContent = "Login / Register";
    authBtn.href = `auth.html?redirect=${encodeURIComponent(currentPage)}`;
    authBtn.classList.remove("authProfileBtn");
    return;
  }

  const user = JSON.parse(savedUser);
  const playerName = user.linkedPlayerName || user.firstName || "Profile";

  authBtn.textContent = "";
  authBtn.href = user.linkedPlayerName
    ? `player-profile.html?name=${encodeURIComponent(user.linkedPlayerName)}`
    : "profile.html";

  authBtn.classList.add("authProfileBtn");
  authBtn.title = playerName;

  let imageUrl = "graphics/logoWoText.png";

  try {
    if (user.linkedPlayerName && window.PlayerData?.fetchPlayerPhotosFromDrive) {
      const photos = await window.PlayerData.fetchPlayerPhotosFromDrive();
      const key = window.PlayerData.photoKey(user.linkedPlayerName);
      imageUrl = photos[key] || imageUrl;
    }
  } catch (err) {
    console.warn("Could not load profile image", err);
  }

  authBtn.innerHTML = `<img src="${imageUrl}" alt="${playerName}">`;
}

updateAuthHeader();