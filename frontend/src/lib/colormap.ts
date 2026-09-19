// Small dependency-free colormap. Not the real viridis LUT, but a
// perceptually-reasonable blue->teal->yellow ramp, sufficient for MVP.
// Returns [r,g,b] each 0-255.
const STOPS: [number, number, number][] = [
  [13, 8, 135],
  [84, 2, 163],
  [139, 10, 165],
  [185, 50, 137],
  [219, 92, 104],
  [244, 136, 73],
  [254, 188, 43],
  [240, 249, 33],
];

export function colormapValue(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (STOPS.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(i0 + 1, STOPS.length - 1);
  const frac = scaled - i0;
  const a = STOPS[i0];
  const b = STOPS[i1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}
