import { NextResponse } from "next/server";

/**
 * GET /api/prices
 *
 * Live market data for the Hero "live feed". Fetches from Yahoo Finance
 * (server-side so we don't hit CORS), falls back to CoinGecko for crypto +
 * Frankfurter for forex if Yahoo is unreachable.
 *
 * Response is cached at the edge for 30 s so the client can poll often
 * without burning the Yahoo rate limit.
 */
export const revalidate = 30;

type Quote = {
  symbol: string;        // "BTC/USD"
  yahoo: string;         // Yahoo ticker
  category: "crypto" | "metal" | "forex";
  flagA: string;
  flagB: string;
  decimals: number;
  price: number;
  change_pct: number;
};

const SYMBOLS: Omit<Quote, "price" | "change_pct">[] = [
  { symbol: "BTC/USD", yahoo: "BTC-USD",  category: "crypto", flagA: "₿", flagB: "🇺🇸", decimals: 0 },
  { symbol: "ETH/USD", yahoo: "ETH-USD",  category: "crypto", flagA: "Ξ", flagB: "🇺🇸", decimals: 2 },
  { symbol: "XAU/USD", yahoo: "GC=F",     category: "metal",  flagA: "🥇", flagB: "🇺🇸", decimals: 2 },
  { symbol: "XAG/USD", yahoo: "SI=F",     category: "metal",  flagA: "🥈", flagB: "🇺🇸", decimals: 2 },
  { symbol: "EUR/USD", yahoo: "EURUSD=X", category: "forex",  flagA: "🇪🇺", flagB: "🇺🇸", decimals: 4 },
  { symbol: "USD/JPY", yahoo: "USDJPY=X", category: "forex",  flagA: "🇺🇸", flagB: "🇯🇵", decimals: 2 },
];

const FALLBACK_PRICES: Record<string, { price: number; change_pct: number }> = {
  "BTC/USD": { price: 67_420,    change_pct:  1.42 },
  "ETH/USD": { price:  3_184.50, change_pct:  0.78 },
  "XAU/USD": { price:  2_384.5,  change_pct:  0.31 },
  "XAG/USD": { price:     27.84, change_pct: -0.52 },
  "EUR/USD": { price:      1.0842, change_pct:  0.18 },
  "USD/JPY": { price:    152.34, change_pct: -0.24 },
};

export async function GET() {
  const tickers = SYMBOLS.map((s) => s.yahoo).join(",");

  // 1. Try Yahoo Finance v7 quote endpoint.
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tickers)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 30 },
      },
    );

    if (res.ok) {
      const data = (await res.json()) as {
        quoteResponse?: {
          result?: Array<{
            symbol: string;
            regularMarketPrice?: number;
            regularMarketChangePercent?: number;
          }>;
        };
      };

      const yahooQuotes = data.quoteResponse?.result ?? [];

      const merged: Quote[] = SYMBOLS.map((meta) => {
        const q = yahooQuotes.find((y) => y.symbol === meta.yahoo);
        const fb = FALLBACK_PRICES[meta.symbol];
        return {
          ...meta,
          price:
            typeof q?.regularMarketPrice === "number"
              ? q.regularMarketPrice
              : fb.price,
          change_pct:
            typeof q?.regularMarketChangePercent === "number"
              ? q.regularMarketChangePercent
              : fb.change_pct,
        };
      });

      return NextResponse.json(
        { source: "yahoo", at: new Date().toISOString(), quotes: merged },
        { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
      );
    }
  } catch {
    // fall through to CoinGecko + Frankfurter fallback
  }

  // 2. Fallback: CoinGecko for crypto + frankfurter.app for forex.
  const merged: Quote[] = await fallbackFetch();

  return NextResponse.json(
    { source: "fallback", at: new Date().toISOString(), quotes: merged },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
  );
}

async function fallbackFetch(): Promise<Quote[]> {
  const cg = fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
    { next: { revalidate: 30 } },
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const fr = fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,JPY", {
    next: { revalidate: 60 },
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const [cgData, frData] = await Promise.all([cg, fr]);

  return SYMBOLS.map((meta) => {
    const fb = FALLBACK_PRICES[meta.symbol];
    if (meta.symbol === "BTC/USD" && cgData?.bitcoin) {
      return { ...meta, price: cgData.bitcoin.usd, change_pct: cgData.bitcoin.usd_24h_change ?? fb.change_pct };
    }
    if (meta.symbol === "ETH/USD" && cgData?.ethereum) {
      return { ...meta, price: cgData.ethereum.usd, change_pct: cgData.ethereum.usd_24h_change ?? fb.change_pct };
    }
    if (meta.symbol === "EUR/USD" && frData?.rates?.EUR) {
      return { ...meta, price: 1 / frData.rates.EUR, change_pct: fb.change_pct };
    }
    if (meta.symbol === "USD/JPY" && frData?.rates?.JPY) {
      return { ...meta, price: frData.rates.JPY, change_pct: fb.change_pct };
    }
    return { ...meta, price: fb.price, change_pct: fb.change_pct };
  });
}
