import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scoreBreakawayRun, type BreakawayRunInput } from './index.ts';
import type { RulesProfile } from '../types.ts';

const profile: RulesProfile = {
  ruleSetId: 'wpra-2026',
  edition: 'WPRA 2026 Rule Book',
  associationCode: 'WPRA',
  values: { barrier_penalty_seconds: 10 },
};

function run(overrides: Partial<BreakawayRunInput> = {}): BreakawayRunInput {
  return {
    rawTimeMs: 2400,
    caught: true,
    stringBrokeAwayCleanly: true,
    brokeStringByHand: false,
    barrierBroken: false,
    ...overrides,
  };
}

test('clean run keeps its raw time', () => {
  const outcome = scoreBreakawayRun(run(), profile);
  assert.equal(outcome.status, 'clean');
  assert.equal(outcome.officialTimeMs, 2400);
});

test('broken barrier adds the association penalty', () => {
  const outcome = scoreBreakawayRun(run({ barrierBroken: true }), profile);
  assert.equal(outcome.status, 'penalty');
  assert.equal(outcome.officialTimeMs, 12400);
});

test('no catch is a no time', () => {
  assert.equal(scoreBreakawayRun(run({ caught: false }), profile).status, 'no_time');
});

test('breaking the string by hand is a no time', () => {
  assert.equal(scoreBreakawayRun(run({ brokeStringByHand: true }), profile).status, 'no_time');
});

test('string that never releases is a no time', () => {
  assert.equal(scoreBreakawayRun(run({ stringBrokeAwayCleanly: false }), profile).status, 'no_time');
});
