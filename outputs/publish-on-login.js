import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.dirname(fileURLToPath(import.meta.url)), root = path.dirname(app);
const logs = path.join(root, 'work', 'auto-publish');
fs.mkdirSync(logs, { recursive: true });
const logFile = path.join(logs, 'latest.log'), markerFile = path.join(logs, 'last-success.json'), lockFile = path.join(logs, 'running.lock');
const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
const log = message => fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const command = (name, args, cwd = root, timeout = 60000) => {
  const result = spawnSync(name, args, { cwd, encoding: 'utf8', windowsHide: true, timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  if (result.stdout) log(result.stdout.trim());
  if (result.status !== 0) throw new Error(`${name} failed: ${result.error?.message || result.stderr || result.status}`);
  return result.stdout.trim();
};

let ownLock = false;
try {
  if (process.argv.includes('--startup')) await sleep(60000);
  try {
    const pid = Number(fs.readFileSync(lockFile, 'utf8'));
    try { process.kill(pid, 0); log('Already running; skipped.'); process.exit(0); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    fs.unlinkSync(lockFile);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const fd = fs.openSync(lockFile, 'wx'); fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd); ownLock = true;
  const previous = fs.existsSync(markerFile) ? JSON.parse(fs.readFileSync(markerFile, 'utf8')) : null;
  if (!process.argv.includes('--force') && previous?.day === day()) { log('Already published today; skipped.'); }
  else {
    log('Starting PC fetch and publication.');
    if (command('git', ['branch', '--show-current']) !== 'main') throw new Error('main branch is required');
    if (command('git', ['remote', 'get-url', 'origin']) !== 'https://github.com/sawanoto/kindle-unlimited-new-arrivals.git') throw new Error('Unexpected remote');
    if (command('git', ['diff', '--cached', '--name-only'])) throw new Error('Staged changes exist; finish editing before publication.');
    const allowed = new Set(['outputs/data/latest.json', 'outputs/data/status.json', 'outputs/data/manual-exclusion-ids.json']);
    const changes = [command('git', ['diff', '--name-only']), command('git', ['ls-files', '--others', '--exclude-standard'])].join('\n').split('\n').filter(Boolean);
    if (changes.some(file => !allowed.has(file))) throw new Error('Code has uncommitted changes; publication stopped to protect edits.');
    // ネット接続がサインイン直後に未準備でも、取得元には接続せずGitHubだけで待機する。
    let ready = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try { command('git', ['fetch', 'origin', 'main']); ready = true; break; }
      catch (error) { log(error.message); if (attempt < 4) await sleep(30000); }
    }
    if (!ready) throw new Error('Network unavailable after waiting.');
    const ahead = command('git', ['rev-list', '--count', 'HEAD..origin/main']);
    if (ahead !== '0') {
      if (changes.length) throw new Error('Remote updates and local data changes both exist; ask Codex to synchronize.');
      command('git', ['merge', '--ff-only', 'origin/main']);
    }
    command(process.execPath, ['crawler.js'], app, 15 * 60 * 1000);
    const records = JSON.parse(fs.readFileSync(path.join(app, 'data/manual-exclusions.json'), 'utf8'));
    const seedFile = path.join(app, 'data/manual-exclusion-ids.json');
    const ids = new Set([...JSON.parse(fs.readFileSync(seedFile, 'utf8')), ...records.map(book => book.id)]);
    fs.writeFileSync(seedFile, JSON.stringify([...ids], null, 2));
    command('git', ['add', ...allowed]);
    if (command('git', ['diff', '--cached', '--name-only'])) command('git', ['commit', '-m', `Publish PC-fetched KU data ${day()}`]);
    command('git', ['push', 'origin', 'main']);
    const marker = { day: day(), publishedAt: new Date().toISOString(), commit: command('git', ['rev-parse', 'HEAD']) };
    fs.writeFileSync(markerFile, JSON.stringify(marker, null, 2));
    log('Success: data pushed; GitHub Actions will deploy the website.');
  }
} catch (error) { log(`ERROR: ${error.message}`); process.exitCode = 1; }
finally { if (ownLock) fs.unlinkSync(lockFile); }
