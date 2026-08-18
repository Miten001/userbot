"""
Shared CDP Fetch-based proxy authentication helper
--------------------------------------------------
Both TeraBox automation GUIs (``main.py`` and ``autoclose.py``) route Chrome
through user-supplied proxies. When a proxy requires a username/password, the
credentials must be delivered to the proxy's authentication challenge (HTTP 407
for plain requests, and the ``CONNECT`` handshake for HTTPS tunnels).

The historical mechanisms were unreliable on modern Chrome:

* ``main.py`` wrote a Manifest V2 ``--load-extension`` whose blocking
  ``chrome.webRequest.onAuthRequired`` callback is no longer honored.
* ``autoclose.py`` set a ``Proxy-Authorization`` header via
  ``Network.setExtraHTTPHeaders`` — that header rides on origin requests, not on
  the proxy ``CONNECT`` tunnel, so the proxy challenge is never satisfied.

This module replaces both with the Chrome DevTools Protocol (CDP) ``Fetch``
domain, which authenticates BOTH plain HTTP requests and HTTPS ``CONNECT``
tunnels:

* ``Fetch.enable`` with ``handleAuthRequests = true``
* on ``Fetch.authRequired`` -> ``Fetch.continueWithAuth`` with
  ``authChallengeResponse = {response: "ProvideCredentials", username, password}``
* on ``Fetch.requestPaused`` -> ``Fetch.continueRequest``

It is dependency-free: the CDP transport is a minimal RFC 6455 WebSocket client
built on the Python standard library, talking to the remote-debugging port that
both tools already open. The message-construction logic is factored into pure
functions so it can be unit-tested without a live Chrome.
"""

import base64
import hashlib
import json
import os
import socket
import struct
import threading
import urllib.request


# ---------------------------------------------------------------------------
# Pure message-construction helpers (unit-testable, no Chrome required)
# ---------------------------------------------------------------------------

def build_fetch_enable_command(msg_id):
    """Build the ``Fetch.enable`` CDP command that arms auth interception.

    ``handleAuthRequests`` is required so Chrome forwards proxy auth challenges
    to us as ``Fetch.authRequired`` events instead of popping a native dialog.
    """
    return {
        "id": msg_id,
        "method": "Fetch.enable",
        "params": {"handleAuthRequests": True},
    }


def is_auth_required_event(event):
    """True when the CDP event is a proxy/server authentication challenge."""
    return isinstance(event, dict) and event.get("method") == "Fetch.authRequired"


def is_request_paused_event(event):
    """True when the CDP event is a normally paused request to be continued."""
    return isinstance(event, dict) and event.get("method") == "Fetch.requestPaused"


def build_auth_response(event, username, password, msg_id):
    """Answer a ``Fetch.authRequired`` event with the parsed credentials.

    Responds ``ProvideCredentials`` so Chrome supplies ``username``/``password``
    to the proxy's authentication challenge (both 407 and CONNECT tunnels).
    """
    request_id = event["params"]["requestId"]
    return {
        "id": msg_id,
        "method": "Fetch.continueWithAuth",
        "params": {
            "requestId": request_id,
            "authChallengeResponse": {
                "response": "ProvideCredentials",
                "username": username,
                "password": password,
            },
        },
    }


def build_continue_request(event, msg_id):
    """Continue a ``Fetch.requestPaused`` event unmodified."""
    request_id = event["params"]["requestId"]
    return {
        "id": msg_id,
        "method": "Fetch.continueRequest",
        "params": {"requestId": request_id},
    }


def dispatch_event(event, username, password, next_msg_id):
    """Map an incoming CDP event to the outgoing CDP command that answers it.

    Returns the command dict to send, or ``None`` if the event is not one we
    handle. Pure function -- this is the core of the auth handler and is what
    the unit tests exercise without a live Chrome.
    """
    if is_auth_required_event(event):
        return build_auth_response(event, username, password, next_msg_id)
    if is_request_paused_event(event):
        return build_continue_request(event, next_msg_id)
    return None


# ---------------------------------------------------------------------------
# Minimal stdlib WebSocket client for the Chrome DevTools Protocol
# ---------------------------------------------------------------------------

def _get_page_ws_url(debug_port, timeout=5):
    """Return a page target's ``webSocketDebuggerUrl`` from the DevTools HTTP API."""
    url = f"http://127.0.0.1:{debug_port}/json"
    req = urllib.request.Request(url, headers={"User-Agent": "cdp-proxy-auth"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        targets = json.loads(resp.read().decode("utf-8"))
    # Prefer an actual page target; fall back to the first target with a ws URL.
    for target in targets:
        if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
            return target["webSocketDebuggerUrl"]
    for target in targets:
        if target.get("webSocketDebuggerUrl"):
            return target["webSocketDebuggerUrl"]
    return None


class _WebSocket:
    """A tiny RFC 6455 text WebSocket client (client-to-localhost only)."""

    def __init__(self, ws_url, timeout=10):
        # ws://127.0.0.1:PORT/devtools/page/ID
        assert ws_url.startswith("ws://")
        rest = ws_url[len("ws://"):]
        hostport, _, path = rest.partition("/")
        host, _, port = hostport.partition(":")
        self._host = host
        self._port = int(port or 80)
        self._path = "/" + path
        self._sock = socket.create_connection((self._host, self._port), timeout=timeout)
        self._sock.settimeout(timeout)
        self._handshake()

    def _handshake(self):
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {self._path} HTTP/1.1\r\n"
            f"Host: {self._host}:{self._port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self._sock.sendall(req.encode())
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self._sock.recv(4096)
            if not chunk:
                raise ConnectionError("WebSocket handshake failed")
            data += chunk
        expected = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
        ).decode()
        if expected.encode() not in data:
            raise ConnectionError("Invalid WebSocket handshake response")

    def send_text(self, text):
        payload = text.encode("utf-8")
        header = bytearray()
        header.append(0x81)  # FIN + text opcode
        length = len(payload)
        mask_bit = 0x80  # clients MUST mask
        if length < 126:
            header.append(mask_bit | length)
        elif length < (1 << 16):
            header.append(mask_bit | 126)
            header.extend(struct.pack(">H", length))
        else:
            header.append(mask_bit | 127)
            header.extend(struct.pack(">Q", length))
        mask = os.urandom(4)
        header.extend(mask)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self._sock.sendall(bytes(header) + masked)

    def _recv_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self._sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("WebSocket connection closed")
            buf += chunk
        return buf

    def recv_text(self):
        first = self._recv_exact(2)
        opcode = first[0] & 0x0F
        length = first[1] & 0x7F
        if length == 126:
            length = struct.unpack(">H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack(">Q", self._recv_exact(8))[0]
        payload = self._recv_exact(length) if length else b""
        if opcode == 0x8:  # close
            raise ConnectionError("WebSocket closed by peer")
        if opcode in (0x9, 0xA):  # ping/pong -> ignore, read next
            return self.recv_text()
        return payload.decode("utf-8", errors="replace")

    def close(self):
        try:
            self._sock.close()
        except Exception:
            pass


class ProxyAuthenticator:
    """Arms CDP ``Fetch`` proxy authentication over a background thread.

    Opens its own DevTools WebSocket session to the page target and answers
    ``Fetch.authRequired`` / ``Fetch.requestPaused`` events with the supplied
    credentials until :meth:`stop` is called.
    """

    def __init__(self, debug_port, username, password):
        self._debug_port = debug_port
        self._username = username
        self._password = password
        self._ws = None
        self._thread = None
        self._msg_id = 0
        self._running = False

    def _next_id(self):
        self._msg_id += 1
        return self._msg_id

    def start(self):
        ws_url = _get_page_ws_url(self._debug_port)
        if not ws_url:
            raise ConnectionError("No DevTools page target found")
        self._ws = _WebSocket(ws_url)
        self._ws.send_text(json.dumps(build_fetch_enable_command(self._next_id())))
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return self

    def _loop(self):
        while self._running:
            try:
                raw = self._ws.recv_text()
            except Exception:
                break
            try:
                event = json.loads(raw)
            except Exception:
                continue
            command = dispatch_event(
                event, self._username, self._password, self._next_id()
            )
            if command is None:
                continue
            try:
                self._ws.send_text(json.dumps(command))
            except Exception:
                break

    def stop(self):
        self._running = False
        if self._ws:
            self._ws.close()


def start_cdp_proxy_auth(debug_port, username, password):
    """Convenience: create, start and return a :class:`ProxyAuthenticator`.

    Returns the running authenticator (keep a reference so its background thread
    is not garbage-collected), or ``None`` if it could not be armed.
    """
    if not (username and password):
        return None
    authenticator = ProxyAuthenticator(debug_port, username, password)
    authenticator.start()
    return authenticator
