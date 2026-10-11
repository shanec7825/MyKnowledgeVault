import { createCompatibleProvider } from '../chunk-I54RRFN2.js';
import { createAnthropicProvider } from '../chunk-QMAJLGXH.js';
import { createResponsesProvider } from '../chunk-FEQLDZSX.js';
import '../chunk-LDMROBJI.js';
import { createGoogleProvider } from '../chunk-C76ZVYP3.js';
import { providerDescriptors, PROVIDER_METADATA } from '../chunk-JCZKVENE.js';
import { providerConnection } from '../chunk-VNEBU6XY.js';
export { providerConnection } from '../chunk-VNEBU6XY.js';
import { ProviderError, ProviderRegistry } from '../chunk-YIW7ZQGE.js';
import '../chunk-GT4UCTDM.js';
import '../chunk-NGJOFCTL.js';
import '../chunk-3UNBAY7P.js';
import '../chunk-HDHO73O7.js';
import '../chunk-GDO34PSX.js';
import '../chunk-LXCVA42T.js';

// src/ai/configuration/compatible.ts
function captureCompatibleApi(input) {
  if (!input.endpoint.trim()) throw new ProviderError("invalid_request", "A compatible endpoint is required");
  const connection = providerConnection(
    { apiKey: input.apiKey ?? "" },
    { defaultBaseUrl: input.endpoint.trim(), requiresKey: false }
  );
  if (connection.apiKey && input.credentialBinding) {
    const binding = input.credentialBinding;
    const bound = providerConnection({}, { defaultBaseUrl: binding.endpoint, requiresKey: false });
    if (binding.protocol !== "compatible" || bound.baseUrl !== connection.baseUrl)
      throw new ProviderError("invalid_request", "The saved credential belongs to a different endpoint");
  }
  return {
    transport: "compatible",
    descriptor: {
      id: input.provider,
      label: input.label,
      transport: input.transport ?? "api",
      fields: [],
      models: [],
      capabilities: [...input.capabilities ?? ["text", "vision", "structured"]]
    },
    credentials: { apiKey: connection.apiKey },
    baseUrl: connection.baseUrl,
    requiresKey: input.requiresKey ?? false
  };
}
function captureCompatibleModel(input) {
  const model = input.model.trim();
  if (!model) throw new ProviderError("invalid_request", "A compatible model is required");
  return { ...captureCompatibleApi(input), model };
}

// src/ai/configuration/providers.ts
function createSelectedApiRegistry(selection, options = {}) {
  const descriptor = structuredClone(selection.descriptor);
  const credentials = { ...selection.credentials };
  const common = {
    descriptor,
    streaming: options.streaming,
    maxRetries: options.maxRetries,
    fetch: options.fetch
  };
  const adapter = selection.transport === "anthropic" ? createAnthropicProvider({ ...common, ...options.anthropic }) : selection.transport === "responses" ? createResponsesProvider({
    ...common,
    defaultBaseUrl: selection.baseUrl,
    webSearchType: selection.webSearchType
  }) : createCompatibleProvider({
    ...common,
    ...options.compatible,
    defaultBaseUrl: selection.baseUrl,
    requiresKey: selection.requiresKey
  });
  return new ProviderRegistry({
    providers: [adapter],
    timeoutMode: options.timeoutMode,
    credentials: {
      async resolve() {
        return { ...credentials };
      }
    }
  });
}
function apiProviders(options = {}) {
  return providerDescriptors().filter((descriptor) => descriptor.transport !== "cli").map((descriptor) => {
    if (descriptor.id === "anthropic")
      return createAnthropicProvider({ descriptor, streaming: options.streaming });
    if (descriptor.id === "google")
      return createGoogleProvider(descriptor, { streaming: options.streaming });
    if (descriptor.id === "openai" && options.openaiTransport === "responses")
      return createResponsesProvider({
        streaming: options.streaming,
        descriptor: { ...descriptor, capabilities: [...descriptor.capabilities, "web"] }
      });
    return createCompatibleProvider({
      descriptor,
      defaultBaseUrl: PROVIDER_METADATA[descriptor.id]?.defaultBaseUrl ?? "https://api.openai.com/v1",
      requiresKey: descriptor.transport === "api",
      normalizeV1: descriptor.transport === "local",
      streaming: options.streaming,
      maxTokensParameter: options.maxTokensParameter ?? (descriptor.transport === "local" ? "max_tokens" : "max_completion_tokens")
    });
  });
}

export { apiProviders, captureCompatibleApi, captureCompatibleModel, createSelectedApiRegistry };
