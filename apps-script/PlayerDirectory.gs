/*
 * Dynamic match-player directory for Oche Ness Monsters.
 *
 * Add this as a new Apps Script file named PlayerDirectory.gs.
 * Run setupPlayerDirectory once, then deploy a new web-app version.
 */

const PLAYER_DIRECTORY_SHEET_NAME = "Player Directory";
const PLAYER_DIRECTORY_HEADERS = ["FullName", "PublicName", "PlayerKey", "AddedAt"];

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
  const spreadsheet = SpreadsheetApp.openById(RESULTS_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(PLAYER_DIRECTORY_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(PLAYER_DIRECTORY_SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, PLAYER_DIRECTORY_HEADERS.length)
    .setValues([PLAYER_DIRECTORY_HEADERS]);
  sheet.setFrozenRows(1);

  return sheet;
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
        addedAt: row[3] || ""
      };
    })
    .filter(function(player) {
      return player.fullName && player.publicName;
    });
}

function seedPlayerDirectory_(sheet) {
  const existingPlayers = readPlayerDirectoryRows_(sheet);
  const existingFullNames = {};

  existingPlayers.forEach(function(player) {
    existingFullNames[normaliseDirectoryName_(player.fullName)] = true;

    // Correct the old spelling if it is already present in the sheet.
    if (sheet.getRange(player.rowNumber, 1).getDisplayValue() !== player.fullName) {
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
        new Date()
      ];
    });

  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, PLAYER_DIRECTORY_HEADERS.length)
      .setValues(newRows);
  }
}

function setupPlayerDirectory() {
  const sheet = getPlayerDirectorySheet_();
  seedPlayerDirectory_(sheet);

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

  const players = readPlayerDirectoryRows_(sheet).map(function(player) {
    return {
      publicName: player.publicName,
      fullName: player.fullName,
      playerKey: player.playerKey || makePlayerKey(player.publicName)
    };
  });

  return jsonResponse({ success: true, players: players });
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
      knownFullNames[normaliseDirectoryName_(player.fullName)] = true;
    });

    const newRows = [];

    (players || []).forEach(function(player) {
      const fullName = canonicalDirectoryFullName_(player && player.fullName);
      const parts = fullName.split(/\s+/).filter(Boolean);
      const fullNameKey = normaliseDirectoryName_(fullName);

      // Do not permanently save blanks or first-name-only entries.
      if (parts.length < 2 || knownFullNames[fullNameKey]) return;

      const publicName = makeAutomaticPublicName_(fullName, directory);
      const savedPlayer = {
        fullName: fullName,
        publicName: publicName,
        playerKey: makePlayerKey(publicName)
      };

      newRows.push([savedPlayer.fullName, savedPlayer.publicName, savedPlayer.playerKey, new Date()]);
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
