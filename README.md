# Playful Systems: Getting Claude Code Running

This gets you set up with Claude Code for the workshop. You'll get your own OpenRouter key by email. Keep it to yourself and don't paste it anywhere public.

If you can, do steps 1, 2 and 9 before the workshop. They involve downloads that can take a while.

## 1. Install Git

Git keeps a history of every version of your work. Claude Code needs it.

**Mac:** open **Terminal** and type:

```bash
git --version
```

If you see a version number, you already have it. If a box pops up offering to install "command line developer tools", click **Install** and wait for it to finish (it can take 10 minutes or so). This also installs Python, which PlatformIO needs later.

**Windows:** install [Git for Windows](https://git-scm.com/downloads/win) and keep all the default options.

## 2. Install Claude Code

**Mac:** in **Terminal**, paste:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows:** open **PowerShell** (no need for Administrator) and paste:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Check it worked by typing:

```
claude --version
```

You should see a version number. If you get "command not found", close the window, open a new one, and try again.

## 3. Make a folder to work in

**Mac:**

```bash
mkdir ~/playful-systems
cd ~/playful-systems
```

**Windows:**

```powershell
mkdir ~\playful-systems
cd ~\playful-systems
```

## 4. Connect to OpenRouter with your key

**First time only:** download the key file for your computer from this repo, `openrouter-key-windows.txt` or `openrouter-key-mac.txt`. Open it, replace `your-key-here` with the key Ed emailed you (keep the quote marks), and save it on your **Desktop**. Don't put it in your project folder, so it never ends up on GitHub.

**Every time you open a new window:** open the key file, copy the three lines, and paste them into the window. For reference, they look like this:

**Mac (Terminal):**

```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="your-key-here"
export ANTHROPIC_API_KEY=""
```

**Windows (PowerShell):**

```powershell
$env:ANTHROPIC_BASE_URL = "https://openrouter.ai/api"
$env:ANTHROPIC_AUTH_TOKEN = "your-key-here"
$env:ANTHROPIC_API_KEY = ""
```

The third line is meant to be empty. Copy it exactly as it is.

These settings only last until you close the window. If you open a new window, paste the three lines again.

## 5. Start Claude Code

```
claude
```

Go through the welcome screens (text style and so on). **If it asks you to log in, stop and put your hand up.** That means your key isn't being picked up.

## 6. Check you're connected

Inside Claude Code, type:

```
/status
```

It should show `https://openrouter.ai/api` as the base URL. If it does, you're ready.

## 7. Set up GitHub

GitHub keeps a copy of your work online, so you can always go back to an earlier version.

1. **Make an account** at [github.com](https://github.com) if you don't have one.
2. **Install the GitHub command-line tool** from [cli.github.com](https://cli.github.com). This lets Claude Code create repositories and push for you.
3. **Log in:** close and reopen your Terminal or PowerShell window so it finds the new tool, then type `gh auth login` and follow the prompts. Choose GitHub.com, then HTTPS, then "Login with a web browser".

Reopening the window clears your key settings, so `cd` back into your folder and paste the three lines from step 4 again before starting `claude`.

Then, inside Claude Code, just ask:

> Set up this folder as a git repository and create a private GitHub repo for it.

## 8. Add the project notes file

Copy `CLAUDE.md` from this repo into your own project folder. Claude Code reads that file automatically at the start of every session. It tells Claude to:

- keep `NOTES.md` up to date with things that matter but aren't code, like the components you're using, wiring, ideas and decisions
- keep a `CHANGELOG.md` of what changed in each version
- commit and push to GitHub each time something works
- keep your key and other private files out of GitHub
- use PlatformIO for Arduino-style boards (see step 9)

That way you don't have to re-explain your project every time you start a new session. You can edit `CLAUDE.md` to add anything else you want Claude to always know.

## 9. Arduino boards with PlatformIO (if you're using a microcontroller)

PlatformIO is the tool Claude Code uses to build your code and upload it to your board. You install it once through VS Code, a free code editor. After that you don't need to use VS Code at all; Claude Code does the work.

### Install it (Mac and Windows)

1. **Mac only:** make sure you've done step 1 first. PlatformIO needs the Python that comes with it.
2. Install **VS Code** from [code.visualstudio.com](https://code.visualstudio.com) and open it.
3. Click the **Extensions** icon on the left (four little squares), or press `Ctrl+Shift+X` (Windows) / `Cmd+Shift+X` (Mac).
4. Search for **PlatformIO IDE** and click **Install**.
5. **Wait.** It downloads its own tools in the background, which takes a few minutes. Watch the bottom-right corner. When it says it's finished, or asks you to reload, click **Reload**. An ant-head icon appears in the left-hand bar when it's done.
6. Close VS Code.

### Check it worked

Open a **new** Terminal or PowerShell window and paste:

**Mac:**

```bash
~/.platformio/penv/bin/pio --version
```

**Windows:**

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" --version
```

You should see something like `PlatformIO Core, version 6.x`. If you get an error, open VS Code again and check the extension finished installing.

You don't need to change any system settings. `CLAUDE.md` tells Claude Code where to find PlatformIO.

### Using it

Plug your board in with a USB cable, start Claude Code, and ask something like:

> I've got an Arduino Uno. Make a PlatformIO project that blinks the built-in LED, and upload it.

Claude Code creates the project, builds it and uploads it. **The first build is slow** (several minutes) because PlatformIO downloads the tools for your board. After that it's quick.

### Watching the serial monitor

The serial monitor shows messages your board sends back, such as sensor readings. Open a **second** Terminal or PowerShell window, `cd` into your project folder, and paste:

**Mac:**

```bash
~/.platformio/penv/bin/pio device monitor
```

**Windows:**

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor
```

Press `Ctrl+C` to close it.

**Close the serial monitor before each upload.** Only one program can use the USB port at a time. If an upload fails with "port busy" or "access denied", this is almost always why.

### If your board doesn't show up

- **Try another USB cable.** Lots of cables only charge and can't carry data. This is the most common problem.
- Try another USB port, and unplug and replug the board.
- Some cheaper boards (many Nano and ESP32 clones) need a USB driver. The chip is usually printed on the board near the USB socket: **CH340** ([how to install the driver](https://learn.sparkfun.com/tutorials/how-to-install-ch340-drivers), Mac and Windows) or **CP2102** ([driver](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers)). Ask Ed if you're not sure.

## 10. The Smart Contact Mic board (optional)

If you're using one of Ed's Smart Contact Mic boards, you've already done the setup in steps 1 to 9. Copy `CLAUDE.md` into your project folder (step 8), start Claude Code, and ask:

> Get the Smart Contact Mic board folder, read BOARD.md, and upload the test sketch.

Then try things like:

> Try mode 1.

> Check the board and tell me if anything fails.

> Help me connect the board to Wi-Fi.

> Make me a QR code so I can control the board from my phone.

> Using mode 5 as a starting point, trigger sounds from my webcam when my hand moves to the left or right.

To play the board from your phone, put it in mode 5 and open the [phone remote](https://ed-devane.github.io/PlayfulSystems/phone/).

There is also a [camera sensor](docs/camera/README.md) you can plug into your own projects, with or without the board. It follows paper tags and coloured card, using a [phone](https://ed-devane.github.io/PlayfulSystems/camera/) or a webcam.

Details of the board and all the test modes are in [`boards/soniphorm-smart-contact-mic/BOARD.md`](boards/soniphorm-smart-contact-mic/BOARD.md). The first build downloads several gigabytes, so do it before the workshop if you can.

## Useful commands

| Command | What it does |
|---|---|
| `/status` | Shows what Claude Code is connected to |
| `/cost` | Rough estimate of what this session has cost |
| `/clear` | Starts a fresh conversation (also keeps costs down) |
| `/exit` | Quits Claude Code |

## Good to know

- **Your key has a spending limit** and stops working after the workshop.
- **`/cost` is only an estimate.** The real figures are on OpenRouter.
- **Long conversations cost more**, because the whole history is sent each time. Use `/clear` when you start on something new.
- **Already use Claude Code with your own account?** Type `/logout` inside Claude Code first, quit, then do step 4 and start again. You can log back in with your own account after the workshop.

## Troubleshooting

| Problem | Try this |
|---|---|
| `claude` not found | Close the window, open a new one, and try again |
| Asks you to log in | Make sure you pasted the three lines in step 4 into this same window, then start `claude` again |
| `/status` doesn't show OpenRouter | Quit Claude Code, paste the three lines again, and start `claude` again |
| Errors about the key or credit | Check the key has no spaces at the start or end, then ask Ed |
| PlatformIO check fails | Open VS Code and check the PlatformIO extension finished installing (step 9) |
| Upload fails: "port busy" or "access denied" | Close the serial monitor (`Ctrl+C` in its window), then upload again |
| Board not found | Try a different USB cable first, then see "If your board doesn't show up" in step 9 |
