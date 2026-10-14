(function () {
  "use strict";

  const VERSION = "10.12.5";
  const BASE = `https://www.gstatic.com/firebasejs/${VERSION}`;
  // Keep the live site on Apps Script until Firebase services and data have
  // been verified. Change to true for the final cutover.
  const FIREBASE_PRIMARY = true;
  const LEGACY_ENDPOINT = "https://script.google.com/macros/s/AKfycbwXZp0rgR2xYo1S7P-512FzoOlWjMfJaRcRPpRVzTkBiWGUEWEbQ25V3_vcLBse_rt5wA/exec";
  const config = {
    apiKey: "AIzaSyBn87XaH6f7MHC6EZZskBJF_4kJYNG1j2c",
    authDomain: "oche-ness-monsters.firebaseapp.com",
    projectId: "oche-ness-monsters",
    storageBucket: "oche-ness-monsters.firebasestorage.app",
    messagingSenderId: "765901984167",
    appId: "1:765901984167:web:59912422549f4a22f16682",
    measurementId: "G-HGH252D73C",
    databaseURL: "https://oche-ness-monsters-default-rtdb.europe-west1.firebasedatabase.app/"
  };

  const ready = Promise.all([
    import(`${BASE}/firebase-app.js`),
    import(`${BASE}/firebase-auth.js`),
    import(`${BASE}/firebase-firestore.js`),
    import(`${BASE}/firebase-storage.js`)
  ]).then(([appSdk, authSdk, firestoreSdk, storageSdk]) => {
    const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config);
    return {
      app,
      auth: authSdk.getAuth(app),
      db: firestoreSdk.getFirestore(app),
      storage: storageSdk.getStorage(app),
      authSdk,
      firestoreSdk,
      storageSdk
    };
  });

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function normaliseName(value) {
    return clean(value).replace(/\s+/g, " ").toLowerCase();
  }

  function playerKey(value) {
    return normaliseName(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function fixtureKey(value) {
    return playerKey(value) || `fixture-${Date.now()}`;
  }

  function formatDate(value) {
    const text = clean(value);
    if (!text) return "";
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) return text;
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
  }

  function seasonFromDate(value) {
    const text = clean(value);
    const iso = text.match(/^(\d{4})-(\d{2})/);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const start = month >= 7 ? year : year - 1;
      return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
    }
    return "26-27";
  }

  async function currentFirebaseUser() {
    const { auth, authSdk } = await ready;
    if (auth.currentUser) return auth.currentUser;
    return new Promise(resolve => {
      const unsubscribe = authSdk.onAuthStateChanged(auth, user => {
        unsubscribe();
        resolve(user || null);
      });
    });
  }

  function publicUser(uid, data = {}) {
    return {
      userId: uid,
      uid,
      firstName: data.firstName || "",
      surname: data.surname || "",
      email: data.email || "",
      team: data.team || "",
      nationality: data.nationality || "",
      photoUrl: data.photoUrl || "",
      photo: data.photoUrl || "",
      status: data.status || "Active",
      role: data.role || "member",
      linkedPlayerName: data.linkedPlayerName || "",
      linkedPlayerKey: data.linkedPlayerKey || "",
      nickname: data.nickname || "",
      bio: data.bio || "",
      walkoutSong: data.walkoutSong || ""
    };
  }

  async function loadOwnUser() {
    const firebaseUser = await currentFirebaseUser();
    if (!firebaseUser) return null;
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "users", firebaseUser.uid));
    if (!snapshot.exists()) return null;
    return publicUser(firebaseUser.uid, snapshot.data());
  }

  async function register(payload) {
    const { auth, db, authSdk, firestoreSdk } = await ready;
    const email = clean(payload.email).toLowerCase();
    const credential = await authSdk.createUserWithEmailAndPassword(auth, email, String(payload.password || ""));
    const data = {
      firstName: clean(payload.firstName),
      surname: clean(payload.surname),
      email,
      team: clean(payload.team),
      nationality: clean(payload.nationality),
      status: "Active",
      role: "member",
      linkedPlayerName: "",
      linkedPlayerKey: "",
      nickname: "",
      bio: "",
      walkoutSong: "",
      photoUrl: "",
      createdAt: firestoreSdk.serverTimestamp(),
      lastLoginAt: firestoreSdk.serverTimestamp()
    };
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "users", credential.user.uid), data);
    return { success: true, user: publicUser(credential.user.uid, data) };
  }

  async function login(payload) {
    const { auth, db, authSdk, firestoreSdk } = await ready;
    const credential = await authSdk.signInWithEmailAndPassword(
      auth,
      clean(payload.email).toLowerCase(),
      String(payload.password || "")
    );
    const ref = firestoreSdk.doc(db, "users", credential.user.uid);
    await firestoreSdk.updateDoc(ref, { lastLoginAt: firestoreSdk.serverTimestamp() });
    const snapshot = await firestoreSdk.getDoc(ref);
    const data = snapshot.data() || {};
    if (data.status !== "Active") throw new Error("This account is not active.");
    return { success: true, user: publicUser(credential.user.uid, data) };
  }

  async function checkUser() {
    const user = await loadOwnUser();
    if (!user || user.status !== "Active") return { success: false, error: "Session expired." };
    return { success: true, user };
  }

  async function resetPassword(payload) {
    const { auth, authSdk } = await ready;
    await authSdk.sendPasswordResetEmail(auth, clean(payload.email).toLowerCase());
    return { success: true };
  }

  async function findPlayers(payload) {
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "publicPlayers"));
    const wantedFirstName = normaliseName(payload.firstName);
    const players = snapshot.docs
      .map(item => item.data())
      .filter(item => {
        const first = normaliseName(item.publicName).split(" ")[0];
        return !wantedFirstName || first === wantedFirstName;
      })
      .map(item => ({
        playerName: item.publicName,
        playerKey: item.playerKey || playerKey(item.publicName),
        photoUrl: item.photoUrl || "",
        nationality: item.nationality || ""
      }))
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
    return { success: true, players };
  }

  async function linkPlayer(payload) {
    const user = await currentFirebaseUser();
    if (!user) throw new Error("Sign in before linking a player.");
    const { db, firestoreSdk } = await ready;
    const values = {
      linkedPlayerName: clean(payload.playerName),
      linkedPlayerKey: clean(payload.playerKey),
      linkedAt: firestoreSdk.serverTimestamp()
    };
    const userRef = firestoreSdk.doc(db, "users", user.uid);
    await firestoreSdk.updateDoc(userRef, values);
    const savedUser = (await firestoreSdk.getDoc(userRef)).data() || {};
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "linkedPlayers", user.uid), {
      userId: user.uid,
      firstName: savedUser.firstName || "",
      surname: savedUser.surname || "",
      fullName: `${savedUser.firstName || ""} ${savedUser.surname || ""}`.trim(),
      playerName: values.linkedPlayerName,
      playerKey: values.linkedPlayerKey,
      linkedPlayerName: values.linkedPlayerName,
      linkedPlayerKey: values.linkedPlayerKey,
      nickname: savedUser.nickname || "",
      bio: savedUser.bio || "",
      walkoutSong: savedUser.walkoutSong || "",
      nationality: savedUser.nationality || "",
      photoUrl: savedUser.photoUrl || "",
      photo: savedUser.photoUrl || "",
      updatedAt: firestoreSdk.serverTimestamp()
    }, { merge: true });
    return { success: true, linkedPlayer: { playerName: values.linkedPlayerName, playerKey: values.linkedPlayerKey } };
  }

  async function updateProfile(payload) {
    const user = await currentFirebaseUser();
    if (!user) throw new Error("Sign in to update your profile.");
    const { db, authSdk, firestoreSdk } = await ready;
    const allowed = ["firstName", "email", "team", "nickname", "bio", "walkoutSong", "nationality", "photoUrl", "photo"];
    const updates = {};
    allowed.forEach(key => {
      if (payload.profile && payload.profile[key] !== undefined) {
        updates[key === "photo" ? "photoUrl" : key] = clean(payload.profile[key]);
      }
    });
    if (updates.email && updates.email !== user.email) {
      await authSdk.updateEmail(user, updates.email.toLowerCase());
      updates.email = updates.email.toLowerCase();
    }
    updates.updatedAt = firestoreSdk.serverTimestamp();
    const userRef = firestoreSdk.doc(db, "users", user.uid);
    await firestoreSdk.updateDoc(userRef, updates);
    const userSnapshot = await firestoreSdk.getDoc(userRef);
    const savedUser = userSnapshot.data() || {};
    if (savedUser.linkedPlayerKey) {
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "linkedPlayers", user.uid), {
        userId: user.uid,
        firstName: savedUser.firstName || "",
        surname: savedUser.surname || "",
        fullName: `${savedUser.firstName || ""} ${savedUser.surname || ""}`.trim(),
        playerName: savedUser.linkedPlayerName || "",
        playerKey: savedUser.linkedPlayerKey,
        linkedPlayerName: savedUser.linkedPlayerName || "",
        linkedPlayerKey: savedUser.linkedPlayerKey,
        nickname: savedUser.nickname || "",
        bio: savedUser.bio || "",
        walkoutSong: savedUser.walkoutSong || "",
        nationality: savedUser.nationality || "",
        photoUrl: savedUser.photoUrl || "",
        photo: savedUser.photoUrl || "",
        updatedAt: firestoreSdk.serverTimestamp()
      }, { merge: true });
    }
    return { success: true, profile: updates };
  }

  function base64Blob(base64, contentType) {
    const bytes = atob(String(base64 || ""));
    const output = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) output[index] = bytes.charCodeAt(index);
    return new Blob([output], { type: contentType || "image/jpeg" });
  }

  async function uploadProfilePhoto(payload) {
    const user = await currentFirebaseUser();
    if (!user) throw new Error("Sign in to upload a profile picture.");
    const { db, storage, firestoreSdk, storageSdk } = await ready;
    const extension = clean(payload.fileName).split(".").pop() || "jpg";
    const target = storageSdk.ref(storage, `profile-images/${user.uid}/profile.${extension}`);
    await storageSdk.uploadBytes(target, base64Blob(payload.imageBase64, payload.mimeType), {
      contentType: payload.mimeType || "image/jpeg"
    });
    const photoUrl = await storageSdk.getDownloadURL(target);
    const userRef = firestoreSdk.doc(db, "users", user.uid);
    await firestoreSdk.updateDoc(userRef, { photoUrl });
    const userData = (await firestoreSdk.getDoc(userRef)).data() || {};
    if (userData.linkedPlayerKey) {
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "linkedPlayers", user.uid), {
        photoUrl,
        photo: photoUrl,
        updatedAt: firestoreSdk.serverTimestamp()
      }, { merge: true });
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "publicPlayers", userData.linkedPlayerKey), { photoUrl }, { merge: true });
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "players", userData.linkedPlayerKey), { photoUrl }, { merge: true });
    }
    return { success: true, photoUrl };
  }

  async function getMatchPlayerDirectory() {
    if (!(await currentFirebaseUser())) throw new Error("Sign in to search the player directory.");
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "players"));
    const players = snapshot.docs.map(item => {
      const data = item.data();
      return {
        publicName: data.publicName || "",
        fullName: data.fullName || "",
        playerKey: data.playerKey || item.id
      };
    }).filter(item => item.fullName).sort((a, b) => a.fullName.localeCompare(b.fullName));
    return { success: true, players };
  }

  async function getPublicPlayerProfiles() {
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "publicPlayers"));
    const profiles = snapshot.docs.map(item => ({ playerKey: item.id, ...item.data() }))
      .filter(item => item.profileVisible !== false);
    return { success: true, profiles };
  }

  async function updatePlayerProfile(payload) {
    if (!(await currentFirebaseUser())) throw new Error("Sign in to edit player profiles.");
    const { db, firestoreSdk } = await ready;
    const key = clean(payload.playerKey);
    const profile = payload.profile || {};
    const publicData = {
      playerKey: key,
      nickname: clean(profile.nickname).slice(0, 80),
      photoUrl: clean(profile.photoUrl).slice(0, 500),
      bio: clean(profile.bio).slice(0, 1000),
      accolades: Array.isArray(profile.accolades) ? profile.accolades.map(clean).filter(Boolean) : [],
      role: clean(profile.role).slice(0, 50),
      song: clean(profile.song).slice(0, 500),
      highestCheckout: clean(profile.highestCheckout).slice(0, 10),
      gooch: profile.gooch ? "yes" : "",
      profileVisible: profile.profileVisible !== false,
      updatedAt: firestoreSdk.serverTimestamp()
    };
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "publicPlayers", key), publicData, { merge: true });
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "players", key), publicData, { merge: true });
    return { success: true, profile: publicData };
  }

  async function getCollectionRows(collectionName, fieldName, season = "") {
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, collectionName));
    return snapshot.docs
      .map(item => item.data())
      .filter(item => !season || season === "all" || item.season === season)
      .map(item => item[fieldName] || item);
  }

  async function getPublicSeasonResults(payload = {}) {
    return { success: true, results: await getCollectionRows("results", "sheetRow", clean(payload.season) || "26-27") };
  }

  async function getPublicSeasonFixtures(payload = {}) {
    return { success: true, fixtures: await getCollectionRows("fixtures", "sheetRow", clean(payload.season) || "26-27") };
  }

  function resultSheetRow(payload, imageUrls) {
    const match = payload.match || {};
    const row = {
      Competition: match.league || match.Competition || "",
      Date: formatDate(match.date || match.Date),
      HomeTeam: match.homeTeam || match.HomeTeam || "",
      AwayTeam: match.awayTeam || match.AwayTeam || "",
      HomeScore: match.homeScore ?? match.HomeScore ?? "",
      AwayScore: match.awayScore ?? match.AwayScore ?? "",
      Result: match.result || match.Result || ""
    };
    for (let index = 1; index <= 12; index += 1) {
      const player = (payload.players || [])[index - 1];
      row[`Player${index}`] = player ? clean(player.name) : "";
      row[`C${index}`] = player ? player.checkouts ?? "" : "";
      row[`F${index}`] = player ? Number(player.finesPence || 0) / 100 : "";
      row[`D${index}`] = player ? Boolean(player.doubleFine) : "";
      row[`O${index}`] = player ? player.oneEightys ?? "" : "";
      row[`B${index}`] = player ? player.bulls ?? "" : "";
      row[`T${index}`] = player ? player.tonOuts ?? "" : "";
    }
    row.IMGFOLDER = imageUrls.join("\n");
    row.Venue = match.venue || "";
    row["Cup?"] = Boolean(match.cup);
    row.Stage = match.stage || "";
    row.HomePoints = match.HomePoints ?? match.homePoints ?? "";
    row.AwayPoints = match.AwayPoints ?? match.awayPoints ?? "";
    return row;
  }

  function makeAutomaticPublicName(fullName, directory) {
    const parts = clean(fullName).split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const surname = parts.slice(1).join(" ");
    const collision = directory.some(item => normaliseName(item.fullName).split(" ")[0] === normaliseName(firstName));
    let candidate = collision && surname ? `${firstName} ${surname.charAt(0).toUpperCase()}` : firstName;
    const used = new Set(directory.map(item => normaliseName(item.publicName)));
    let number = 2;
    while (used.has(normaliseName(candidate))) candidate = `${firstName} ${surname.charAt(0).toUpperCase()}${number++}`;
    return candidate;
  }

  async function syncPlayers(players) {
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "players"));
    const directory = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    const known = new Set(directory.map(item => normaliseName(item.fullName)).filter(Boolean));
    for (const player of players || []) {
      const fullName = clean(player.fullName);
      if (fullName.split(/\s+/).length < 2 || known.has(normaliseName(fullName))) continue;
      const publicName = makeAutomaticPublicName(fullName, directory);
      const key = playerKey(publicName);
      const privateData = { fullName, publicName, playerKey: key, addedAt: firestoreSdk.serverTimestamp() };
      const publicData = { publicName, playerKey: key, profileVisible: true };
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "players", key), privateData, { merge: true });
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "publicPlayers", key), publicData, { merge: true });
      directory.push(privateData);
      known.add(normaliseName(fullName));
    }
  }

  async function uploadResultImages(resultId, images) {
    const { storage, storageSdk } = await ready;
    const urls = [];
    for (let index = 0; index < (images || []).length; index += 1) {
      const image = images[index];
      const name = clean(image.name) || `image-${index + 1}.jpg`;
      const target = storageSdk.ref(storage, `result-images/${resultId}/${name}`);
      await storageSdk.uploadBytes(target, base64Blob(image.base64, image.mimeType), {
        contentType: image.mimeType || "image/jpeg"
      });
      urls.push(await storageSdk.getDownloadURL(target));
    }
    return urls;
  }

  async function saveResult(payload) {
    const user = await currentFirebaseUser();
    if (!user) throw new Error("Log in to submit a result.");
    const ownUser = await loadOwnUser();
    if (!ownUser?.linkedPlayerKey) throw new Error("Only linked ONM players can submit results.");
    const { db, firestoreSdk } = await ready;
    const resultId = clean(payload.rowNumber) || firestoreSdk.doc(firestoreSdk.collection(db, "results")).id;
    const imageUrls = await uploadResultImages(resultId, payload.images || []);
    const sheetRow = resultSheetRow(payload, imageUrls);
    const data = {
      sheetRow,
      season: seasonFromDate(payload.match?.date),
      fixtureKey: clean(payload.match?.fixtureKey),
      submittedBy: user.uid,
      submittedByPlayerKey: ownUser.linkedPlayerKey,
      updatedAt: firestoreSdk.serverTimestamp()
    };
    if (!payload.rowNumber) data.createdAt = firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "results", resultId), data, { merge: true });
    await syncPlayers(payload.players || []);
    return { success: true, rowNumber: resultId, folderUrl: imageUrls[0] || "" };
  }

  async function getLinkedPlayers() {
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "linkedPlayers"));
    return { success: true, players: snapshot.docs.map(item => item.data()) };
  }

  async function saveDartMatch(payload) {
    const user = await currentFirebaseUser();
    if (!user) throw new Error("Sign in to save a match.");
    const { db, firestoreSdk } = await ready;
    const match = payload.match || {};
    if (!match.matchId) throw new Error("Missing match ID.");
    const ref = firestoreSdk.doc(db, "dartMatches", clean(match.matchId));
    if ((await firestoreSdk.getDoc(ref)).exists()) return { success: true, duplicate: true, matchId: match.matchId };
    await firestoreSdk.setDoc(ref, { ...match, submittedBy: user.uid, createdAt: firestoreSdk.serverTimestamp() });
    return { success: true, matchId: match.matchId };
  }

  async function getUserStats(payload) {
    const wantedName = normaliseName(payload.linkedPlayerName);
    const wantedKey = clean(payload.linkedPlayerKey);
    if (!wantedName && !wantedKey) return { success: false, error: "Missing linked player name." };
    const { db, firestoreSdk } = await ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, "dartMatches"));
    const totals = {
      gamesPlayed: 0, wins: 0, losses: 0, totalScored: 0, dartsThrown: 0,
      checkoutHits: 0, checkoutAttempts: 0, highestOut: 0, highScore: 0,
      bestLeg: 0, worstLeg: 0, oneEightys: 0, bullOuts: 0,
      firstNineTotal: 0, firstNineMatches: 0, legsFor: 0, legsAgainst: 0
    };
    const matchResults = [];
    snapshot.docs.map(item => item.data()).forEach(match => {
      const p1Match = wantedKey
        ? clean(match.playerOneId) === wantedKey
        : normaliseName(match.playerOneName) === wantedName;
      const p2Match = wantedKey
        ? clean(match.playerTwoId) === wantedKey
        : normaliseName(match.playerTwoName) === wantedName;
      if (!p1Match && !p2Match) return;
      const prefix = p1Match ? "playerOne" : "playerTwo";
      const other = p1Match ? "playerTwo" : "playerOne";
      const number = suffix => Number(match[`${prefix}${suffix}`] || 0);
      totals.gamesPlayed += 1;
      totals.legsFor += number("Legs");
      totals.legsAgainst += Number(match[`${other}Legs`] || 0);
      totals.totalScored += number("TotalScored");
      totals.dartsThrown += number("DartsThrown");
      totals.checkoutHits += number("CheckoutsHit");
      totals.checkoutAttempts += number("CheckoutAttempts");
      totals.oneEightys += number("180s");
      totals.bullOuts += number("BullOuts");
      totals.highestOut = Math.max(totals.highestOut, number("HighestOut"));
      totals.highScore = Math.max(totals.highScore, number("HighScore"));
      const bestLeg = number("BestLeg");
      const worstLeg = number("WorstLeg");
      if (bestLeg && (!totals.bestLeg || bestLeg < totals.bestLeg)) totals.bestLeg = bestLeg;
      if (worstLeg && worstLeg > totals.worstLeg) totals.worstLeg = worstLeg;
      const firstNine = number("First9Avg");
      if (firstNine) {
        totals.firstNineTotal += firstNine;
        totals.firstNineMatches += 1;
      }
      const won = match[`${prefix}Won`] === true || clean(match[`${prefix}Won`]).toLowerCase() === "true";
      totals[won ? "wins" : "losses"] += 1;
      matchResults.push({ won, date: clean(match.dateTime) });
    });
    matchResults.sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let index = matchResults.length - 1; index >= 0; index -= 1) {
      const amount = matchResults[index].won ? 1 : -1;
      if (streak && Math.sign(streak) !== amount) break;
      streak += amount;
    }
    return {
      success: true,
      stats: {
        gamesPlayed: totals.gamesPlayed,
        wins: totals.wins,
        losses: totals.losses,
        streak,
        legsFor: totals.legsFor,
        legsAgainst: totals.legsAgainst,
        legsFA: `${totals.legsFor}/${totals.legsAgainst}`,
        winRate: totals.gamesPlayed ? `${((totals.wins / totals.gamesPlayed) * 100).toFixed(2)}%` : "0.00%",
        average: totals.dartsThrown ? ((totals.totalScored / totals.dartsThrown) * 3).toFixed(2) : "0.00",
        firstNineAvg: totals.firstNineMatches ? (totals.firstNineTotal / totals.firstNineMatches).toFixed(2) : "0.00",
        dartsThrown: totals.dartsThrown || "",
        checkouts: `${totals.checkoutHits}/${totals.checkoutAttempts}`,
        checkoutRate: totals.checkoutAttempts ? `${((totals.checkoutHits / totals.checkoutAttempts) * 100).toFixed(2)}%` : "0.00%",
        highestOut: totals.highestOut || "",
        highScore: totals.highScore || "",
        bestLeg: totals.bestLeg ? `${totals.bestLeg} darts` : "",
        worstLeg: totals.worstLeg ? `${totals.worstLeg} darts` : "",
        oneEightys: totals.oneEightys,
        bullOuts: totals.bullOuts
      }
    };
  }

  async function getPlayerSeasonVoteData() {
    return { success: true, shouldShow: false, reason: "noActiveVote" };
  }

  async function submitPlayerSeasonVote(payload) {
    const user = await currentFirebaseUser();
    if (!user) throw new Error("Sign in to vote.");
    const { db, firestoreSdk } = await ready;
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "votes", user.uid), {
      vote: clean(payload.vote),
      submittedAt: firestoreSdk.serverTimestamp()
    });
    return { success: true, vote: clean(payload.vote) };
  }

  async function importSiteData(onProgress) {
    const user = await loadOwnUser();
    if (!user || !["admin", "owner"].includes(user.role)) {
      throw new Error("Your Firebase user must have the owner or admin role before importing data.");
    }

    const { db, firestoreSdk } = await ready;
    const report = message => typeof onProgress === "function" && onProgress(message);
    const loadJson = async path => {
      const response = await fetch(`${path}?migration=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return response.json();
    };

    report("Loading the existing player profiles…");
    const profiles = await loadJson("data/player-profile.json");
    const directory = [
      ["Nick", "Nick Horne"], ["Rob", "Rob Piesse"], ["Brad", "Brad Church"],
      ["Jack", "Jack Zilles"], ["Paddy", "Paddy Cope"], ["Codon", "Codon Walsh"],
      ["Ricky", "Ricky Plows"], ["Phil L", "Phil Lee"], ["Phil A", "Phil Leonard"],
      ["Luke", "Luke Venton"], ["Filip", "Filip Kalmus"], ["Gary", "Gary Hampshire"],
      ["Andre", "Andre Astbury-Palmer"], ["Fraser", "Fraser Gillies"], ["Bobby", "Bobby Harwood"],
      ["George T", "George Tapsell"], ["Billiams", "Michael Williams"], ["Nick B", "Nick Beresford"],
      ["James R", "James Russell"], ["David M", "David Mooney"], ["Matt C", "Matt Crawley"],
      ["Jonny", "Jonny Horne"], ["Remzi", "Remzi Esken"], ["Andy", "Andy Croft"],
      ["AP", "Alex Pendlebury"], ["Rob G", "Rob Goodall"], ["Kit", "Kit Neaves"],
      ["Sam", "Sam Sims"], ["Ian", "Ian Ryan"], ["Alfie", "Alfie Sell"],
      ["Seb", "Seb Priest"], ["Alex", "Alex Maguire"], ["Paul", "Paul Reed"],
      ["Charlie S", "Charlie Smith"], ["Paddy N", "Paddy Nicholsen"],
      ["James B", "James Bailey"], ["Adam T", "Adam Thornborn-Crook"]
    ];
    const publicNames = new Set(directory.map(([publicName]) => publicName));
    Object.keys(profiles || {}).forEach(publicName => {
      if (!publicNames.has(publicName)) directory.push([publicName, ""]);
    });

    for (const [publicName, fullName] of directory) {
      const key = playerKey(publicName);
      const profile = profiles[publicName] || {};
      const profileData = {
        publicName,
        playerKey: key,
        nickname: profile.nickname || "",
        photoUrl: profile.photo || profile.photoUrl || "",
        bio: profile.bio || "",
        accolades: Array.isArray(profile.accolades) ? profile.accolades : [],
        role: profile.role || "",
        song: profile.song || "",
        highestCheckout: clean(profile["highest-checkout"] || profile["highest checkout"]),
        gooch: clean(profile.gooch).toLowerCase(),
        profileVisible: profile.profileVisible !== false
      };
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "publicPlayers", key), profileData, { merge: true });
      await firestoreSdk.setDoc(firestoreSdk.doc(db, "players", key), {
        ...profileData,
        fullName,
        importedAt: firestoreSdk.serverTimestamp()
      }, { merge: true });
    }
    report(`Imported ${directory.length} players.`);

    const resultFiles = [
      ["24-25", "data/result-data-24-25.json"],
      ["25-26", "data/result-data-25-26.json"],
      ["26-27", "data/result-data-26-27.json"]
    ];
    let resultCount = 0;
    for (const [season, path] of resultFiles) {
      report(`Importing ${season} results…`);
      const rows = await loadJson(path);
      for (let index = 0; index < rows.length; index += 1) {
        const id = `${season}-${String(index + 1).padStart(4, "0")}`;
        await firestoreSdk.setDoc(firestoreSdk.doc(db, "results", id), {
          sheetRow: rows[index],
          season,
          imported: true,
          importedAt: firestoreSdk.serverTimestamp()
        }, { merge: true });
        resultCount += 1;
      }
    }
    report(`Imported ${resultCount} results.`);

    const fixtureFiles = [
      ["25-26", "data/fixtures-25-26.json"],
      ["26-27", "data/fixtures-26-27.json"]
    ];
    let fixtureCount = 0;
    for (const [season, path] of fixtureFiles) {
      report(`Importing ${season} fixtures…`);
      const rows = await loadJson(path);
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const id = `${season}-${fixtureKey(`${row.Date || ""}-${row.Opponent || ""}-${index}`)}`;
        await firestoreSdk.setDoc(firestoreSdk.doc(db, "fixtures", id), {
          sheetRow: row,
          season,
          imported: true,
          importedAt: firestoreSdk.serverTimestamp()
        }, { merge: true });
        fixtureCount += 1;
      }
    }
    report(`Imported ${fixtureCount} fixtures.`);
    return { players: directory.length, results: resultCount, fixtures: fixtureCount };
  }

  const actions = {
    register,
    login,
    resetPassword,
    getUser: checkUser,
    checkUser,
    findPlayers,
    linkPlayer,
    updateProfile,
    uploadProfilePhoto,
    getMatchPlayerDirectory,
    getPublicPlayerProfiles,
    updatePlayerProfile,
    getPublicSeasonResults,
    getPublicSeasonFixtures,
    submitResult: saveResult,
    updateResult: saveResult,
    getLinkedPlayers,
    saveDartMatch,
    getUserStats,
    getPlayerSeasonVoteData,
    submitPlayerSeasonVote
  };

  async function postFirebase(payload) {
    try {
      const handler = actions[payload?.action];
      if (!handler) throw new Error(`Firebase action is not implemented: ${payload?.action || "unknown"}`);
      return await handler(payload || {});
    } catch (error) {
      console.error("Firebase request failed", payload?.action, error);
      const message = error?.code === "auth/invalid-credential"
        ? "Invalid email or password. If this is your first login since the move to Firebase, choose Create account once."
        : error?.code === "auth/email-already-in-use"
          ? "An account already exists with this email."
          : error?.message || "Could not connect to Firebase.";
      return { success: false, error: message };
    }
  }

  async function postLegacy(payload) {
    const response = await fetch(LEGACY_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload || {}),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    return response.json();
  }

  async function post(payload) {
    return FIREBASE_PRIMARY ? postFirebase(payload) : postLegacy(payload);
  }

  async function signOut() {
    const { auth, authSdk } = await ready;
    await authSdk.signOut(auth);
  }

  // Accounts cached by the former Apps Script login do not contain a
  // Firebase uid. Remove them before session.js renders the header so an old
  // localStorage record can never be mistaken for an authenticated session.
  if (FIREBASE_PRIMARY) {
    try {
      const cachedUser = JSON.parse(localStorage.getItem("onmUser") || "null");
      if (cachedUser && !cachedUser.uid) localStorage.removeItem("onmUser");
    } catch {
      localStorage.removeItem("onmUser");
    }
  }

  window.ONMFirebase = {
    ready,
    post,
    postFirebase,
    signOut,
    loadOwnUser,
    importSiteData,
    playerKey,
    config,
    firebasePrimary: FIREBASE_PRIMARY
  };
})();
