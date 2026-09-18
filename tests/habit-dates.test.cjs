const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../roun_study_app.html'), 'utf8');
for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script);
const names = ['toggleV2Habit', 'getV2HabitReward', 'getV2StoredReward', 'calcHabitStreak', 'getHabitMilestoneReward', 'calculateRecordReward', 'calculateRecordSessions', 'sumStreakBonuses', 'addStreakBonus', 'bonusKey', 'getMiracleBonus'];
const source = names.map(name => {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  return html.slice(start, html.indexOf('\n}', start) + 2);
}).join('\n');
let saved = { history:{} }, selected = '2026-09-09';
const synced = [];
const context = vm.createContext({
  console, Set, Date, Number, Boolean, Math, JSON,
  loadState: () => structuredClone(saved),
  ensureV2ViewDate: () => selected,
  getV2TodayKey: () => '2026-09-09',
  getShowerBonus: () => 1000,
  getV2UnitRewardForDate: () => 500, getV2CompletedCount: () => 0,
  isV2Weekend: () => false,
  isWeekendDate: d => [0, 6].includes(d.getDay()),
  tasks: { miracle:{done:false}, shower:{done:false} }, xp:0,
  XP_GAINS: {miracle:30, shower:20}, STORE_KEY:'test',
  localStorage: {setItem: (_, value) => {saved = JSON.parse(value);}},
  calcTotalAccum: history => Object.values(history).reduce((sum, r) => sum + r.reward, 0),
  document: {getElementById: () => null},
  syncStudyDayToSupabase: async date => {synced.push(date);},
  syncXpToSupabase: async () => {}, updateProgress: () => {}, renderV2Home: () => {},
});
vm.runInContext(source, context);
context.toggleV2Habit('miracle');
assert.equal(saved.history[selected].reward, 4000);
const today = JSON.stringify(saved.history[selected]);
selected = '2026-09-08';
assert.equal(context.getV2HabitReward(selected).total, 0);
context.toggleV2Habit('shower');
assert.equal(saved.history[selected].reward, 1000);
assert.equal(JSON.stringify(saved.history['2026-09-09']), today);
assert.equal(context.tasks.shower.done, false);
context.toggleV2Habit('miracle');
assert.equal(saved.history[selected].reward, 5000);
assert.equal(context.getV2HabitReward(selected).total, 5000);
const snapshot = {rewardSnapshot:{total:3000, habitReward:{total:0}}};
assert.equal(context.getV2StoredReward(snapshot, selected).total, 8000);
context.toggleV2Habit('shower');
assert.equal(saved.history[selected].reward, 4000);
assert.equal(context.getV2StoredReward(snapshot, selected).total, 7000);
context.toggleV2Habit('miracle');
assert.equal(saved.history[selected].reward, 0);
assert.equal(JSON.stringify(saved.history['2026-09-09']), today);
context.toggleV2Habit('shower');
assert.equal(saved.history[selected].reward, 1000);
assert.equal(saved.totalAccum, 5000);
assert.equal(synced.at(-1), selected);
assert.equal(context.getV2HabitReward('2026-09-07').total, 0);
// Cancelling a milestone removes only that day's habit bonus; checking again pays once.
saved = {history:{}, claimedBonuses:{}};
for (let day = 1; day <= 9; day++) saved.history[`2026-09-0${day}`] = {completed:['miracle'], reward:4000};
selected = '2026-09-10';
context.toggleV2Habit('miracle');
assert.equal(saved.history[selected].reward, 14000);
context.toggleV2Habit('miracle');
assert.equal(saved.history[selected].reward, 0);
context.toggleV2Habit('miracle');
assert.equal(saved.history[selected].reward, 14000);
assert.equal(saved.history[selected].streakBonuses.length, 1);
assert.match(html, /#screen-word2 > \* \{ flex-shrink:0; \}/);
assert.match(html, /\.screen \{[^}]*min-height:0;[^}]*overflow-y:auto;/);
console.log('PASS: script syntax, date isolation, past rewards, cancellation, recheck, snapshots, milestones, and scroll CSS');

for (const days of [10,20,30,40]) assert.equal(context.getHabitMilestoneReward(days, 'miracle'), 10000);
assert.equal(context.getHabitMilestoneReward(9, 'miracle'), 0);
assert.equal(context.getHabitMilestoneReward(10, 'shower'), 5000);
