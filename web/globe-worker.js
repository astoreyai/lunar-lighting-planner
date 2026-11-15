// Bakes the globe's cast-shadow texture off the main thread (about 0.3-0.4 s on a desktop), so the page stays
// responsive. Workers do not see the page's import map, so the version query is carried over by hand.
const { globeTexture } = await import(`./globe-math.js${new URL(import.meta.url).search}`);
self.onmessage = ({ data: { id, z, ppd, sunKm } }) => {
  const { px } = globeTexture({ z, ppd }, sunKm);
  self.postMessage({ id, px }, [px.buffer]);
};
