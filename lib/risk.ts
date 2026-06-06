/**
 * Risk / evaluation engine.
 *
 * Pure, side-effect-free functions that decide what should happen to an
 * account given a fresh equity reading. The /api/sync route fetches live
 * equity from the MT5 provider, feeds it through `evaluateAccount`, and
 * persists the returned patch. Keeping the rules pure makes them trivial to
 * reason about (and to unit-test later).
 *
 * Rules implemented (typical prop-firm model):
 *   • Overall drawdown — equity must stay above
 *       initial_balance × (1 − overall_loss_pct/100).
 *   • Daily drawdown   — equity must stay above
 *       day_start_equity × (1 − daily_loss_pct/100).
 *   • Profit target    — during evaluation, hitting
 *       step_baseline × (1 + profit_target_pct/100) passes the step.
 *       Passing the final step funds the account; funded accounts have no
 *       profit target (only drawdown protection).
 *
 * A new trading day resets the daily anchor to the equity carried over from
 * the previous close.
 */

export type AccountPhase = "evaluation" | "funded" | "breached" | "closed";

/** The subset of an `accounts` row the engine needs to make a decision. */
export type EvalAccount = {
  initial_balance_usd: number;
  balance_usd: number; // baseline for the CURRENT step
  equity_usd: number; // last known equity (before this reading)
  high_water_usd: number;
  day_start_equity_usd: number | null;
  day_anchor: string | null; // YYYY-MM-DD
  daily_loss_pct: number;
  overall_loss_pct: number;
  profit_target_pct: number;
  phase: AccountPhase;
  step_index: number;
  total_steps: number;
};

export type EvalEventType =
  | "synced"
  | "step_passed"
  | "funded"
  | "breached"
  | "daily_reset";

export type EvalEvent = { type: EvalEventType; message: string };

export type AccountPatch = {
  equity_usd?: number;
  balance_usd?: number;
  high_water_usd?: number;
  day_start_equity_usd?: number;
  day_anchor?: string;
  phase?: AccountPhase;
  step_index?: number;
  funded_at?: string;
  breached_at?: string;
  breach_reason?: string;
  last_synced_at?: string;
};

export type EvalResult = {
  patch: AccountPatch;
  events: EvalEvent[];
  /** New `challenges.state`, when the outcome should change it. */
  challengeState?: "active" | "failed" | "funded";
};

/** UTC date string (YYYY-MM-DD) used as the daily-drawdown anchor. */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function evaluateAccount(
  acc: EvalAccount,
  newEquity: number,
  now: Date = new Date(),
): EvalResult {
  const events: EvalEvent[] = [];
  const patch: AccountPatch = {
    last_synced_at: now.toISOString(),
  };

  const today = dayKey(now);
  const initial = acc.initial_balance_usd || acc.balance_usd;
  const stepBaseline = acc.balance_usd || initial;

  // ── Daily anchor rollover ───────────────────────────────────────────
  let dayStart = acc.day_start_equity_usd ?? stepBaseline;
  if (acc.day_anchor !== today) {
    // Carry the prior close (last known equity) as the new day's open.
    dayStart = acc.equity_usd ?? stepBaseline;
    patch.day_start_equity_usd = dayStart;
    patch.day_anchor = today;
    events.push({ type: "daily_reset", message: `New trading day — daily limit re-anchored at $${dayStart.toFixed(2)}` });
  }

  // Always record the new equity + high-water mark.
  patch.equity_usd = newEquity;
  patch.high_water_usd = Math.max(acc.high_water_usd ?? newEquity, newEquity);

  // Terminal phases: just record the reading, no rule evaluation.
  if (acc.phase === "breached" || acc.phase === "closed") {
    events.push({ type: "synced", message: "Equity recorded (account inactive)." });
    return { patch, events };
  }

  // ── Drawdown breaches ───────────────────────────────────────────────
  const overallFloor = round2(initial * (1 - acc.overall_loss_pct / 100));
  const dailyFloor = round2(dayStart * (1 - acc.daily_loss_pct / 100));

  if (newEquity <= overallFloor) {
    patch.phase = "breached";
    patch.breached_at = now.toISOString();
    patch.breach_reason = `Overall drawdown: equity $${newEquity.toFixed(2)} ≤ floor $${overallFloor.toFixed(2)}`;
    events.push({ type: "breached", message: patch.breach_reason });
    return { patch, events, challengeState: acc.phase === "evaluation" ? "failed" : undefined };
  }

  if (newEquity <= dailyFloor) {
    patch.phase = "breached";
    patch.breached_at = now.toISOString();
    patch.breach_reason = `Daily drawdown: equity $${newEquity.toFixed(2)} ≤ daily floor $${dailyFloor.toFixed(2)}`;
    events.push({ type: "breached", message: patch.breach_reason });
    return { patch, events, challengeState: acc.phase === "evaluation" ? "failed" : undefined };
  }

  // ── Profit target (evaluation only) ─────────────────────────────────
  if (acc.phase === "evaluation") {
    const target = round2(stepBaseline * (1 + acc.profit_target_pct / 100));
    if (newEquity >= target) {
      const isFinalStep = acc.step_index >= acc.total_steps;

      // Reset the baseline so the next phase starts fresh at the initial size.
      patch.balance_usd = initial;
      patch.equity_usd = initial;
      patch.high_water_usd = initial;
      patch.day_start_equity_usd = initial;
      patch.day_anchor = today;

      if (isFinalStep) {
        patch.phase = "funded";
        patch.funded_at = now.toISOString();
        events.push({ type: "funded", message: `Profit target hit — account is now FUNDED ($${initial.toFixed(2)}).` });
        return { patch, events, challengeState: "funded" };
      }

      patch.step_index = acc.step_index + 1;
      events.push({
        type: "step_passed",
        message: `Step ${acc.step_index}/${acc.total_steps} passed — advanced to step ${acc.step_index + 1}.`,
      });
      return { patch, events, challengeState: "active" };
    }
  }

  events.push({ type: "synced", message: `Equity $${newEquity.toFixed(2)} recorded.` });
  return { patch, events };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
