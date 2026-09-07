// src/lib/scoring/breakawayroping/index.ts
//
// Breakaway roping. The fastest timed event in rodeo: one loop, one catch, and
// the string breaks away from the saddle horn to stop the clock. The engine is
// almost entirely binary outcomes plus one additive barrier penalty — the
// product value is in a clean, defensible call, not in a complicated formula.
//
// Every rule is data (barrier seconds vary by association) and every outcome
// cites its rule, per src/lib/scoring/types.ts.

import {
  type AppliedPenalty,
  type RulesProfile,
  type RunOutcome,
  formatTime,
  profileBool,
  requireNumber,
} from '../types.ts';

export const BR_PENALTIES = {
  BARRIER: { code: 'BARRIER', rule: 'Broken barrier' },
  NO_CATCH: { code: 'NO_CATCH', rule: 'Legal catch required around the neck' },
  BREAK_BY_HAND: { code: 'BREAK_BY_HAND', rule: 'String must break from the horn, not be broken by hand' },
  NO_RELEASE: { code: 'NO_RELEASE', rule: 'Rope must release (break away) from the saddle horn' },
  TIME_LIMIT: { code: 'TIME_LIMIT', rule: 'Exceeded the arena time limit' },
} as const;

export interface BreakawayRunInput {
  /** Raw time from flag to string break, in milliseconds. */
  rawTimeMs: number | null;
  /** A legal catch is a loop around the calf's neck that holds. */
  caught: boolean;
  /** The string released from the horn (rather than being pulled by hand). */
  stringBrokeAwayCleanly: boolean;
  /** True when the roper reached up and broke the string by hand — no time. */
  brokeStringByHand: boolean;
  /** Barrier broken at the start (adds the association's barrier penalty). */
  barrierBroken: boolean;
}

/**
 * Score a breakaway run under a dated rules profile.
 *
 * Required rule values:
 *   barrier_penalty_seconds  number  (WPRA/PRCA typically 10)
 */
export function scoreBreakawayRun(input: BreakawayRunInput, profile: RulesProfile): RunOutcome {
  const penalties: AppliedPenalty[] = [];

  // No catch, string broken by hand, or string that never released are all no-time.
  if (!input.caught) {
    return {
      status: 'no_time',
      appliedPenalties: [{ ...BR_PENALTIES.NO_CATCH, rule: `${BR_PENALTIES.NO_CATCH.rule} — ${profile.edition}` }],
      explanation: `No time: a legal catch is required (${profile.edition}).`,
    };
  }
  if (input.brokeStringByHand) {
    return {
      status: 'no_time',
      appliedPenalties: [{ ...BR_PENALTIES.BREAK_BY_HAND, rule: `${BR_PENALTIES.BREAK_BY_HAND.rule} — ${profile.edition}` }],
      explanation: `No time: the string was broken by hand (${profile.edition}).`,
    };
  }
  if (!input.stringBrokeAwayCleanly) {
    return {
      status: 'no_time',
      appliedPenalties: [{ ...BR_PENALTIES.NO_RELEASE, rule: `${BR_PENALTIES.NO_RELEASE.rule} — ${profile.edition}` }],
      explanation: `No time: the rope did not break away from the horn (${profile.edition}).`,
    };
  }
  if (input.rawTimeMs === null || !Number.isFinite(input.rawTimeMs)) {
    return {
      status: 'no_time',
      appliedPenalties: [],
      explanation: 'No time recorded.',
    };
  }

  let officialTimeMs = input.rawTimeMs;

  if (input.barrierBroken) {
    const barrierSeconds = requireNumber(profile, 'barrier_penalty_seconds');
    officialTimeMs += barrierSeconds * 1000;
    penalties.push({
      ...BR_PENALTIES.BARRIER,
      seconds: barrierSeconds,
      rule: `${barrierSeconds} second barrier — ${profile.edition}`,
    });
  }

  const status = penalties.length > 0 ? 'penalty' : 'clean';
  const explanation =
    penalties.length > 0
      ? `${formatTime(officialTimeMs)} with a ${formatTime(officialTimeMs - input.rawTimeMs)} barrier penalty (${profile.edition}).`
      : `Clean run: ${formatTime(officialTimeMs)} (${profile.edition}).`;

  // Kept for parity with other engines that read optional strictness flags.
  void profileBool(profile, 'strict_flag_review', false);

  return {
    status,
    officialTimeMs,
    appliedPenalties: penalties,
    explanation,
  };
}
