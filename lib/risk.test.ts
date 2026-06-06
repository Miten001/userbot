import { describe, it, expect } from "vitest";
import { evaluateAccount, dayKey, type EvalAccount } from "./risk";

/** A healthy mid-evaluation account anchored to "today". */
function baseAccount(overrides: Partial<EvalAccount> = {}): EvalAccount {
  const today = dayKey(new Date("2026-06-06T12:00:00Z"));
  return {
    initial_balance_usd: 50_000,
    balance_usd: 50_000,
    equity_usd: 50_000,
    high_water_usd: 50_000,
    day_start_equity_usd: 50_000,
    day_anchor: today,
    daily_loss_pct: 5,
    overall_loss_pct: 10,
    profit_target_pct: 8,
    phase: "evaluation",
    step_index: 1,
    total_steps: 2,
    ...overrides,
  };
}

const NOW = new Date("2026-06-06T12:00:00Z");

describe("evaluateAccount", () => {
  it("records equity and updates the high-water mark on a normal sync", () => {
    const { patch, events } = evaluateAccount(baseAccount(), 51_000, NOW);
    expect(patch.equity_usd).toBe(51_000);
    expect(patch.high_water_usd).toBe(51_000);
    expect(patch.phase).toBeUndefined();
    expect(events.some((e) => e.type === "synced")).toBe(true);
  });

  it("does not lower the high-water mark when equity dips", () => {
    const acc = baseAccount({ high_water_usd: 53_000, equity_usd: 53_000 });
    const { patch } = evaluateAccount(acc, 52_000, NOW);
    expect(patch.high_water_usd).toBe(53_000);
  });

  it("breaches on overall drawdown (equity at/below initial × (1 - overall%))", () => {
    // floor = 50_000 × 0.90 = 45_000
    const { patch, events, challengeState } = evaluateAccount(baseAccount(), 44_900, NOW);
    expect(patch.phase).toBe("breached");
    expect(patch.breach_reason).toMatch(/Overall drawdown/);
    expect(events.some((e) => e.type === "breached")).toBe(true);
    expect(challengeState).toBe("failed");
  });

  it("breaches on daily drawdown (equity below day_start × (1 - daily%))", () => {
    // day floor = 50_000 × 0.95 = 47_500, still above overall floor 45_000
    const { patch } = evaluateAccount(baseAccount(), 47_400, NOW);
    expect(patch.phase).toBe("breached");
    expect(patch.breach_reason).toMatch(/Daily drawdown/);
  });

  it("passes a step and advances when the profit target is hit (not final step)", () => {
    // target = 50_000 × 1.08 = 54_000
    const { patch, events, challengeState } = evaluateAccount(baseAccount(), 54_100, NOW);
    expect(patch.phase).toBeUndefined();
    expect(patch.step_index).toBe(2);
    expect(patch.balance_usd).toBe(50_000); // baseline reset to initial
    expect(patch.equity_usd).toBe(50_000); // fresh start
    expect(challengeState).toBe("active");
    expect(events.some((e) => e.type === "step_passed")).toBe(true);
  });

  it("funds the account when the final step's profit target is hit", () => {
    const acc = baseAccount({ step_index: 2, total_steps: 2 });
    const { patch, events, challengeState } = evaluateAccount(acc, 54_500, NOW);
    expect(patch.phase).toBe("funded");
    expect(patch.funded_at).toBeTruthy();
    expect(challengeState).toBe("funded");
    expect(events.some((e) => e.type === "funded")).toBe(true);
  });

  it("re-anchors the daily limit on a new trading day", () => {
    const acc = baseAccount({ day_anchor: "2026-06-05", equity_usd: 52_000 });
    const { patch, events } = evaluateAccount(acc, 52_500, NOW);
    expect(patch.day_anchor).toBe(dayKey(NOW));
    expect(patch.day_start_equity_usd).toBe(52_000); // carried from prior close
    expect(events.some((e) => e.type === "daily_reset")).toBe(true);
  });

  it("enforces only overall drawdown for funded accounts (no profit target)", () => {
    const acc = baseAccount({ phase: "funded", step_index: 2 });
    // Big profit should NOT change phase for a funded account.
    const { patch } = evaluateAccount(acc, 60_000, NOW);
    expect(patch.phase).toBeUndefined();
    expect(patch.equity_usd).toBe(60_000);
  });

  it("breaches a funded account on drawdown without failing a challenge", () => {
    const acc = baseAccount({ phase: "funded", step_index: 2 });
    const { patch, challengeState } = evaluateAccount(acc, 44_000, NOW);
    expect(patch.phase).toBe("breached");
    expect(challengeState).toBeUndefined(); // funded breach doesn't fail the eval
  });

  it("only records equity for already-breached accounts", () => {
    const acc = baseAccount({ phase: "breached" });
    const { patch, events } = evaluateAccount(acc, 10_000, NOW);
    expect(patch.phase).toBeUndefined();
    expect(patch.equity_usd).toBe(10_000);
    expect(events.every((e) => e.type === "synced" || e.type === "daily_reset")).toBe(true);
  });
});
