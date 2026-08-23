"""Async HTTP client wrapping aiohttp with SOCKS support.

Responsibilities (design Component / Requirement 3.1, 3.4, 18.2):
* Configurable per-request connect/read timeouts and descriptive User-Agent.
* Issue a request *through* a given proxy for HTTP/HTTPS/SOCKS4/SOCKS5.
* Return status, headers, body and measured round-trip latency.
* Attach no cookies/tokens/personal data (a clean session per request).
"""

from __future__ import annotations

import time
from typing import Optional

from proxy_scraper.domain.interfaces import HttpResponse
from proxy_scraper.domain.models import ProxyCandidate, ProxyProtocol

_DEFAULT_USER_AGENT = (
    "ProxyScraperGUI/1.0 (+https://example.local; defensive proxy validation tool)"
)

# A deliberately minimal, non-identifying header set. We never attach cookies,
# auth tokens, or personal data (Requirement 18.2).
_SAFE_HEADERS = {
    "User-Agent": _DEFAULT_USER_AGENT,
    "Accept": "*/*",
    "Accept-Encoding": "identity",
    "Connection": "close",
}


def _proxy_url(candidate: ProxyCandidate) -> str:
    """Build a proxy connection URL for the candidate's protocol."""
    scheme = {
        ProxyProtocol.HTTP: "http",
        ProxyProtocol.HTTPS: "http",  # HTTPS proxies are reached via http CONNECT
        ProxyProtocol.SOCKS4: "socks4",
        ProxyProtocol.SOCKS5: "socks5",
    }[candidate.protocol]
    return f"{scheme}://{candidate.host}:{candidate.port}"


class AsyncHttpClient:
    """Concrete :class:`~proxy_scraper.domain.interfaces.HttpClient`.

    Uses aiohttp for HTTP(S) proxies and aiohttp_socks connectors for SOCKS
    proxies. Imports of the third-party libraries are performed lazily so the
    rest of the domain layer can be imported/tested without them installed.
    """

    def __init__(
        self,
        *,
        default_timeout: float = 8.0,
        user_agent: str = _DEFAULT_USER_AGENT,
    ) -> None:
        self._default_timeout = default_timeout
        self._headers = dict(_SAFE_HEADERS)
        self._headers["User-Agent"] = user_agent

    async def get(
        self,
        url: str,
        *,
        proxy: Optional[ProxyCandidate] = None,
        timeout: Optional[float] = None,
    ) -> HttpResponse:
        """Issue a GET request, optionally routed through *proxy*.

        Raises on any network error so the caller (ValidationEngine / source
        adapter) can classify or time the failure.
        """
        import aiohttp  # lazy import

        timeout_s = timeout if timeout is not None else self._default_timeout
        client_timeout = aiohttp.ClientTimeout(total=timeout_s)

        connector = None
        aiohttp_proxy: Optional[str] = None

        if proxy is not None:
            if proxy.protocol in (ProxyProtocol.SOCKS4, ProxyProtocol.SOCKS5):
                # SOCKS proxies require a dedicated connector.
                from aiohttp_socks import ProxyConnector  # lazy import

                connector = ProxyConnector.from_url(_proxy_url(proxy))
            else:
                # HTTP / HTTPS proxies are passed via the ``proxy=`` argument.
                aiohttp_proxy = _proxy_url(proxy)

        start = time.perf_counter()
        # A fresh session per request guarantees no cookie/state carryover
        # between requests (Requirement 18.2).
        session_kwargs: dict = {
            "timeout": client_timeout,
            "headers": self._headers,
            "cookie_jar": aiohttp.DummyCookieJar(),  # never store/send cookies
            "trust_env": False,  # ignore ambient proxy/credential env vars
        }
        if connector is not None:
            session_kwargs["connector"] = connector

        async with aiohttp.ClientSession(**session_kwargs) as session:
            async with session.get(
                url,
                proxy=aiohttp_proxy,
                allow_redirects=True,
                ssl=False,
            ) as resp:
                body = await resp.text(errors="replace")
                latency_ms = int((time.perf_counter() - start) * 1000)
                headers = {k: v for k, v in resp.headers.items()}
                return HttpResponse(
                    status=resp.status,
                    headers=headers,
                    body=body,
                    latency_ms=max(0, latency_ms),
                )
