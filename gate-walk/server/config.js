// All the settings in one place. Restart the server after changing anything.

export default {
  // Web addresses on this computer.
  walkerPort: 8080, // the phone page. Only this one gets shared.
  mapPort: 8081, // the map of everyone. Stays on this computer.

  // Where the maps open, and where practice dots start.
  mapStart: { lat: 55.0, lon: -8.0, zoom: 18 },

  sendEveryMs: 1000, // how often a practice dot reports its position
  practiceAccuracyM: 1.5, // the accuracy a practice dot pretends to have
  staleAfterS: 15, // no update for this long: shown as "lost"
  mapRefreshMs: 500, // how often the map of everyone is updated
  reconnectMs: 2000, // wait before a page tries to reconnect

  maxNameLength: 24,
  maxPeople: 60,

  logFolder: 'logs',

  // Dot colours, handed out in turn.
  colours: ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080', '#f032e6', '#9a6324'],
};
