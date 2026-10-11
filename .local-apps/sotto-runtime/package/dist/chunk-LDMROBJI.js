import { readRequestBytes } from './chunk-3UNBAY7P.js';
import { abortable } from './chunk-GDO34PSX.js';
import { z } from 'zod';

// src/ai/providers/http.ts
function providerFetch(context, implementation = globalThis.fetch) {
  return async (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : void 0));
    if (Number(headers.get("x-stainless-retry-count") ?? 0) > 0) context.onRetry?.();
    return implementation(input, init);
  };
}
var models = z.array(z.object({ id: z.string().min(1) }));
var compatiblePage = z.object({ object: z.literal("list"), data: models });
var anthropicPage = z.object({
  data: models,
  has_more: z.boolean(),
  first_id: z.string().nullable(),
  last_id: z.string().nullable()
});
var compatibleEndpoints = /* @__PURE__ */ new Set([
  "https://api.meta.ai/v1/models",
  "https://api.openai.com/v1/models",
  "https://generativelanguage.googleapis.com/v1beta/openai/models",
  "https://api.groq.com/openai/v1/models",
  "https://api.x.ai/v1/models",
  "https://api.deepseek.com/models",
  "https://api.deepseek.com/v1/models",
  "https://api.mistral.ai/v1/models"
]);
function authenticates(endpoint, bytes) {
  const url = new URL(endpoint);
  const path = `${url.origin}${url.pathname}`;
  const schema = path === "https://api.anthropic.com/v1/models" ? anthropicPage : compatibleEndpoints.has(path) ? compatiblePage : void 0;
  if (!schema || url.username || url.password || url.hash) return false;
  if (url.search && !(path === "https://api.anthropic.com/v1/models" && url.search === "?limit=1"))
    return false;
  try {
    return schema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).success;
  } catch {
    return false;
  }
}
function modelCredentialProbe(signal, implementation = globalThis.fetch) {
  const responses = /* @__PURE__ */ new WeakMap();
  const probeFetch = async (input, init) => {
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : void 0);
    const combined = inherited ? AbortSignal.any([signal, inherited]) : signal;
    combined.throwIfAborted();
    const endpoint = input instanceof Request ? input.url : String(input);
    const response = await implementation(input, { ...init, signal: combined, redirect: "error" });
    if (combined.aborted) {
      await abortable(Promise.resolve(response.body?.cancel()), combined);
      combined.throwIfAborted();
    }
    if (response.redirected) {
      await abortable(Promise.resolve(response.body?.cancel()), combined);
      throw new Error("Credential probe redirected");
    }
    const bytes = await abortable(
      readRequestBytes({ body: response.body, signal: combined }, 64 * 1024),
      combined
    );
    const bounded = new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    responses.set(bounded, { endpoint, bytes });
    return bounded;
  };
  return {
    fetch: probeFetch,
    async readiness(response) {
      await abortable(Promise.resolve(response.body?.cancel()), signal);
      signal.throwIfAborted();
      const captured = responses.get(response);
      return {
        code: "ready",
        checkedAt: Date.now(),
        ...response.status === 200 && captured && authenticates(captured.endpoint, captured.bytes) ? { authentication: "verified" } : {}
      };
    }
  };
}

export { modelCredentialProbe, providerFetch };
