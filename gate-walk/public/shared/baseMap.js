// The street map under the dots. "L" is Leaflet, loaded by the page.

export function createBaseMap(element, start) {
  const map = L.map(element).setView([start.lat, start.lon], start.zoom);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  tiles.once('tileerror', () => console.warn('Map pictures are not loading. Is there internet?'));
  tiles.addTo(map);
  return map;
}
