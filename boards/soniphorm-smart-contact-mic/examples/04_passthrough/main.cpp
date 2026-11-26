// Contact mic amplifier: piezo straight to the headphone/line jack.
// MODE switches the speaker/exciter on. If the exciter touches the same object
// as the piezo this will feed back and can get loud very quickly.
#include <Arduino.h>
#include "scm_audio.h"
#include "scm_button.h"

constexpr float GAIN = 1.0f;
constexpr float SPEAKER_MAX = 0.7f;  // protects a small exciter from overload

scm::ModeButton button;
bool speakerOn = false;

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

  float audio[scm::BLOCK_SIZE];
  scm::readPiezo(audio);

  // Put your own processing here, one sample at a time.
  for (float& sample : audio) {
    sample *= GAIN;
    if (speakerOn) sample = constrain(sample, -SPEAKER_MAX, SPEAKER_MAX);
  }

  scm::writeAudio(audio, audio);
}
