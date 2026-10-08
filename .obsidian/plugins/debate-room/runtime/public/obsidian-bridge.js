// This bridge exchanges appearance, the topic and current debate ID. Vault writes require
// an explicit Obsidian command, never a message sent by the embedded page.
export function createObsidianBridge(onTopic, getId) {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('obsidian');
  if (window.parent === window || !/^[a-f0-9-]{36}$/.test(token || '')) return null;
  document.documentElement.classList.add('obsidian-embed');
  const themeVariables = new Set(['background-primary', 'background-primary-alt', 'background-secondary', 'background-modifier-border', 'background-modifier-hover', 'text-normal', 'text-muted', 'text-faint', 'text-on-accent', 'text-accent', 'interactive-accent', 'interactive-accent-hover', 'background-modifier-error', 'text-error', 'font-interface', 'font-text', 'font-ui-small', 'font-ui-medium', 'radius-s']);
  const send = (type, extra = {}) => window.parent.postMessage({ channel: 'debate-room', token, type, ...extra }, 'app://obsidian.md');
  let ready = false;
  window.addEventListener('message', event => {
    if (!ready || event.source !== window.parent || event.origin !== 'app://obsidian.md' || event.data?.channel !== 'debate-room' || event.data?.token !== token) return;
    if (event.data.type === 'theme') {
      const root = document.documentElement;
      root.classList.toggle('obsidian-dark', event.data.dark === true);
      for (const name of themeVariables) {
        const value = event.data.variables?.[name];
        if (typeof value === 'string' && value.length <= 500) {
          if (value.trim()) root.style.setProperty(`--${name}`, value);
          else root.style.removeProperty(`--${name}`);
        }
      }
    }
    if (event.data.type === 'topic' && typeof event.data.topic === 'string' && event.data.topic.trim() && event.data.topic.length <= 500) onTopic(event.data.topic.trim());
  });
  return {
    ready() { ready = true; send('ready'); send('state', { id: getId() }); },
    report() { if (ready) send('state', { id: getId() }); }
  };
}
