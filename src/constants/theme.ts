// src/constants/theme.ts
//
// Palette drawn from breakawayroping.pro — a modern purple/pink identity that
// sets the fastest women's timed event apart from the traditional-leather look
// of the roughstock and roping apps.

export const colors = {
  background: '#140b1c',
  surface: '#1e1329',
  card: '#261634',
  border: '#3d2a52',
  text: '#f2e9f7',
  muted: '#b39ac6',
  accent: '#c026d3',
  accentAlt: '#f472b6',
  cream: '#f7edff',
  success: '#4ba36b',
  warning: '#d99a2b',
  danger: '#c8503f',
} as const;

export const app = {
  name: "Breakaway Roping",
  short: "Breakaway",
  domain: "breakawayroping.pro",
  eventType: "breakawayroping",
  eventLabel: "breakaway roping",
  tagline: "The fastest catch in rodeo, broken down rope by rope.",
  associations: ["WPRA", "NIRA", "NHSRA"] as readonly string[],
} as const;

export const spacing = { screenX: 20, screenY: 24, gap: 24, cardPad: 16 } as const;
export const radius = { card: 16, pill: 999, control: 12 } as const;
