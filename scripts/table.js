
let matches = [
  { home: "Puskas Lovers", away: "Cruyff FC", result: "1-1" },
  { home: "Catenaccio", away: "Maradona+10", result: "2-3" },
  { home: "Puskas Lovers", away: "Catenaccio", result: "0-0" },
  { home: "Cruyff FC", away: "Maradona+10", result: "2-0" },
  { home: "Catenaccio", away: "Cruyff FC", result: "1-0" },
  { home: "Maradona+10", away: "Puskas Lovers", result: "1-1" },
  { home: "Cruyff FC", away: "Puskas Lovers", result: "3-3" },
  { home: "Maradona+10", away: "Catenaccio", result: "1-0" },
  { home: "Catenaccio", away: "Puskas Lovers", result: "1-2" },
  { home: "Maradona+10", away: "Cruyff FC", result: "3-1" },
  { home: "Cruyff FC", away: "Catenaccio", result: "1-1" },
  { home: "Puskas Lovers", away: "Maradona+10", result: "4-0" },
  
]

let data = [];

function getDataFromMatches(matches) {    
  matches.forEach((match) => {
    let homeTeam = match.home;
    let awayTeam = match.away;
    let homeGoals = match.result.split("-")[0];
    let awayGoals = match.result.split("-")[1];
    let index = data.findIndex(team => team.NAME === homeTeam);
    // Home team non-existant in array, let's create it with default scores
    if (index === -1) {
      data.push({NAME: homeTeam, PL: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, P: 0});
    }
    index = data.findIndex(team => team.NAME === awayTeam);
    // Away team non-existant in array, let's create it with default scores
    if (index === -1) {
      data.push({NAME: awayTeam, PL: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, P: 0});
    }
    // parseInt is neccesary because goals are strings at this point
    processMatchResult(data, homeTeam, awayTeam, parseInt(homeGoals, 10), parseInt(awayGoals, 10));
  });
  // data is filled, let's sort it by points, goal difference, goals for.
  data.sort((teamA,teamB)=>(teamA.P - teamB.P || teamA.GD - teamB.GD || teamA.GF - teamB.GF));
  // sort gets ascending order, we need to reverse it for a normal league table
  data.reverse();
}

function processMatchResult(data, homeTeam, awayTeam, homeGoals, awayGoals) {
  // We get the reference to each team object
  let indexHT = data.findIndex(team => team.NAME === homeTeam);
  let indexAT = data.findIndex(team => team.NAME === awayTeam);
  // Common data (home) - plus one played and registering the goals
  data[indexHT].PL += 1;
  data[indexHT].GF += homeGoals;
  data[indexHT].GA += awayGoals;
  data[indexHT].GD = data[indexHT].GF - data[indexHT].GA;
  // Common data (away) - plus one played and registering the goals
  data[indexAT].PL += 1;
  data[indexAT].GF += awayGoals;
  data[indexAT].GA += homeGoals;
  data[indexAT].GD = data[indexAT].GF - data[indexAT].GA;
  // Draw
  if (homeGoals === awayGoals) {
    // Home team register a draw
    data[indexHT].D += 1;
    data[indexHT].P += 1;
    // Away team register a draw
    data[indexAT].D += 1;
    data[indexAT].P += 1;
  }
  // Home win
  if (homeGoals > awayGoals) {
    // Home team register a win
    data[indexHT].W += 1;
    data[indexHT].P += 3;
    // Away team register a loss
    data[indexAT].L += 1;
  }
  // Away win
  if (homeGoals < awayGoals) {
    // Away team register a win
    data[indexAT].W += 1;
    data[indexAT].P += 3;
    // Home team register a loss
    data[indexHT].L += 1;
  }
}

function insertTableHead(table, data) {
  let head = Object.keys(data[0]);
  let thead = table.createTHead();
  let row = thead.insertRow();
  row.className = "text-xs bg-purple-600 text-white font-bold";
  for (let key of head) {
    let th = document.createElement("th");
    th.className = "px-6 py-2";
    let text = document.createTextNode(key);
    th.appendChild(text);
    row.appendChild(th);
  }
}

function insertTableBody(table, data) {
  let oddRow = true;
  let first = true;
  for (let team of data) {
    let row = table.insertRow();
    
    if (oddRow) {
      row.className = "bg-purple-100";
      oddRow = false;
    } else {
      row.className = "bg-purple-50";
      oddRow = true;
    }
    if (first) {
      row.className = "font-semibold bg-purple-100";
      first = false;
    }

    for (let key in team) {
      let cell = row.insertCell();
      cell.className = "text-center p-2 border border-purple-50";
      let text = document.createTextNode(team[key]);
      cell.appendChild(text);
    }
  }
}

getDataFromMatches(matches);
let table = document.querySelector("#friends-league");
insertTableBody(table, data);
insertTableHead(table, data);

