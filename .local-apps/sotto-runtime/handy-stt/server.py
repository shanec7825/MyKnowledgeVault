"""Private loopback OpenAI-compatible STT bridge to the installed Handy CLI."""
import email.policy
import json
import subprocess
import tempfile
import threading
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HANDY = Path.home() / 'AppData/Local/Handy/handy.exe'
FFMPEG = next((ROOT / 'deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe'))
MODEL = 'handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf'
LOCK = threading.Lock()
FLAGS = subprocess.CREATE_NO_WINDOW


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def log_message(self, *args):
        pass  # Never log audio, transcripts, or request headers.

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/health':
            self.reply(200, {'status': 'ok', 'provider': 'Handy'})
        else:
            self.reply(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/v1/audio/transcriptions':
            return self.reply(404, {'error': 'Not found'})
        try:
            limit = 25 * 1024 * 1024
            if self.headers.get('Transfer-Encoding', '').lower() == 'chunked':
                chunks, total = [], 0
                while True:
                    line = self.rfile.readline(128)
                    size = int(line.split(b';', 1)[0].strip(), 16)
                    if size < 0:
                        raise ValueError('Invalid chunk size')
                    if size == 0:
                        break
                    total += size
                    if total > limit:
                        return self.reply(413, {'error': 'Audio must be at most 25 MB'})
                    chunk = self.rfile.read(size)
                    if len(chunk) != size or self.rfile.read(2) != b'\r\n':
                        raise ValueError('Incomplete audio')
                    chunks.append(chunk)
                body = b''.join(chunks)
                self.close_connection = True
            else:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= limit:
                    return self.reply(413, {'error': 'Audio must be at most 25 MB'})
                body = self.rfile.read(length)
                if len(body) != length:
                    raise ValueError('Incomplete audio')
            content_type = self.headers.get('Content-Type', '')
            if '\r' in content_type or '\n' in content_type or not content_type.startswith('multipart/form-data'):
                return self.reply(400, {'error': 'Multipart audio required'})
            message = BytesParser(policy=email.policy.default).parsebytes(
                ('Content-Type: ' + content_type + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + body)
            audio = next((p.get_payload(decode=True) for p in message.iter_parts()
                          if p.get_param('name', header='content-disposition') == 'file'), None)
            if not audio:
                return self.reply(400, {'error': 'Audio file required'})
        except (ValueError, AttributeError):
            return self.reply(400, {'error': 'Invalid audio request'})
        if not LOCK.acquire(timeout=3):
            return self.reply(503, {'error': 'Handy is busy; retry shortly'})
        try:
            with tempfile.TemporaryDirectory(prefix='sotto-handy-') as folder:
                source, wav = Path(folder) / 'input.audio', Path(folder) / 'input.wav'
                source.write_bytes(audio)
                subprocess.run([str(FFMPEG), '-nostdin', '-loglevel', 'error', '-y', '-i', str(source),
                                '-t', '600', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', str(wav)],
                               check=True, capture_output=True, timeout=45, creationflags=FLAGS)
                run = subprocess.run([str(HANDY), '--transcribe-file', str(wav), '--model', MODEL, '--json'],
                                     check=True, capture_output=True, timeout=180, creationflags=FLAGS)
                result = json.loads(run.stdout.decode('utf-8-sig'))
                text = result.get('text')
                if not isinstance(text, str):
                    raise ValueError('Unexpected Handy response')
                self.reply(200, {'text': text})
        except (subprocess.SubprocessError, ValueError, OSError):
            self.reply(502, {'error': 'Handy transcription failed'})
        finally:
            LOCK.release()


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8091), Handler)
    server.timeout = 30
    server.serve_forever()
