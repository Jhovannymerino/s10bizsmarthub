// Minimal HTTP trigger so Docker backend can fire sync-vpn.sh on the host
const http = require('http');
const { spawn } = require('child_process');
const { existsSync } = require('fs');

const PORT = 3299;
const API_KEY = '1fe0bf01e872d7f586e4828abcdc1ba0a5283f5625570128';
const SCRIPT = '/opt/apps/s10bizsmarthub/sync-vpn.sh';
const LOG = '/var/log/s10-sync.log';
const MIN_YEAR = 2022;

function defaultYears() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = MIN_YEAR; y <= current; y++) years.push(String(y));
  return years;
}

let running = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Auth check
  const key = req.headers['x-sync-key'] || url.searchParams.get('key');
  if (key !== API_KEY) {
    res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return;
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running, script: existsSync(SCRIPT) }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/trigger') {
    if (running) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'busy', message: 'Sync ya en curso' }));
      return;
    }

    const years = url.searchParams.get('years')
      ? url.searchParams.get('years').split(',')
      : defaultYears();

    running = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started', years }));

    // Run sync years sequentially in background
    (async () => {
      for (const year of years) {
        await new Promise((resolve) => {
          const child = spawn(SCRIPT, [year], { stdio: ['ignore','pipe','pipe'] });
          child.stdout.on('data', d => process.stdout.write(d));
          child.stderr.on('data', d => process.stderr.write(d));
          child.on('close', resolve);
        });
      }
      running = false;
    })();
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[s10-sync-trigger] listening on :${PORT}`);
});
