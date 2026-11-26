// The camera page: camera -> detectors -> scene -> messages. The picture is read
// on the phone; only numbers are sent.
import { createTagCamera } from "./vision/tagCamera.js";
import { sampleColour, MAX_COLOURS, MIN_SATURATION } from "./vision/colourStrips.js";
import { createScene, readTagThings, readColourThings, describe, changed } from "./scene.js";
import { createLink } from "./link.js";
import { SETTINGS, onAppear, toneFor } from "./mappings.js";

const DETAIL = "fast";      // "fast", "normal" or "fine": finer reads smaller tags, more slowly
const DATA_EVERY_MS = 150;  // fastest the camera data is sent
const MIN_VALUE = 0.15;     // darker than this cannot be learned as a colour

const element = (id) => document.getElementById(id);
const isOn = (id) => element(id).checked;
const canvas = element("view");
const draw2d = canvas.getContext("2d");

const scene = createScene();
let colours = [];           // learned colours: { rgb, h, s, v }
let facing = "environment";
let latest = { tags: [], strips: [] };
let things = [];
let sentData = null;
let sentDataAt = 0;
let soundCount = 3;
let messages = 0;
let sounding = false;
let lastTone = 0;
const references = new Map();  // key -> position that movement is measured from
let picture = null;            // where the video is drawn on the canvas
let wakeLock = null;

// ---- link --------------------------------------------------------------------
const link = createLink({
  onStatus: (text) => (element("status").textContent = text),
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

// ---- what happens with each camera frame -------------------------------------
function onFrame(tags, width, height, now, strips) {
  latest = { tags, strips: strips ?? [] };
  const reads = [...readTagThings(tags, width), ...readColourThings(strips, width, height)];
  const result = scene.update(reads, now);
  things = result.things;

  for (const thing of result.left) references.delete(thing.key);
  for (const thing of result.appeared) {
    references.set(thing.key, { x: thing.x, y: thing.y });
    if (!isOn(thing.kind === "tag" ? "tagsPlay" : "coloursPlay")) continue;
    const message = onAppear(thing, { soundCount });
    if (message) command(message);
  }
  playMovement(now);
  sendData(now);
}

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
  if (!changed(sentData, data, SETTINGS.MOVE) || now - sentDataAt < DATA_EVERY_MS) return;
  if (!link.camera(data)) return;
  sentData = data;
  sentDataAt = now;
}

function forgetScene() {
  scene.clear();
  references.clear();
  latest = { tags: [], strips: [] };
  things = [];
  quiet();
  const empty = describe([]);
  element("data").textContent = JSON.stringify(empty);
  if (link.camera(empty)) sentData = empty;
}

// ---- camera ------------------------------------------------------------------
const camera = createTagCamera({ onTags: onFrame });
camera.setWhiteBalanceLocked(true);  // steadier colours, where the camera allows it

function startCamera() {
  camera.start({ facingMode: facing, detail: DETAIL });
}

function keepAwake() {
  if (!navigator.wakeLock || document.hidden) return;
  navigator.wakeLock.request("screen").then((lock) => (wakeLock = lock)).catch(() => {});
}

element("camera").addEventListener("click", () => {
  if (camera.stats().status === "off" || camera.stats().status === "error") {
    startCamera();
    keepAwake();
  } else {
    camera.stop();
    forgetScene();
    wakeLock?.release().catch(() => {});
  }
});

element("flip").addEventListener("click", () => {
  facing = facing === "environment" ? "user" : "environment";
  forgetScene();
  if (camera.stats().status === "on") startCamera();
});

setInterval(() => {
  const stats = camera.stats();
  element("camera").textContent = stats.status === "on" || stats.status === "starting" ? "Stop camera" : "Start camera";
  element("seeing").textContent =
    stats.status === "error" ? "Camera: " + stats.error
    : stats.status === "starting" ? "Starting camera..."
    : stats.status === "on" ? "Seeing " + count("tag") + " and " + count("colour") + " (" + Math.round(stats.fps) + " frames a second)"
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
function applyColours() {
  camera.setColours({ palette: colours, tolerance: Number(element("tolerance").value) });
  element("toleranceValue").textContent = element("tolerance").value;
  element("colours").replaceChildren(...colours.map((colour, i) => {
    const button = document.createElement("button");
    button.className = "chip";
    button.style.borderColor = "rgb(" + colour.rgb.join(",") + ")";
    button.textContent = i + 1 + "  remove";
    button.addEventListener("click", () => {
      colours.splice(i, 1);
      saveColours();
    });
    return button;
  }));
}

function saveColours() {
  try { localStorage.setItem("cameraColours", JSON.stringify(colours)); } catch (e) {}
  forgetScene();  // the colour numbers may have changed
  applyColours();
}

// Tapping the picture learns the colour under the finger.
canvas.addEventListener("click", (event) => {
  const video = camera.video;
  if (!picture || !video.videoWidth) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * (canvas.width / rect.width) - picture.x) / picture.width;
  const y = ((event.clientY - rect.top) * (canvas.height / rect.height) - picture.y) / picture.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;

  const frame = document.createElement("canvas");
  frame.width = video.videoWidth;
  frame.height = video.videoHeight;
  const context = frame.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0);
  const pixels = context.getImageData(0, 0, frame.width, frame.height).data;
  const colour = sampleColour(frame.width, frame.height, pixels, x, y);

  const say = (text) => (element("colourNote").textContent = text);
  if (!colour || colour.s < MIN_SATURATION || colour.v < MIN_VALUE) {
    say("Too grey or dark to follow. Tap something strongly coloured.");
    return;
  }
  const tolerance = Number(element("tolerance").value);
  const same = colours.findIndex((c) => Math.min(Math.abs(c.h - colour.h), 360 - Math.abs(c.h - colour.h)) < tolerance / 2);
  if (same >= 0) {
    colours[same] = colour;  // learn it again, for example after the light changed
    say("Colour " + (same + 1) + " updated.");
  } else if (colours.length >= MAX_COLOURS) {
    say("That is the most colours it can follow. Remove one first.");
    return;
  } else {
    colours.push(colour);
    say("Learned colour " + colours.length + ".");
  }
  saveColours();
});

element("tolerance").addEventListener("input", applyColours);

// ---- drawing -----------------------------------------------------------------
function paint() {
  requestAnimationFrame(paint);
  const video = camera.video;
  const frameWidth = video.videoWidth;
  const frameHeight = video.videoHeight;
  if (camera.stats().status !== "on" || !frameWidth) {
    draw2d.clearRect(0, 0, canvas.width, canvas.height);
    picture = null;
    return;
  }
  // The canvas takes the camera's shape, so nothing is cropped or stretched.
  if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
    canvas.width = frameWidth;
    canvas.height = frameHeight;
  }
  picture = { x: 0, y: 0, width: frameWidth, height: frameHeight };
  draw2d.drawImage(video, 0, 0);
  const unit = Math.max(frameWidth, frameHeight) / 400;
  for (const strip of latest.strips) {
    const colour = colours[strip.colour];
    if (colour) outline(strip.corners, "rgb(" + colour.rgb.join(",") + ")", String(strip.colour + 1), unit);
  }
  for (const tag of latest.tags) outline(tag.corners, "#fff", "tag " + tag.id, unit);
}

function outline(corners, colour, label, unit) {
  const points = corners.map(([x, y]) => [x * canvas.width, y * canvas.height]);
  draw2d.beginPath();
  points.forEach(([x, y], i) => (i ? draw2d.lineTo(x, y) : draw2d.moveTo(x, y)));
  draw2d.closePath();
  draw2d.lineWidth = 3 * unit;
  draw2d.strokeStyle = "#000";
  draw2d.stroke();
  draw2d.lineWidth = 1.5 * unit;
  draw2d.strokeStyle = colour;
  draw2d.stroke();
  draw2d.font = "bold " + Math.round(12 * unit) + "px system-ui, sans-serif";
  draw2d.lineWidth = 3 * unit;
  draw2d.strokeStyle = "#000";
  draw2d.strokeText(label, points[0][0], points[0][1] - 3 * unit);
  draw2d.fillStyle = "#fff";
  draw2d.fillText(label, points[0][0], points[0][1] - 3 * unit);
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
  if (document.hidden) forgetScene();
  else if (camera.stats().status === "on") keepAwake();
});

const fromAddress = new URLSearchParams(location.search).get("c");
let remembered = null;
try {
  remembered = localStorage.getItem("channel");
  colours = JSON.parse(localStorage.getItem("cameraColours")) || [];
} catch (e) {}
element("channel").value = fromAddress || remembered || "";
applyColours();
if (!window.isSecureContext) element("seeing").textContent = "The camera needs an https address.";
paint();
