// Test tone: a quiet 440 Hz sine on the headphone/line jack.
// Press MODE to switch the speaker/exciter on and off.
#include <Arduino.h>
#include "scm_audio.h"
#include "scm_button.h"

constexpr float FREQUENCY = 440.0f;
constexpr float LEVEL = 0.1f;  // 0.0 to 1.0. Start low.

scm::ModeButton button;
bool speakerOn = false;
float phase = 0.0f;

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  button.begin();
  scm::beginAudio();
}

void loop() {
  if (button.wasPressed()) {
    speakerOn = !speakerOn;
    scm::setSpeaker(speakerOn);
    Serial.printf("Speaker %s\n", speakerOn ? "ON" : "OFF");
  }

  float out[scm::BLOCK_SIZE];
  for (size_t i = 0; i < scm::BLOCK_SIZE; i++) {
    out[i] = sinf(phase) * LEVEL;
    phase += TWO_PI * FREQUENCY / scm::SAMPLE_RATE;
    if (phase >= TWO_PI) phase -= TWO_PI;
  }
  scm::writeAudio(out, out);
}
