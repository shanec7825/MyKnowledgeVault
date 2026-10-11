# Handy recognition for Sotto

Uses the existing Handy 0.9.6 installation and downloaded Nemotron Streaming 3.5
model. Existing Handy settings, recordings, and models are preserved. Recognition
runs locally via `handy.exe --transcribe-file --json`. FFmpeg converts uploaded
audio to 16 kHz mono PCM WAV; temporary audio files are deleted after each request.

Windows loopback endpoint: `http://127.0.0.1:8091/v1`.
Direct container endpoint: `http://host.docker.internal:8091/v1`.
Select **Local sidecar** under Speech to Text and paste the container endpoint
`http://mimo-tts:8090/v1` into its base URL field. Select **Local sidecar** under
Text to Speech and use the same URL. This shared gateway routes recognition
to Handy and synthesis to MiMo, avoiding the wizard's shared local address field.
Run the wizard's local endpoint check to continue.
The UI/SDK model alias `whisper-1` routes to Handy's existing Nemotron model.

The bridge starts at Windows sign-in using `Sotto Handy STT.lnk` in the user's
Startup directory. To start manually, run `start.ps1` in this directory.
It uses the bundled Codex Python runtime; if that runtime is removed, update
the Python path in `start.ps1`. Docker Desktop and Sotto still need to be running.

Validated: both onboarding endpoint checks passed, and Sotto's live STT provider
test transcribed MiMo-generated speech in about 4.5 seconds. Handy recognized
the brand name Sotto as Soto; recognition accuracy is not guaranteed.
