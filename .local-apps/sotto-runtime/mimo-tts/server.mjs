import http from 'node:http';
import { readFileSync } from 'node:fs';

const key = readFileSync(process.env.MIMO_KEY_FILE || '/run/secrets/mimo-api-key', 'utf8').trim();
if (!key) throw new Error('MiMo credential file is empty');
const base = process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1';
const voices = ['Chloe', 'Dean', 'Mia', 'Milo'];
const reply = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};

http.createServer(async (req, res) => {
  req.setTimeout(150_000);
  const path = req.url?.replace(/^\/v1(?=\/)/, '');
  if (req.method === 'GET' && path === '/health') return reply(res, 200, { status: 'ok' });
  if (req.method === 'GET' && path === '/voices') {
    return reply(res, 200, { voices: voices.map(id => ({ id, name: id, gender: ['Chloe', 'Mia'].includes(id) ? 'female' : 'male' })) });
  }
  if (req.method === 'POST' && path === '/audio/transcriptions') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('multipart/form-data')) return reply(res, 400, { error: 'Multipart audio required' });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) return reply(res, 413, { error: 'Audio must be at most 25 MB' });
        chunks.push(chunk);
      }
      const upstream = await fetch('http://host.docker.internal:8091/v1/audio/transcriptions', {
        method: 'POST', headers: { 'Content-Type': contentType },
        body: Buffer.concat(chunks), signal: AbortSignal.timeout(180_000),
      });
      const data = await upstream.json();
      if (!upstream.ok || typeof data.text !== 'string') {
        return reply(res, upstream.status >= 400 ? upstream.status : 502, { error: 'Handy transcription failed' });
      }
      return reply(res, 200, { text: data.text });
    } catch {
      return reply(res, 502, { error: 'Handy transcription service unavailable' });
    }
  }
  if (req.method !== 'POST' || path !== '/tts') return reply(res, 404, { error: 'Not found' });
  let input;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65_536) return reply(res, 413, { error: 'Text request too large' });
      chunks.push(chunk);
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 12_000) {
      return reply(res, 400, { error: 'Text must contain 1 to 12000 characters' });
    }
    if (!voices.includes(input.voice)) return reply(res, 400, { error: 'Unsupported voice' });
  } catch {
    return reply(res, 400, { error: 'Invalid JSON request' });
  }
  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        model: 'mimo-v2.5-tts', stream: false,
        messages: [
          { role: 'user', content: 'Speak clearly and naturally at a comfortable pace for an English learner. Read the supplied text exactly.' },
          { role: 'assistant', content: input.text },
        ],
        audio: { format: 'wav', voice: input.voice },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return reply(res, 502, { error: `MiMo returned HTTP ${upstream.status}` });
    }
    const data = await upstream.json();
    const encoded = data?.choices?.[0]?.message?.audio?.data;
    if (typeof encoded !== 'string' || encoded.length > 96_000_000) throw new Error('Invalid audio response');
    const audio = Buffer.from(encoded, 'base64');
    if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Invalid WAV response');
    }
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length });
    res.end(audio);
  } catch {
    reply(res, 502, { error: 'MiMo request failed or returned invalid audio' });
  }
}).listen(Number(process.env.PORT || 8090), '0.0.0.0');
