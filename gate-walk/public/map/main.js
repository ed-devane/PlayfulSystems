// The map of everyone.

import { createBaseMap } from '/shared/baseMap.js';
import { connect } from '/shared/link.js';
import { showList } from './list.js';
import { createMarkers } from './markers.js';

const $ = (selector) => document.querySelector(selector);

let map;
let markers;
let movedToFirstPerson = false;

function showEveryone() {
  const positions = markers?.positions() ?? [];
  if (positions.length) map.fitBounds(L.latLngBounds(positions).pad(0.3), { maxZoom: 19 });
}

connect({
  onState(connected) {
    $('#connection').textContent = connected ? 'Connected' : 'No connection. Is the server running?';
    $('#connection').classList.toggle('down', !connected);
  },
  onMessage(message) {
    if (message.type === 'welcome' && !map) {
      map = createBaseMap('map', message.settings.mapStart);
      markers = createMarkers(map);
    }
    if (message.type !== 'people') return;
    const { people } = message;
    markers.show(people);
    showList($('#people'), people);
    $('#count').textContent = people.length
      ? `${people.filter((p) => !p.stale).length} of ${people.length} live`
      : 'Nobody yet';
    map.invalidateSize(); // the list changes height as people join
    if (people.length && !movedToFirstPerson) {
      movedToFirstPerson = true;
      showEveryone();
    }
  },
});

$('#show-all').addEventListener('click', showEveryone);
