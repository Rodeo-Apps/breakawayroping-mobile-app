// src/lib/pose/event.ts — breakaway roping
//
// The fastest timed event in rodeo: score the start off the barrier, the swing
// and delivery, the catch, and the string break off the horn. Unlike tie-down
// there is no dismount or tie — the whole run is over in two to three seconds,
// so the margins that matter are the start and the delivery.

import type { FaultDefinition } from './types.ts';
import type { Taxonomy } from './judge.ts';

export const FEATURE_KEYS = [
  'barrier_break_delta_ms',
  'box_start_frame_ms',
  'horse_acceleration_profile',
  'approach_line_deviation',
  'swing_count',
  'delivery_frame_ms',
  'loop_travel_ms',
  'catch_frame_ms',
  'loop_placement_class', // 0 clean neck, 1 high/one-ear, 2 missed
  'string_break_frame_ms',
  'horse_rate_frame_ms', // horse rating the calf into the catch
  'horse_stop_frame_ms',
] as const;

export const SEGMENTS: string[] = [];

const DEFINITIONS: FaultDefinition[] = [
  {
    code: 'BARRIER_MARGIN_THIN',
    label: 'Cutting the barrier fine',
    description: 'Leaving close enough to the barrier that a ten second penalty is a matter of luck.',
    segment: 'whole_run',
    attributedTo: 'pair',
    feature: 'barrier_break_delta_ms',
    thresholds: { low: -80, medium: -40, high: -10 },
    inverted: true,
    drill: 'Score work against a marker with your margin called out loud.',
  },
  {
    code: 'SLOW_START',
    label: 'Slow out of the box',
    description:
      'Barrier release to the horse reaching stride. In an event won by hundredths this is where most time is lost.',
    segment: 'whole_run',
    attributedTo: 'pair',
    feature: 'box_start_frame_ms',
    thresholds: { low: 120, medium: 240, high: 400 },
    drill: 'Box work: leave flat and hard, then rate down, before you add a calf.',
  },
  {
    code: 'EXTRA_SWING',
    label: 'One swing too many',
    description:
      'Every extra swing is time on the clock. The best breakaway ropers deliver on the first or second swing.',
    segment: 'whole_run',
    attributedTo: 'rider',
    feature: 'swing_count',
    thresholds: { low: 3, medium: 4, high: 5 },
    drill: 'Dummy roping on a fast count — commit to the delivery, do not wind up.',
  },
  {
    code: 'DELIVERY_LATE',
    label: 'Late delivery',
    description: 'Reaching the catch position but not letting the loop go. Position without delivery is wasted time.',
    segment: 'whole_run',
    attributedTo: 'rider',
    feature: 'delivery_frame_ms',
    thresholds: { low: 150, medium: 300, high: 500 },
    drill: 'Rope the sled at speed, delivering the instant you reach position.',
  },
  {
    code: 'LOOP_PLACEMENT_POOR',
    label: 'Loose loop placement',
    description:
      'The loop caught high or on one ear rather than settling clean around the neck, risking a slipped catch.',
    segment: 'whole_run',
    attributedTo: 'rider',
    feature: 'loop_placement_class',
    thresholds: { low: 0.4, medium: 0.7, high: 1.0 },
    drill: 'Slow-motion delivery work focusing on tip control and a flat, open loop.',
  },
  {
    code: 'HORSE_RATE_POOR',
    label: 'Horse not rating the calf',
    description:
      'A horse that rates the calf into the catch position gives the roper a still target. This one did not.',
    segment: 'whole_run',
    attributedTo: 'horse',
    feature: 'horse_rate_frame_ms',
    thresholds: { low: 150, medium: 300, high: 500 },
    drill: 'Tracking work behind cattle without roping, rewarding the rate.',
  },
];

export const TAXONOMY: Taxonomy = {
  version: 'breakawayroping-1.0.0',
  definitions: DEFINITIONS,
  repeatedSegments: SEGMENTS,
};
