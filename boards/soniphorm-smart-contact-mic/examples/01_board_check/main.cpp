// Board check: reports whether each part of the board responds.
// Open the serial monitor. A report prints every 3 seconds. Tap the piezo to
// see the level change, and press MODE to test the button.
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include "pins.h"
#include "scm_audio.h"
#include "scm_button.h"

scm::ModeButton button;
bool audioOk = false;
float peak = 0.0f;
uint32_t lastReport = 0;

void scanI2C() {
  Serial.print("I2C devices : ");
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) Serial.printf("0x%02X ", address);
  }
  Serial.println("(0x18 is the codec)");
}

void checkSD() {
  SPI.begin(SCM_PIN_SD_SCK, SCM_PIN_SD_MISO, SCM_PIN_SD_MOSI, SCM_PIN_SD_CS);
  if (SD.begin(SCM_PIN_SD_CS, SPI, 20000000)) {
    Serial.printf("SD card     : PASS, %llu MB\n", SD.cardSize() / (1024ULL * 1024ULL));
  } else {
    Serial.println("SD card     : not found (insert a FAT32 card, or ignore if unused)");
  }
  SD.end();
}

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);  // never stall if nothing is listening
  button.begin();
  audioOk = scm::beginAudio();
}

void loop() {
  float mono[scm::BLOCK_SIZE];
  scm::readPiezo(mono);
  for (float sample : mono) peak = max(peak, fabsf(sample));

  if (button.wasPressed()) Serial.println("MODE button : pressed");

  if (millis() - lastReport >= 3000) {
    lastReport = millis();
    Serial.println("\n--- Smart Contact Mic board check ---");
    Serial.printf("Flash       : %u MB (expect 16)\n", ESP.getFlashChipSize() / (1024 * 1024));
    Serial.printf("PSRAM       : %s, %u KB (expect about 8192)\n",
                  psramFound() ? "PASS" : "FAIL", ESP.getPsramSize() / 1024);
    Serial.printf("Codec/audio : %s\n", audioOk ? "PASS" : "FAIL");
    scanI2C();
    checkSD();
    Serial.printf("Piezo peak  : %.4f over the last 3 s (tap it)\n", peak);
    peak = 0.0f;
  }
}
