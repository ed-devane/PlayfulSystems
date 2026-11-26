// Messages from a phone (or any web page) over the internet, using a free public
// MQTT broker as the relay:
//
//   web page --(secure WebSocket)--> broker --(MQTT)--> this board
//
// Each board has its own random channel code. The broker is public: anyone who
// knows the code can send to the board, so don't use this for anything private.
#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <mqtt_client.h>
#include "scm_wifi.h"

namespace phone {

// The web page uses the same broker and channel layout. Change both together.
constexpr char BROKER[] = "mqtt://broker.hivemq.com:1883";
constexpr char PAGE[] = "https://ed-devane.github.io/PlayfulSystems/phone/";
constexpr char TOPIC_ROOT[] = "playfulsystems/";

typedef void (*Handler)(const String& message);

inline esp_mqtt_client_handle_t client = nullptr;
inline Handler onMessage = nullptr;
inline String commandTopic;
inline String statusTopic;
inline volatile bool connected = false;
inline volatile bool soundsWanted = false;  // someone needs the sound list

// The list of sounds the web page shows as buttons.
inline void publishSounds(const String& list) {
  if (!client || !connected) return;
  String topic = statusTopic.substring(0, statusTopic.lastIndexOf('/')) + "/sounds";
  esp_mqtt_client_publish(client, topic.c_str(), list.c_str(), 0, 0, 0);
}

// Six random characters, made once and then kept on the board.
inline String channel() {
  Preferences prefs;
  prefs.begin(scm::SETTINGS, false);
  String code = prefs.getString("channel", "");
  if (code.length() == 0) {
    const char* letters = "abcdefghjkmnpqrstuvwxyz23456789";  // no look-alikes
    for (int i = 0; i < 6; i++) code += letters[esp_random() % strlen(letters)];
    prefs.putString("channel", code);
  }
  prefs.end();
  return code;
}

inline void printLink() {
  const char* state = connected ? "connected" : client ? "connecting" : "off (needs mode 5)";
  Serial.printf("Phone link: %s   channel %s\n", state, channel().c_str());
  Serial.printf("On your phone open: %s?c=%s\n", PAGE, channel().c_str());
  Serial.printf("QR code for it:     %sqr.html?c=%s\n", PAGE, channel().c_str());
}

inline void events(void*, esp_event_base_t, int32_t id, void* data) {
  esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)data;
  if (id == MQTT_EVENT_CONNECTED) {
    connected = true;
    soundsWanted = true;
    esp_mqtt_client_subscribe(client, commandTopic.c_str(), 0);
    esp_mqtt_client_publish(client, statusTopic.c_str(), "online", 0, 0, 1);
    Serial.println("Phone link connected");
  } else if (id == MQTT_EVENT_DISCONNECTED) {
    if (connected) Serial.println("Phone link lost, retrying");
    connected = false;
  } else if (id == MQTT_EVENT_DATA) {
    // Only short, complete messages are accepted.
    if (event->data_len <= 0 || event->data_len > 40 || event->data_len != event->total_data_len) {
      return;
    }
    char text[41];
    memcpy(text, event->data, event->data_len);
    text[event->data_len] = '\0';
    if (onMessage) onMessage(String(text));
  }
}

// Needs Wi-Fi with internet access. handler runs on a separate task.
inline void start(Handler handler) {
  if (client) return;
  onMessage = handler;
  String base = String(TOPIC_ROOT) + channel();
  commandTopic = base + "/cmd";
  statusTopic = base + "/status";

  esp_mqtt_client_config_t config = {};
  config.broker.address.uri = BROKER;
  config.session.last_will.topic = statusTopic.c_str();  // sent if the board vanishes
  config.session.last_will.msg = "offline";
  config.session.last_will.retain = 1;
  config.session.keepalive = 20;
  client = esp_mqtt_client_init(&config);
  if (client == nullptr) {
    Serial.println("Phone link FAILED to start");
    return;
  }
  esp_mqtt_client_register_event(client, (esp_mqtt_event_id_t)ESP_EVENT_ANY_ID, events, nullptr);
  esp_mqtt_client_start(client);
}

inline void stop() {
  if (!client) return;
  if (connected) {
    esp_mqtt_client_publish(client, statusTopic.c_str(), "offline", 0, 1, 1);
    delay(200);
  }
  esp_mqtt_client_stop(client);
  esp_mqtt_client_destroy(client);
  client = nullptr;
  connected = false;
}

}  // namespace phone
