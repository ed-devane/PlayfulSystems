// Soniphorm Smart Contact Mic: every pin on the board.
// This is the only file where pin numbers are written down. Source: board schematic.
#pragma once

// Audio bus (I2S), shared by the mic codec and the output DAC
#define SCM_PIN_I2S_MCLK   16   // master clock to the ES8311 codec
#define SCM_PIN_I2S_BCLK   15   // bit clock
#define SCM_PIN_I2S_LRCK   17   // left/right (word) clock
#define SCM_PIN_I2S_DOUT   18   // ESP32 -> PCM5102A DAC (headphones, line out, speaker)
#define SCM_PIN_I2S_DIN     8   // ES8311 codec (piezo) -> ESP32

// Speaker / exciter amplifier (NS4150): HIGH = on, LOW = off
#define SCM_PIN_AMP_ENABLE  6

// I2C bus (codec settings, plus anything on the expansion header). Pull-ups fitted.
#define SCM_PIN_I2C_SDA     1
#define SCM_PIN_I2C_SCL     2

// microSD card (SPI mode)
#define SCM_PIN_SD_SCK      9
#define SCM_PIN_SD_MOSI    10
#define SCM_PIN_SD_MISO    11
#define SCM_PIN_SD_CS      12

// MODE button: pressed = LOW, pull-up resistor fitted on the board
#define SCM_PIN_MODE_BTN   47

// Expansion header spare pins (analog in, touch, or digital in/out). 3.3 V only.
#define SCM_PIN_HEADER_IO1  4
#define SCM_PIN_HEADER_IO2  5

// I2C address of the codec
#define SCM_ES8311_ADDR   0x18
