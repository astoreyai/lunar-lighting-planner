// A share of the landing-area layer's visibility passes, off the main thread (web/litmap.js splits the map's cells
// between workers). Workers do not see the page's import map, so the version query is carried over by hand.
// The handler is set before the import resolves: a message that arrives while a module worker is still awaiting is lost.
const shadow = import(`./shadow.js${new URL(import.meta.url).search}`);
let job; // { grid, far, cells, i0, dhM, needEarth }: the cells to compute and where they start in the map
self.onmessage = async ({ data: d }) => {
  const { shadowContext, visCells } = await shadow;
  if (d.cells) { job = { ...d, grid: d.grid || job.grid, far: d.far === undefined ? job?.far : d.far }; return; } // new cells; each terrain comes only when it changed
  const { grid, far, cells, i0, dhM, needEarth } = job;
  const sun = visCells(shadowContext(grid, d.sun, { dhM, far }), cells);
  const earth = needEarth ? visCells(shadowContext(grid, d.earth, { radiusKm: 0, near: true, dhM, far }), cells, undefined, sun) : null; // only where the Sun is or might be up
  self.postMessage({ i0, sun, earth }, earth ? [sun.buffer, earth.buffer] : [sun.buffer]);
};
