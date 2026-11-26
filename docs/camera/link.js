// The link out of the phone: a public MQTT broker, the same one the board and
// the phone remote use. Needs mqtt.js loaded by the page.
//
//   playfulsystems/<channel>/cmd     messages to the board ("play 1")
//   playfulsystems/<channel>/camera  what the camera sees, as JSON, for a computer
//   playfulsystems/<channel>/status  from the board: "online" every few seconds
//   playfulsystems/<channel>/sounds  from the board: the sounds it can play

const BROKER = "wss://broker.hivemq.com:8884/mqtt";
const TOPIC_ROOT = "playfulsystems/";
const SILENT_MS = 8000;  // the board reports every 3 s; longer means trouble

export function createLink({ onStatus, onSounds, onConnected }) {
  let client = null;
  let topic = "";
  let boardOnline = false;
  let lastHeard = 0;

  setInterval(() => {
    if (client && boardOnline && Date.now() - lastHeard > SILENT_MS) {
      boardOnline = false;
      onStatus("Connected, but the board has stopped responding. Waiting for it...");
    }
  }, 1000);

  function connect(channel) {
    if (client) client.end(true);
    if (typeof mqtt === "undefined") {
      onStatus("The connection library did not load. Check the internet and reload.");
      return false;
    }
    topic = TOPIC_ROOT + channel;
    boardOnline = false;
    onStatus("Connecting...");
    const link = mqtt.connect(BROKER, { reconnectPeriod: 2000 });
    client = link;
    // Anything arriving from a connection we have since closed is ignored.
    const current = () => link === client;
    link.on("connect", () => {
      if (!current()) return;
      onStatus("Connected. No board heard yet (fine if you are only sending to a computer).");
      link.subscribe([topic + "/status", topic + "/sounds"]);
      onConnected();
    });
    link.on("message", (from, payload) => {
      if (!current()) return;
      if (from === topic + "/sounds") {
        onSounds(payload.toString().split("\n").filter(Boolean).slice(1, 9));
        return;
      }
      if (payload.toString() !== "online") {
        boardOnline = false;
        onStatus("Connected. Board is offline.");
        return;
      }
      lastHeard = Date.now();
      if (!boardOnline) {
        boardOnline = true;
        onStatus("Connected. Board is online.");
        link.publish(topic + "/cmd", "list");  // ask what it can play
      }
    });
    link.on("reconnect", () => {
      if (!current()) return;
      boardOnline = false;
      onStatus("Reconnecting...");
    });
    link.on("error", (error) => {
      if (current()) onStatus("Connection problem: " + error.message);
    });
    return true;
  }

  function publish(name, text) {
    if (!client?.connected) return false;
    client.publish(topic + "/" + name, text, { qos: 0 });
    return true;
  }

  return {
    connect,
    isOpen: () => client !== null,
    command: (text) => publish("cmd", text),
    camera: (data) => publish("camera", JSON.stringify(data)),
    disconnect() {
      const link = client;
      if (!link) return;
      if (link.connected) link.publish(topic + "/cmd", "stop");
      client = null;
      link.end(!link.connected);
      onStatus("Disconnected.");
    },
  };
}
