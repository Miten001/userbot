/**
 * MT5 provider abstraction.
 *
 * In the real world a prop firm provisions an MT5 account by either:
 *   1. Calling a broker's MT5 Manager API (requires a license / partnership), or
 *   2. Using a 3rd-party SaaS like https://metaapi.cloud (paid plan ~$39/mo).
 *
 * This module exposes a tiny interface (`MT5Provider`) and ships TWO impls:
 *   • MockProvider   — returns fake account numbers, used until you wire MetaApi.
 *   • MetaApiProvider— sketched stub that talks to metaapi.cloud REST.
 *
 * Switching is automatic: if `METAAPI_TOKEN` is set in env, MetaApi is used,
 * otherwise the mock kicks in. Backend code should always go through
 * `getMT5Provider()` — never branch on env directly.
 */

export type ProvisionInput = {
  account_size_usd: number;
  user_email: string;
  /** Friendly group name e.g. "evaluation-2step-50000" — providers may use it as a tag. */
  group?: string;
};

export type ProvisionResult = {
  provider: "mock" | "metaapi";
  provider_id: string;       // internal ID at provider
  login: string;             // MT5 login number (e.g. "10234567")
  password: string;          // initial investor/master password
  server: string;            // MT5 server name
  balance_usd: number;
};

export interface MT5Provider {
  provision(input: ProvisionInput): Promise<ProvisionResult>;
  /** Returns balance/equity. Used by the risk engine to enforce drawdown. */
  fetchEquity(provider_id: string): Promise<{ balance_usd: number; equity_usd: number }>;
}

/* ──────────────────────────────────────────────────────────────
 * Mock provider — no external dependency, deterministic-ish.
 * Good enough for local dev and demos.
 * ────────────────────────────────────────────────────────────── */
class MockProvider implements MT5Provider {
  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    const login = String(10_000_000 + Math.floor(Math.random() * 89_999_999));
    return {
      provider: "mock",
      provider_id: `mock_${login}`,
      login,
      password: randomPassword(),
      server: "ApexFunded-Demo",
      balance_usd: input.account_size_usd,
    };
  }

  async fetchEquity(provider_id: string) {
    // Mocked: tiny random walk around the size embedded in the id.
    const seed = parseInt(provider_id.replace(/\D/g, "")) || 50_000;
    const drift = (Math.random() - 0.5) * 0.02 * seed;
    const balance = seed;
    const equity = +(balance + drift).toFixed(2);
    return { balance_usd: balance, equity_usd: equity };
  }
}

/* ──────────────────────────────────────────────────────────────
 * MetaApi provider — talks to https://metaapi.cloud.
 *
 * NOTE: this is a *sketch*. The real flow at MetaApi requires:
 *   1. Pre-provisioned MT5 accounts at a broker (MetaApi rents them).
 *   2. An API token (set METAAPI_TOKEN).
 *   3. Per-region API endpoints.
 *
 * Do NOT enable this in production without reading MetaApi docs.
 * ────────────────────────────────────────────────────────────── */
class MetaApiProvider implements MT5Provider {
  private token: string;
  private region: string;

  constructor(token: string, region: string) {
    this.token = token;
    this.region = region;
  }

  private apiBase() {
    return `https://mt-provisioning-api-v1.${this.region}.agiliumtrade.ai`;
  }

  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    // POST /users/current/accounts with provisioning request
    const res = await fetch(`${this.apiBase()}/users/current/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": this.token,
      },
      body: JSON.stringify({
        name: `apex-${input.user_email}-${input.account_size_usd}`,
        type: "cloud",
        platform: "mt5",
        magic: 0,
        application: "MetaApi",
        // …broker-specific fields (login, server) go here in production
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MetaApi provision failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      login: string;
      password: string;
      server: string;
    };

    return {
      provider: "metaapi",
      provider_id: data.id,
      login: data.login,
      password: data.password,
      server: data.server,
      balance_usd: input.account_size_usd,
    };
  }

  async fetchEquity(provider_id: string) {
    const res = await fetch(
      `https://mt-client-api-v1.${this.region}.agiliumtrade.ai/users/current/accounts/${provider_id}/account-information`,
      { headers: { "auth-token": this.token } },
    );
    if (!res.ok) throw new Error(`MetaApi equity fetch failed: ${res.status}`);
    const data = (await res.json()) as { balance: number; equity: number };
    return { balance_usd: data.balance, equity_usd: data.equity };
  }
}

/* ──────────────────────────────────────────────────────────────
 * Factory
 * ────────────────────────────────────────────────────────────── */
let _provider: MT5Provider | null = null;

export function getMT5Provider(): MT5Provider {
  if (_provider) return _provider;
  const token = process.env.METAAPI_TOKEN;
  const region = process.env.METAAPI_REGION || "new-york";
  _provider = token ? new MetaApiProvider(token, region) : new MockProvider();
  return _provider;
}

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
