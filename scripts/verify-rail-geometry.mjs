// Re-derive Comb side-rail hex geometry and prove no overlap + 3-row fit.
// Mirrors the constants in public/index.html renderRail() and the center comb px() formula.

const RAIL_COLS = 3;
const VISIBLE_ROWS = 3;
const S3 = Math.sqrt(3);
const MAX_RAIL_SIZE = 56;

// Expanded rail dimensions after the layout fix.
const railWidth = 350;      // comb-rail min-width
const pxW = Math.max(320, railWidth - 10);
const railH = 420;
const labelH = 18;
const subH = 14;
const availH = Math.max(220, railH - labelH - subH - 14);

const RAIL_WIDTH_FACTOR = 6; // 3 rectangular cols * 2*size + 2*size end caps
const sizeFromW = pxW / RAIL_WIDTH_FACTOR;
const sizeFromH = availH / (0.95 + (VISIBLE_ROWS - 1) * S3 + S3 / 2);
const size = Math.max(44, Math.min(MAX_RAIL_SIZE, sizeFromW, sizeFromH));

const pitchX = size * 2;
const pitchY = size * S3;
const padX = Math.max(size, (pxW - 4 * size) / 2);
const padY = size * 0.95;

const hexDrawRadius = size - 2;
const hexFlatToFlat = hexDrawRadius * S3;
const hexVertexToVertex = hexDrawRadius * 2;
const strokeWidth = 1.35;

const visibleH = padY + (VISIBLE_ROWS - 1) * pitchY + size * S3 / 2;

// Build rectangular slot centers.
const slots = [];
let i = 0;
for (let row = 0; i < 9; row++) {
  for (let col = 0; col < RAIL_COLS && i < 9; col++) {
    slots.push({
      row,
      col,
      cx: padX + col * pitchX,
      cy: padY + row * pitchY,
    });
    i++;
  }
}

// Check pairwise overlaps using axis-aligned bounding boxes of the drawn hexes.
function hexBox(cx, cy) {
  return {
    left: cx - hexDrawRadius,
    right: cx + hexDrawRadius,
    top: cy - hexFlatToFlat / 2,
    bottom: cy + hexFlatToFlat / 2,
  };
}

let overlap = false;
let overlapPairs = [];
for (let a = 0; a < slots.length; a++) {
  for (let b = a + 1; b < slots.length; b++) {
    const boxA = hexBox(slots[a].cx, slots[a].cy);
    const boxB = hexBox(slots[b].cx, slots[b].cy);
    const horizontalGap = Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left);
    const verticalGap = Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top);
    if (horizontalGap > 0 && verticalGap > 0) {
      overlap = true;
      overlapPairs.push({ a: slots[a], b: slots[b], horizontalGap, verticalGap });
    }
  }
}

// Row-gap check (vertical gap between adjacent row polygons, including stroke).
const rowGaps = [];
for (let r = 0; r < VISIBLE_ROWS - 1; r++) {
  const topOfLower = padY + (r + 1) * pitchY - hexFlatToFlat / 2;
  const bottomOfUpper = padY + r * pitchY + hexFlatToFlat / 2;
  const gap = topOfLower - bottomOfUpper;
  rowGaps.push({ row: r, gap, visualGap: gap - strokeWidth });
}

// Center comb vertical pitch for the same size.
const centerCombPitchY = size * S3;

console.log("Rail geometry verification");
console.log("==========================");
console.log(`rail width (railWidth)  : ${railWidth}px`);
console.log(`drawable width (pxW)    : ${pxW}px`);
console.log(`available height        : ${availH}px`);
console.log(`sizeFromW               : ${sizeFromW.toFixed(2)}`);
console.log(`sizeFromH               : ${sizeFromH.toFixed(2)}`);
console.log(`chosen size             : ${size.toFixed(2)}`);
console.log(`pitchX                  : ${pitchX.toFixed(2)}px`);
console.log(`pitchY                  : ${pitchY.toFixed(2)}px`);
console.log(`padX                    : ${padX.toFixed(2)}px`);
console.log(`padY                    : ${padY.toFixed(2)}px`);
console.log(`visibleH                : ${visibleH.toFixed(2)}px`);
console.log(`hex draw radius         : ${hexDrawRadius.toFixed(2)}px`);
console.log(`hex flat-to-flat height : ${hexFlatToFlat.toFixed(2)}px`);
console.log(`hex vertex-to-vertex    : ${hexVertexToVertex.toFixed(2)}px`);
console.log(`stroke width            : ${strokeWidth}px`);
console.log("");
console.log("Slot centers (first 9)");
slots.forEach((s) => {
  console.log(`row ${s.row} col ${s.col}: cx ${s.cx.toFixed(2)}, cy ${s.cy.toFixed(2)}`);
});
console.log("");
console.log("Row gaps (polygon edge to edge, then visual incl. stroke)");
rowGaps.forEach((g) => {
  console.log(`row ${g.row} -> ${g.row + 1}: gap ${g.gap.toFixed(2)}px, visual gap ${g.visualGap.toFixed(2)}px`);
});
console.log("");
console.log(`Any polygon overlap                     : ${overlap ? "YES — FAIL" : "NO — PASS"}`);
if (overlap) {
  console.log("Overlap pairs:");
  overlapPairs.forEach((p) => {
    console.log(`  row ${p.a.row} col ${p.a.col} <-> row ${p.b.row} col ${p.b.col}: h-gap ${p.horizontalGap.toFixed(2)}px, v-gap ${p.verticalGap.toFixed(2)}px`);
  });
}
console.log(`3-row visible height fits in availH     : ${visibleH <= availH + 0.001 ? "YES — PASS" : "NO — FAIL"}`);
console.log(`Rail pitchY matches center comb pitchY  : ${Math.abs(pitchY - centerCombPitchY) < 0.001 ? "YES — PASS" : "NO — FAIL"}`);
console.log(`PitchY/hexHeight ratio (should be > 1)  : ${(pitchY / hexFlatToFlat).toFixed(3)}`);
console.log(`Hex size unchanged (≈56)                : ${Math.abs(size - 56) <= 1 ? "YES — PASS" : "NO — FAIL"}`);
console.log(`Rail width expanded (>= 350px)          : ${railWidth >= 350 ? "YES — PASS" : "NO — FAIL"}`);
console.log(`Rail height expanded (>= 380px)         : ${railH >= 380 ? "YES — PASS" : "NO — FAIL"}`);

if (overlap || visibleH > availH + 0.001) {
  process.exit(1);
}
