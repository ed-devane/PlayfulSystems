// Two knobs on the expansion header control a tone: pitch and volume.
// Wiring for each pot: outer legs to header 3V3 and GND, middle leg to GPIO4
// (pitch) or GPIO5 (volume). With nothing wired the readings are random.
// MODE switches the speaker/exciter on and off.
#include <Arduino.h>
#include "pins.h"
#include "scm_audio.h"
#include "scm_button.h"

scm::ModeButton button;
bool speakerOn = false;
float pitchKnob = 0.0f;
float volumeKnob = 0.0f;
float phase = 0.0f;
uint32_t lastRead = 0;
uint32_t lastPrint = 0;

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

  uint32_t now = millis();
  if (now - lastRead >= 10) {
    lastRead = now;
    // 0.0 to 1.0, smoothed to remove jitter
    pitchKnob += 0.2f * (analogRead(SCM_PIN_HEADER_IO1) / 4095.0f - pitchKnob);
    volumeKnob += 0.2f * (analogRead(SCM_PIN_HEADER_IO2) / 4095.0f - volumeKnob);
  }

  float frequency = 100.0f + pitchKnob * 900.0f;
  float level = volumeKnob * 0.2f;

  float out[scm::BLOCK_SIZE];
  for (size_t i = 0; i < scm::BLOCK_SIZE; i++) {
    out[i] = sinf(phase) * level;
    phase += TWO_PI * frequency / scm::SAMPLE_RATE;
    if (phase >= TWO_PI) phase -= TWO_PI;
  }
  scm::writeAudio(out, out);

  if (now - lastPrint >= 250) {
    lastPrint = now;
    Serial.printf("pitch %.0f Hz, volume %.2f\n", frequency, level);
  }
}
