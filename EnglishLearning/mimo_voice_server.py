#!/usr/bin/env python3
# Local-only Xiaomi MiMo TTS bridge for EnglishLearning.
# The API key is encrypted with Windows DPAPI and never written to GitHub.

from __future__ import annotations
import base64
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import sys
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8765
ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / ".mimo"
CONFIG_FILE = STATE_DIR / "config.dpapi"

VOICES = {"Mia", "Chloe", "Milo", "Dean", "mimo_default"}

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD),
                ("pbData", ctypes.POINTER(ctypes.c_char))]

crypt32 = ctypes.windll.crypt32 if os.name == "nt" else None
kernel32 = ctypes.windll.kernel32 if os.name == "nt" else None

def _blob(data: bytes):
    buf = ctypes.create_string_buffer(data)
    return DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))), buf

def dpapi_encrypt(data: bytes) -> bytes:
    if os.name != "nt":
        raise RuntimeError("DPAPI encryption is only available on Windows.")
    in_blob, in_buf = _blob(data)
    out_blob = DATA_BLOB()
    ok = crypt32.CryptProtectData(
        ctypes.byref(in_blob), "MiMo EnglishLearning", None, None, None, 0,
        ctypes.byref(out_blob)
    )
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)

def dpapi_decrypt(data: bytes) -> bytes:
    if os.name != "nt":
        raise RuntimeError("DPAPI decryption is only available on Windows.")
    in_blob, in_buf = _blob(data)
    out_blob = DATA_BLOB()
    ok = crypt32.CryptUnprotectData(
        ctypes.byref(in_blob), None, None, None, None, 0,
        ctypes.byref(out_blob)
    )
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)

def save_config(cfg: dict):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(cfg, ensure_ascii=False).encode("utf-8")
    CONFIG_FILE.write_bytes(dpapi_encrypt(raw))

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        raise FileNotFoundError("MiMo is not configured yet.")
    raw = dpapi_decrypt(CONFIG_FILE.read_bytes())
    return json.loads(raw.decode("utf-8"))

SETUP_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MiMo Voice Setup</title>
<style>
body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.55}
.card{border:1px solid #ddd;border-radius:16px;padding:20px;margin:16px 0}
input,select{width:100%;box-sizing:border-box;padding:10px;margin:6px 0 14px;border:1px solid #bbb;border-radius:9px}
button{padding:10px 14px;border:0;border-radius:9px;background:#111827;color:white;cursor:pointer}
small{color:#555}.ok{color:#087f23}.bad{color:#b42318}
</style></head>
<body>
<h1>MiMo Voice Setup</h1>
<div class="card">
<p>Your API key stays on this computer. It is encrypted with Windows DPAPI and saved under <code>EnglishLearning/.mimo/</code>, which is ignored by Git.</p>
<label>Token Plan API key</label>
<input id="key" type="password" autocomplete="off" placeholder="tp-..." />
<label>Token Plan Base URL</label>
<input id="base" type="text" placeholder="Paste the Base URL shown on your MiMo Token Plan page" />
<label>Default English voice</label>
<select id="voice"><option>Mia</option><option>Chloe</option><option>Milo</option><option>Dean</option></select>
<button onclick="save()">Encrypt & Save</button>
<p id="msg"></p>
</div>
<div class="card">
<h2>Test TTS</h2>
<input id="text" value="Retrieval practice helps me consolidate what I learned." />
<button onclick="testTTS()">Generate & Play</button>
<audio id="audio" controls style="width:100%;margin-top:12px"></audio>
<p><small>The key is never sent to ChatGPT or committed to GitHub. It is sent only from this local bridge to the MiMo Base URL you configure.</small></p>
</div>
<script>
async function save(){
 const payload={api_key:key.value.trim(),base_url:base.value.trim(),voice:voice.value};
 const r=await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const j=await r.json(); msg.textContent=j.ok?'Saved securely.':(j.error||'Failed'); msg.className=j.ok?'ok':'bad';
 if(j.ok) key.value='';
}
async function testTTS(){
 const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text.value})});
 if(!r.ok){alert(await r.text());return}
 const blob=await r.blob(); audio.src=URL.createObjectURL(blob); audio.play();
}
</script></body></html>"""

class Handler(BaseHTTPRequestHandler):
    server_version = "MiMoLocalBridge/1.0"

    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ("null", f"http://{HOST}:{PORT}", f"http://localhost:{PORT}"):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def _json(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/setup"):
            data = SETUP_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path == "/api/status":
            try:
                cfg = load_config()
                self._json(200, {"configured": True, "voice": cfg.get("voice", "Mia"), "base_url": cfg.get("base_url", "")})
            except Exception:
                self._json(200, {"configured": False})
            return
        self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 100_000:
            self._json(413, {"error": "Request too large."})
            return
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._json(400, {"error": "Invalid JSON."})
            return

        if self.path == "/api/config":
            key = str(body.get("api_key", "")).strip()
            base_url = str(body.get("base_url", "")).strip().rstrip("/")
            voice = str(body.get("voice", "Mia")).strip()
            if not (key.startswith("tp-") or key.startswith("ttp-") or key.startswith("sk-")):
                self._json(400, {"error": "The API key format does not look like a MiMo key."})
                return
            if not base_url.startswith("https://"):
                self._json(400, {"error": "Base URL must start with https://."})
                return
            if voice not in VOICES:
                voice = "Mia"
            try:
                save_config({"api_key": key, "base_url": base_url, "voice": voice})
                self._json(200, {"ok": True})
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if self.path == "/api/tts":
            text = str(body.get("text", "")).strip()
            if not text:
                self._json(400, {"error": "Text is required."})
                return
            if len(text) > 5000:
                self._json(400, {"error": "Text is too long for this local helper."})
                return
            try:
                cfg = load_config()
                voice = str(body.get("voice") or cfg.get("voice") or "Mia")
                if voice not in VOICES:
                    voice = "Mia"
                payload = {
                    "model": "mimo-v2.5-tts",
                    "messages": [
                        {"role": "user", "content": "Clear natural English for language learning. Moderate pace, precise pronunciation, neutral expressive tone."},
                        {"role": "assistant", "content": text}
                    ],
                    "audio": {"format": "wav", "voice": voice}
                }
                req = urllib.request.Request(
                    cfg["base_url"].rstrip("/") + "/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + cfg["api_key"],
                    },
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        result = json.loads(resp.read().decode("utf-8"))
                except urllib.error.HTTPError as e:
                    detail = e.read().decode("utf-8", "replace")
                    self._json(e.code, {"error": "MiMo API error", "detail": detail[:1000]})
                    return
                audio_b64 = result["choices"][0]["message"]["audio"]["data"]
                audio = base64.b64decode(audio_b64)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(audio)))
                self.end_headers()
                self.wfile.write(audio)
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        self.send_error(404)

    def log_message(self, fmt, *args):
        print("[MiMo]", fmt % args)

def main():
    if os.name != "nt":
        print("This secure configuration currently uses Windows DPAPI and is intended for Windows.")
        sys.exit(1)
    print(f"MiMo local voice bridge: http://{HOST}:{PORT}/setup")
    print("Keep this window open while using MiMo buttons in your English HTML lessons.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

if __name__ == "__main__":
    main()
