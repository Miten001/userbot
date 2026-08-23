"""Default registry of public proxy sources.

Keeping the source list here (rather than in ``main.py``) makes it easy to add
or swap sources without touching the composition root. Every source is a
pluggable adapter behind the :class:`ProxySource` protocol.
"""

from __future__ import annotations

from proxy_scraper.domain.models import ProxyProtocol
from proxy_scraper.infrastructure.sources import (
    HtmlTableSource,
    JsonApiSource,
    PlaintextListSource,
)


def default_sources() -> list:
    """Return the default set of free, public proxy source adapters."""
    return [
        # HTML table source.
        HtmlTableSource(
            url="https://free-proxy-list.net/",
            name="free-proxy-list.net",
        ),
        # JSON API source (Geonode free proxy list).
        JsonApiSource(),
        # Plaintext list sources (popular public raw lists + ProxyScrape API).
        PlaintextListSource(
            url=(
                "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/"
                "http.txt"
            ),
            name="TheSpeedX/http",
            default_protocol=ProxyProtocol.HTTP,
        ),
        PlaintextListSource(
            url=(
                "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/"
                "socks5.txt"
            ),
            name="TheSpeedX/socks5",
            default_protocol=ProxyProtocol.SOCKS5,
        ),
        PlaintextListSource(
            url=(
                "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/"
                "socks4.txt"
            ),
            name="TheSpeedX/socks4",
            default_protocol=ProxyProtocol.SOCKS4,
        ),
        PlaintextListSource(
            url=(
                "https://api.proxyscrape.com/v2/?request=displayproxies"
                "&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all"
            ),
            name="proxyscrape.com/http",
            default_protocol=ProxyProtocol.HTTP,
        ),
    ]
