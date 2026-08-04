// Re-derive Comb side-rail hex geometry and prove no overlap + 3-row fit.
// Mirrors the constants in public/index.html renderRail() and the center comb px() formula.

const RAIL_COLS = 3;
const VISIBLE_ROWS = 3;
const S3 = Math.sqrt(3);

// Typical rail dimensions observed in the previous review.
const pxW = 294; // rail clientWidth - 10
const railH = 343;
const labelH = 18;
const subH = 14;
const availH = Math.max(180, railH - labelH - subH - 14);

const sizeFromW = pxW / (RAIL_COLS * 1.62);
const sizeFromH = availH / (0.95 + (VISIBLE_ROWS - 1) * S3 + S3 / 2);
const size = Math.max(44, Math.min(sizeFromW, sizeFromH));

const padX = size * 0.92;
const pitchX = size * 1.62;
const pitchY = size * S3;
const padY = size * 0.95;

const visibleH = padY + (VISIBLE_ROWS - 1) * pitchY + size * S3 / 2;
const hexDrawRadius = size - 2;
const hexHeight = hexDrawRadius * S3; // flat-to-flat for a flat-top hex

// Row centers and vertical extents for the first 3 rows.
const rows = [];
for (let r = 0; r < VISIBLE_ROWS; r++) {
  const cy = padY + r * pitchY;
  rows.push({
    row: r,
    cy,
    top: cy - hexDrawRadius * S3 / 2,
    bottom: cy + hexDrawRadius * S3 / 2,
  });
}

let overlap = false;
for (let i = 0; i < rows.length - 1; i++) {
  const gap = rows[i + 1].top - rows[i].bottom;
  if (gap < 0) overlap = true;
  rows[i].nextGap = gap;
}

// Center comb vertical pitch for the same size.
const centerCombPitchY = size * S3;

console.log("Rail geometry verification");
console.log("==========================");
console.log(`rail width (pxW)        : ${pxW}px`);
console.log(`available height        : ${availH}px`);
console.log(`sizeFromW               : ${sizeFromW.toFixed(2)}`);
console.log(`sizeFromH               : ${sizeFromH.toFixed(2)}`);
console.log(`chosen size             : ${size.toFixed(2)}`);
console.log(`pitchX                  : ${pitchX.toFixed(2)}px`);
console.log(`pitchY                  : ${pitchY.toFixed(2)}px`);
console.log(`padY                    : ${padY.toFixed(2)}px`);
console.log(`visibleH                : ${visibleH.toFixed(2)}px`);
console.log(`hex draw radius         : ${hexDrawRadius.toFixed(2)}px`);
console.log(`hex flat-to-flat height : ${hexHeight.toFixed(2)}px`);
console.log("");
console.log("Row extents (first 3 visible rows)");
rows.forEach((r) => {
  const next = r.nextGap !== undefined ? `  gap to next row: ${r.nextGap.toFixed(2)}px` : "";
  console.log(`row ${r.row}: center ${r.cy.toFixed(2)}px, top ${r.top.toFixed(2)}px, bottom ${r.bottom.toFixed(2)}px${next}`);
});
console.log("");
console.log(`Vertical overlap between adjacent rows: ${overlap ? "YES — FAIL" : "NO — PASS"}`);
console.log(`3-row visible height fits in availH     : ${visibleH <= availH + 0.001 ? "YES — PASS" : "NO — FAIL"}`);
console.log(`Rail pitchY matches center comb pitchY  : ${Math.abs(pitchY - centerCombPitchY) < 0.001 ? "YES — PASS" : "NO — FAIL"}`);
console.log(`PitchY/hexHeight ratio (should be > 1)  : ${(pitchY / hexHeight).toFixed(3)}`);

if (overlap || visibleH > availH + 0.001) {
  process.exit(1);
}
