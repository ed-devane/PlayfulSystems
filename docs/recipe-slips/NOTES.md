# Recipe Slips: notes

## The concept

During the morning circle, keywords go up on post-its on a white projection screen and
cluster into categories. One phone photo of the screen becomes a table (one column per
category). Ed checks it with the room, the app draws one word per column for each
participant, and prints a "recipe slip" each on a small thermal printer.

It's also a live demo of vibe coding, so the code stays simple and readable.

In-room steps: take photo, glance at table, fix misreads, press print.

## Hardware and technology

- Android phone, Chrome. Expect 9 to 10 participants.
- **PeriPage A6** thermal printer: 384 dots wide (48 mm printed), 203 dpi, no cutter.
  - Classic Bluetooth (serial port profile), **not** Bluetooth Low Energy.
  - The page talks to it with **Web Serial**. It must be paired in Android settings first.
  - It prints pictures, so each slip is drawn as a black and white image.
  - Slips read **lengthways** (turned 90 degrees) so the lettering can be larger. One is
    about 48 mm by 13 to 15 cm and takes about 12 seconds, so nine take about 2 minutes.
    Sizes are in `js/config.js` under `SLIP_STYLE`. This replaces the spec's
    32-characters-per-line upright layout.
  - Protocol bytes as in Centipede's `src/modules/paperTags/tagSheet.js` and FilmScore's
    `helper/peripage.py` (originally from bitrate16/peripage-python).
- Static site on GitHub Pages: https://ed-devane.github.io/PlayfulSystems/recipe-slips/
- Plain HTML, CSS and JavaScript. No build step, framework, backend or database.
- Handwriting is read by a vision model through OpenRouter (default
  `anthropic/claude-opus-5.5`, changeable in Settings). The key is typed into the app and
  stored in the phone's browser only. Use a key with a low spending limit: any page on
  ed-devane.github.io shares that browser storage.
- QR code for the phone: https://ed-devane.github.io/PlayfulSystems/recipe-slips/qr.html

## Decisions

- Lives in `docs/recipe-slips/` of the PlayfulSystems repo, so Pages serves it.
- The spec asked for BLE and ESC/POS text. Changed to the PeriPage picture protocol
  because that's the printer being used.
- Participants' names are typed into the app and never put in this public repo.
- **In the room: underline each heading note.** The model is told an underlined note is a
  heading; colour and position are the fallbacks.
- "Fake printer" shows the exact picture that would be printed. Long-press it to save
  it, which is also a fallback: print the saved image from the PeriPage app.
- The "Partner" line prints only when pairs are on; a group of three lists both others.

## Folder structure

```
index.html            the app page
styles.css            how it looks
tests.html            open in a browser to run the tests
js/config.js          settings and numbers to change (defaults, timings, sizes)
js/main.js            starts the app and switches between screens
js/log.js             messages and errors shown on screen
js/storage.js         saving on the phone
js/table/             the table: data, CSV, on-screen editor
js/names/             the list of participants
js/draw/              the random draw, pairs and the draw screen
js/slips/             slip wording and layout, drawing it as a picture
js/printer/           talking to the PeriPage
js/photo/             shrinking the photo, the question for the model, reading its answer
js/settingsView.js    the settings screen
tests/                the tests themselves
qr.html               QR code to open the app on a phone
```

## Build order

Photo reading (4) was moved ahead of 2 and 3, because avoiding typing matters most.
Steps 1 to 4 are built. Step 5 is whatever the phone tests show needs polishing.

1. Page, review table, CSV, autosave (typed input only), plus an early test print
2. Names, draw, pairs, fake printer preview
3. Printing slips (print all, print one)
4. Reading the photo through OpenRouter
5. Polish for phone use

## To check on the phone

- [x] Page loads on GitHub Pages in Chrome on Android (2026-11-27)
- [x] Connect printer and test print work (2026-11-27, so Web Serial to the PeriPage works on the phone)
- [ ] Photo of handwritten notes reads into a sensible table
  - [x] First try (2026-11-27): two handwritten words were read correctly on the phone
  - [x] With headings underlined, every word was read correctly (2026-11-27)
  - [ ] Several clusters with coloured notes, on the projection screen
- [ ] Test print in the new lengthways layout
- [ ] Full run: photo, table, names, draw, print all
