// HTTP trigger: Docker backend → sync-vpn.sh en el host VPS
// Expone progreso detallado (año/empresa/batch) vía GET /status
const http = require('http');
const { spawn } = require('child_process');
const { existsSync } = require('fs');

const PORT = 3299;
const API_KEY = '1fe0bf01e872d7f586e4828abcdc1ba0a5283f5625570128';
const SCRIPT = '/opt/apps/s10bizsmarthub/sync-vpn.sh';
const MIN_YEAR = 2022;

function defaultYears() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = MIN_YEAR; y <= current; y++) years.push(String(y));
  return years;
}

// Estado de progreso global — actualizado en tiempo real mientras corre el sync
const progress = {
  running: false,
  script: false,
  years: [],
  totalYears: 0,
  currentYearIndex: -1,
  currentYear: null,
  completedYears: [],
  currentCompany: null,
  currentBatch: null,
  companiesDone: [],       // empresas completadas en el año actual
  startedAt: null,
  finishedAt: null,
  lastLine: '',
};

function resetProgress() {
  progress.running = false;
  progress.years = [];
  progress.totalYears = 0;
  progress.currentYearIndex = -1;
  progress.currentYear = null;
  progress.completedYears = [];
  progress.currentCompany = null;
  progress.currentBatch = null;
  progress.companiesDone = [];
  progress.startedAt = null;
  progress.finishedAt = null;
  progress.lastLine = '';
}

// Parsea líneas del stdout de sync-agent.js para extraer progreso
function parseLine(line) {
  line = line.trim();
  if (!line) return;

  progress.lastLine = line;

  // "Processing: CMO GROUP S.A. (22011489)"
  const companyMatch = line.match(/^Processing:\s+(.+?)\s+\(\d+\)/);
  if (companyMatch) {
    // Si ya había empresa, no la añadimos dos veces
    if (progress.currentCompany && !progress.companiesDone.includes(progress.currentCompany)) {
      // No la marcamos como done todavía — se marca cuando llega "✓ Pushed to VPS"
    }
    progress.currentCompany = companyMatch[1];
    progress.currentBatch = null;
    return;
  }

  // "  → Batch 1: P&L, CxC, CxP..."
  const batchMatch = line.match(/→ (Batch \d+[^.]*)/);
  if (batchMatch) {
    progress.currentBatch = batchMatch[1].trim();
    return;
  }

  // "  → Batch 4: Validaciones forenses..."
  const batch4Match = line.match(/→ (Batch 4[^.]*)/);
  if (batch4Match) {
    progress.currentBatch = batch4Match[1].trim();
    return;
  }

  // "  ✓ Pushed to VPS — 52 KPI types saved"
  if (line.includes('Pushed to VPS') && progress.currentCompany) {
    if (!progress.companiesDone.includes(progress.currentCompany)) {
      progress.companiesDone.push(progress.currentCompany);
    }
    progress.currentBatch = null;
    return;
  }

  // "Sync completed."
  if (line.includes('Sync completed')) {
    progress.currentCompany = null;
    progress.currentBatch = null;
    return;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Auth
  const key = req.headers['x-sync-key'] || url.searchParams.get('key');
  if (key !== API_KEY) {
    res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return;
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    progress.script = existsSync(SCRIPT);
    const elapsed = progress.startedAt ? Math.floor((Date.now() - progress.startedAt) / 1000) : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...progress, elapsed }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/trigger') {
    if (progress.running) {
      const elapsed = progress.startedAt ? Math.floor((Date.now() - progress.startedAt) / 1000) : 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'busy', message: 'Sync ya en curso', ...progress, elapsed }));
      return;
    }

    const years = url.searchParams.get('years')
      ? url.searchParams.get('years').split(',').filter(Boolean)
      : defaultYears();

    resetProgress();
    progress.running = true;
    progress.years = years;
    progress.totalYears = years.length;
    progress.startedAt = Date.now();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started', years }));

    // Corre los años secuencialmente en background
    (async () => {
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        progress.currentYearIndex = i;
        progress.currentYear = year;
        progress.currentCompany = null;
        progress.currentBatch = null;
        progress.companiesDone = [];

        await new Promise((resolve) => {
          const child = spawn(SCRIPT, [year], { stdio: ['ignore', 'pipe', 'pipe'] });

          let buf = '';
          child.stdout.on('data', (d) => {
            process.stdout.write(d);
            buf += d.toString();
            const lines = buf.split('\n');
            buf = lines.pop(); // keep incomplete last line
            for (const line of lines) parseLine(line);
          });
          child.stderr.on('data', (d) => process.stderr.write(d));
          child.on('close', () => {
            if (buf) parseLine(buf);
            progress.completedYears.push(year);
            resolve();
          });
        });
      }

      progress.running = false;
      progress.finishedAt = Date.now();
      progress.currentYear = null;
      progress.currentCompany = null;
      progress.currentBatch = null;
    })();
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[s10-sync-trigger] listening on :${PORT}`);
});
