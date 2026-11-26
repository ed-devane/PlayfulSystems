// Mode 5: play sounds and tones from messages sent over Wi-Fi.
//
// With a saved network (serial command "wifi") the board joins it. Otherwise,
// or if joining fails, it creates its own network (no internet, no phone link).
//
// The same text messages work from every source:
//   play 1            play sound 1 (just "1" also works)
//   tone 440 0.5      a tone at 440 Hz, level 0 to 1. Repeat it to keep it going:
//                     it fades out after 1 second without a new message
//   stop              silence
//   reload            read the SD card again
//   list              send the sound names to the phone page
//
//   Web:   http://<address>/  (buttons),  /play?n=1,  /stop
//   UDP:   port 9000
//   Phone: see phone_link.h
#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "scm_wifi.h"
#include "sound_bank.h"
#include "phone_link.h"

namespace net {

constexpr uint16_t UDP_PORT = 9000;
constexpr char OWN_NETWORK_PASSWORD[] = "playful-systems";
constexpr uint32_t TONE_TIMEOUT_MS = 1000;

inline WebServer server(80);
inline WiFiUDP udp;
inline bool running = false;
inline volatile bool reloadWanted = false;

// Read by the audio task.
inline volatile float toneHz = 440.0f;
inline volatile float toneLevel = 0.0f;
inline volatile uint32_t toneAt = 0;

inline float wantedToneLevel() {
  return millis() - toneAt < TONE_TIMEOUT_MS ? toneLevel : 0.0f;
}

inline void silence() {
  toneLevel = 0.0f;
  bank::trigger(bank::STOP_ALL);
}

// number counts from 1, as shown in the sound list.
inline bool play(int number) {
  if (number < 1 || number > bank::soundCount) return false;
  bank::trigger(number - 1);
  Serial.printf("Wi-Fi: play %d (%s)\n", number, bank::sounds[number - 1].name);
  return true;
}

// Acts on one text message. Add your own messages here.
inline void runMessage(const String& message) {
  String text = message;
  text.trim();
  float hz, level;
  if (text == "stop") {
    silence();
  } else if (text == "list") {
    phone::soundsWanted = true;  // handle() sends it
  } else if (text == "reload") {
    reloadWanted = true;  // handle() reads the card again
  } else if (sscanf(text.c_str(), "tone %f %f", &hz, &level) == 2 && isfinite(hz) &&
             isfinite(level)) {
    if (hz > 0.0f) toneHz = constrain(hz, 40.0f, 5000.0f);
    toneLevel = constrain(level, 0.0f, 1.0f);
    toneAt = millis();
  } else {
    if (text.startsWith("play ")) text = text.substring(5);
    if (!play(text.toInt())) Serial.printf("Wi-Fi: did not understand \"%s\"\n", message.c_str());
  }
}

inline void sendPage() {
  String name = scm::boardName();
  String page = "<!doctype html><meta name=viewport content='width=device-width'>"
                "<title>" + name + "</title><h2>" + name + "</h2>";
  for (int i = 0; i < bank::soundCount; i++) {
    page += "<p><button style='font-size:1.4em' onclick=\"fetch('/play?n=" + String(i + 1) +
            "')\">" + String(i + 1) + " " + bank::sounds[i].name + "</button></p>";
  }
  page += "<p><button style='font-size:1.4em' onclick=\"fetch('/stop')\">Stop</button></p>";
  server.send(200, "text/html", page);
}

inline void setupRoutes() {
  static bool done = false;
  if (done) return;
  done = true;
  server.enableCORS(true);  // lets a web page on your laptop call the board
  server.on("/", sendPage);
  server.on("/play", []() {
    int number = server.arg("n").toInt();
    if (play(number)) server.send(200, "text/plain", "ok");
    else server.send(404, "text/plain", "no sound with that number");
  });
  server.on("/stop", []() {
    silence();
    server.send(200, "text/plain", "ok");
  });
}

inline void printAddress() {
  if (!running) {
    Serial.println("Wi-Fi is off (mode 5 turns it on)");
    return;
  }
  bool own = WiFi.getMode() == WIFI_AP;
  IPAddress ip = own ? WiFi.softAPIP() : WiFi.localIP();
  if (own) {
    Serial.printf("Board's own network: %s   password: %s\n", scm::boardName().c_str(),
                  OWN_NETWORK_PASSWORD);
    Serial.println("(No internet on this network, so no phone link.)");
  } else {
    Serial.printf("Joined network: %s\n", WiFi.SSID().c_str());
  }
  Serial.printf("Web page: http://%s/   or http://%s.local/\n", ip.toString().c_str(),
                scm::boardName().c_str());
  Serial.printf("UDP: send \"play 1\" to %s port %u\n", ip.toString().c_str(), UDP_PORT);
  if (!own) phone::printLink();
}

inline void start() {
  if (running) {
    printAddress();
    return;
  }
  bool joined = scm::joinSavedNetwork();
  if (!joined) {
    Serial.println("Making the board's own network instead.");
    WiFi.mode(WIFI_AP);
    if (!WiFi.softAP(scm::boardName().c_str(), OWN_NETWORK_PASSWORD)) {
      Serial.println("Wi-Fi FAILED to start");
      return;
    }
    WiFi.setSleep(false);
  }
  setupRoutes();
  server.begin();
  udp.begin(UDP_PORT);
  MDNS.begin(scm::boardName().c_str());
  running = true;
  if (joined) phone::start(runMessage);
  printAddress();
}

inline void stop() {
  if (!running) return;
  phone::stop();
  silence();
  MDNS.end();
  udp.stop();
  server.stop();
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  running = false;
}

inline void handle() {
  if (!running) return;
  server.handleClient();
  if (udp.parsePacket() > 0) {
    char message[41];
    int length = udp.read(message, sizeof(message) - 1);
    message[max(length, 0)] = '\0';
    runMessage(message);
  }

  if (reloadWanted) {
    reloadWanted = false;
    silence();
    bank::load();
  }
  // Tell the phone page what can be played, when asked and after any reload.
  static uint32_t sentLoad = 0;
  if (phone::connected && (phone::soundsWanted || sentLoad != bank::loads)) {
    phone::soundsWanted = false;
    sentLoad = bank::loads;
    phone::publishSounds(bank::describe());
  }
}

}  // namespace net
