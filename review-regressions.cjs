// Run: NODE_PATH=<directory containing typescript> node review-regressions.cjs
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
function load(file, globals, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
    .replace('export const share = new Share()', '');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText, {exports, require: name => imports[name] || {}, console, ...globals});
  return exports;
}
async function main() {
  const root = '/group/lan-transfer-share-inbox';
  const removed = [];
  const good = `${root}/abc-123/file.txt`;
  const bad = ['/valuable/file', `${root}/abc-123/../file`, `${root}/abc-123/..`, `${root}/abc-123/a/b`];
  const shared = load('局域网互传/shared_files.ts', {
    FileManager: {appGroupDocumentsDirectory: '/group', existsSync: () => true, removeSync: p => removed.push(p)},
    Storage: {get: () => [...bad, good].map(p => ({path:p, createdAt:1})), remove() {}},
  }, {scripting: {Path:path.posix}});
  assert.equal(shared.isStagedSharedFile(good), true);
  for (const p of bad) assert.equal(shared.isStagedSharedFile(p), false);
  assert.equal(shared.claimSharedFiles().length, 0);
  assert.deepEqual(removed, [`${root}/abc-123`]);
  const {Share} = load('局域网互传/class/share.ts', {}, {});
  let closed = 0;
  const session = {close() {closed++}};
  const receiver = {sessions: []};
  for (const raw of ['null', '[]', '42', '"text"', '{}', '{', 'x'.repeat(700001)]) {
    Share.prototype.handlePacket.call(receiver, session, raw);
  }
  assert.equal(closed, 7);
  for (const succeeds of [true, false]) {
    let ended = 0, started = 0, updates = 0, alerts = 0;
    let saved = {id:'existing', origin:1};
    let finish;
    const done = new Promise(resolve => {finish = resolve});
    load('IslandSeconds/index.tsx', {
      Storage: {get: () => saved, set: (_key, value) => {saved=value; return true}, remove: () => {throw Error('unexpected remove')}},
      Dialog: {actionSheet: async () => 1, alert: async () => {alerts++}},
      console: {log() {}, error() {}},
    }, {
      scripting: {LiveActivity: {from: async () => ({getActivityState: async () => 'active', update: async () => {updates++;return succeeds}, end: async () => {ended++;return true}})}, Script: {exit:finish}},
      './live_activity': {ACTIVITY_NAME:'clock', SecondsActivity: () => {started++;throw Error('unexpected start')}},
    });
    await done;
    assert.equal(updates, 1); assert.equal(ended, 0); assert.equal(started, 0);
    assert.equal(alerts, succeeds ? 0 : 1);
    assert.equal(saved.id, 'existing');
    if (!succeeds) assert.equal(saved.origin, 1);
  }
  for (const succeeds of [true, false]) {
    const stored = new Map([['lanTransfer.activityOwner', 'owner'], ['lanTransfer.activityId', 'activity']]);
    const {TransferActivityController} = load('局域网互传/activity.ts', {
      Storage: {get: key => stored.get(key), remove: key => stored.delete(key)},
      console: {warn() {}},
    }, {'./class/share': {share: {setActivityStateListener() {}}}});
    const controller = new TransferActivityController();
    controller.ownerToken = 'owner';
    controller.activity = {end: async () => succeeds};
    controller.state = () => ({});
    await controller.stop();
    assert.equal(stored.has('lanTransfer.activityId'), !succeeds);
  }
  console.log('PASS: staged cleanup boundaries, malformed packets, resync and activity-stop success/failure');
}
main().catch(error => {console.error(error); process.exitCode=1});
