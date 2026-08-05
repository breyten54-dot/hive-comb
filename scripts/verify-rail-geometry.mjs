// Verify Comb side-rail hex geometry: 3×6 band, non-overlapping pitch,
// size from width only (6 rows must not shrink hexes). Mirrors renderRail().

const RAIL_ROWS = 6;
const RAIL_VISIBLE_COLS = 3;
const S3 = Math.sqrt(3);
const MAX_RAIL_SIZE = 48;

const pxW = 220;
const sizeFromW = pxW / (2 + (RAIL_VISIBLE_COLS - 1) * 2 + 0.2);
const size = Math.max(28, Math.min(MAX_RAIL_SIZE, sizeFromW));

const pitchX = size * 2;
const pitchY = size * S3;
const padX = size;
const padY = size * 0.95;

const hexDrawRadius = size - 2;
const hexFlatToFlat = hexDrawRadius * S3;

const cols = 3;
const slots = [];
let i = 0;
const slotCount = cols * RAIL_ROWS;
for (let col = 0; col < cols; col++) {
  for (let row = 0; row < RAIL_ROWS; row++) {
    if (i >= slotCount) break;
    slots.push({
      row,
      col,
      cx: padX + col * pitchX,
      cy: padY + row * pitchY,
    });
    i++;
  }
}

const contentW = padX + (cols - 1) * pitchX + size;
const visibleH = padY + (RAIL_ROWS - 1) * pitchY + size * S3 / 2;

function hexBox(cx, cy) {
  return {
    left: cx - hexDrawRadius,
    right: cx + hexDrawRadius,
    top: cy - hexFlatToFlat / 2,
    bottom: cy + hexFlatToFlat / 2,
  };
}

let overlap = false;
const overlapPairs = [];
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

const rowGaps = [];
for (let r = 0; r < RAIL_ROWS - 1; r++) {
  const topOfLower = padY + (r + 1) * pitchY - hexFlatToFlat / 2;
  const bottomOfUpper = padY + r * pitchY + hexFlatToFlat / 2;
  rowGaps.push({ row: r, gap: topOfLower - bottomOfUpper });
}

const colGaps = [];
for (let c = 0; c < cols - 1; c++) {
  const leftOfRight = padX + (c + 1) * pitchX - hexDrawRadius;
  const rightOfLeft = padX + c * pitchX + hexDrawRadius;
  colGaps.push({ col: c, gap: leftOfRight - rightOfLeft });
}

const sizeUnshrunkByHeight = Math.abs(size - Math.min(MAX_RAIL_SIZE, sizeFromW)) < 1e-9;
const pass =
  !overlap &&
  slots.length === 18 &&
  rowGaps.every((g) => g.gap > 0) &&
  colGaps.every((g) => g.gap > 0) &&
  sizeUnshrunkByHeight &&
  Math.abs(pitchY - size * S3) < 1e-9 &&
  Math.abs(pitchX - size * 2) < 1e-9;

console.log(JSON.stringify({
  size,
  pitchX,
  pitchY,
  pxW,
  contentW,
  visibleH,
  slots: slots.length,
  rows: RAIL_ROWS,
  cols,
  rowGaps,
  colGaps,
  overlap,
  sizeUnshrunkByHeight,
  pass,
}, null, 2));

if (!pass) process.exit(1);
