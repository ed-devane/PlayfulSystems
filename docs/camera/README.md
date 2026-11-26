# Camera sensor

A tool you can plug into your own project. It uses a camera to follow **printed paper tags** and **coloured card**, and gives you where they are as numbers. What you do with the numbers is up to you: graphics, sound, a game, MIDI, a motor, a web page, a microcontroller.

Detection happens in the browser. The picture is never sent anywhere.

## Three ways to plug it in

| You want | Use | Example |
|---|---|---|
| A webcam or phone camera inside your own web page | `sensor.js` | [`examples/webcam.html`](https://ed-devane.github.io/PlayfulSystems/camera/examples/webcam.html) |
| A phone as the camera, a web page on a computer doing the rest | `receive.js` and the [camera page](https://ed-devane.github.io/PlayfulSystems/camera/) | [`examples/receive.html`](https://ed-devane.github.io/PlayfulSystems/camera/examples/receive.html) |
| A phone as the camera, a Python program doing the rest | `listen.py` and the camera page | `listen.py` |

### In your own web page

Copy this whole folder into your project, then:

```js
import { createCameraSensor } from "./camera/sensor.js";

const sensor = createCameraSensor({
  onView(view) {
    for (const tag of view.tags) console.log(tag.id, tag.x, tag.y);
  },
});
startButton.addEventListener("click", () => sensor.start());
```

| Call | Does |
|---|---|
| `start()`, `stop()` | Camera on and off |
| `switchCamera()` | Back or front camera |
| `learnColour(x, y)` | Follows the colour at that point of the picture (0 to 1). Returns `{ learned, message }` |
| `removeColour(index)`, `colours()`, `setTolerance(degrees)` | Manage learned colours |
| `draw(context)` | Draws the picture and outlines on a canvas, if you want a preview |
| `state()` | `status`, `error`, `fps` |

To keep learned colours between visits, save what `onColours(colours)` gives you and pass it back as `colours`.

The page needs to be served from `https` or `localhost`, not opened as a file. On your computer, run `python -m http.server` in your project folder and open `http://localhost:8000`.

### Phone to a web page on a computer

Open the [camera page](https://ed-devane.github.io/PlayfulSystems/camera/) on the phone, start the camera, type a channel and tap **Connect**. For a QR code: `https://ed-devane.github.io/PlayfulSystems/phone/qr.html?p=camera&c=<channel>`. In your page (served the same way as above):

```js
import { receiveCamera } from "https://ed-devane.github.io/PlayfulSystems/camera/receive.js";

receiveCamera("mychannel", {
  onView(view) {
    for (const thing of view.appeared) console.log(thing.key, "appeared");
  },
});
```

This needs no publishing and no changes to the phone page.

### Phone to Python

```
python -m pip install paho-mqtt
python listen.py <channel>
```

It prints the data as it arrives. Change its `on_camera()` function.

## What you get

```json
{"tags":[{"id":7,"x":0.42,"y":0.51,"size":0.12,"rot":-4}],
 "colours":[{"id":1,"x":0.8,"y":0.3,"size":0.03,"count":2}]}
```

| Field | Meaning |
|---|---|
| `x`, `y` | 0 to 1: left to right, top to bottom of the picture |
| `id` | The tag's number, or the colour's number (1, 2, 3 in the order learned) |
| `size` | Tag width, or area of the biggest card of that colour, as a fraction of the picture |
| `rot` | Tags only: how far it is turned, in degrees |
| `count` | Colours only: how many cards of that colour are in view |

In JavaScript, `view` also has `things` (tags and colours together, each with `kind` and a `key` such as `"tag 7"`), and `appeared` and `left` (what has just arrived or gone). In your own page `onView` runs on every camera frame. From a phone it runs when something changes, and about every 2 seconds while something is in view.

## Getting good readings

- Print tags from [`tags.html`](https://ed-devane.github.io/PlayfulSystems/camera/tags.html). Matt paper, white edge left on, big enough in the picture (about a tenth of its width or more is a safe start). They are ArUco markers from the `DICT_5X5_1000` set, numbers 0 to 399.
- Colours: strongly coloured, matt card against a plain background. Anything else of a similar colour is followed too. If the light changes, learn it again. **Colour tolerance** widens or narrows what counts. Up to 8 colours.
- A camera on a stand gives steadier results than a hand-held one.
- The picture is not mirrored. With a front camera or a webcam facing you, your left is the picture's right.

## Sending over the internet

The phone routes go through the free public broker `broker.hivemq.com`, on the topic `playfulsystems/<channel>/camera`. There are no guarantees, and anyone who knows the channel can read and send, so make it hard to guess. Expect an occasional delay of a second or so, and connecting sometimes takes about 10 seconds. If your project can't accept that, use `sensor.js` in the page that does the work.

## Example idea: a grid

One thing you could build: do something when an object moves into another zone of the picture. This works as the `onView` of either `sensor.js` or `receive.js`.

```js
const COLUMNS = 3;
const ROWS = 2;
const EDGE = 0.08;        // ignore things sitting on a line, as a fraction of a zone
const zones = new Map();  // the zone each thing was last in

function onView(view) {
  for (const thing of view.left) zones.delete(thing.key);
  for (const thing of view.things) {
    const across = thing.x * COLUMNS;
    const down = thing.y * ROWS;
    if (onLine(across, COLUMNS) || onLine(down, ROWS)) continue;
    const zone = Math.min(ROWS - 1, Math.floor(down)) * COLUMNS + Math.min(COLUMNS - 1, Math.floor(across));
    if (zones.get(thing.key) === zone) continue;
    zones.set(thing.key, zone);
    enterZone(thing, zone);
  }
}

function onLine(position, count) {
  const line = Math.round(position);
  return line > 0 && line < count && Math.abs(position - line) < EDGE;
}

function enterZone(thing, zone) {
  console.log(thing.key, "entered zone", zone);  // your idea goes here
}
```

## Using it with the Smart Contact Mic board

The camera page has an optional board section that sends `play` and `tone` messages on the same channel. `mappings.js` decides what is sent, and has two empty functions, `everyFrame` and `drawGuides`, for other behaviour. `listen.py` can send to a board too, with `send("play 2")`.

## Files

| File | Job |
|---|---|
| `sensor.js` | The sensor: camera in, view out |
| `receive.js` | Receives a phone's view in a web page |
| `listen.py` | Receives a phone's view in Python |
| `scene.js` | Steadies the readings, spots arrivals and departures |
| `vision/` | Reading tags and colours (from Soniphorm Centipede) |
| `vendor/js-aruco2/` | Third-party tag detector, MIT licence (see its `LICENSE.txt`) |
| `index.html`, `app.js`, `link.js`, `mappings.js` | The phone camera page |
| `tags.html` | Printable tags |

Tested with a simulated camera picture in a desktop browser (26/11/2026).
