// Audio for the Soniphorm Smart Contact Mic: piezo in, headphone/line/speaker out.
//
//   scm::beginAudio();              // once, in setup()
//   scm::readPiezo(mono);           // waits for the next 64 samples from the piezo
//   scm::writeAudio(left, right);   // sends 64 samples to the outputs
//   scm::setSpeaker(true);          // speaker/exciter amp on (it is off at start)
//
// 48 kHz. Samples are floats from -1.0 to 1.0. One block lasts 1.33 ms, so
// code between reads and writes must be quick: no delay(), no SD card access.
//
// The codec register values are taken from firmware that runs on this board.
// Change them only with the ES8311 datasheet to hand.
#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <driver/i2s_std.h>
#include "pins.h"

namespace scm {

constexpr uint32_t SAMPLE_RATE = 48000;
constexpr size_t   BLOCK_SIZE  = 64;

// The ES8311 only reaches about +/-0.083 of its digital range on this board, so
// raw samples are scaled up by 12 to make that limit roughly 1.0.
constexpr float PIEZO_SCALE = 12.0f;
constexpr float RAW_LIMIT   = 0.083f;

inline i2s_chan_handle_t txChannel = nullptr;
inline i2s_chan_handle_t rxChannel = nullptr;

// True if the last block read by readPiezo() hit the converter's limit.
inline bool piezoClipped = false;

inline void setSpeaker(bool on) {
  pinMode(SCM_PIN_AMP_ENABLE, OUTPUT);
  digitalWrite(SCM_PIN_AMP_ENABLE, on ? HIGH : LOW);
}

inline bool codecWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(SCM_ES8311_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

inline int codecRead(uint8_t reg) {
  Wire.beginTransmission(SCM_ES8311_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission() != 0) return -1;
  if (Wire.requestFrom(SCM_ES8311_ADDR, 1) != 1) return -1;
  return Wire.read();
}

// Sets up the ES8311 for 48 kHz, microphone input, MCLK = 256 x sample rate.
inline bool beginCodec() {
  Wire.begin(SCM_PIN_I2C_SDA, SCM_PIN_I2C_SCL);
  Wire.setClock(100000);
  delay(10);

  codecWrite(0x44, 0x08);  // I2C noise immunity (the very first write can fail)
  codecWrite(0x00, 0x1F);  // reset
  delay(20);

  // Clocks (codec is the I2S follower)
  codecWrite(0x01, 0x3F);
  codecWrite(0x02, 0x00);
  codecWrite(0x03, 0x10);
  codecWrite(0x04, 0x10);
  codecWrite(0x05, 0x00);

  // Analog power
  codecWrite(0x0B, 0x00);
  codecWrite(0x0C, 0x00);
  codecWrite(0x10, 0x1F);
  codecWrite(0x11, 0x7F);

  codecWrite(0x00, 0x80);  // start the codec (without this there is no input)
  delay(10);

  codecWrite(0x06, 0x03);
  codecWrite(0x07, 0x00);
  codecWrite(0x08, 0xFF);

  // Serial audio format
  codecWrite(0x09, 0x10);
  codecWrite(0x0A, 0x00);  // 24-bit output in a 32-bit slot

  // ADC (piezo input)
  codecWrite(0x17, 0xBF);  // ADC digital volume
  codecWrite(0x0E, 0x02);
  codecWrite(0x12, 0x00);
  codecWrite(0x14, 0x10);  // mic input, analog gain 0 dB (leave it there, see BOARD.md)
  codecWrite(0x0D, 0x01);
  codecWrite(0x15, 0x40);
  codecWrite(0x16, 0x00);  // extra digital gain off

  // The codec's own DAC is not wired to anything, but is set up as in the
  // tested firmware.
  codecWrite(0x31, 0x70);
  codecWrite(0x32, 0x00);
  codecWrite(0x33, 0x00);
  codecWrite(0x37, 0x48);
  codecWrite(0x45, 0x00);

  return codecRead(0xFD) == 0x83;  // chip ID
}

inline bool beginI2S() {
  i2s_chan_config_t channelConfig = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
  channelConfig.dma_desc_num = 6;
  channelConfig.dma_frame_num = BLOCK_SIZE;
  channelConfig.auto_clear = true;  // send silence if the code falls behind
  if (i2s_new_channel(&channelConfig, &txChannel, &rxChannel) != ESP_OK) return false;

  i2s_std_config_t config = {
    .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
    .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO),
    .gpio_cfg = {
      .mclk = (gpio_num_t)SCM_PIN_I2S_MCLK,
      .bclk = (gpio_num_t)SCM_PIN_I2S_BCLK,
      .ws   = (gpio_num_t)SCM_PIN_I2S_LRCK,
      .dout = (gpio_num_t)SCM_PIN_I2S_DOUT,
      .din  = (gpio_num_t)SCM_PIN_I2S_DIN,
      .invert_flags = {},
    },
  };

  if (i2s_channel_init_std_mode(txChannel, &config) != ESP_OK) return false;
  if (i2s_channel_init_std_mode(rxChannel, &config) != ESP_OK) return false;
  if (i2s_channel_enable(txChannel) != ESP_OK) return false;
  return i2s_channel_enable(rxChannel) == ESP_OK;
}

// Fills mono[BLOCK_SIZE] with piezo samples, with the constant (DC) offset removed.
inline bool readPiezo(float* mono) {
  static float lastIn = 0.0f;
  static float lastOut = 0.0f;

  int32_t raw[BLOCK_SIZE * 2];  // left, right, left, right...
  size_t bytesRead = 0;
  if (i2s_channel_read(rxChannel, raw, sizeof(raw), &bytesRead, 1000) != ESP_OK ||
      bytesRead != sizeof(raw)) {
    memset(mono, 0, BLOCK_SIZE * sizeof(float));
    return false;
  }

  piezoClipped = false;
  for (size_t i = 0; i < BLOCK_SIZE; i++) {
    float sample = raw[i * 2] / 2147483648.0f;  // the piezo is on the left slot
    if (fabsf(sample) >= RAW_LIMIT) piezoClipped = true;
    float in = sample * PIEZO_SCALE;
    lastOut = in - lastIn + 0.998f * lastOut;  // DC blocking filter, about 15 Hz
    lastIn = in;
    mono[i] = lastOut;
  }
  return true;
}

// left  -> headphone/line left
// right -> headphone/line right AND the speaker/exciter amp
inline bool writeAudio(const float* left, const float* right) {
  int32_t raw[BLOCK_SIZE * 2];
  for (size_t i = 0; i < BLOCK_SIZE; i++) {
    raw[i * 2]     = (int32_t)(constrain(left[i],  -1.0f, 1.0f) * 2147480000.0f);
    raw[i * 2 + 1] = (int32_t)(constrain(right[i], -1.0f, 1.0f) * 2147480000.0f);
  }
  size_t bytesWritten = 0;
  return i2s_channel_write(txChannel, raw, sizeof(raw), &bytesWritten, 1000) == ESP_OK;
}

// Speaker off, codec set up, audio bus running. Throws away the first moment of
// input while the codec and filter settle.
inline bool beginAudio() {
  setSpeaker(false);
  bool codecOk = beginCodec();
  if (!codecOk) Serial.println("ERROR: ES8311 codec not found on I2C");
  if (!beginI2S()) {
    Serial.println("ERROR: I2S audio failed to start");
    return false;
  }
  float discard[BLOCK_SIZE];
  for (int i = 0; i < 200; i++) readPiezo(discard);
  return codecOk;
}

}  // namespace scm
