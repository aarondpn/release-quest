const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs', 'matches');
let dirEnsured = false;

function ensureDir() {
  if (dirEnsured) return;
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  dirEnsured = true;
}

function createMatchLog(lobbyId) {
  ensureDir();
  const ts = Date.now();
  const filename = `${lobbyId}_${ts}.jsonl`;
  const filepath = path.join(LOGS_DIR, filename);
  const stream = fs.createWriteStream(filepath, { flags: 'a' });

  return {
    log(event, data) {
      const line = JSON.stringify({ t: Date.now(), event, ...data });
      stream.write(line + '\n');
    },
    close() {
      stream.end();
    },
  };
}

module.exports = { createMatchLog };
