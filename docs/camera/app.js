// The camera page: the sensor (sensor.js), sending what it sees over a channel,
// with optional controls for a Smart Contact Mic board.
import { createCameraSensor } from "./sensor.js";
import { describe, changed } from "./scene.js";
import { createLink } from "./link.js";
import { SETTINGS, onAppear, toneFor, everyFrame, drawGuides } from "./mappings.js";

const DATA_EVERY_MS = 150;    // fastest the camera data is sent
const DATA_REPEAT_MS = 2000;  // repeated while something is in view, for late listeners

const element = (id) => document.getElementById(id);
const isOn = (id) => element(id).checked;
const canvas = element("view");
const draw2d = canvas.getContext("2d");

let things = [];
let sentData = null;
let sentDataAt = 0;
let soundCount = 3;
let messages = 0;
let sounding = false;
let lastTone = 0;
const references = new Map();  // key -> position that movement is measured from
let showingPicture = false;
let wakeLock = null;

// ---- link --------------------------------------------------------------------
const link = createLink({
  onStatus: (text) => (element("status").textContent = text),
  onBoard: (text) => (element("board").textContent = text),
  onSounds: (names) => {
    soundCount = names.length || 3;
    element("sounds").textContent = "Board sounds: " + names.map((n, i) => i + 1 + " " + n).join(", ");
  },
  onConnected: () => (sentData = null),  // send the current view afresh
});

function command(message) {
  if (!link.command(message)) return;
  messages += 1;
  element("sent").textContent = message + " (message " + messages + ")";
}

function quiet() {
  if (sounding) command("tone 0 0");
  sounding = false;
}

// ---- the sensor --------------------------------------------------------------
let saved = [];
try { saved = JSON.parse(localStorage.getItem("cameraColours")) || []; } catch (e) {}

const sensor = createCameraSensor({
  colours: saved,
  onColours(colours) {
    try { localStorage.setItem("cameraColours", JSON.stringify(colours)); } catch (e) {}
    showColours();
  },
  onView(view) {
    const now = performance.now();
    things = view.things;
    for (const thing of view.left) references.delete(thing.key);
    for (const thing of view.appeared) {
      references.set(thing.key, { x: thing.x, y: thing.y });
      if (!isOn(thing.kind === "tag" ? "tagsPlay" : "coloursPlay")) continue;
      const message = onAppear(thing, { soundCount });
      if (message) command(message);
    }
    if (!things.length) quiet();
    playMovement(now);
    everyFrame(things, { send: command, soundCount });
    sendData(now);
  },
});

// A tone follows whichever thing has moved furthest.
function playMovement(now) {
  if (!isOn("moveTone") || now - lastTone < SETTINGS.TONE_EVERY_MS) return;
  let mover = null;
  let furthest = SETTINGS.MOVE;
  for (const thing of things) {
    const from = references.get(thing.key);
    if (!from) continue;
    const distance = Math.hypot(thing.x - from.x, thing.y - from.y);
    if (distance >= furthest) {
      mover = thing;
      furthest = distance;
    }
  }
  if (!mover) return;
  references.set(mover.key, { x: mover.x, y: mover.y });
  lastTone = now;
  sounding = true;
  command(toneFor(mover));
}

function sendData(now) {
  const data = describe(things);
  element("data").textContent = JSON.stringify(data);
  const news = changed(sentData, data, SETTINGS.MOVE);
  const repeat = things.length > 0 && now - sentDataAt >= DATA_REPEAT_MS;
  // An empty view goes at once: no more frames may follow it.
  if (!repeat && !(news && (things.length === 0 || now - sentDataAt >= DATA_EVERY_MS))) return;
  if (!link.camera(data)) return;
  sentData = data;
  sentDataAt = now;
}

// ---- camera controls ---------------------------------------------------------
function keepAwake() {
  if (!navigator.wakeLock || document.hidden) return;
  navigator.wakeLock.request("screen").then((lock) => (wakeLock = lock)).catch(() => {});
}

element("camera").addEventListener("click", () => {
  const { status } = sensor.state();
  if (status === "off" || status === "error") {
    sensor.start();
    keepAwake();
  } else {
    sensor.stop();
    wakeLock?.release().catch(() => {});
  }
});
element("flip").addEventListener("click", () => sensor.switchCamera());

setInterval(() => {
  const { status, error, fps } = sensor.state();
  element("camera").textContent = status === "on" || status === "starting" ? "Stop camera" : "Start camera";
  element("seeing").textContent =
    status === "error" ? "Camera: " + error
    : status === "starting" ? "Starting camera..."
    : status === "on" ? "Seeing " + count("tag") + " and " + count("colour") + " (" + Math.round(fps) + " frames a second)"
    : "Camera off";
}, 500);

function count(kind) {
  const n = things.filter((t) => t.kind === kind).length;
  return n + " " + kind + (n === 1 ? "" : "s");
}

setInterval(() => {
  if (sounding && performance.now() - lastTone > SETTINGS.STILL_MS) quiet();
}, 100);

// ---- learned colours ---------------------------------------------------------
function showColours() {
  element("colours").replaceChildren(...sensor.colours().map((colour, i) => {
    const button = document.createElement("button");
    button.className = "chip";
    button.style.borderColor = "rgb(" + colour.rgb.join(",") + ")";
    button.textContent = i + 1 + "  remove";
    button.addEventListener("click", () => sensor.removeColour(i));
    return button;
  }));
}

// Tapping the picture learns the colour under the finger.
canvas.addEventListener("click", (event) => {
  if (!showingPicture) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  element("colourNote").textContent = sensor.learnColour(x, y).message;
});

element("tolerance").addEventListener("input", () => {
  element("toleranceValue").textContent = element("tolerance").value;
  sensor.setTolerance(Number(element("tolerance").value));
});

function paint() {
  requestAnimationFrame(paint);
  showingPicture = sensor.draw(draw2d, drawGuides);
}

// ---- connecting and start-up -------------------------------------------------
element("connect").addEventListener("click", () => {
  if (link.isOpen()) {
    sounding = false;
    link.disconnect();
  } else {
    const channel = element("channel").value.trim().toLowerCase();
    if (!/^[a-z0-9]{4,20}$/.test(channel)) {
      element("status").textContent = "Type a channel code: 4 to 20 letters and numbers.";
      return;
    }
    try { localStorage.setItem("channel", channel); } catch (e) {}
    link.connect(channel);
  }
  element("connect").textContent = link.isOpen() ? "Disconnect" : "Connect";
  element("channel").disabled = link.isOpen();
});

element("stop").addEventListener("click", () => {
  sounding = false;
  command("stop");
});
element("moveTone").addEventListener("change", () => {
  for (const thing of things) references.set(thing.key, { x: thing.x, y: thing.y });
  quiet();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) sensor.reset();
  else if (sensor.state().status === "on") keepAwake();
});

const fromAddress = new URLSearchParams(location.search).get("c");
let remembered = null;
try { remembered = localStorage.getItem("channel"); } catch (e) {}
element("channel").value = fromAddress || remembered || "";
element("toleranceValue").textContent = element("tolerance").value;
showColours();
if (!window.isSecureContext) element("seeing").textContent = "The camera needs an https address.";
paint();
