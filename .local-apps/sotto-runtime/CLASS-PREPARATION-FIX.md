# Local class preparation correction

The pinned Sotto release removed `meaning` from immersion introduction examples,
then synthesized it from `target`. Teaching review requires an explanation of
the action/message, so a question repeated as its meaning was rejected even
after semantic repair. The local override mounts a corrected protocol,
generator and two prompts into the workers container. A1 and immersion both
require `target`, `meaning`, and `note`; immersion meanings use the target language.
The existing teaching reviews and publication limits remain enabled.

The prompts aim for 60 raw words to leave room for the application's quote
framing within its existing 180-word rendered limit. Earlier attempts and user
progress were preserved. Runtime patches live at `/home/lenovo/.sotto/patches`.
Docker Compose mounts persist across restarts. Reassess these patches before
upgrading the pinned release; do not blindly mount them into another version.

Regression verification uses `verify-intro.mjs` inside the workers container
with `node --import tsx`. It checks initial and repair schema requirements and
their prompt consistency. A live course generation additionally tests the full
pipeline. A successful schema check does not guarantee generated lesson quality.
