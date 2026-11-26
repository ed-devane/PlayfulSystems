// Sounds for playback: loads WAV files from the SD card into PSRAM so they can
// start instantly and overlap. Without a card it makes three built-in sounds.
//
// The main loop loads sounds and asks for them with trigger(). Only the audio
// task calls update() and mix().
#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include "pins.h"
#include "scm_audio.h"

namespace bank {

constexpr int MAX_SOUNDS = 8;
constexpr int MAX_VOICES = 4;
constexpr size_t MAX_BYTES = 6 * 1024 * 1024;  // PSRAM budget for all sounds
constexpr int STOP_ALL = -1;

struct Sound {
  char name[40];
  int16_t* data;   // mono
  size_t length;   // samples
  uint32_t rate;   // Hz
};

struct Voice {
  int sound = -1;
  uint64_t position = 0;  // fixed point: upper 32 bits are the sample number
  bool loop = false;
};

struct Request {
  int sound;
  bool loop;
};

inline Sound sounds[MAX_SOUNDS];
inline volatile int soundCount = 0;
inline volatile bool ready = false;
inline volatile int activeVoices = 0;
inline bool sdMounted = false;
inline bool fromCard = false;
inline Voice voices[MAX_VOICES];
inline QueueHandle_t requests = nullptr;

inline void writeLE(File& file, uint32_t value, int bytes) {
  for (int i = 0; i < bytes; i++) file.write((uint8_t)(value >> (8 * i)));
}

inline bool saveWav(const char* path, const int16_t* data, size_t length) {
  File file = SD.open(path, FILE_WRITE);
  if (!file) return false;
  uint32_t dataBytes = length * sizeof(int16_t);
  file.print("RIFF");
  writeLE(file, 36 + dataBytes, 4);
  file.print("WAVEfmt ");
  writeLE(file, 16, 4);
  writeLE(file, 1, 2);                     // PCM
  writeLE(file, 1, 2);                     // mono
  writeLE(file, scm::SAMPLE_RATE, 4);
  writeLE(file, scm::SAMPLE_RATE * 2, 4);
  writeLE(file, 2, 2);
  writeLE(file, 16, 2);
  file.print("data");
  writeLE(file, dataBytes, 4);

  const uint8_t* bytes = (const uint8_t*)data;
  size_t written = 0;
  while (written < dataBytes) {
    size_t chunk = min((size_t)4096, (size_t)(dataBytes - written));
    if (file.write(bytes + written, chunk) != chunk) break;
    written += chunk;
  }
  file.close();
  return written == dataBytes;
}

inline uint32_t readLE(const uint8_t* bytes, int count) {
  uint32_t value = 0;
  for (int i = 0; i < count; i++) value |= (uint32_t)bytes[i] << (8 * i);
  return value;
}

// Loads one 16 or 24 bit PCM WAV file (mono or stereo, any sample rate).
inline bool loadWav(const char* path, Sound& sound, size_t& bytesUsed) {
  File file = SD.open(path);
  if (!file) return false;

  uint8_t header[12];
  if (file.read(header, 12) != 12 || memcmp(header, "RIFF", 4) != 0 ||
      memcmp(header + 8, "WAVE", 4) != 0) {
    Serial.printf("  skipped %s: not a WAV file\n", path);
    file.close();
    return false;
  }

  uint16_t format = 0, channels = 0, bits = 0;
  uint32_t rate = 0, dataBytes = 0;
  uint8_t chunk[8];
  while (file.read(chunk, 8) == 8) {
    uint32_t size = readLE(chunk + 4, 4);
    size_t next = file.position() + size + (size & 1);
    if (memcmp(chunk, "fmt ", 4) == 0) {
      uint8_t fmt[16];
      if (file.read(fmt, 16) != 16) break;
      format = readLE(fmt, 2);
      channels = readLE(fmt + 2, 2);
      rate = readLE(fmt + 4, 4);
      bits = readLE(fmt + 14, 2);
    } else if (memcmp(chunk, "data", 4) == 0) {
      dataBytes = min((uint32_t)size, (uint32_t)(file.size() - file.position()));
      break;
    }
    if (next > file.size()) break;
    file.seek(next);
  }

  bool pcm = format == 1 || format == 0xFFFE;
  if (!pcm || (bits != 16 && bits != 24) || channels < 1 || channels > 2 || rate == 0 ||
      dataBytes == 0) {
    Serial.printf("  skipped %s: needs to be 16 or 24 bit PCM, mono or stereo\n", path);
    file.close();
    return false;
  }

  size_t frameBytes = channels * bits / 8;
  size_t frames = dataBytes / frameBytes;
  size_t room = (MAX_BYTES - bytesUsed) / sizeof(int16_t);
  if (frames > room) {
    Serial.printf("  %s shortened to fit in memory\n", path);
    frames = room;
  }
  int16_t* data = frames ? (int16_t*)ps_malloc(frames * sizeof(int16_t)) : nullptr;
  if (data == nullptr) {
    Serial.printf("  skipped %s: no memory left\n", path);
    file.close();
    return false;
  }

  static uint8_t buffer[512 * 6];
  size_t done = 0;
  while (done < frames) {
    size_t count = min((size_t)512, frames - done);
    if ((size_t)file.read(buffer, count * frameBytes) != count * frameBytes) break;
    for (size_t i = 0; i < count; i++) {
      int32_t mix = 0;
      for (int c = 0; c < channels; c++) {
        // The top two bytes of each sample (works for 16 and 24 bit).
        const uint8_t* s = buffer + i * frameBytes + c * bits / 8 + (bits / 8 - 2);
        mix += (int16_t)readLE(s, 2);
      }
      data[done++] = mix / channels;
    }
  }
  file.close();

  if (done == 0) {
    free(data);
    return false;
  }
  const char* slash = strrchr(path, '/');
  strlcpy(sound.name, slash ? slash + 1 : path, sizeof(sound.name));
  sound.data = data;
  sound.length = done;
  sound.rate = rate;
  bytesUsed += done * sizeof(int16_t);
  return true;
}

// Three short synthetic sounds: a beep, a chord and a rising sweep.
inline bool makeTestSound(int which, Sound& sound) {
  const char* names[3] = {"test_beep.wav", "test_chord.wav", "test_sweep.wav"};
  size_t length = scm::SAMPLE_RATE * (which == 0 ? 4 : 10) / 10;
  int16_t* data = (int16_t*)ps_malloc(length * sizeof(int16_t));
  if (data == nullptr) return false;
  float phase = 0.0f;
  for (size_t i = 0; i < length; i++) {
    float t = (float)i / scm::SAMPLE_RATE;
    float fade = 1.0f - (float)i / length;
    float value;
    if (which == 0) {
      value = sinf(TWO_PI * 880.0f * t);
    } else if (which == 1) {
      value = (sinf(TWO_PI * 330.0f * t) + sinf(TWO_PI * 440.0f * t) +
               sinf(TWO_PI * 550.0f * t)) / 3.0f;
    } else {
      phase += TWO_PI * (200.0f + 1800.0f * (1.0f - fade)) / scm::SAMPLE_RATE;
      value = sinf(phase);
    }
    data[i] = (int16_t)(value * fade * 16000.0f);
  }
  strlcpy(sound.name, names[which], sizeof(sound.name));
  sound.data = data;
  sound.length = length;
  sound.rate = scm::SAMPLE_RATE;
  return true;
}

// Finds WAV files in the top folder of the card, in alphabetical order.
inline int findWavFiles(String* names, int maximum) {
  int count = 0;
  File root = SD.open("/");
  if (!root) return 0;
  while (File entry = root.openNextFile()) {
    String name = entry.name();
    String lower = name;
    lower.toLowerCase();
    // Names starting with "." are hidden files that Macs add to cards.
    bool wanted = !entry.isDirectory() && lower.endsWith(".wav") && !name.startsWith(".");
    entry.close();
    if (!wanted) continue;
    int at = count;
    while (at > 0 && name < names[at - 1]) at--;
    if (at >= maximum) continue;
    for (int i = min(count, maximum - 1); i > at; i--) names[i] = names[i - 1];
    names[at] = name;
    if (count < maximum) count++;
  }
  root.close();
  return count;
}

inline void list() {
  Serial.printf("%d sound(s), %s:\n", (int)soundCount,
                fromCard ? "loaded from the SD card" : "BUILT IN (not from an SD card)");
  for (int i = 0; i < soundCount; i++) {
    Serial.printf("  %d  %s (%.1f s)\n", i + 1, sounds[i].name,
                  (float)sounds[i].length / sounds[i].rate);
  }
}

// (Re)loads all sounds. Call from the main loop only.
inline void load() {
  if (requests == nullptr) requests = xQueueCreate(8, sizeof(Request));
  ready = false;
  delay(20);  // let the audio task finish the block it is on
  for (int i = 0; i < soundCount; i++) free(sounds[i].data);
  soundCount = 0;
  fromCard = false;

  SD.end();
  SPI.begin(SCM_PIN_SD_SCK, SCM_PIN_SD_MISO, SCM_PIN_SD_MOSI, SCM_PIN_SD_CS);
  sdMounted = SD.begin(SCM_PIN_SD_CS, SPI, 20000000);

  if (sdMounted) {
    String names[MAX_SOUNDS];
    int found = findWavFiles(names, MAX_SOUNDS);
    if (found == 0) {
      Serial.println("SD card has no WAV files: writing three test sounds to it");
      for (int i = 0; i < 3; i++) {
        Sound test;
        if (!makeTestSound(i, test)) continue;
        String path = String("/") + test.name;
        if (!saveWav(path.c_str(), test.data, test.length)) {
          Serial.printf("  SD write FAILED: %s\n", path.c_str());
        }
        free(test.data);
      }
      found = findWavFiles(names, MAX_SOUNDS);
    }
    size_t bytesUsed = 0;
    for (int i = 0; i < found; i++) {
      String path = String("/") + names[i];
      if (loadWav(path.c_str(), sounds[soundCount], bytesUsed)) soundCount = soundCount + 1;
    }
    fromCard = soundCount > 0;
  } else {
    Serial.println("No SD card found (FAT32 cards work)");
  }

  if (soundCount == 0) {
    for (int i = 0; i < 3; i++) {
      if (makeTestSound(i, sounds[soundCount])) soundCount = soundCount + 1;
    }
  }
  ready = true;
  list();
}

// number is 0 for the first sound, or STOP_ALL. Safe to call from any task.
inline void trigger(int number, bool loop = false) {
  Request request = {number, loop};
  xQueueSend(requests, &request, 0);
}

// Audio task only, once per block: acts on trigger() requests.
inline void update() {
  if (!ready) {
    for (Voice& voice : voices) voice.sound = -1;
    activeVoices = 0;
    return;
  }

  Request request;
  while (xQueueReceive(requests, &request, 0) == pdTRUE) {
    if (request.sound == STOP_ALL) {
      for (Voice& voice : voices) voice.sound = -1;
    } else if (request.sound >= 0 && request.sound < soundCount) {
      Voice* chosen = &voices[0];  // if all are busy, replace the first
      for (Voice& voice : voices) {
        if (voice.sound < 0) {
          chosen = &voice;
          break;
        }
      }
      chosen->sound = request.sound;
      chosen->position = 0;
      chosen->loop = request.loop;
    }
  }
}

// Audio task only: adds the playing sounds into out[BLOCK_SIZE].
inline void mix(float* out, float level) {
  if (!ready) return;
  int active = 0;
  for (Voice& voice : voices) {
    if (voice.sound < 0 || voice.sound >= soundCount) continue;
    const Sound& sound = sounds[voice.sound];
    uint64_t step = ((uint64_t)sound.rate << 32) / scm::SAMPLE_RATE;
    for (size_t i = 0; i < scm::BLOCK_SIZE; i++) {
      size_t index = voice.position >> 32;
      if (index >= sound.length) {
        if (!voice.loop) {
          voice.sound = -1;
          break;
        }
        voice.position = 0;
        index = 0;
      }
      float fraction = (uint32_t)voice.position / 4294967296.0f;
      float a = sound.data[index];
      float b = index + 1 < sound.length ? sound.data[index + 1] : 0.0f;
      out[i] += (a + (b - a) * fraction) / 32768.0f * level;
      voice.position += step;
    }
    if (voice.sound >= 0) active++;
  }
  activeVoices = active;
}

}  // namespace bank
