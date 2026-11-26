// All-in-one test sketch for the Soniphorm Smart Contact Mic.
// Type a command in the serial monitor and press Enter, or send one with
// tools/scm.py. The MODE button steps to the next mode.
//
//   0  silent                        6  tap the piezo to play a sound
//   1  piezo to headphones/line      7  frequency sweep
//   2  sine wave (no piezo)          8  piezo level meter
//   3  play a file from the SD card  9  record 5 seconds, then play it
//   4  piezo to speaker/exciter
//   5  Wi-Fi sound triggers
//
// Audio runs in its own task, so Wi-Fi, SD and serial work cannot interrupt it.
#include <Arduino.h>
#include <Preferences.h>
#include "pins.h"
#include "scm_audio.h"
#include "scm_button.h"
#include "scm_serial.h"
#include "scm_wifi.h"
#include "sound_bank.h"
#include "wifi_control.h"

// ---- settings ----------------------------------------------------------------
constexpr float SINE_HZ = 440.0f;
constexpr float SINE_LEVEL = 0.15f;
constexpr float FILE_LEVEL = 0.7f;
constexpr float REMOTE_TONE_LEVEL = 0.4f;  // mode 5: output at "tone" level 1
constexpr float SPEAKER_TRIM = 0.5f;     // output is turned down while the amp is on
constexpr float SPEAKER_MAX = 0.7f;      // protects a small exciter
constexpr float TAP_THRESHOLD = 0.05f;   // mode 6: raise if it triggers itself
constexpr uint32_t TAP_GAP_BLOCKS = 150; // about 0.2 s
constexpr float SWEEP_LOW_HZ = 50.0f;
constexpr float SWEEP_HIGH_HZ = 5000.0f;
constexpr float SWEEP_SECONDS = 15.0f;
constexpr size_t RECORD_SAMPLES = scm::SAMPLE_RATE * 5;

const char* MODE_NAMES[10] = {
    "silent",
    "piezo to headphones/line",
    "sine wave 440 Hz (piezo not used)",
    "play a file from the SD card (loops)",
    "piezo to speaker/exciter",
    "Wi-Fi: sounds and tones from web, UDP or phone",
    "tap the piezo to play a sound",
    "frequency sweep 50 Hz to 5 kHz",
    "piezo level meter (silent)",
    "record 5 seconds, then play it back",
};

// ---- shared between the main loop and the audio task -------------------------
volatile int mode = 1;
volatile uint32_t modeChanges = 0;
volatile float volume = 1.0f;
volatile bool speakerOn = false;
volatile float meterPeak = 0.0f;
volatile bool meterClipped = false;
volatile float sweepHz = 0.0f;
volatile int tapCount = 0;
volatile int recordState = 0;  // 0 idle, 1 recording, 2 playing, 3 finished
volatile bool saveWanted = false;
int16_t* recording = nullptr;

scm::ModeButton button;
scm::SerialLines serialLines;
scm::WifiSetup wifiSetup;
bool audioOk = false;

// ---- audio task --------------------------------------------------------------
void audioTask(void*) {
  float input[scm::BLOCK_SIZE];
  float output[scm::BLOCK_SIZE];
  uint32_t seenChange = 0;
  float phase = 0.0f;
  float sweepTime = 0.0f;
  size_t recordPosition = 0;
  uint32_t blocksSinceTap = TAP_GAP_BLOCKS;
  int nextTapSound = 0;
  float remotePhase = 0.0f;   // mode 5 tone
  float remoteHz = 440.0f;
  float remoteLevel = 0.0f;

  for (;;) {
    uint32_t changes = modeChanges;  // read before mode: see setMode()
    int current = mode;
    bank::update();
    if (seenChange != changes) {  // a mode was just chosen: start it fresh
      seenChange = changes;
      phase = 0.0f;
      sweepTime = 0.0f;
      recordPosition = 0;
      blocksSinceTap = TAP_GAP_BLOCKS;
      if (current == 9) recordState = recording ? 1 : 0;
    }

    memset(output, 0, sizeof(output));
    bool usesPiezo = current == 1 || current == 4 || current == 6 || current == 8 || current == 9;
    float peak = 0.0f;
    if (usesPiezo) {
      scm::readPiezo(input);
      for (float sample : input) peak = max(peak, fabsf(sample));
      if (peak > meterPeak) meterPeak = peak;
      if (scm::piezoClipped) meterClipped = true;
    }
    float gain = volume;

    switch (current) {
      case 1:  // piezo to headphones/line
      case 4:  // piezo to speaker/exciter
        for (size_t i = 0; i < scm::BLOCK_SIZE; i++) output[i] = input[i] * gain;
        break;

      case 2:    // sine wave
      case 7: {  // sweep
        float frequency = SINE_HZ;
        if (current == 7) {
          frequency = SWEEP_LOW_HZ * powf(SWEEP_HIGH_HZ / SWEEP_LOW_HZ, sweepTime / SWEEP_SECONDS);
          sweepHz = frequency;
          sweepTime += (float)scm::BLOCK_SIZE / scm::SAMPLE_RATE;
          if (sweepTime >= SWEEP_SECONDS) sweepTime = 0.0f;
        }
        for (size_t i = 0; i < scm::BLOCK_SIZE; i++) {
          output[i] = sinf(phase) * SINE_LEVEL * gain;
          phase += TWO_PI * frequency / scm::SAMPLE_RATE;
          if (phase >= TWO_PI) phase -= TWO_PI;
        }
        break;
      }

      case 3:  // SD playback
        bank::mix(output, FILE_LEVEL * gain);
        break;

      case 5: {  // sounds and tones sent over Wi-Fi
        bank::mix(output, FILE_LEVEL * gain);
        float wantedLevel = net::wantedToneLevel();
        float wantedHz = net::toneHz;
        for (size_t i = 0; i < scm::BLOCK_SIZE; i++) {
          remoteLevel += 0.002f * (wantedLevel - remoteLevel);  // glide, no clicks
          remoteHz += 0.002f * (wantedHz - remoteHz);
          output[i] += sinf(remotePhase) * remoteLevel * REMOTE_TONE_LEVEL * gain;
          remotePhase += TWO_PI * remoteHz / scm::SAMPLE_RATE;
          if (remotePhase >= TWO_PI) remotePhase -= TWO_PI;
        }
        break;
      }

      case 6:  // tap to play
        // Ignores the piezo while a sound plays, so it cannot retrigger itself.
        if (bank::activeVoices > 0) {
          blocksSinceTap = 0;
        } else if (blocksSinceTap < TAP_GAP_BLOCKS) {
          blocksSinceTap++;
        } else if (peak > TAP_THRESHOLD && bank::soundCount > 0) {
          bank::trigger(nextTapSound % bank::soundCount);
          nextTapSound++;
          tapCount = tapCount + 1;
          blocksSinceTap = 0;
        }
        bank::mix(output, FILE_LEVEL * gain);
        break;

      case 9:  // record then play
        if (recordState == 1) {
          for (size_t i = 0; i < scm::BLOCK_SIZE && recordPosition < RECORD_SAMPLES; i++) {
            recording[recordPosition++] = (int16_t)(constrain(input[i], -1.0f, 1.0f) * 32767.0f);
          }
          if (recordPosition >= RECORD_SAMPLES) {
            recordPosition = 0;
            saveWanted = true;
            recordState = 2;
          }
        } else if (recordState == 2) {
          for (size_t i = 0; i < scm::BLOCK_SIZE && recordPosition < RECORD_SAMPLES; i++) {
            output[i] = recording[recordPosition++] / 32768.0f * gain;
          }
          if (recordPosition >= RECORD_SAMPLES) recordState = 3;
        }
        break;

      default:  // 0 and 8 are silent
        break;
    }

    if (speakerOn) {
      for (float& sample : output) {
        sample = constrain(sample * SPEAKER_TRIM, -SPEAKER_MAX, SPEAKER_MAX);
      }
    }
    scm::writeAudio(output, output);  // paces the task: waits for the next block
  }
}

// ---- commands ----------------------------------------------------------------
void setSpeaker(bool on) {
  speakerOn = on;
  scm::setSpeaker(on);
  Serial.printf("Speaker amp %s\n", on ? "ON" : "OFF");
}

void setMode(int chosen) {
  speakerOn = false;
  scm::setSpeaker(false);
  if (mode == 5 && chosen != 5) net::stop();
  bank::trigger(bank::STOP_ALL);
  mode = 0;
  delay(20);  // let the audio task play out the stop

  Serial.printf("\nMODE %d: %s\n", chosen, MODE_NAMES[chosen]);
  recordState = 0;
  saveWanted = false;
  mode = chosen;
  modeChanges = modeChanges + 1;

  if (chosen == 3) {
    delay(20);
    bank::trigger(0, true);
    Serial.printf("Playing %s (\"list\" to see all, \"play 2\" for another)\n",
                  bank::sounds[0].name);
  }
  if (chosen == 4) {
    Serial.println("Careful: if the exciter touches the same object as the piezo it can howl.");
    Serial.println("Type 0 to silence.");
  }
  if (chosen == 5) net::start();
  if (chosen == 6) Serial.println("Tap the piezo.");
  if (chosen == 9) Serial.println(recording ? "Recording now..." : "No PSRAM: cannot record");
  if (chosen == 4 || chosen == 5) setSpeaker(true);
  else Serial.println("Speaker amp OFF (\"speaker\" turns it on)");

  // Remembered, so a reset comes back to the same test. Mode 4 is left out so
  // the board never starts up with a live mic into the speaker.
  Preferences prefs;
  prefs.begin("scm-test", false);
  prefs.putInt("mode", chosen == 4 ? 1 : chosen);
  prefs.end();
}

void boardCheck() {
  Serial.println("\n--- Board check ---");
  Serial.printf("Flash       : %u MB (expect 16)\n", ESP.getFlashChipSize() / (1024 * 1024));
  Serial.printf("PSRAM       : %s, %u KB (expect about 8192)\n", psramFound() ? "PASS" : "FAIL",
                ESP.getPsramSize() / 1024);
  Serial.printf("Codec       : %s\n", audioOk && scm::codecRead(0xFD) == 0x83 ? "PASS" : "FAIL");
  Serial.print("I2C devices : ");
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) Serial.printf("0x%02X ", address);
  }
  Serial.println("(0x18 is the codec)");
  Serial.printf("SD card     : %s\n", bank::sdMounted ? "mounted at last load" : "not found");
  Serial.printf("MODE button : %s\n",
                digitalRead(SCM_PIN_MODE_BTN) == LOW ? "pressed" : "not pressed");
  Serial.printf("Header      : GPIO4 = %d, GPIO5 = %d (0-4095, random if unwired)\n",
                analogRead(SCM_PIN_HEADER_IO1), analogRead(SCM_PIN_HEADER_IO2));
  Serial.printf("Current     : mode %d, volume %.1f, speaker %s\n", (int)mode, (float)volume,
                speakerOn ? "on" : "off");
}

void help() {
  Serial.println("\nModes:");
  for (int i = 0; i < 10; i++) Serial.printf("  %d  %s\n", i, MODE_NAMES[i]);
  Serial.println("Commands:");
  Serial.println("  speaker        speaker amp on/off");
  Serial.println("  vol 0.5        volume, 0 to 2");
  Serial.println("  list           sounds available");
  Serial.println("  files          what is on the SD card");
  Serial.println("  play 2         play sound 2 (modes 3, 5 and 6)");
  Serial.println("  stop           stop sounds");
  Serial.println("  reload         read the SD card again");
  Serial.println("  check          board check");
  Serial.println("  wifi           save a Wi-Fi network (\"wifi clear\" forgets it)");
  Serial.println("  status         current mode");
  Serial.println("  phone          this board's phone link and QR code address");
}

void status() {
  Serial.printf("MODE %d: %s | volume %.1f | speaker %s\n", (int)mode, MODE_NAMES[mode],
                (float)volume, speakerOn ? "on" : "off");
  if (mode == 5) net::printAddress();
}

void runCommand(String line) {
  switch (wifiSetup.handle(line)) {
    case scm::WifiSetup::Saved:
      if (mode == 5) {
        net::stop();
        net::start();
        setSpeaker(true);
      }
      return;
    case scm::WifiSetup::Used:
      return;
    case scm::WifiSetup::NotWifi:
      break;
  }

  line.trim();
  if (line.length() == 0) return;
  if (line.length() == 1 && isDigit(line[0])) {
    setMode(line[0] - '0');
  } else if (line == "speaker") {
    setSpeaker(!speakerOn);
  } else if (line.startsWith("vol ")) {
    volume = constrain(line.substring(4).toFloat(), 0.0f, 2.0f);
    Serial.printf("Volume %.2f\n", (float)volume);
  } else if (line == "list") {
    bank::list();
  } else if (line.startsWith("play ")) {
    int number = line.substring(5).toInt();
    if (mode != 3 && mode != 5 && mode != 6) {
      Serial.println("Switch to mode 3, 5 or 6 first");
    } else if (number < 1 || number > bank::soundCount) {
      Serial.println("No sound with that number (try \"list\")");
    } else {
      bank::trigger(bank::STOP_ALL);
      bank::trigger(number - 1);
      Serial.printf("Playing %s\n", bank::sounds[number - 1].name);
    }
  } else if (line == "stop") {
    bank::trigger(bank::STOP_ALL);
    Serial.println("Stopped");
  } else if (line == "files") {
    bank::listCard();
  } else if (line == "reload") {
    bank::load();
  } else if (line == "check") {
    boardCheck();
  } else if (line == "phone") {
    phone::printLink();
  } else if (line == "status") {
    status();
  } else if (line == "help") {
    help();
  } else {
    Serial.printf("Unknown command \"%s\" (try \"help\")\n", line.c_str());
  }
}

void readSerial() {
  String line;
  while (serialLines.read(line)) runCommand(line);
}

// Messages for the modes that report as they go.
void report() {
  static uint32_t last = 0;
  static int tapsShown = 0;
  if (tapCount != tapsShown) {
    tapsShown = tapCount;
    Serial.printf("TAP %d\n", tapsShown);
  }
  if (saveWanted) {
    saveWanted = false;
    Serial.println("Recorded. Playing back.");
    if (bank::sdMounted) {
      bool saved = bank::saveWav("/recording.wav", recording, RECORD_SAMPLES);
      Serial.println(saved ? "Saved /recording.wav" : "SD write FAILED");
    } else {
      Serial.println("No SD card: not saved");
    }
  }
  if (millis() - last < 300) return;
  last = millis();
  if (mode == 8) {
    float peak = meterPeak;
    char bar[41];
    int length = constrain((int)(peak * 60.0f), 0, 40);
    memset(bar, '#', length);
    bar[length] = '\0';
    Serial.printf("%.3f %s%s\n", peak, bar, meterClipped ? " CLIP" : "");
  } else if (mode == 7) {
    Serial.printf("%.0f Hz\n", (float)sweepHz);
  }
  meterPeak = 0.0f;
  meterClipped = false;
}

// ---- main --------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);  // never stall if nothing is listening
  delay(1500);               // time for the serial monitor to reconnect

  button.begin();
  audioOk = scm::beginAudio();
  recording = (int16_t*)ps_malloc(RECORD_SAMPLES * sizeof(int16_t));
  bank::load();
  xTaskCreatePinnedToCore(audioTask, "audio", 8192, nullptr, 10, nullptr, 1);

  Preferences prefs;
  prefs.begin("scm-test", true);
  int saved = prefs.getInt("mode", 1);
  prefs.end();

  Serial.println("\nSmart Contact Mic test sketch");
  help();
  setMode(constrain(saved, 0, 9));
}

void loop() {
  readSerial();
  if (button.wasPressed()) setMode((mode + 1) % 10);
  net::handle();
  report();
  delay(2);
}
