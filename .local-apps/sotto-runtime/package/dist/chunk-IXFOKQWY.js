import { abortable } from './chunk-GDO34PSX.js';
import { randomBytes, timingSafeEqual } from 'crypto';
import { mkdtemp, chmod, rm } from 'fs/promises';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { once } from 'events';
import { z } from 'zod';

// src/runtime/isolated-claude-relay.ts
var isolatedClaudeRelay = String.raw`
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
(async () => {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 4 * 1024 * 1024) throw new Error('Bootstrap input limit');
  }
  const config = JSON.parse(input);
  const version = execFileSync('claude', ['--version'], {
    cwd: '/work', timeout: 10000, maxBuffer: 1024,
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/work', CLAUDE_CONFIG_DIR: '/work/.claude' },
  }).toString().trim();
  if (version !== '2.1.283 (Claude Code)') throw new Error('Unsupported Claude protocol version');
  const server = http.createServer((incoming, outgoing) => {
    if (incoming.method === 'GET' && incoming.url === '/api/hello') {
      outgoing.writeHead(200, { 'content-type': 'application/json' });
      outgoing.end('{}');
      return;
    }
    if (incoming.method !== 'POST' || !['/v1/messages', '/v1/messages?beta=true'].includes(incoming.url)) {
      outgoing.writeHead(403); outgoing.end(); return;
    }
    const upstream = http.request({ socketPath: '/broker/broker.sock', path: '/v1/messages', method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.token } }, (response) => {
        outgoing.writeHead(response.statusCode, { 'content-type': response.headers['content-type'] || 'application/json' });
        response.on('error', () => outgoing.destroy());
        response.pipe(outgoing);
      });
    upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    incoming.on('error', () => upstream.destroy());
    outgoing.on('close', () => upstream.destroy());
    incoming.pipe(upstream);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const child = spawn('claude', ['--bare', ...config.args], {
    cwd: '/work',
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/work', CLAUDE_CONFIG_DIR: '/work/.claude',
      ANTHROPIC_API_KEY: 'isolated-execution-placeholder', ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + server.address().port,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(config.maxOutputTokens),
      MAX_THINKING_TOKENS: '0' },
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  child.stdin.on('error', () => {});
  child.stdin.end(config.prompt);
  child.once('error', () => { server.closeAllConnections(); server.close(); process.exitCode = 1; });
  child.once('close', (code) => { server.closeAllConnections(); server.close(); process.exitCode = code === 0 ? 0 : 1; });
})().catch(() => { process.stderr.write('Isolated CLI bootstrap failed\n'); process.exitCode = 1; });
`;

// src/runtime/credential-broker.ts
var textBlock = z.object({
  type: z.literal("text"),
  text: z.string(),
  cache_control: z.object({ type: z.literal("ephemeral") }).strict().optional()
}).strict();
var anthropicBody = z.object({
  model: z.string(),
  max_tokens: z.number().int().positive(),
  messages: z.array(
    z.object({ role: z.enum(["user", "assistant"]), content: z.union([z.string(), z.array(textBlock)]) }).strict()
  ).min(1).max(512),
  system: z.union([z.string(), z.array(textBlock)]).optional(),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop_sequences: z.array(z.string().max(200)).max(10).optional(),
  tools: z.array(z.never()).max(0).optional(),
  metadata: z.object({ user_id: z.string().max(1024) }).strict().optional(),
  thinking: z.object({ type: z.literal("disabled") }).strict().optional(),
  output_config: z.object({ effort: z.enum(["low", "medium", "high", "max"]) }).strict().optional()
}).strict();
var chatBody = z.object({
  model: z.string(),
  max_tokens: z.number().int().positive(),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }).strict()).min(1).max(512),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional()
}).strict();
var CredentialBrokerCleanupError = class extends Error {
  constructor() {
    super("Credential broker cleanup could not be verified");
    this.name = "CredentialBrokerCleanupError";
  }
};
function authorized(request, token) {
  const supplied = request.headers.authorization;
  if (typeof supplied !== "string") return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function reject(response, status) {
  if (response.headersSent) response.destroy();
  else {
    response.writeHead(status, { "content-type": "application/json", connection: "close" });
    response.end(JSON.stringify({ error: "broker_request_rejected" }));
  }
}
async function startCredentialBroker(options) {
  options = { ...options };
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
    throw new TypeError("Broker requires a fixed HTTPS endpoint");
  const route = options.protocol === "anthropic-messages" ? "/v1/messages" : "/v1/chat/completions";
  if (!endpoint.pathname.endsWith(route)) throw new TypeError("Endpoint does not match broker protocol");
  if (!options.model || !options.credential || !options.executionId)
    throw new TypeError("Broker identity and credential are required");
  for (const value of [
    options.maxOutputTokens,
    options.maxRequestBytes,
    options.maxResponseBytes,
    options.maxConcurrentRequests,
    options.requestTimeoutMs,
    options.expiresAt
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new TypeError("Positive integer broker limits required");
  }
  if (options.expiresAt <= Date.now()) throw new Error("Broker grant expired");
  options.signal?.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), "sidedoor-broker-"));
  const socketPath = join(directory, "broker.sock");
  const token = randomBytes(32).toString("hex");
  const lifetime = new AbortController();
  let active = 0;
  const pending = /* @__PURE__ */ new Set();
  let cleanupFailed = false;
  async function handle(request, response) {
    if (lifetime.signal.aborted || Date.now() >= options.expiresAt) return reject(response, 403);
    if (!authorized(request, token)) return reject(response, 401);
    if (request.method !== "POST" || request.url !== route || request.headers["content-type"]?.split(";")[0] !== "application/json")
      return reject(response, 400);
    const allowed = /* @__PURE__ */ new Set([
      "host",
      "connection",
      "content-type",
      "content-length",
      "transfer-encoding",
      "authorization"
    ]);
    if (Object.keys(request.headers).some((header) => !allowed.has(header))) return reject(response, 400);
    if (active >= options.maxConcurrentRequests) return reject(response, 429);
    active++;
    const disconnected = new AbortController();
    const timeout = AbortSignal.timeout(
      Math.min(options.requestTimeoutMs, Math.max(1, options.expiresAt - Date.now()))
    );
    const signal = AbortSignal.any([lifetime.signal, disconnected.signal, timeout]);
    const disconnect = () => disconnected.abort();
    response.on("close", disconnect);
    const abort = () => {
      request.destroy();
      response.destroy();
    };
    signal.addEventListener("abort", abort, { once: true });
    let upstream;
    try {
      const chunks = [];
      let size = 0;
      for await (const raw of request) {
        const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        size += chunk.byteLength;
        if (size > options.maxRequestBytes) return reject(response, 413);
        chunks.push(chunk);
      }
      const parsed = (options.protocol === "anthropic-messages" ? anthropicBody : chatBody).safeParse(
        JSON.parse(Buffer.concat(chunks).toString("utf8"))
      );
      if (!parsed.success || parsed.data.model !== options.model || parsed.data.max_tokens > options.maxOutputTokens)
        return reject(response, 400);
      signal.throwIfAborted();
      await abortable(
        options.admit({
          executionId: options.executionId,
          model: options.model,
          maxOutputTokens: parsed.data.max_tokens,
          signal
        }),
        signal
      );
      signal.throwIfAborted();
      const headers = { "content-type": "application/json" };
      if (options.protocol === "anthropic-messages") {
        headers["x-api-key"] = options.credential;
        headers["anthropic-version"] = "2023-06-01";
      } else headers.authorization = `Bearer ${options.credential}`;
      upstream = await (options.fetch ?? globalThis.fetch)(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(parsed.data),
        redirect: "error",
        signal
      });
      signal.throwIfAborted();
      if (!upstream.ok) return reject(response, 502);
      const type = upstream.headers.get("content-type")?.split(";")[0];
      if (type !== "application/json" && type !== "text/event-stream") return reject(response, 502);
      response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      if (upstream.body) {
        let received = 0;
        for await (const chunk of upstream.body) {
          signal.throwIfAborted();
          received += chunk.byteLength;
          if (received > options.maxResponseBytes) throw new Error("Response limit");
          if (!response.write(chunk)) await once(response, "drain", { signal });
        }
      }
      response.end();
    } catch {
      reject(response, signal.aborted ? 408 : 403);
    } finally {
      signal.removeEventListener("abort", abort);
      disconnected.abort();
      response.removeListener("close", disconnect);
      if (upstream?.body && !upstream.body.locked)
        await upstream.body.cancel().catch(() => {
          cleanupFailed = true;
        });
      active--;
    }
  }
  const server = createServer((request, response) => {
    const task = handle(request, response);
    pending.add(task);
    void task.finally(() => pending.delete(task)).catch(() => response.destroy());
  });
  server.requestTimeout = options.requestTimeoutMs;
  server.headersTimeout = Math.min(1e4, options.requestTimeoutMs);
  server.maxHeadersCount = 16;
  server.maxConnections = options.maxConcurrentRequests + 8;
  server.on("connection", (socket) => socket.setTimeout(options.requestTimeoutMs, () => socket.destroy()));
  server.on("clientError", (_error, socket) => socket.destroy());
  let closing;
  const close = () => closing ??= (async () => {
    lifetime.abort();
    options.signal?.removeEventListener("abort", onAbort);
    clearTimeout(expiry);
    server.closeAllConnections();
    await new Promise(
      (resolve, rejectClose) => server.close((error) => error ? rejectClose(error) : resolve())
    );
    let timer;
    try {
      await Promise.race([
        Promise.allSettled([...pending]),
        new Promise((_resolve, rejectPending) => {
          timer = setTimeout(() => rejectPending(new CredentialBrokerCleanupError()), 1e3);
        })
      ]);
      if (cleanupFailed) throw new CredentialBrokerCleanupError();
    } finally {
      clearTimeout(timer);
      await rm(directory, { recursive: true, force: true });
    }
  })().catch(() => {
    throw new CredentialBrokerCleanupError();
  });
  const onAbort = () => {
    void close().catch(() => void 0);
  };
  const expiry = setTimeout(onAbort, Math.min(2147483647, options.expiresAt - Date.now()));
  expiry.unref();
  try {
    server.listen(socketPath);
    await once(server, "listening");
    await chmod(directory, 457);
    await chmod(socketPath, 438);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) {
      await close();
      options.signal.throwIfAborted();
    }
    return { directory, socketPath, token, close };
  } catch (error) {
    await close().catch(() => void 0);
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export { CredentialBrokerCleanupError, isolatedClaudeRelay, startCredentialBroker };
