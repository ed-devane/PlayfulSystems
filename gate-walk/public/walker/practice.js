// Practice mode: a dot you drag (or tap the map to move) instead of GPS.
// It reports positions the same way GPS will: onPosition({ lat, lon, accuracy, t }).

export function startPractice(map, settings, onPosition) {
  const marker = L.marker(map.getCenter(), {
    draggable: true,
    icon: L.divIcon({ className: 'me', iconSize: [28, 28] }),
  }).addTo(map);

  const report = () => {
    const { lat, lng } = marker.getLatLng().wrap();
    onPosition({ lat, lon: lng, accuracy: settings.practiceAccuracyM, t: Date.now() });
  };

  map.on('click', (event) => {
    marker.setLatLng(event.latlng);
    report();
  });
  marker.on('drag', report);

  report();
  setInterval(report, settings.sendEveryMs);
}
