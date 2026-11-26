# Soniphorm Smart Contact Mic

A small ESP32-S3 board for sound, designed by Ed Devane. It listens through a piezo (contact mic), plays to headphones, line out or a small speaker/exciter, reads and writes a microSD card, and has Wi-Fi and Bluetooth LE.

Things you can make with it: a contact mic amplifier or effect, a sampler triggered by taps, a sound player triggered over Wi-Fi (for example by camera tracking on a laptop), a resonating object using an exciter, a battery field recorder, or a sensor-controlled instrument using the expansion header.

## Instructions for Claude Code

- Read this whole file before writing code for this board.
- Pin numbers come from `include/pins.h` only. Don't invent pins.
- For audio, use `lib/scm/scm_audio.h`. Don't write new codec or I2S setup, and don't add `driver/i2s.h`, `ESP_I2S`, Mozzi or other audio libraries alongside it: they fight over the same hardware.
- Use the `platformio.ini` settings here. Don't change the platform version or the USB flags.
- Start from the closest example in `examples/`.
- Check the "What has been tested" table, and say so when you rely on something untested.

## Testing a board

The sketch `examples/00_test_modes` contains every test. Upload it from this folder:

```
pio run -e 00_test_modes -t upload
```

(`pio` is often not on the PATH: see the project `CLAUDE.md` for the full path.)

Then switch tests in any of three ways:

1. Ask Claude Code, for example "try mode 1". Claude runs `tools/scm.py` with PlatformIO's Python:
   - Windows: `& "$env:USERPROFILE\.platformio\penv\Scripts\python.exe" tools/scm.py 1`
   - Mac: `~/.platformio/penv/bin/python tools/scm.py 1`
2. Type the number in the serial monitor and press Enter (`pio device monitor`, in a second window).
3. Press the MODE button to step through the modes (no computer needed).

The serial monitor and `tools/scm.py` can't both use the board at once. Close the monitor (`Ctrl+C`) first.

| Mode | What it does | What it proves | What you need |
|---|---|---|---|
| 0 | Silent | | |
| 1 | Piezo to headphones/line | Piezo, preamp, codec, DAC | Piezo, headphones |
| 2 | 440 Hz sine, piezo not used | Output path on its own | Headphones |
| 3 | Plays a WAV file from the SD card, looping | SD card and playback | SD card |
| 4 | Piezo to speaker/exciter | Amplifier | Piezo, speaker or exciter |
| 5 | Sounds and tones sent over Wi-Fi | Wi-Fi, SD, amplifier | Speaker or exciter |
| 6 | Tap the piezo to play a sound | Triggering from the piezo | Piezo, headphones |
| 7 | Sweep from 50 Hz to 5 kHz | Finding an object's resonances | Speaker or exciter |
| 8 | Level meter in the serial output | Input level and clipping | Piezo |
| 9 | Records 5 s, plays it back, saves `/recording.wav` | Input, memory, SD writing | Piezo, headphones |

Other commands: `speaker` (amp on/off), `vol 0.5` (0 to 2), `list`, `play 2`, `stop`, `reload` (after changing the SD card), `check` (board report), `status`, `wifi`, `help`. For mode 5, give `tools/scm.py` longer to listen: `--wait 20`.

The speaker amp is on by itself only in modes 4 and 5. In other modes, type `speaker` to hear them through the speaker.

The board remembers the last mode after a reset (mode 4 comes back as mode 1, for safety).

### Sounds on the SD card

- Format the card as FAT32. Put WAV files in the top level (not in folders).
- 16 or 24 bit PCM, mono or stereo, any sample rate. Stereo is mixed to mono.
- The first 8 files in alphabetical order are used. Naming them `01_...`, `02_...` sets the numbers.
- They are loaded into memory at start-up: about 60 seconds of 48 kHz sound in total.
- A card with no WAV files gets three test sounds written to it.
- With no card, three built-in sounds are used and the output says "BUILT IN". That tests playback, not the SD card.

## Connecting to Wi-Fi

The board stores one network. It is typed into the serial monitor and kept on the board, so it survives new uploads and never appears in code or git.

### Steps (for Claude Code to walk the person through)

**Never ask for the Wi-Fi password in the chat, and never put it in a file.**

1. Upload a sketch that has the `wifi` command (`00_test_modes` does).
2. Ask the person to open a **second** terminal window, go to this folder and run `pio device monitor` (give them the full `pio` path).
3. They type `wifi` and press Enter, then the network name, then the password. Capitals matter.
4. In `00_test_modes`, they type `5`. The board prints either `Joined. Board address: ...` or why it failed.
5. They close the monitor with `Ctrl+C`. Only then can you upload or use `tools/scm.py`.
6. Check with `tools/scm.py --wait 3 status`.

| The board says | Meaning |
|---|---|
| `No 2.4 GHz network called "..." found` | Wrong name, out of range, or a 5 GHz only network |
| `"..." is in range, so check the password` | Probably a typo in the password |
| `Making the board's own network instead` | It could not join. Its own network has no internet |

- 2.4 GHz only. On an iPhone hotspot, turn on "Maximize Compatibility".
- Networks with a sign-in web page or a username (many universities) won't work.
- Moving to another place means entering the new network again, on each board.
- Some public networks stop devices seeing each other, or block the phone link. A phone hotspot avoids that.
- `wifi clear` forgets the network.

### Wi-Fi in your own sketch

`lib/scm/scm_wifi.h` and `lib/scm/scm_serial.h` do all of the above:

```cpp
#include "scm_serial.h"
#include "scm_wifi.h"

scm::SerialLines lines;
scm::WifiSetup wifiSetup;

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  scm::joinSavedNetwork();      // waits up to 15 s and explains any failure
}

void loop() {
  String line;
  while (lines.read(line)) {
    if (wifiSetup.handle(line) == scm::WifiSetup::Saved) scm::joinSavedNetwork();
  }
}
```

## Mode 5: sounds and tones over Wi-Fi

The same text messages work from a web page, UDP or a phone:

| Message | Does |
|---|---|
| `play 2` (or `2`) | Plays sound 2 |
| `tone 440 0.5` | Tone at 440 Hz, level 0 to 1. Fades out after 1 second unless sent again |
| `stop` | Silence |

New messages are added in `runMessage()` in `wifi_control.h`.

**From a phone** (any internet connection, including mobile data):

1. Put the board in mode 5. It prints a **channel code** and an address.
2. Open https://ed-devane.github.io/PlayfulSystems/phone/ on the phone, type the code, tap **Connect**, and allow movement access if asked.
3. Try the sound buttons, then switch on tilt, shake or turn.

The route is: phone page, secure WebSocket, a free public MQTT broker (`broker.hivemq.com`), board. The broker has no guarantees, and anyone who knows a channel code can send to that board. Phones only give movement data to `https` pages, which is why the page can't be served by the board itself.

The page's source is `docs/phone/index.html` in the Playful Systems repository: one file, with the movement-to-message mappings near the top. To make your own version, copy it into a project and publish it at an `https` address (for example GitHub Pages).

**From a laptop on the same network:**

- Browser: `http://<address>/` shows a button for each sound.
- Web request: `http://<address>/play?n=2` or `/stop`. A page served from your own computer (`localhost`) can call this. A page on an `https` website can't.
- UDP to port 9000, plain text. This suits Python, Max, Pure Data and TouchDesigner.

```python
import socket
board = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
board.sendto(b"play 2", ("192.168.1.50", 9000))  # use your board's address
```

For camera tracking: the laptop does the tracking and sends a message **once when something changes** (for example, when a hand enters an area), not on every video frame.

Without a saved network the board makes its own, named `scm-xxxx`, password `playful-systems`. **A laptop joined to it loses its internet connection, so Claude Code stops working.**

## Hardware

| Part | Detail |
|---|---|
| Processor | ESP32-S3-WROOM-1-N16R8: 2 cores, 16 MB flash, 8 MB OPI PSRAM |
| Piezo input | Two-leg input into a TLV9064 preamp (fixed gain, about 33x), then an ES8311 codec |
| Output | PCM5102A stereo DAC, to a 3.5 mm jack |
| Speaker/exciter | NS4150 class D amplifier, 3.3 V supply |
| Storage | microSD, SPI mode |
| Controls | MODE, BOOT and RESET buttons |
| Lights | A green power light only. There is no LED your code can control. |
| USB | USB-C, connected directly to the ESP32-S3 |

Some boards have been fitted with a mini-jack for the piezo in place of the spring terminal.

### Pins

| GPIO | Use | Notes |
|---|---|---|
| 15 | I2S bit clock | Shared by codec and DAC |
| 17 | I2S left/right clock | Shared |
| 16 | I2S master clock | Codec |
| 18 | I2S data out | To the DAC |
| 8 | I2S data in | From the codec |
| 6 | Speaker amp enable | HIGH = on |
| 1 | I2C SDA | Codec (0x18) and header. Pull-ups fitted |
| 2 | I2C SCL | |
| 9 | SD clock | |
| 10 | SD MOSI | |
| 11 | SD MISO | |
| 12 | SD chip select | |
| 47 | MODE button | LOW when pressed. Pull-up fitted |
| 0 | BOOT button | Used for uploading |
| 4 | Header spare pin | Analog in, touch or digital |
| 5 | Header spare pin | Analog in, touch or digital |
| 19, 20 | USB | Don't use |
| 26 to 37 | Flash and PSRAM | Never use |
| 46 | Start-up (strapping) pin | Don't use |

### Expansion header (8 pin)

| Header pin | Signal |
|---|---|
| 1 | GND |
| 2 | 3V3 |
| 3 | SDA (GPIO1) |
| 4 | SCL (GPIO2) |
| 5 | GPIO4 |
| 6 | GPIO5 |
| 7 | Marked as LED data out. **Treat as not connected** (the schematic shows no link to the processor) |
| 8 | GND |

Check which end is pin 1 before wiring. Header signals are 3.3 V only: never connect 5 V to them.

## Audio

```cpp
#include "scm_audio.h"

scm::beginAudio();               // once, in setup()
scm::readPiezo(mono);            // float mono[scm::BLOCK_SIZE]
scm::writeAudio(left, right);    // two float arrays of BLOCK_SIZE
scm::setSpeaker(true);           // amp on
```

- 48 kHz, blocks of 64 samples (1.33 ms), floats from -1 to 1.
- The loop that handles audio must not use `delay()`, access the SD card or do network work. Either keep those out of it, or run audio in its own task as `00_test_modes` does.
- **The speaker/exciter amp takes the right channel only.** The jack has both.
- The speaker output is bridged: connect the two speaker terminals only to a speaker or exciter. Never connect either one to ground or to another device's input.
- Start quiet. Limit speaker signals to about 0.7 to protect small exciters.
- A piezo and exciter on the same object will feed back.
- Headphones plug into a line level output, so they play but are not very loud.

### Piezo levels

The codec only reaches about 8% of its digital range on this board, and sits at a constant offset. `readPiezo()` removes the offset and scales by 12, so normal signals read about -0.6 to 0.6. `scm::piezoClipped` is true when the input is overloaded. Hard hits clip.

- Don't raise the codec's analog gain (register 0x14) to get more level: above about 6 dB the input saturates. Multiply in your code instead.
- To measure how hard something was hit, average the level over about 6 ms after the start of the hit. The first peak alone is a poor measure because hard hits clip it.

## SD card

```cpp
#include <SPI.h>
#include <SD.h>
SPI.begin(SCM_PIN_SD_SCK, SCM_PIN_SD_MISO, SCM_PIN_SD_MOSI, SCM_PIN_SD_CS);
SD.begin(SCM_PIN_SD_CS, SPI, 20000000);   // try 10000000 if a card gives errors
```

Cards can pause for a long time while writing. Record into PSRAM (`ps_malloc`) and save afterwards.

## Other limits

- The ESP32-S3 has no analog output pins (`dacWrite` does not exist).
- It has Bluetooth LE only. Bluetooth speaker/headphone libraries (A2DP) do not work.
- Call `Serial.setTxTimeoutMs(0)` after `Serial.begin`, or printing can stall audio when no computer is listening.
- USB MIDI needs different USB settings, which changes how uploading works. Not covered here.

## Uploading

**The first upload to a board that has the Soniphorm firmware on it:**

1. Hold **BOOT**, press and release **RESET**, then release **BOOT**.
2. Upload.
3. Press **RESET** (or unplug and replug) to start the new code.

Later uploads should work without buttons. If one fails, do the same three steps.

Uploading your own code replaces the Soniphorm firmware that runs the visual patcher. Ask Ed if you want it back.

The first build downloads several gigabytes of tools and can take 20 minutes or more. Do it before the workshop, on a good connection.

## Power

- USB-C (laptop or power bank).
- Or a battery on the 2-pin connector, 4 to 12 V. **Check the polarity before plugging in.** The board does not charge batteries.

## Starting your own project

Copy `platformio.ini`, `include/` and `lib/` into the new project folder. In `platformio.ini`, delete the `[platformio]` section and all the `[env:...]` sections below `[env]`, then add:

```ini
[env:scm]
```

Put your code in `src/main.cpp`. For sound file playback, copy `sound_bank.h` from `examples/00_test_modes/` into `src/`. For mode 5 style messages, also copy `wifi_control.h` and `phone_link.h`. Wi-Fi joining is already in `lib/`.

## Examples

| Folder | Shows |
|---|---|
| `00_test_modes` | All tests in one sketch |
| `01_board_check` | Report on flash, memory, codec, SD, button |
| `02_tone_out` | Making sound |
| `03_piezo_meter` | Reading the piezo, detecting taps |
| `04_passthrough` | Processing live input |
| `05_record_play` | Recording to memory, saving a WAV |
| `06_header_pots` | Knobs on the expansion header |

## What has been tested

| Item | Status |
|---|---|
| Pin map | Taken from the board schematic and the firmware that runs on the board |
| Codec settings | Copied from firmware that runs on the board |
| `00_test_modes` board check, serial commands | Works on one board (26/11/2026, Windows) |
| `00_test_modes` modes 1, 2, 3 and 4, speaker amp | Heard working on one board (26/11/2026) |
| Mode 5: joining a network, web page buttons, UDP messages | Works on one board (26/11/2026) |
| Phone link and `tone` message | **Not yet tested** |
| `00_test_modes` modes 6 to 9 | **Not yet tested** |
| Upload without buttons (after the first upload) | Works (26/11/2026, Windows) |
| Examples `01` to `06` | Build, **not yet run on a board** |
| Building on a Mac | Not tested |
| Battery power with these sketches | Not tested |
| Header pin 7 | Not verified. Treat as not connected |
