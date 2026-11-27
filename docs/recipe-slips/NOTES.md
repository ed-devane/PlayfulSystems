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
  - Protocol bytes as in Centipede's `src/modules/paperTags/tagSheet.js` and FilmScore's
    `helper/peripage.py` (originally from bitrate16/peripage-python).
- Static site on GitHub Pages: https://ed-devane.github.io/PlayfulSystems/recipe-slips/
- Plain HTML, CSS and JavaScript. No build step, framework, backend or database.
- Step 4: handwriting is read by a vision model through OpenRouter. The key is typed
  into the app and stored on the phone only.

## Decisions

- Lives in `docs/recipe-slips/` of the PlayfulSystems repo, so Pages serves it.
- The spec asked for BLE and ESC/POS text. Changed to the PeriPage picture protocol
  because that's the printer being used. Slips are still 32 characters wide.
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
js/slips/             slip wording and layout, drawing it as a picture
js/printer/           talking to the PeriPage
js/settingsView.js    the settings screen
tests/                the tests themselves
```

## Build order

1. Page, review table, CSV, autosave (typed input only), plus an early test print
2. Names, draw, pairs, fake printer preview
3. Printing slips (print all, print one)
4. Reading the photo through OpenRouter
5. Polish for phone use

## To check on the phone

- [ ] Page loads on GitHub Pages in Chrome on Android
- [ ] Connect printer and test print work
- [ ] Photo of handwritten notes reads into a sensible table (after step 4)
- [ ] Full run: photo, table, names, draw, print all (after step 5)
