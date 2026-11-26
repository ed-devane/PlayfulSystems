// Receive what a phone's camera page sees, in any web page. The phone opens the
// published camera page and connects to a channel; your page does this:
//
//   import { receiveCamera } from "https://ed-devane.github.io/PlayfulSystems/camera/receive.js";
//   receiveCamera("mychannel", { onView: (view) => console.log(view.tags, view.colours) });
//
// view = { tags, colours, things, appeared, left }  (see README.md)
import mqtt from "https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.esm.js";
import { thingsFrom, makeView } from "./scene.js";

const BROKER = "wss://broker.hivemq.com:8884/mqtt";
const TOPIC_ROOT = "playfulsystems/";
const STALE_MS = 5000;  // the phone repeats every 2 s while something is in view

export function receiveCamera(channel, { onView, onStatus = () => {} }) {
  const topic = TOPIC_ROOT + channel.trim().toLowerCase() + "/camera";
  const client = mqtt.connect(BROKER, { reconnectPeriod: 2000 });
  let things = [];
  let lastHeard = 0;

  function show(next) {
    const before = new Set(things.map((thing) => thing.key));
    const after = new Set(next.map((thing) => thing.key));
    const appeared = next.filter((thing) => !before.has(thing.key));
    const left = things.filter((thing) => !after.has(thing.key));
    things = next;
    onView(makeView(next, appeared, left));
  }

  onStatus("Connecting...");
  client.on("connect", () => {
    client.subscribe(topic);
    onStatus("Connected. Waiting for the phone.");
  });
  client.on("reconnect", () => onStatus("Reconnecting..."));
  client.on("error", (error) => onStatus("Connection problem: " + error.message));
  client.on("message", (from, payload) => {
    // Anyone who knows the channel can send to it, so check what arrives.
    const next = thingsFrom(payload.toString());
    if (!next) return;
    lastHeard = Date.now();
    onStatus("Receiving.");
    show(next);
  });

  // If the phone vanishes, don't leave its last view standing.
  const timer = setInterval(() => {
    if (things.length && Date.now() - lastHeard > STALE_MS) {
      onStatus("Nothing heard from the phone.");
      show([]);
    }
  }, 1000);

  return {
    stop() {
      clearInterval(timer);
      client.end(true);
    },
  };
}
