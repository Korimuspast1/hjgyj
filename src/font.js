/**
 * Tiny 3x5 pixel font for HUD, tooltips and labels.
 * Text is drawn with filled rectangles, one per lit pixel, so it stays crisp
 * when the canvas is scaled. Lowercase input is shown in capitals.
 */

/** Glyph rows: '#' = lit pixel, anything else = off. Each glyph is 3 wide, 5 tall. */
const GLYPHS = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["#.#", "###", "###", "#.#", "#.#"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: ["###", "#.#", "#.#", "###", "..#"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["##.", "..#", ".#.", "#..", "###"],
  3: ["##.", "..#", ".#.", "..#", "##."],
  4: ["#.#", "#.#", "###", "..#", "..#"],
  5: ["###", "#..", "##.", "..#", "##."],
  6: [".##", "#..", "###", "#.#", "###"],
  7: ["###", "..#", ".#.", ".#.", ".#."],
  8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "##."],
  ".": ["...", "...", "...", "...", ".#."],
  ",": ["...", "...", "...", ".#.", "#.."],
  ":": ["...", ".#.", "...", ".#.", "..."],
  "-": ["...", "...", "###", "...", "..."],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "\\": ["#..", "#..", ".#.", "..#", "..#"],
  "(": [".#", "#.", "#.", "#.", ".#"],
  ")": ["#.", ".#", ".#", ".#", "#."],
  "!": [".#", ".#", ".#", "..", ".#"],
  "?": ["##.", "..#", ".#.", "...", ".#."],
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  "[": ["##", "#.", "#.", "#.", "##"],
  "]": ["##", ".#", ".#", ".#", "##"],
  "#": ["#.#", "###", "#.#", "###", "#.#"],
  "=": ["...", "###", "...", "###", "..."],
  ">": ["#..", ".#.", "..#", ".#.", "#.."],
  "<": ["..#", ".#.", "#..", ".#.", "..#"],
  "*": ["...", "#.#", ".#.", "#.#", "..."],
  "'": [".#", ".#", "...", "...", "..."],
  "_": ["...", "...", "...", "...", "###"],
  " ": ["...", "...", "...", "...", "..."],
};

/** Advance per character: 3 px glyph + 1 px gap. */
export const GLYPH_ADVANCE = 4;
export const GLYPH_HEIGHT = 5;

/** Pixel width of a string. */
export function textWidth(text) {
  return Math.max(0, String(text).length * GLYPH_ADVANCE - 1);
}

/**
 * Draws text with 1 px drop shadow using filled rectangles.
 * @param {CanvasRenderingContext2D} ctx context with identity transform
 * @param {string} text
 * @param {number} x left edge in canvas pixels (integer)
 * @param {number} y top edge in canvas pixels (integer)
 * @param {string} color CSS colour
 * @param {string} [shadow] CSS colour for the drop shadow, or null for none
 */
export function drawText(ctx, text, x, y, color, shadow = '#1b1410') {
  const str = String(text).toUpperCase();
  if (shadow) {
    ctx.fillStyle = shadow;
    paintGlyphs(ctx, str, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  paintGlyphs(ctx, str, x, y);
}

function paintGlyphs(ctx, str, x0, y0) {
  for (let c = 0; c < str.length; c++) {
    const rows = GLYPHS[str[c]] || GLYPHS['?'];
    const gx = x0 + c * GLYPH_ADVANCE;
    for (let r = 0; r < GLYPH_HEIGHT; r++) {
      const row = rows[r];
      for (let k = 0; k < 3; k++) {
        if (row[k] === '#') ctx.fillRect(gx + k, y0 + r, 1, 1);
      }
    }
  }
}
