// This bridge only exchanges the topic and current debate ID. Vault writes require
// an explicit Obsidian command, never a message sent by the embedded page.
export function createObsidianBridge(onTopic, getId) {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('obsidian');
  if (window.parent === window || !/^[a-f0-9-]{36}$/.test(token || '')) return null;
  const send = (type, extra = {}) => window.parent.postMessage({ channel: 'debate-room', token, type, ...extra }, 'app://obsidian.md');
  let ready = false;
  window.addEventListener('message', event => {
    if (!ready || event.source !== window.parent || event.origin !== 'app://obsidian.md' || event.data?.channel !== 'debate-room' || event.data?.token !== token) return;
    if (event.data.type === 'topic' && typeof event.data.topic === 'string' && event.data.topic.trim() && event.data.topic.length <= 500) onTopic(event.data.topic.trim());
  });
  return {
    ready() { ready = true; send('ready'); send('state', { id: getId() }); },
    report() { if (ready) send('state', { id: getId() }); }
  };
}
