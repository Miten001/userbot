/* Shared types and utilities for all dashboard pages */

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

export function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}
