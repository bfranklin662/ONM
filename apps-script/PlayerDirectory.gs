/*
 * Dynamic match-player directory for Oche Ness Monsters.
 *
 * Add this as a new Apps Script file named PlayerDirectory.gs.
 * Run setupPlayerDirectory once, then deploy a new web-app version.
 */

const PLAYER_DIRECTORY_SHEET_NAME = "Player Directory";
const PLAYER_PROFILE_SEED_URL = "https://ochenessmonsters.com/data/player-profile.json";
const PLAYER_DIRECTORY_HEADERS = [
  "FullName",
  "PublicName",
  "PlayerKey",
  "Nickname",
  "PhotoURL",
  "Bio",
  "Accolades",
  "Role",
  "Song",
  "HighestCheckout",
  "Gooch",
  "ProfileVisible",
  "AddedAt"
];

// Used only to seed the directory sheet the first time it is created.
// New players are added automatically after a successful result submission.
const INITIAL_MATCH_PLAYER_DIRECTORY = [
  { publicName: "Nick", fullName: "Nick Horne" },
  { publicName: "Rob", fullName: "Rob Piesse" },
  { publicName: "Brad", fullName: "Brad Church" },
  { publicName: "Jack", fullName: "Jack Zilles" },
  { publicName: "Paddy", fullName: "Paddy Cope" },
  { publicName: "Codon", fullName: "Codon Walsh" },
  { publicName: "Ricky", fullName: "Ricky Plows" },
  { publicName: "Phil L", fullName: "Phil Lee" },
  { publicName: "Phil A", fullName: "Phil Leonard" },
  { publicName: "Luke", fullName: "Luke Venton" },
  { publicName: "Filip", fullName: "Filip Kalmus" },
  { publicName: "Gary", fullName: "Gary Hampshire" },
  { publicName: "Andre", fullName: "Andre Astbury-Palmer" },
  { publicName: "Fraser", fullName: "Fraser Gillies" },
  { publicName: "Bobby", fullName: "Bobby Harwood" },
  { publicName: "George T", fullName: "George Tapsell" },
  { publicName: "Billiams", fullName: "Michael Williams" },
  { publicName: "Nick B", fullName: "Nick Beresford" },
  { publicName: "James R", fullName: "James Russell" },
  { publicName: "David M", fullName: "David Mooney" },
  { publicName: "Matt C", fullName: "Matt Crawley" },
  { publicName: "Jonny", fullName: "Jonny Horne" },
  { publicName: "Remzi", fullName: "Remzi Esken" },
  { publicName: "Andy", fullName: "Andy Croft" },
  { publicName: "AP", fullName: "Alex Pendlebury" },
  { publicName: "Rob G", fullName: "Rob Goodall" },
  { publicName: "Kit", fullName: "Kit Neaves" },
  { publicName: "Sam", fullName: "Sam Sims" },
  { publicName: "Ian", fullName: "Ian Ryan" },
  { publicName: "Alfie", fullName: "Alfie Sell" },
  { publicName: "Seb", fullName: "Seb Priest" },
  { publicName: "Alex", fullName: "Alex Maguire" },
  { publicName: "Paul", fullName: "Paul Reed" },
  { publicName: "Charlie S", fullName: "Charlie Smith" },
  { publicName: "Paddy N", fullName: "Paddy Nicholsen" },
  { publicName: "James B", fullName: "James Bailey" },
  { publicName: "Adam T", fullName: "Adam Thornborn-Crook" }
];

function normaliseDirectoryName_(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function canonicalDirectoryFullName_(value) {
  const fullName = String(value || "").trim().replace(/\s+/g, " ");
  return normaliseDirectoryName_(fullName) === "alfie sells" ? "Alfie Sell" : fullName;
}

function getPlayerDirectorySheet_() {
  const spreadsheet = getResultsDataSheet().getParent();
  let sheet = spreadsheet.getSheetByName(PLAYER_DIRECTORY_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(PLAYER_DIRECTORY_SHEET_NAME);
  }

  ensurePlayerDirectorySchema_(sheet);
  sheet.setFrozenRows(1);

  return sheet;
}

function ensurePlayerDirectorySchema_(sheet) {
  const oldColumnCount = Math.max(sheet.getLastColumn(), 1);
  const oldHeaders = sheet.getRange(1, 1, 1, oldColumnCount).getDisplayValues()[0]
    .map(function(value) { return String(value || "").trim(); });
  const schemaMatches = PLAYER_DIRECTORY_HEADERS.every(function(header, index) {
    return oldHeaders[index] === header;
  }) && oldHeaders.length === PLAYER_DIRECTORY_HEADERS.length;

  if (schemaMatches) return;

  const oldRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, oldColumnCount).getValues()
    : [];
  const migratedRows = oldRows.map(function(row) {
    const record = {};
    oldHeaders.forEach(function(header, index) {
      if (header) record[header] = row[index];
    });
    return PLAYER_DIRECTORY_HEADERS.map(function(header) {
      if (header === "ProfileVisible" && record[header] === undefined) return true;
      return record[header] === undefined ? "" : record[header];
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, PLAYER_DIRECTORY_HEADERS.length).setValues([PLAYER_DIRECTORY_HEADERS]);
  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, PLAYER_DIRECTORY_HEADERS.length).setValues(migratedRows);
  }
}

function readPlayerDirectoryRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, PLAYER_DIRECTORY_HEADERS.length)
    .getValues()
    .map(function(row, index) {
      return {
        rowNumber: index + 2,
        fullName: canonicalDirectoryFullName_(row[0]),
        publicName: String(row[1] || "").trim(),
        playerKey: String(row[2] || "").trim(),
        nickname: String(row[3] || "").trim(),
        photoUrl: String(row[4] || "").trim(),
        bio: String(row[5] || "").trim(),
        accolades: String(row[6] || "").trim(),
        role: String(row[7] || "").trim(),
        song: String(row[8] || "").trim(),
        highestCheckout: String(row[9] || "").trim(),
        gooch: String(row[10] || "").trim().toLowerCase(),
        profileVisible: row[11] === "" ? true : String(row[11]).toLowerCase() !== "false",
        addedAt: row[12] || ""
      };
    })
    .filter(function(player) {
      return player.publicName;
    });
}

function seedPlayerDirectory_(sheet) {
  const existingPlayers = readPlayerDirectoryRows_(sheet);
  const existingFullNames = {};

  existingPlayers.forEach(function(player) {
    if (player.fullName) {
      existingFullNames[normaliseDirectoryName_(player.fullName)] = true;
    }

    // Correct the old spelling if it is already present in the sheet.
    if (player.fullName && sheet.getRange(player.rowNumber, 1).getDisplayValue() !== player.fullName) {
      sheet.getRange(player.rowNumber, 1).setValue(player.fullName);
    }
  });

  const newRows = INITIAL_MATCH_PLAYER_DIRECTORY
    .filter(function(player) {
      return !existingFullNames[normaliseDirectoryName_(player.fullName)];
    })
    .map(function(player) {
      return [
        player.fullName,
        player.publicName,
        makePlayerKey(player.publicName),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        true,
        new Date()
      ];
    });

  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, PLAYER_DIRECTORY_HEADERS.length)
      .setValues(newRows);
  }
}

function profileAccoladesCell_(value) {
  if (Array.isArray(value)) return value.join(",");
  return String(value || "").trim();
}

function importPlayerProfilesFromWebsite_(sheet) {
  let profiles = {};

  try {
    const response = UrlFetchApp.fetch(PLAYER_PROFILE_SEED_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return;
    profiles = JSON.parse(response.getContentText()) || {};
  } catch (error) {
    console.warn("Could not import existing player profiles", error);
    return;
  }

  const directory = readPlayerDirectoryRows_(sheet);
  const directoryByPublicName = {};
  directory.forEach(function(player) {
    directoryByPublicName[normaliseDirectoryName_(player.publicName)] = player;
  });

  const missingRows = [];
  Object.keys(profiles).forEach(function(publicName) {
    if (directoryByPublicName[normaliseDirectoryName_(publicName)]) return;
    const profile = profiles[publicName] || {};
    missingRows.push([
      "",
      publicName,
      makePlayerKey(publicName),
      profile.nickname || "",
      profile.photo || "",
      profile.bio || "",
      profileAccoladesCell_(profile.accolades),
      profile.role || "",
      profile.song || "",
      profile["highest-checkout"] || profile["highest checkout"] || "",
      profile.gooch || "",
      true,
      new Date()
    ]);
  });

  if (missingRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missingRows.length, PLAYER_DIRECTORY_HEADERS.length)
      .setValues(missingRows);
  }

  directory.forEach(function(player) {
    const profile = profiles[player.publicName];
    if (!profile) return;

    const existing = sheet.getRange(player.rowNumber, 4, 1, 9).getValues()[0];
    const imported = [
      profile.nickname || "",
      profile.photo || "",
      profile.bio || "",
      profileAccoladesCell_(profile.accolades),
      profile.role || "",
      profile.song || "",
      profile["highest-checkout"] || profile["highest checkout"] || "",
      profile.gooch || "",
      true
    ];

    const merged = existing.map(function(value, index) {
      return value === "" ? imported[index] : value;
    });
    sheet.getRange(player.rowNumber, 4, 1, merged.length).setValues([merged]);
  });
}

function setupPlayerDirectory() {
  const sheet = getPlayerDirectorySheet_();
  seedPlayerDirectory_(sheet);
  importPlayerProfilesFromWebsite_(sheet);

  if (!sheet.isSheetHidden()) {
    sheet.hideSheet();
  }

  return "Player Directory is ready with " + readPlayerDirectoryRows_(sheet).length + " players.";
}

function getMatchPlayerDirectory(payload) {
  const userId = String(payload.userId || "").trim();
  const email = normalizeEmail(payload.email);

  if (!userId || !email) {
    return jsonResponse({ success: false, error: "Sign in to search the player directory." });
  }

  const userRecord = findUserByEmail(email);
  if (!userRecord || String(userRecord.row[0]) !== userId) {
    return jsonResponse({ success: false, error: "User session could not be verified." });
  }

  if (userRecord.row[8] !== "Active") {
    return jsonResponse({ success: false, error: "Account inactive." });
  }

  const sheet = getPlayerDirectorySheet_();
  seedPlayerDirectory_(sheet);

  const players = readPlayerDirectoryRows_(sheet)
    .filter(function(player) { return player.fullName; })
    .map(function(player) {
      return {
        publicName: player.publicName,
        fullName: player.fullName,
        playerKey: player.playerKey || makePlayerKey(player.publicName)
      };
    });

  return jsonResponse({ success: true, players: players });
}

function publicPlayerProfile_(player) {
  return {
    publicName: player.publicName,
    playerKey: player.playerKey || makePlayerKey(player.publicName),
    nickname: player.nickname,
    photoUrl: player.photoUrl,
    bio: player.bio,
    accolades: player.accolades
      ? player.accolades.split(",").map(function(value) { return value.trim(); }).filter(Boolean)
      : [],
    role: player.role,
    song: player.song,
    highestCheckout: player.highestCheckout,
    gooch: player.gooch,
    profileVisible: player.profileVisible
  };
}

function getPublicPlayerProfiles() {
  const sheet = getPlayerDirectorySheet_();
  seedPlayerDirectory_(sheet);
  const profiles = readPlayerDirectoryRows_(sheet)
    .filter(function(player) { return player.profileVisible; })
    .map(publicPlayerProfile_);

  return jsonResponse({ success: true, profiles: profiles });
}

function assertActiveDirectoryEditor_(payload) {
  const userId = String(payload.userId || "").trim();
  const email = normalizeEmail(payload.email);

  if (!userId || !email) throw new Error("Sign in to edit player profiles.");

  const userRecord = findUserByEmail(email);
  if (!userRecord || String(userRecord.row[0]) !== userId) {
    throw new Error("User session could not be verified.");
  }
  if (userRecord.row[8] !== "Active") throw new Error("Account inactive.");
}

function cleanProfileField_(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function updatePlayerProfile(payload) {
  assertActiveDirectoryEditor_(payload);

  const playerKey = String(payload.playerKey || "").trim();
  if (!playerKey) throw new Error("Player key is required.");

  const sheet = getPlayerDirectorySheet_();
  const player = readPlayerDirectoryRows_(sheet).find(function(item) {
    return item.playerKey === playerKey;
  });
  if (!player) throw new Error("Player profile not found.");

  const profile = payload.profile || {};
  const values = [[
    cleanProfileField_(profile.nickname, 80),
    cleanProfileField_(profile.photoUrl, 500),
    cleanProfileField_(profile.bio, 1000),
    profileAccoladesCell_(profile.accolades).slice(0, 500),
    cleanProfileField_(profile.role, 50),
    cleanProfileField_(profile.song, 500),
    cleanProfileField_(profile.highestCheckout, 10),
    profile.gooch ? "yes" : "",
    profile.profileVisible !== false
  ]];

  sheet.getRange(player.rowNumber, 4, 1, values[0].length).setValues(values);
  const updated = readPlayerDirectoryRows_(sheet).find(function(item) {
    return item.playerKey === playerKey;
  });

  return jsonResponse({ success: true, profile: publicPlayerProfile_(updated) });
}

function makeAutomaticPublicName_(fullName, existingPlayers) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const surname = parts.slice(1).join(" ");
  const firstNameKey = normaliseDirectoryName_(firstName);

  const sameFirstNameExists = existingPlayers.some(function(player) {
    return normaliseDirectoryName_(String(player.fullName || "").split(/\s+/)[0]) === firstNameKey;
  });

  let candidate = sameFirstNameExists && surname
    ? firstName + " " + surname.charAt(0).toUpperCase()
    : firstName;

  const usedPublicNames = {};
  existingPlayers.forEach(function(player) {
    usedPublicNames[normaliseDirectoryName_(player.publicName)] = true;
  });

  if (!usedPublicNames[normaliseDirectoryName_(candidate)]) return candidate;

  let suffix = 2;
  while (usedPublicNames[normaliseDirectoryName_(candidate + suffix)]) {
    suffix++;
  }
  return candidate + suffix;
}

function syncSubmittedPlayersToDirectory(players) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getPlayerDirectorySheet_();
    seedPlayerDirectory_(sheet);
    const directory = readPlayerDirectoryRows_(sheet);
    const knownFullNames = {};

    directory.forEach(function(player) {
      if (player.fullName) {
        knownFullNames[normaliseDirectoryName_(player.fullName)] = true;
      }
    });

    const newRows = [];

    (players || []).forEach(function(player) {
      const fullName = canonicalDirectoryFullName_(player && player.fullName);
      const parts = fullName.split(/\s+/).filter(Boolean);
      const fullNameKey = normaliseDirectoryName_(fullName);

      // Do not permanently save blanks or first-name-only entries.
      if (parts.length < 2 || knownFullNames[fullNameKey]) return;

      const matchingPlaceholder = directory.find(function(existingPlayer) {
        return !existingPlayer.fullName &&
          normaliseDirectoryName_(existingPlayer.publicName) === normaliseDirectoryName_(player.name);
      });
      if (matchingPlaceholder) {
        sheet.getRange(matchingPlaceholder.rowNumber, 1).setValue(fullName);
        matchingPlaceholder.fullName = fullName;
        knownFullNames[fullNameKey] = true;
        return;
      }

      const publicName = makeAutomaticPublicName_(fullName, directory);
      const savedPlayer = {
        fullName: fullName,
        publicName: publicName,
        playerKey: makePlayerKey(publicName)
      };

      newRows.push([
        savedPlayer.fullName,
        savedPlayer.publicName,
        savedPlayer.playerKey,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        true,
        new Date()
      ]);
      directory.push(savedPlayer);
      knownFullNames[fullNameKey] = true;
    });

    if (newRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, PLAYER_DIRECTORY_HEADERS.length)
        .setValues(newRows);
    }
  } finally {
    lock.releaseLock();
  }
}
