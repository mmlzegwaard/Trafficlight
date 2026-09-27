import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RotterdamTracker } from './tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const port = Number(process.env.PORT) || 3000;
const tracker = new RotterdamTracker();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function serveFile(response, filePath) {
  try {
    const contents = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    });
    response.end(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendJson(response, 404, { error: 'Niet gevonden' });
      return;
    }

    sendJson(response, 500, { error: 'Bestand kon niet worden geladen' });
  }
}

function resolvePublicPath(requestPath) {
  const relativePath = requestPath.replace(/^\/+/, '') || 'rotterdam.html';
  const resolvedPath = path.resolve(publicDir, relativePath);

  if (resolvedPath !== publicDir && !resolvedPath.startsWith(`${publicDir}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && requestUrl.pathname === '/api/rotterdam/status') {
    sendJson(response, 200, tracker.getStatus());
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/rotterdam/poll') {
    const status = await tracker.poll();
    sendJson(response, 200, status);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/') {
    response.writeHead(302, { Location: '/rotterdam' });
    response.end();
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/rotterdam') {
    await serveFile(response, path.join(publicDir, 'rotterdam.html'));
    return;
  }

  if (request.method === 'GET') {
    const publicPath = resolvePublicPath(requestUrl.pathname);
    if (!publicPath) {
      sendJson(response, 404, { error: 'Niet gevonden' });
      return;
    }

    await serveFile(response, publicPath);
    return;
  }

  sendJson(response, 405, { error: 'Methode niet toegestaan' });
});

tracker.start();

server.listen(port, () => {
  console.log(`Rotterdam tracker draait op http://localhost:${port}/rotterdam`);
});
