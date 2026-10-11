'use strict';

require('crypto');
var zod = require('zod');

// src/ai/index.ts
zod.z.object({
  allowedDomains: zod.z.array(zod.z.string().min(1)).nullable().optional(),
  blockedDomains: zod.z.array(zod.z.string().min(1)).nullable().optional(),
  maxUses: zod.z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  userLocation: zod.z.object({
    type: zod.z.literal("approximate"),
    city: zod.z.string().nullable().optional(),
    country: zod.z.string().nullable().optional(),
    region: zod.z.string().nullable().optional(),
    timezone: zod.z.string().nullable().optional()
  }).strict().nullable().optional()
}).strict().refine(
  (value) => value.allowedDomains == null || value.blockedDomains == null,
  "Web search cannot combine allowed and blocked domains"
);
var ProviderError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ProviderError";
  }
  code;
};
var MissingProviderCredentialsError = class extends ProviderError {
  constructor(message) {
    super("invalid_request", message);
    this.name = "MissingProviderCredentialsError";
  }
};

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

exports.providerConnection = providerConnection;
