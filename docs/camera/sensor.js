// The camera as a sensor, for any web page: it follows paper tags and coloured
// card and reports what is in view. No page layout, network or board code here.
//
//   import { createCameraSensor } from "./sensor.js";
//   const sensor = createCameraSensor({ onView: (view) => console.log(view.tags, view.colours) });
//   sensor.start();                // from a button tap
//   sensor.learnColour(0.5, 0.5);  // follow the colour in the middle of the picture
//
// view = { tags, colours, things, appeared, left }  (see README.md)
import { createTagCamera } from "./vision/tagCamera.js";
import { sampleColour, MAX_COLOURS, MIN_SATURATION, DEFAULT_TOLERANCE } from "./vision/colourStrips.js";
import { createScene, readTagThings, readColourThings, makeView } from "./scene.js";

const MIN_VALUE = 0.15;  // darker than this cannot be learned as a colour

export function createCameraSensor({
  onView = () => {},       // called for every camera frame
  onColours = () => {},    // called when the learned colours change, to save them
  colours = [],            // colours saved earlier
  tolerance = DEFAULT_TOLERANCE,  // how far a hue may differ, in degrees
  detail = "fast",         // "fast", "normal" or "fine": finer reads smaller tags, more slowly
} = {}) {
  const scene = createScene();
  let palette = [...colours];
  let allowed = tolerance;
  let facing = "environment";  // the back camera; "user" is the front one
  let latest = { tags: [], strips: [] };
  let view = makeView([]);

  const camera = createTagCamera({
    onTags(tags, width, height, now, strips) {
      latest = { tags, strips: strips ?? [] };
      const reads = [...readTagThings(tags, width), ...readColourThings(strips, width, height)];
      const result = scene.update(reads, now);
      view = makeView(result.things, result.appeared, result.left);
      onView(view);
    },
  });
  camera.setWhiteBalanceLocked(true);  // steadier colours, where the camera allows it
  const apply = () => camera.setColours({ palette, tolerance: allowed });
  apply();

  // Forgets what is in view, and reports everything as having left.
  function reset() {
    const left = view.things;
    scene.clear();
    latest = { tags: [], strips: [] };
    view = makeView([], [], left);
    onView(view);
  }

  function coloursChanged() {
    apply();
    reset();  // the colour numbers may have changed
    onColours(palette);
  }

  function start() {
    camera.start({ facingMode: facing, detail });
  }

  return {
    start,
    stop() {
      camera.stop();
      reset();
    },
    switchCamera() {
      facing = facing === "environment" ? "user" : "environment";
      reset();
      if (camera.stats().status === "on") start();
    },
    reset,
    // { status: "off" | "starting" | "on" | "error", error, fps, width, height }
    state: () => camera.stats(),
    colours: () => palette,

    // Follow the colour at this point of the picture (x and y from 0 to 1).
    // Returns { learned, message }.
    learnColour(x, y) {
      const video = camera.video;
      if (!video.videoWidth) return { learned: false, message: "Start the camera first." };
      const frame = document.createElement("canvas");
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      const context = frame.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0);
      const pixels = context.getImageData(0, 0, frame.width, frame.height).data;
      const colour = sampleColour(frame.width, frame.height, pixels, x, y);

      if (!colour || colour.s < MIN_SATURATION || colour.v < MIN_VALUE) {
        return { learned: false, message: "Too grey or dark to follow. Tap something strongly coloured." };
      }
      const same = palette.findIndex((c) => Math.min(Math.abs(c.h - colour.h), 360 - Math.abs(c.h - colour.h)) < allowed / 2);
      if (same < 0 && palette.length >= MAX_COLOURS) {
        return { learned: false, message: "That is the most colours it can follow. Remove one first." };
      }
      if (same >= 0) palette[same] = colour;  // learned again, for example after the light changed
      else palette.push(colour);
      coloursChanged();
      return { learned: true, message: same >= 0 ? "Colour " + (same + 1) + " updated." : "Learned colour " + palette.length + "." };
    },
    removeColour(index) {
      palette.splice(index, 1);
      coloursChanged();
    },
    setTolerance(degrees) {
      allowed = degrees;
      apply();
    },

    // Draws the picture and the outlines of what was found onto a canvas.
    // between(context, width, height) draws under the outlines. Returns false
    // when there is no picture.
    draw(context, between) {
      const video = camera.video;
      const canvas = context.canvas;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (camera.stats().status !== "on" || !width) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        return false;
      }
      // The canvas takes the camera's shape, so nothing is cropped or stretched.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(video, 0, 0);
      if (between) {
        context.save();
        between(context, width, height);
        context.restore();
      }
      const unit = Math.max(width, height) / 400;
      for (const strip of latest.strips) {
        const colour = palette[strip.colour];
        if (colour) outline(context, strip.corners, "rgb(" + colour.rgb.join(",") + ")", String(strip.colour + 1), unit);
      }
      for (const tag of latest.tags) outline(context, tag.corners, "#fff", "tag " + tag.id, unit);
      return true;
    },
  };
}

function outline(context, corners, colour, label, unit) {
  const { width, height } = context.canvas;
  const points = corners.map(([x, y]) => [x * width, y * height]);
  context.beginPath();
  points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
  context.closePath();
  context.lineWidth = 3 * unit;
  context.strokeStyle = "#000";
  context.stroke();
  context.lineWidth = 1.5 * unit;
  context.strokeStyle = colour;
  context.stroke();
  context.font = "bold " + Math.round(12 * unit) + "px system-ui, sans-serif";
  context.lineWidth = 3 * unit;
  context.strokeStyle = "#000";
  context.strokeText(label, points[0][0], points[0][1] - 3 * unit);
  context.fillStyle = "#fff";
  context.fillText(label, points[0][0], points[0][1] - 3 * unit);
}
