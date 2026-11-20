import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canvas, operations, readJson, scenarioOrder } from './scenarios.mjs';

const publicDir = join(canvas, 'public');
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' };

export async function createLabServer({ actions = operations } = {}) {
  const seed = await readJson(join(publicDir, 'snapshot.json'));
  const state = { preparedAt: seed.preparedAt, scenarios: seed.scenarios, updated: {}, active: null };
  return createServer(async (req, res) => {
    const send = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      if (!['127.0.0.1', 'localhost'].includes(req.headers.host?.split(':')[0])) return send(403, { error: 'Use the local address.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, state);
      if (url.pathname.startsWith('/api/')) {
        const action = url.pathname.slice(5);
        if (req.method !== 'POST' || !scenarioOrder.includes(action)) return send(404, { error: 'Unknown operation.' });
        if (req.headers.origin !== 'http://' + req.headers.host ||
            req.headers['x-replay-lab'] !== '1') return send(403, { error: 'Operations require a same-origin request.' });
        if (state.active) return send(409, { error: 'An operation is already running.' });
        const active = { action, startedAt: Date.now(), event: null };
        state.active = active;
        try {
          state.scenarios[action] = await actions[action]((event) => { active.event = event; });
          state.updated[action] = new Date().toISOString();
        } catch (error) {
          console.error(`[${action}] ${error.message}`);
          return send(422, { error: `${action} failed. Check the local server log and the Kujo, Eval, and Dispatch setup.` });
        } finally { state.active = null; }
        return send(200, state);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'Method not allowed.' });
      const path = resolve(publicDir, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(publicDir + sep) || !types[extname(path)]) return send(404, { error: 'File not found.' });
      const file = await stat(path).catch(() => null);
      if (!file?.isFile()) return send(404, { error: 'File not found.' });
      res.writeHead(200, { 'Content-Type': types[extname(path)], 'Content-Length': file.size, 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(path);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch {
      if (res.headersSent) res.destroy();
      else send(400, { error: 'Invalid request.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await createLabServer();
  server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
    console.log(`Replay Lab — http://127.0.0.1:${server.address().port}`);
  });
}
