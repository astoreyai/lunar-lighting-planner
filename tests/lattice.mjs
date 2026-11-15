// Fixed south-polar comparison points [lat, lon] (85.5-89.5 S, every 45 deg), shared by the real-data tests.
export const LATTICE = [];
for (const lat of [-85.5, -86.5, -87.5, -88.5, -89.5]) for (let lon = 0; lon < 360; lon += 45) LATTICE.push([lat, lon]);
