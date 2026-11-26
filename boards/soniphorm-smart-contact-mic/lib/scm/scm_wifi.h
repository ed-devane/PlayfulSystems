// Wi-Fi for any sketch on this board. The network name and password are typed
// into the serial monitor and stored on the board, never in code or in git.
//
//   scm::WifiSetup wifiSetup;
//   // for each line typed:
//   switch (wifiSetup.handle(line)) {
//     case scm::WifiSetup::NotWifi: /* your own commands */ break;
//     case scm::WifiSetup::Saved:   scm::joinSavedNetwork(); break;
//     case scm::WifiSetup::Used:    break;
//   }
//   // and wherever you want to connect:
//   if (scm::joinSavedNetwork()) { ... }
//
// One network is stored. It survives uploading new code.
#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>

namespace scm {

constexpr char SETTINGS[] = "scm-test";  // name of the storage area on the board

inline void saveNetwork(const String& ssid, const String& password) {
  Preferences prefs;
  prefs.begin(SETTINGS, false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", password);
  prefs.end();
}

// A short name that differs between boards, for example "scm-6428".
inline String boardName() {
  uint64_t mac = ESP.getEfuseMac();
  char name[16];
  snprintf(name, sizeof(name), "scm-%02x%02x", (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));
  return String(name);
}

// Says why joining failed: wrong name (or out of range), or probably the password.
inline void explainWifiFailure(const String& ssid) {
  WiFi.disconnect();
  delay(200);
  int found = WiFi.scanNetworks();
  bool visible = false;
  for (int i = 0; i < found; i++) visible |= WiFi.SSID(i) == ssid;
  WiFi.scanDelete();
  if (visible) {
    Serial.printf("\"%s\" is in range, so check the password.\n", ssid.c_str());
  } else {
    Serial.printf("No 2.4 GHz network called \"%s\" found (capitals matter).\n", ssid.c_str());
  }
}

// Joins the stored network. Waits up to timeoutMs, so don't call it from an
// audio loop. Returns false (and says why) if it can't.
inline bool joinSavedNetwork(uint32_t timeoutMs = 15000) {
  Preferences prefs;
  prefs.begin(SETTINGS, true);
  String ssid = prefs.getString("ssid", "");
  String password = prefs.getString("pass", "");
  prefs.end();

  if (ssid.length() == 0) {
    Serial.println("No Wi-Fi network saved (type \"wifi\" to save one).");
    return false;
  }
  Serial.printf("Joining %s ...\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  uint32_t began = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - began < timeoutMs) delay(100);
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Could not join.");
    explainWifiFailure(ssid);
    return false;
  }
  WiFi.setSleep(false);  // quicker response to messages
  Serial.printf("Joined. Board address: %s\n", WiFi.localIP().toString().c_str());
  return true;
}

// The "wifi" command: asks for the name, then the password.
class WifiSetup {
 public:
  enum Result { NotWifi, Used, Saved };

  Result handle(const String& line) {
    if (step == 1) {
      name = line;
      name.trim();
      step = 2;
      Serial.println("Password? (it is shown as you type)");
      return Used;
    }
    if (step == 2) {
      saveNetwork(name, line);
      step = 0;
      Serial.println("Network saved on the board.");
      return Saved;
    }
    String command = line;
    command.trim();
    if (command == "wifi clear") {
      saveNetwork("", "");
      Serial.println("Saved network forgotten");
      return Used;
    }
    if (command == "wifi") {
      step = 1;
      Serial.println("Network name? (2.4 GHz only)");
      return Used;
    }
    return NotWifi;
  }

 private:
  int step = 0;
  String name;
};

}  // namespace scm
