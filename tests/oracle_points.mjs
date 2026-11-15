// Fixed lunar test points [lon E, lat] and fixture series for the Horizons oracle. On-the-hour epochs hit
// the packed hourly rows exactly; half-past epochs exercise the interpolation the app runs between rows.
export const POINTS = [[23.47, 0.67], [0, -89.9], [120, -85], [-170, -45], [-60, 30], [180, 0]];
export const SERIES = [{ tag: '', start: '1969-01-02 03:00' }, { tag: '_mid', start: '1969-01-02 03:30' }];
