/* Shared types and demo data for all dashboard pages */

export type Account = {
  id: string;
  mt5_login: string;
  mt5_server: string;
  balance_usd: number;
  equity_usd: number;
  phase: string;
  step_index: number;
  profit_target_pct: number;
  daily_loss_pct: number;
  overall_loss_pct: number;
  profit_split_pct?: number;
  challenge?: { step: string; account_size_usd: number; state: string };
};

export type Profile = {
  id: string;
  full_name: string | null;
  country: string | null;
  phone: string | null;
  is_admin?: boolean;
};

export type Payout = {
  id: string;
  account_id: string;
  amount_usd: number;
  method: string | null;
  destination: string | null;
  status: string;
  requested_at: string;
  paid_at: string | null;
};

export type Trade = {
  id: string;
  account_id: string;
  symbol: string;
  side: string;
  volume: number;
  open_price: number | null;
  close_price: number | null;
  profit_usd: number | null;
  opened_at: string | null;
  closed_at: string | null;
};

export const WITHDRAW_METHODS = [
  { value: "bank", label: "Bank transfer" },
  { value: "usdt-trc20", label: "USDT (TRC-20)" },
  { value: "wise", label: "Wise" },
];

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: "demo-1", mt5_login: "10458321", mt5_server: "ApexFunded-Demo",
    balance_usd: 50_000, equity_usd: 52_412, phase: "evaluation", step_index: 1,
    profit_target_pct: 8, daily_loss_pct: 5, overall_loss_pct: 10, profit_split_pct: 80,
    challenge: { step: "two", account_size_usd: 50_000, state: "active" },
  },
  {
    id: "demo-2", mt5_login: "10458977", mt5_server: "ApexFunded-Live",
    balance_usd: 100_000, equity_usd: 106_300, phase: "funded", step_index: 2,
    profit_target_pct: 0, daily_loss_pct: 5, overall_loss_pct: 10, profit_split_pct: 85,
    challenge: { step: "two", account_size_usd: 100_000, state: "funded" },
  },
];

export const DEMO_PROFILE: Profile = { id: "demo", full_name: "Alex Trader", country: "AE", phone: "+971 50 000 0000" };

export const DEMO_PAYOUTS: Payout[] = [
  { id: "demo-po1", account_id: "demo-2", amount_usd: 1_240, method: "usdt-trc20", destination: "TXk...9f3", status: "paid", requested_at: new Date(Date.now() - 6e8).toISOString(), paid_at: new Date(Date.now() - 5e8).toISOString() },
  { id: "demo-po2", account_id: "demo-2", amount_usd: 850, method: "bank", destination: "IBAN...42", status: "requested", requested_at: new Date(Date.now() - 2e8).toISOString(), paid_at: null },
];

export const DEMO_TRADES: Trade[] = [
  { id: "t1", account_id: "demo-2", symbol: "XAUUSD", side: "buy", volume: 1.2, open_price: 2318.4, close_price: 2331.7, profit_usd: 1_596, opened_at: new Date(Date.now() - 2e8).toISOString(), closed_at: new Date(Date.now() - 1.9e8).toISOString() },
  { id: "t2", account_id: "demo-1", symbol: "EURUSD", side: "sell", volume: 0.8, open_price: 1.0921, close_price: 1.0894, profit_usd: 216, opened_at: new Date(Date.now() - 3e8).toISOString(), closed_at: new Date(Date.now() - 2.8e8).toISOString() },
  { id: "t3", account_id: "demo-1", symbol: "GBPUSD", side: "buy", volume: 0.5, open_price: 1.2710, close_price: 1.2688, profit_usd: -110, opened_at: new Date(Date.now() - 4e8).toISOString(), closed_at: new Date(Date.now() - 3.9e8).toISOString() },
  { id: "t4", account_id: "demo-2", symbol: "BTCUSD", side: "buy", volume: 0.3, open_price: 61_200, close_price: 62_540, profit_usd: 402, opened_at: new Date(Date.now() - 5e8).toISOString(), closed_at: new Date(Date.now() - 4.8e8).toISOString() },
  { id: "t5", account_id: "demo-2", symbol: "USDJPY", side: "sell", volume: 1.0, open_price: 157.82, close_price: 157.14, profit_usd: 431, opened_at: new Date(Date.now() - 6e8).toISOString(), closed_at: new Date(Date.now() - 5.8e8).toISOString() },
];

export function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}
