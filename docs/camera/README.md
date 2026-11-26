# Phone camera page

A web page that uses a phone's camera as a sensor. It follows **printed paper tags** and **coloured card**, and sends only numbers: to a Smart Contact Mic board, to a program on a computer, or both. The picture never leaves the phone.

Open it at https://ed-devane.github.io/PlayfulSystems/camera/ (print tags at [`tags.html`](https://ed-devane.github.io/PlayfulSystems/camera/tags.html)).

## Using it

1. Tap **Start camera** and allow the camera.
2. Show it printed tags, or tap a coloured card in the picture to follow that colour. Up to 8 colours.
3. To send, type a **channel** and tap **Connect**. With a board, use the channel code it printed. Without one, make up your own (4 to 20 letters and numbers, hard to guess).
4. Switch on what should make sound on the board.

To open it on a phone with a QR code: `https://ed-devane.github.io/PlayfulSystems/phone/qr.html?p=camera&c=<channel>`. With a board plugged in, `tools/phone_qr.py --camera` does this.

### Getting good readings

- Good, even light. Tags: matt paper, white edge left on, big enough in the picture (about a tenth of its width or more is a safe start).
- Colours: strongly coloured, matt card against a plain background. Anything else of a similar colour is followed too. If the light changes, tap the card again to relearn it. **Colour tolerance** widens or narrows what counts.
- Hold the phone still on a stand for steady results.
- The picture is not mirrored. With the front camera or a webcam facing you, your left is the picture's right.

Tested with a simulated camera picture in a desktop browser (26/11/2026). **Not yet tried with a real camera or phone.**

## What it sends

Messages travel through the free public broker `broker.hivemq.com` (no guarantees, and anyone who knows the channel can read and send). Expect an occasional delay of a second or so.

| Topic | Contents |
|---|---|
| `playfulsystems/<channel>/cmd` | Messages to the board: `play 1`, `tone 440 0.5`, `stop` |
| `playfulsystems/<channel>/camera` | JSON of what is in view, sent when it changes |

```json
{"tags":[{"id":7,"x":0.42,"y":0.51,"size":0.12,"rot":-4}],
 "colours":[{"id":1,"x":0.8,"y":0.3,"size":0.03,"count":2}]}
```

`x` runs from 0 (left of the picture) to 1 (right), `y` from 0 (top) to 1 (bottom). `size` is the tag's width, or the area of the biggest card of that colour, as a fraction of the picture. `rot` is how far a tag is turned, in degrees. `count` is how many cards of that colour are in view. An empty list means nothing is in view.

## On a computer

`listen.py` prints the data as it arrives. Change its `on_camera()` function to drive sound, graphics, MIDI or anything else.

```
python -m pip install paho-mqtt
python listen.py <channel>
```

## Making your own version

Copy this whole folder into your project.

| File | Job |
|---|---|
| `mappings.js` | **Start here:** which messages the board gets |
| `index.html` | The page |
| `app.js` | Joins everything up |
| `scene.js` | What is in view, arriving and leaving |
| `link.js` | Sending and receiving |
| `vision/` | Reading tags and colours (from Soniphorm Centipede) |
| `vendor/js-aruco2/` | Third-party tag detector, MIT licence (see its `LICENSE.txt`) |

Phones only give the camera to `https` pages, or `localhost` on the computer itself. To try changes on a computer, run `python -m http.server` in this folder and open `http://localhost:8000`. To use your version on a phone, publish the folder at an `https` address, for example with GitHub Pages.

Tags are ArUco markers from the `DICT_5X5_1000` set, numbers 0 to 399.
