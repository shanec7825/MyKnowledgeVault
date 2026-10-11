import { ProviderError, MissingProviderCredentialsError } from './chunk-YIW7ZQGE.js';

// src/ai/configuration/connection.ts
function providerConnection(credentials, options) {
  const configured = credentials.baseUrl;
  let base;
  let defaultBase;
  try {
    defaultBase = new URL(options.defaultBaseUrl);
    base = new URL(typeof configured === "string" && configured ? configured : options.defaultBaseUrl);
  } catch {
    throw new ProviderError("invalid_request", "Invalid provider endpoint");
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new ProviderError("invalid_request", "Invalid provider endpoint");
  if (options.normalizeV1 && !base.pathname.replace(/\/+$/, "").endsWith("/v1"))
    base.pathname = base.pathname.replace(/\/+$/, "") + "/v1";
  const selected = base.origin === defaultBase.origin ? credentials.apiKey : credentials.compatibleApiKey;
  const apiKey = typeof selected === "string" ? selected : "";
  if (options.requiresKey && !apiKey && !(options.allowAnonymous && credentials.allowAnonymous === true))
    throw new MissingProviderCredentialsError("Configure credentials for the selected endpoint");
  return { baseUrl: base.href.replace(/\/+$/, ""), apiKey };
}

export { providerConnection };
