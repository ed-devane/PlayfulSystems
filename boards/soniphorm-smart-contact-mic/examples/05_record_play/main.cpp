// Recorder: press MODE to start, press again to stop (or wait 30 s).
// The recording is saved to the SD card as a WAV file, then played back through
// the jack and the speaker/exciter. It still records and plays without a card.
//
// Audio is held in PSRAM while recording, because SD cards can pause for long
// enough to cause gaps if written to during recording.
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include "pins.h"
#include "scm_audio.h"
#include "scm_button.h"

constexpr uint32_t MAX_SECONDS = 30;
constexpr size_t MAX_SAMPLES = MAX_SECONDS * scm::SAMPLE_RATE;
constexpr float PLAY_MAX = 0.7f;

enum class State { Idle, Recording, Playing };

scm::ModeButton button;
State state = State::Idle;
int16_t* recording = nullptr;
size_t recordedSamples = 0;
size_t playPosition = 0;
bool sdReady = false;

void writeLE(File& file, uint32_t value, int bytes) {
  for (int i = 0; i < bytes; i++) file.write((uint8_t)(value >> (8 * i)));
}

void saveWav() {
  if (!sdReady) {
    Serial.println("No SD card: not saved");
    return;
  }
  char path[20];
  int number = 1;
  do {
    snprintf(path, sizeof(path), "/rec%03d.wav", number++);
  } while (SD.exists(path) && number < 1000);

  File file = SD.open(path, FILE_WRITE);
  if (!file) {
    Serial.println("Could not create the file");
    return;
  }

  uint32_t dataBytes = recordedSamples * sizeof(int16_t);
  file.print("RIFF");
  writeLE(file, 36 + dataBytes, 4);
  file.print("WAVEfmt ");
  writeLE(file, 16, 4);                    // format chunk size
  writeLE(file, 1, 2);                     // PCM
  writeLE(file, 1, 2);                     // mono
  writeLE(file, scm::SAMPLE_RATE, 4);
  writeLE(file, scm::SAMPLE_RATE * 2, 4);  // bytes per second
  writeLE(file, 2, 2);                     // bytes per sample frame
  writeLE(file, 16, 2);                    // bits per sample
  file.print("data");
  writeLE(file, dataBytes, 4);

  const uint8_t* bytes = (const uint8_t*)recording;
  size_t written = 0;
  while (written < dataBytes) {
    size_t chunk = min((size_t)4096, (size_t)(dataBytes - written));
    if (file.write(bytes + written, chunk) != chunk) break;
    written += chunk;
  }
  file.close();
  Serial.printf("%s %s\n", written == dataBytes ? "Saved" : "SD write FAILED:", path);
}

void startRecording() {
  scm::setSpeaker(false);
  recordedSamples = 0;
  state = State::Recording;
  Serial.println("Recording... press MODE to stop");
}

void finishRecording() {
  Serial.printf("Recorded %.1f s\n", (float)recordedSamples / scm::SAMPLE_RATE);
  saveWav();
  playPosition = 0;
  scm::setSpeaker(true);
  state = State::Playing;
  Serial.println("Playing back...");
}

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  button.begin();
  scm::beginAudio();

  recording = (int16_t*)ps_malloc(MAX_SAMPLES * sizeof(int16_t));
  if (recording == nullptr) Serial.println("ERROR: no PSRAM");

  SPI.begin(SCM_PIN_SD_SCK, SCM_PIN_SD_MISO, SCM_PIN_SD_MOSI, SCM_PIN_SD_CS);
  sdReady = SD.begin(SCM_PIN_SD_CS, SPI, 20000000);
  Serial.println(sdReady ? "SD card ready" : "No SD card");
  Serial.println("Press MODE to record");
}

void loop() {
  bool pressed = button.wasPressed();
  float input[scm::BLOCK_SIZE];
  float output[scm::BLOCK_SIZE] = {0};
  scm::readPiezo(input);  // keeps the loop running at audio speed

  if (pressed && recording != nullptr) {
    if (state == State::Recording) {
      finishRecording();
      return;
    }
    startRecording();
  }

  if (state == State::Recording) {
    for (size_t i = 0; i < scm::BLOCK_SIZE && recordedSamples < MAX_SAMPLES; i++) {
      recording[recordedSamples++] = (int16_t)(constrain(input[i], -1.0f, 1.0f) * 32767.0f);
    }
    if (recordedSamples >= MAX_SAMPLES) {
      finishRecording();
      return;
    }
  } else if (state == State::Playing) {
    for (size_t i = 0; i < scm::BLOCK_SIZE && playPosition < recordedSamples; i++) {
      output[i] = constrain(recording[playPosition++] / 32768.0f, -PLAY_MAX, PLAY_MAX);
    }
    if (playPosition >= recordedSamples) {
      scm::setSpeaker(false);
      state = State::Idle;
      Serial.println("Done. Press MODE to record");
    }
  }

  scm::writeAudio(output, output);
}
