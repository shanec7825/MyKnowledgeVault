// src/ai/browser.ts
function compatibleProviders(providers, required) {
  return providers.filter(
    (provider) => required.every((capability) => provider.capabilities.includes(capability))
  );
}

export { compatibleProviders };
