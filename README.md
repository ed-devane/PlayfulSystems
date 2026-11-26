# Playful Systems: Getting Claude Code Running

This gets you set up with Claude Code for the workshop. You'll get your own OpenRouter key by email. Keep it to yourself and don't paste it anywhere public.

## 1. Install Claude Code

**Mac:** open **Terminal** and paste:

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

## 2. Make a folder to work in

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

## 3. Connect to OpenRouter with your key

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

## 4. Start Claude Code

```
claude
```

Go through the welcome screens (text style and so on). **If it asks you to log in, stop and put your hand up.** That means your key isn't being picked up.

## 5. Check you're connected

Inside Claude Code, type:

```
/status
```

It should show `https://openrouter.ai/api` as the base URL. If it does, you're ready.

## 6. Set up GitHub

GitHub keeps a copy of your work online and a history of every version, so you can always go back.

1. **Make an account** at [github.com](https://github.com) if you don't have one.
2. **Install Git:**
   - **Mac:** type `git --version` in Terminal. If it isn't installed, your Mac will offer to install it. Say yes.
   - **Windows:** install [Git for Windows](https://git-scm.com/downloads/win) and keep the default options.
3. **Install the GitHub command-line tool** from [cli.github.com](https://cli.github.com). This lets Claude Code create repositories and push for you.
4. **Log in:** close and reopen your Terminal or PowerShell window so it finds the new tools, then type `gh auth login` and follow the prompts. Choose GitHub.com, then HTTPS, then "Login with a web browser".

Reopening the window clears your key settings, so `cd` back into your folder and paste the three lines from step 3 again before starting `claude`.

Then, inside Claude Code, just ask:

> Set up this folder as a git repository and create a private GitHub repo for it.

## 7. Add the project notes file

Copy `CLAUDE.md` from this repo into your own project folder. Claude Code reads that file automatically at the start of every session. It tells Claude to:

- keep `NOTES.md` up to date with things that matter but aren't code, like the components you're using, wiring, ideas and decisions
- keep a `CHANGELOG.md` of what changed in each version
- commit and push to GitHub each time something works

That way you don't have to re-explain your project every time you start a new session. You can edit `CLAUDE.md` to add anything else you want Claude to always know.

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
- **Already use Claude Code with your own account?** Type `/logout` inside Claude Code first, quit, then do step 3 and start again. You can log back in with your own account after the workshop.

## Troubleshooting

| Problem | Try this |
|---|---|
| `claude` not found | Close the window, open a new one, and try again |
| Asks you to log in | Make sure you pasted the three lines in step 3 into this same window, then start `claude` again |
| `/status` doesn't show OpenRouter | Quit Claude Code, paste the three lines again, and start `claude` again |
| Errors about the key or credit | Check the key has no spaces at the start or end, then ask Ed |
