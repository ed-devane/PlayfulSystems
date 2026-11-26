// Piezo level meter and tap detector, shown in the serial monitor.
#include <Arduino.h>
#include "scm_audio.h"

constexpr float TAP_THRESHOLD = 0.05f;   // raise if it triggers by itself
constexpr uint32_t TAP_GAP_MS = 150;     // ignore ringing after a tap

float meterPeak = 0.0f;
bool meterClipped = false;
uint32_t lastMeter = 0;
uint32_t lastTap = 0;

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  scm::beginAudio();
}

void loop() {
  float mono[scm::BLOCK_SIZE];
  scm::readPiezo(mono);

  float blockPeak = 0.0f;
  for (float sample : mono) blockPeak = max(blockPeak, fabsf(sample));
  meterPeak = max(meterPeak, blockPeak);
  meterClipped |= scm::piezoClipped;

  uint32_t now = millis();
  if (blockPeak > TAP_THRESHOLD && now - lastTap > TAP_GAP_MS) {
    lastTap = now;
    // This is the level at the start of the hit, not its full strength.
    Serial.printf("TAP (level at onset %.2f)\n", blockPeak);
  }

  if (now - lastMeter >= 100) {
    lastMeter = now;
    char bar[41];
    int length = constrain((int)(meterPeak * 60.0f), 0, 40);
    memset(bar, '#', length);
    bar[length] = '\0';
    Serial.printf("%.3f %s%s\n", meterPeak, bar, meterClipped ? " CLIP" : "");
    meterPeak = 0.0f;
    meterClipped = false;
  }
}
