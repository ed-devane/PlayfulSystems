// The walker page: join with a name, then send positions to the computer.

import { createBaseMap } from '/shared/baseMap.js';
import { connect } from '/shared/link.js';
import { getId, savedName, saveName } from './identity.js';
import { startPractice } from './practice.js';

const $ = (selector) => document.querySelector(selector);
const practising = new URLSearchParams(location.search).get('sim') === '1';

let settings;
let map;

const link = connect({
  onState(connected) {
    $('#connection').textContent = connected ? 'Connected' : 'No connection. Retrying…';
    $('#connection').classList.toggle('down', !connected);
  },
  onMessage(message) {
    if (message.type === 'welcome' && !settings) setUp(message.settings);
  },
});

function setUp(received) {
  settings = received;
  map = createBaseMap('map', settings.mapStart);
  if (!practising) {
    $('#gps-notice').hidden = false;
    return;
  }
  $('#name').maxLength = settings.maxNameLength;
  $('#name').value = savedName();
  $('#join').hidden = false;
}

$('#join').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#name').value.trim();
  if (!name) return;
  saveName(name);
  $('#join').hidden = true;
  $('#status').hidden = false;
  map.invalidateSize();

  const id = getId();
  startPractice(map, settings, (position) => {
    const sent = link.send({ type: 'position', id, name, source: 'sim', ...position });
    $('#status').textContent = sent
      ? `${name}, practice mode: drag your dot or tap the map.`
      : 'Your position is not being sent: no connection.';
  });
});
