const test = require('node:test');
const assert = require('node:assert/strict');
const { botProgress, championAwards } = require('../scripts/profile-game-progress.js');

test('bot progress ignores duplicates and invalid challenge keys and validates flawless scores', () => {
  const wins = ['1-1', '1-3', '1-5', '1-7', '1-9'];
  const scores = Object.fromEntries(wins.map(key => { const mode = Number(key.split('-')[1]); return [key, { won: mode === 9 ? 1 : (mode + 1) / 2, lost: 0 }]; }));
  assert.deepEqual(botProgress({ monsterBotWins: [...wins, '1-1', '0-1', '21-1', '1-11'], monsterBotBestScores: scores }), { challenges: 5, flawless: 5, trophies: 1 });
  scores['1-3'] = { won: 1, lost: 0 };
  assert.deepEqual(botProgress({ monsterBotWins: wins, monsterBotBestScores: scores }), { challenges: 5, flawless: 4, trophies: 0 });
});

test('a completed real tournament awards its verified champion, but not a runner-up or test winner', async () => {
  const { makeDraw, tournamentView, simulateTournamentResults } = await import('../scripts/tournament-engine.mjs');
  const data = { id: 'competition', title: 'Club Cup', settings: { structure: 'knockout', playMode: 'online', capacity: 4, drawMode: 'random', gameType: 'bestOf', legsCount: 1, startScore: 501, inMode: 'straight' }, entries: { a: 'A', b: 'B', c: 'C', d: 'D' }, seeds: {}, results: {}, status: 'live' };
  data.draw = makeDraw(data, () => .4);
  data.results = simulateTournamentResults(data, () => .4);
  const champion = tournamentView(data).winners[0];
  assert.equal(championAwards([data], [champion], tournamentView).length, 0);
  data.status = 'complete';
  assert.deepEqual(championAwards([data], [champion], tournamentView), [{ id: 'competition', title: 'Club Cup', mode: 'Online' }]);
  assert.equal(championAwards([data], ['not-the-winner'], tournamentView).length, 0);
  assert.equal(championAwards([{ ...data, testMode: true }], [champion], tournamentView).length, 0);
  assert.equal(championAwards([{ ...data, draw: null }], [champion], tournamentView).length, 0);
  assert.equal(championAwards([{ ...data, settings: { ...data.settings, playMode: 'inPerson' } }], [champion], tournamentView)[0].mode, 'In person');
});
