import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const js = 'text/javascript; charset=utf-8';
const routes = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
  '/app.js': ['public/app.js', js],
  '/pdf-lib.min.js': ['node_modules/pdf-lib/dist/pdf-lib.min.js', js],
  '/favicon.ico': ['public/favicon.ico', 'image/x-icon'],
  '/favicon.svg': ['public/favicon.svg', 'image/svg+xml'],
  '/apple-touch-icon.png': ['public/apple-touch-icon.png', 'image/png'],
  '/og-image.png': ['public/og-image.png', 'image/png'],
};
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

if (!existsSync(path.join(root, routes['/pdf-lib.min.js'][0]))) {
  console.error('pdf-lib is missing. Run "npm install" first, then "npm start".');
  process.exit(1);
}

const startPort = Number(process.env.PORT) || 3000;
const maxAttempts = 10;

const server = http.createServer(async (req, res) => {
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  const { port } = server.address();
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return send(403, 'Forbidden');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let pathname;
  try {
    pathname = new URL(req.url, 'http://x').pathname;
  } catch {
    return send(404, 'Not found');
  }
  const route = Object.hasOwn(routes, pathname) && routes[pathname];
  if (!route) return send(404, 'Not found');
  try {
    send(200, await readFile(path.join(root, route[0])), { 'Content-Type': route[1] });
  } catch {
    send(404, 'Not found');
  }
});

const openBrowser = (url) => {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', `"${url}"`]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' }).on('error', () => {}).unref();
  } catch {}
};

const listen = (port, attempt = 1) => {
  server.once('error', (err) => {
    server.removeAllListeners('listening');
    if (err.code === 'EADDRINUSE' && attempt < maxAttempts) return listen(port + 1, attempt + 1);
    console.error(err.code === 'EADDRINUSE'
      ? `Could not find a free port (tried ${startPort}-${port}). Close the other app using it, or set a different PORT, e.g. PORT=4000 npm start.`
      : `Could not start the server: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    server.removeAllListeners('error');
    const url = `http://localhost:${port}`;
    console.log(`PDF Combiner is running at ${url}\nPress Ctrl+C to stop.`);
    if (process.env.NO_OPEN !== '1') openBrowser(url);
  });
};

listen(startPort);
