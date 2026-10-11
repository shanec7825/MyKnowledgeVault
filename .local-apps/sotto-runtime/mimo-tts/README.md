# Sotto MiMo TTS

Sotto at http://localhost:3785 uses the existing Codex login for text generation.
Its configured `local` TTS provider sends generated text to this internal adapter,
which calls MiMo `mimo-v2.5-tts` and returns WAV audio. Speech recognition uses
the installed Windows Handy model through the adjacent `handy-stt` bridge.

Runtime: Ubuntu WSL `/home/lenovo/.sotto`. Start with `docker compose up -d`
from that directory. The adapter has no published host port. It restarts with
Docker and its health check does not consume API quota.

The private credential is `/home/lenovo/.sotto/secrets/mimo-api-key` (mode 0600).
It is mounted read-only into the adapter; do not put it in this directory or Git.
To replace it, edit that private file and restart `docker compose restart mimo-tts`.
`MIMO_BASE_URL` in the runtime override currently selects the China Token Plan endpoint.
For another account or region, change that URL to the account's official endpoint.

Sotto settings: `ttsProvider=local`, `ttsBaseUrl=http://mimo-tts:8090/v1`,
`ttsVoices=Chloe,Dean,Mia,Milo`. The Sotto UI may label this as Local TTS;
the synthesis model actually runs on MiMo. Text is transmitted to MiMo.
Set `sttBaseUrl=http://mimo-tts:8090/v1` too. The shared gateway forwards
`/v1/audio/transcriptions` to the Windows Handy bridge. Both welcome wizard
fields use the same URL, avoiding the upstream shared `baseUrls.local` state bug.

Validated: Sotto TTS test produced a 5.6-second WAV; the Codex provider generated
Hello and MiMo synthesized it as a 24 kHz WAV. Empty text is rejected.
