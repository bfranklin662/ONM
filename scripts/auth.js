const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";

const els = {
  authToggle: document.getElementById("authToggle"),
  showRegisterBtn: document.getElementById("showRegisterBtn"),
  showLoginBtn: document.getElementById("showLoginBtn"),
  registerForm: document.getElementById("registerForm"),
  loginForm: document.getElementById("loginForm"),
  authMsg: document.getElementById("authMsg"),
  teamSelect: document.getElementById("teamSelect"),
  customTeamWrap: document.getElementById("customTeamWrap"),
  customTeamInput: document.getElementById("customTeamInput"),
  registerSubmitBtn: document.getElementById("registerSubmitBtn"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  linkPlayerOverlay: document.getElementById("linkPlayerOverlay"),
  closeLinkPlayerBtn: document.getElementById("closeLinkPlayerBtn"),
  linkPlayerList: document.getElementById("linkPlayerList"),
  skipLinkPlayerBtn: document.getElementById("skipLinkPlayerBtn"),
  linkPlayerMsg: document.getElementById("linkPlayerMsg"),
};

async function postToAppScript(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    }
  });

  return response.json();
}

function setButtonLoading(button, isLoading, text) {
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? `<span class="btnSpinner"></span>`
    : text;
}

function setTogglePosition(toggleEl, activeBtn) {
  const buttons = [...toggleEl.querySelectorAll(".toggleBtn")];
  const slider = toggleEl.querySelector(".toggleSlider");
  const index = buttons.indexOf(activeBtn);
  const count = buttons.length;

  buttons.forEach(btn => btn.classList.remove("active"));
  activeBtn.classList.add("active");

  slider.style.width = `calc((100% - 8px) / ${count})`;
  slider.style.transform = `translateX(${index * 100}%)`;
}



async function showLinkedPlayersModal(user) {
  els.linkPlayerOverlay.classList.remove("hidden");
  els.linkPlayerOverlay.setAttribute("aria-hidden", "false");

  els.linkPlayerList.innerHTML = `
      <div class="loadingRow">
        <span class="inlineSpinner"></span>
        <span>Loading linked players...</span>
      </div>
    `;
  els.linkPlayerMsg.classList.add("hidden");

  try {
    const result = await postToAppScript({
      action: "findPlayers",
      firstName: user.firstName
    });

    if (!result.success) {
      els.linkPlayerList.innerHTML = `<div class="muted">Could not load players.</div>`;
      return;
    }

    if (!result.players.length) {
      els.linkPlayerList.innerHTML = `
        <div class="muted">No matching players found.</div>
        <div class="profileSearchRow">
          <input id="manualPlayerSearchInput" type="text" placeholder="Search another player">
          <button id="manualPlayerSearchBtn" type="button" class="btn btnPrimary">Search</button>
        </div>
      `;

      document.getElementById("manualPlayerSearchBtn").addEventListener("click", () => {
        const value = document.getElementById("manualPlayerSearchInput").value.trim();
        if (!value) return;
        showLinkedPlayersModal({ ...user, firstName: value });
      });

      return;
    }

    let drivePhotos = {};

    if (window.PlayerData?.fetchPlayerPhotosFromDrive) {
      drivePhotos = await window.PlayerData.fetchPlayerPhotosFromDrive();
    }

    els.linkPlayerList.innerHTML = result.players.map(player => {
      const key = window.PlayerData?.photoKey
        ? window.PlayerData.photoKey(player.playerName)
        : player.playerKey;

      const imageUrl = drivePhotos[key] || "graphics/logoWoText.png";

      return `
        <button type="button" class="playerRow linkPlayerBtn" data-name="${player.playerName}" data-key="${player.playerKey}">
          <img src="${imageUrl}" alt="">
          <span>${player.playerName}</span>
          <span class="inviteBtn">Link</span>
        </button>
      `;
    }).join("");

    els.linkPlayerList.insertAdjacentHTML("beforeend", `
      <div class="profileSearchRow">
        <input id="manualPlayerSearchInput" type="text" placeholder="Search another player">
        <button id="manualPlayerSearchBtn" type="button" class="btn btnPrimary">Search</button>
      </div>
    `);

    document.getElementById("manualPlayerSearchBtn").addEventListener("click", () => {
      const value = document.getElementById("manualPlayerSearchInput").value.trim();
      if (!value) return;
      showLinkedPlayersModal({ ...user, firstName: value });
    });

    els.linkPlayerList.querySelectorAll(".linkPlayerBtn").forEach(button => {
      button.addEventListener("click", async () => {
        const allButtons = els.linkPlayerList.querySelectorAll(".linkPlayerBtn");

        allButtons.forEach(btn => {
          btn.disabled = true;
          btn.classList.add("disabled");
          btn.style.pointerEvents = "none";
        });

        button.classList.add("isLoading");
        button.disabled = true;

        if (els.skipLinkPlayerBtn) {
          els.skipLinkPlayerBtn.classList.add("hidden");
        }

        els.linkPlayerList.querySelectorAll(".linkPlayerBtn").forEach(btn => {
          btn.disabled = true;
          btn.classList.add("disabled");
        });

        const linkPill = button.querySelector(".inviteBtn");
        if (linkPill) {
          linkPill.innerHTML = `<span class="btnSpinner"></span>`;
        }

        els.linkPlayerMsg.textContent = "Linking player...";
        els.linkPlayerMsg.classList.remove("hidden");

        let linkResult;

        try {
          linkResult = await postToAppScript({
            action: "linkPlayer",
            userId: user.userId,
            playerName: button.dataset.name,
            playerKey: button.dataset.key
          });
        } catch (err) {
          els.linkPlayerMsg.textContent = "Could not connect.";

          allButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove("disabled");
            btn.style.pointerEvents = "";
          });

          button.classList.remove("isLoading");

          if (linkPill) linkPill.textContent = "Link";

          return;
        }

        if (!linkResult.success) {
          els.linkPlayerMsg.textContent = linkResult.error || "Could not link player.";

          allButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove("disabled");
            btn.style.pointerEvents = "";
          });

          button.classList.remove("isLoading");

          if (linkPill) linkPill.textContent = "Link";

          return;
        }

        const updatedUser = {
          ...user,
          linkedPlayerName: linkResult.linkedPlayer.playerName,
          linkedPlayerKey: linkResult.linkedPlayer.playerKey
        };

        localStorage.setItem("onmUser", JSON.stringify(updatedUser));

        els.linkPlayerList.innerHTML = `
          <div class="linkSuccess">
            <div class="linkSuccessIcon">✓</div>
            <div class="linkSuccessTitle">Player linked</div>
            <div class="linkSuccessText">${linkResult.linkedPlayer.playerName} has been linked to your account.</div>
          </div>
        `;

        els.linkPlayerMsg.classList.add("hidden");

        setTimeout(() => {
          continueAfterAuth();
        }, 1200);
      });
    });
  } catch (err) {
    els.linkPlayerList.innerHTML = `<div class="muted">Could not connect to player list.</div>`;
  }
}

function continueAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") || "index.html";

  window.location.href = redirect;
}

els.registerForm.addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(els.registerForm);

  let teamValue = els.teamSelect.value;

  if (teamValue === "Other") {
    teamValue = els.customTeamInput.value.trim();

    if (!teamValue) {
      els.authMsg.textContent = "Please enter your team name.";
      els.authMsg.classList.remove("hidden");
      els.customTeamInput.focus();
      return;
    }
  }

  if (teamValue === "None") {
    teamValue = "";
  }

  els.authMsg.textContent = "Creating account...";
  els.authMsg.classList.remove("hidden");

  setButtonLoading(els.registerSubmitBtn, true, "Creating...");

  try {
    const result = await postToAppScript({
      action: "register",
      firstName: formData.get("firstName"),
      surname: formData.get("surname"),
      email: formData.get("email"),
      team: teamValue,
      password: formData.get("password")
    });

    if (!result.success) {
      els.authMsg.textContent = result.error || "Could not create account.";
      setButtonLoading(els.registerSubmitBtn, false, "Create account");
      return;
    }

    localStorage.setItem("onmUser", JSON.stringify(result.user));
    setButtonLoading(els.registerSubmitBtn, false, "Create account");

    if (result.user.team === "Oche Ness Monsters") {
      showLinkedPlayersModal(result.user);
    } else {
      continueAfterAuth();
    }

  } catch (err) {
    setButtonLoading(els.registerSubmitBtn, false, "Create account");
    els.authMsg.textContent = "Could not connect to the server.";
  }
});

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(els.loginForm);

  els.authMsg.textContent = "Logging in...";
  els.authMsg.classList.remove("hidden");

  setButtonLoading(els.loginSubmitBtn, true, "Logging in...");

  try {
    const result = await postToAppScript({
      action: "login",
      email: formData.get("email"),
      password: formData.get("password")
    });

    if (!result.success) {
      els.authMsg.textContent = result.error || "Could not log in.";
      setButtonLoading(els.loginSubmitBtn, false, "Login");
      return;
    }

    localStorage.setItem("onmUser", JSON.stringify(result.user));
    setButtonLoading(els.loginSubmitBtn, false, "Login");

    if (result.user.team === "Oche Ness Monsters" && !result.user.linkedPlayerName) {
      showLinkedPlayersModal(result.user);
    } else {
      continueAfterAuth();
    }

  } catch (err) {
    els.authMsg.textContent = "Could not connect to the server.";
    setButtonLoading(els.loginSubmitBtn, false, "Login");
  }
});

els.showRegisterBtn.addEventListener("click", () => {
  setTogglePosition(els.authToggle, els.showRegisterBtn);
  els.registerForm.classList.remove("hidden");
  els.loginForm.classList.add("hidden");
  els.authMsg.classList.add("hidden");
});

els.showLoginBtn.addEventListener("click", () => {
  setTogglePosition(els.authToggle, els.showLoginBtn);
  els.loginForm.classList.remove("hidden");
  els.registerForm.classList.add("hidden");
  els.authMsg.classList.add("hidden");
});

els.teamSelect.addEventListener("change", () => {
  if (els.teamSelect.value === "Other") {
    els.customTeamWrap.classList.remove("hidden");
    setTimeout(() => els.customTeamInput.focus(), 50);
  } else {
    els.customTeamWrap.classList.add("hidden");
    els.customTeamInput.value = "";
  }
});

els.closeLinkPlayerBtn.addEventListener("click", continueAfterAuth);
els.skipLinkPlayerBtn.addEventListener("click", continueAfterAuth);

els.linkPlayerOverlay.addEventListener("click", event => {
  if (event.target !== els.linkPlayerOverlay) return;
  continueAfterAuth();
});

setTogglePosition(
  els.authToggle,
  document.querySelector("#authToggle .toggleBtn.active")
);

