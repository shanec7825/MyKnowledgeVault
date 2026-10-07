import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / '.runtime' / 'python-packages'))
import edge_tts


async def main():
    request = json.loads(sys.stdin.buffer.read().decode('utf-8'))
    speech = edge_tts.Communicate(request['text'], request['voice'], rate=request['rate'], proxy=request.get('proxy') or None)
    async for chunk in speech.stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])
    sys.stdout.buffer.flush()


asyncio.run(main())
