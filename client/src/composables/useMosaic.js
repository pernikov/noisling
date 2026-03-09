import { computed } from 'vue';

/**
 * Given a ref/computed of cover strings, returns:
 *   mosaicCols  – number of columns (floor(sqrt(n)), always a full grid)
 *   mosaicCells – array of covers filling the N×N grid (no padding needed)
 *   mosaicStyle – inline style string for the CSS grid
 */
export function useMosaic(coversRef) {
  const mosaicCols = computed(() =>
    Math.min(10, Math.max(1, Math.floor(Math.sqrt(coversRef.value.length))))
  );

  const mosaicCells = computed(() =>
    coversRef.value.slice(0, mosaicCols.value * mosaicCols.value)
  );

  const mosaicStyle = computed(() =>
    `grid-template-columns: repeat(${mosaicCols.value}, 1fr); grid-template-rows: repeat(${mosaicCols.value}, 1fr);`
  );

  return { mosaicCols, mosaicCells, mosaicStyle };
}

/**
 * Stateless helper for use in v-for loops where covers is a plain array
 * (not reactive). Returns { cols, cells, style }.
 */
export function mosaicFromCovers(covers) {
  const cols = Math.min(10, Math.max(1, Math.floor(Math.sqrt(covers.length))));
  const cells = covers.slice(0, cols * cols);
  const style = `grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${cols}, 1fr);`;
  return { cols, cells, style };
}
