"""
logwatch_bridge.py — pipe Python stdout/stderr to LogWatch React viewer

Usage:
  python logwatch_bridge.py          # start bridge, logs stream to ws://localhost:8765
  python logwatch_bridge.py 9000     # use a custom port

Install dependency:
  pip install websockets

Then run your app and pipe its output through this bridge:
  python your_app.py 2>&1 | python logwatch_bridge.py

Or import and use directly:
  from logwatch_bridge import patch_logging
  patch_logging()   # call at the top of your script
"""

import asyncio
import sys
import threading
import websockets
import logging
import queue

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
_clients = set()
_queue = queue.Queue()


async def handler(ws):
    _clients.add(ws)
    try:
        await ws.wait_closed()
    finally:
        _clients.discard(ws)


async def broadcaster():
    while True:
        try:
            msg = _queue.get_nowait()
            if _clients:
                await asyncio.gather(*[c.send(msg) for c in list(_clients)], return_exceptions=True)
        except queue.Empty:
            await asyncio.sleep(0.05)


async def main():
    async with websockets.serve(handler, "localhost", PORT):
        print(f"[logwatch] WebSocket bridge listening on ws://localhost:{PORT}", file=sys.stderr)
        await broadcaster()


def _ws_thread():
    asyncio.run(main())


# ── Pipe mode (stdin → WebSocket) ─────────────────────────────────────────────
def pipe_mode():
    t = threading.Thread(target=_ws_thread, daemon=True)
    t.start()
    print(f"[logwatch] Piping stdin to ws://localhost:{PORT} — open LogWatch and connect", file=sys.stderr)
    try:
        for line in sys.stdin:
            line = line.rstrip("\n")
            if line:
                _queue.put(line)
    except KeyboardInterrupt:
        pass


# ── Library mode (logging handler) ────────────────────────────────────────────
class WebSocketHandler(logging.Handler):
    def emit(self, record):
        _queue.put(self.format(record))


def patch_logging(level=logging.DEBUG, fmt="[%(levelname)s] %(asctime)s — %(name)s: %(message)s"):
    """Call once at the top of your script to send all logging output to LogWatch."""
    t = threading.Thread(target=_ws_thread, daemon=True)
    t.start()

    handler = WebSocketHandler()
    handler.setFormatter(logging.Formatter(fmt))
    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(handler)

    # Also keep a StreamHandler so you still see logs in the terminal
    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(logging.Formatter(fmt))
    root.addHandler(stream_handler)

    print(f"[logwatch] Logging patched — streaming to ws://localhost:{PORT}", file=sys.stderr)


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not sys.stdin.isatty():
        pipe_mode()
    else:
        print("Usage: python your_app.py 2>&1 | python logwatch_bridge.py", file=sys.stderr)
        print("   or: import logwatch_bridge; logwatch_bridge.patch_logging()", file=sys.stderr)
