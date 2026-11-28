// A dot, a name and an accuracy circle for each person.

const LOST_COLOUR = '#888';

export function createMarkers(map) {
  const markers = new Map(); // id -> { dot, circle, label }

  function add(person) {
    const at = [person.lat, person.lon];
    // The name is set as plain text, so nothing typed on a phone can run on this page.
    const label = document.createElement('span');
    const dot = L.circleMarker(at, { radius: 8, color: '#fff', weight: 2, fillOpacity: 1 })
      .bindTooltip(label, { permanent: true, direction: 'right', offset: [10, 0] });
    const circle = L.circle(at, { radius: person.accuracy, weight: 1, fillOpacity: 0.12 });
    circle.addTo(map);
    dot.addTo(map);
    const marker = { dot, circle, label };
    markers.set(person.id, marker);
    return marker;
  }

  return {
    show(people) {
      const present = new Set(people.map((person) => person.id));
      for (const [id, { dot, circle }] of markers) {
        if (present.has(id)) continue; // the computer was restarted: remove old dots
        dot.remove();
        circle.remove();
        markers.delete(id);
      }
      for (const person of people) {
        const marker = markers.get(person.id) ?? add(person);
        const colour = person.stale ? LOST_COLOUR : person.colour;
        marker.label.textContent = person.name;
        marker.dot.setLatLng([person.lat, person.lon]).setStyle({ fillColor: colour });
        marker.circle.setLatLng([person.lat, person.lon]).setRadius(person.accuracy).setStyle({ color: colour });
      }
    },
    positions: () => [...markers.values()].map(({ dot }) => dot.getLatLng()),
  };
}
