(function () {
  const loginForm = document.getElementById("migrationLogin");
  const actions = document.getElementById("migrationActions");
  const userText = document.getElementById("migrationUser");
  const runButton = document.getElementById("runMigration");
  const log = document.getElementById("migrationLog");
  const createButton = document.getElementById("createFirebaseOwner");

  function message(value, append = false) {
    log.textContent = append ? `${log.textContent}\n${value}` : value;
  }

  function showSignedIn(result) {
    loginForm.classList.add("hidden");
    actions.classList.remove("hidden");
    userText.textContent = `Signed in as ${result.user.email}.`;
  }

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    message("Signing in…");
    const result = await window.ONMFirebase.postFirebase({
      action: "login",
      email: document.getElementById("migrationEmail").value,
      password: document.getElementById("migrationPassword").value
    });
    if (!result.success) {
      message(result.error || "Could not sign in.");
      return;
    }
    showSignedIn(result);
    message("Ready to import. This can be run again without creating duplicates.");
  });

  createButton.addEventListener("click", async () => {
    const firstName = document.getElementById("migrationFirstName").value.trim();
    const surname = document.getElementById("migrationSurname").value.trim();
    const email = document.getElementById("migrationEmail").value.trim();
    const password = document.getElementById("migrationPassword").value;
    if (!firstName || !surname || !email || password.length < 6) {
      message("Enter your first name, surname, email and a password of at least six characters.");
      return;
    }
    message("Creating the Firebase account…");
    const result = await window.ONMFirebase.postFirebase({
      action: "register",
      firstName,
      surname,
      email,
      password,
      team: "Oche Ness Monsters"
    });
    if (!result.success) {
      message(result.error || "Could not create the Firebase account.");
      return;
    }
    showSignedIn(result);
    message("Account created. In Firestore, change this user's role from member to owner, then return here and run the import.");
  });

  runButton.addEventListener("click", async () => {
    runButton.disabled = true;
    message("Starting import…");
    try {
      const totals = await window.ONMFirebase.importSiteData(value => message(value, true));
      message(`Finished. ${totals.players} players, ${totals.results} results and ${totals.fixtures} fixtures are now in Firebase.`, true);
    } catch (error) {
      message(`Import stopped: ${error.message}`, true);
    } finally {
      runButton.disabled = false;
    }
  });
})();
