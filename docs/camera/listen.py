"""Receive what the phone camera page sees, on this computer.

    python listen.py <channel>

Needs the MQTT library once:  python -m pip install paho-mqtt
Change on_camera() to do something with the data, including sending messages to
the board.
"""

import json
import sys

try:
    import paho.mqtt.client as mqtt
except ImportError:
    sys.exit("Install the MQTT library first: python -m pip install paho-mqtt")

BROKER = "broker.hivemq.com"
PORT = 1883


def on_camera(data, send):
    """data is {"tags": [...], "colours": [...]}. See README.md.

    send("play 2") sends a message to the board on the same channel.
    """
    print(json.dumps(data), flush=True)


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python listen.py <channel>")
    root = "playfulsystems/" + sys.argv[1].strip().lower()
    topic = root + "/camera"

    def on_connect(client, *details):
        client.subscribe(topic)
        print("Listening to", topic, "(Ctrl+C stops)", flush=True)

    def on_message(client, userdata, message):
        # Anyone who knows the channel can send to it, so check what arrives.
        try:
            data = json.loads(message.payload)
        except ValueError:
            return
        if isinstance(data, dict) and "tags" in data and "colours" in data:
            on_camera(data, lambda text: client.publish(root + "/cmd", text))

    versions = getattr(mqtt, "CallbackAPIVersion", None)  # paho-mqtt 2 and later
    client = mqtt.Client(versions.VERSION2) if versions else mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(BROKER, PORT)
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
