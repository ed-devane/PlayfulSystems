# Gate Walk: notes

A workshop example project. People walk around with their phones. Walking into a
"gate" (an area on the map) will trigger sound, video and a box.

The full draft design is `../installation-spec.md`. Where these notes differ from
it, these notes are newer.

## First milestone: see everyone on a map

- **Phone page** (the "walker" page): enter a name, see your own dot, send your position.
- **Computer map:** everyone's dot, how accurate each is, and who has stopped updating.
- **Practice mode** (`?sim=1`): drag a dot instead of using GPS.
- **Log:** every position saved to a CSV file.
- **Not yet:** gates, sound, video, box, camera tracking.

### Steps

1. A practice dot on the phone page shows up on the computer map.
2. Real phone GPS works through a secure (`cloudflared`) address, with a QR code
   and a "keep the screen on" lock.
3. Several phones walk outside; check accuracy and logs. Try at least one iPhone
   and one Android phone.

## Decisions

- **28 Nov 2026:** Track locations first. Triggering comes afterwards. Building
  starts in earnest on 29 Nov.
- **28 Nov 2026:** The boards will get **custom ESP-NOW firmware** (we write the
  sender and the receiver). ESP-NOW is not part of the Soniphorm patcher firmware,
  so this replaces what the spec says about reusing it. Uploading our firmware
  replaces the Soniphorm firmware on those boards.
- **28 Nov 2026:** Server in **Node**, so the server and the pages are both
  JavaScript. Map drawn with **Leaflet** and **OpenStreetMap** (needs internet).
- **Two separate addresses.** Port 8080 serves the walker page and is the only one
  to share through the tunnel. Port 8081 serves the map of everyone and only
  answers on this computer, so people with the phone link can't see where others are.
- **Position logs stay off GitHub** (`logs/` is ignored): they show where people walked.

## Hardware

- 3 x Soniphorm Smart Contact Mic boards, each on a USB power bank (for later).

## Files

```
server/            the program on the computer
  config.js          all settings in one place
  main.js            starts it
  app.js             the two web addresses and their live connections
  messages.js        checks what phones send
  people.js          who is where
  positionLog.js     writes the CSV
  staticFiles.js     serves the page files
  log.js             messages in the terminal
public/walker/     the page on participants' phones
public/map/        the map of everyone
public/shared/     parts both pages use
test/              automatic checks
logs/              position records (not on GitHub)
```

## Running it

Installed on Ed's computer: Node 22, cloudflared, PlatformIO
(`& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe"`).

From the `gate-walk` folder:

```
npm install                 (first time only)
node server/main.js         (Ctrl+C stops it)
node --test                 (automatic checks)
```

- Practice walker: http://localhost:8080/?sim=1 (each tab is another person)
- Map of everyone: http://localhost:8081

## Later

- The map starts at the spec's placeholder spot (55.0, -8.0). Change `mapStart` in
  `server/config.js` to the real site.
