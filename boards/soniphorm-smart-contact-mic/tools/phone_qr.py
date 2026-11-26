r"""Show a QR code that opens the phone remote for the board that is plugged in.

Run it with PlatformIO's Python, like scm.py:

  Windows:  & "$env:USERPROFILE\.platformio\penv\Scripts\python.exe" tools/phone_qr.py
  Mac:      ~/.platformio/penv/bin/python tools/phone_qr.py

It asks the board for its channel code and opens a web page with the QR code.
The board needs the test sketch (00_test_modes) and the serial monitor closed.
Use --code to skip asking the board.
"""

import argparse
import re
import sys
import webbrowser

PAGE = "https://ed-devane.github.io/PlayfulSystems/phone/qr.html?c="


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--code", help="channel code, if you already know it")
    parser.add_argument("--port", help="serial port, if more than one board")
    parser.add_argument("--no-open", action="store_true", help="only print the address")
    args = parser.parse_args()

    code = args.code
    if not code:
        import scm  # the neighbouring script that talks to the board

        # The board can be busy for 15 seconds while it joins Wi-Fi.
        reply = scm.talk("phone", args.port, 20.0, echo=False, until="qr.html?c=")
        found = re.search(r"channel ([a-z0-9]{4,20})", reply)
        if not found:
            sys.exit("The board did not give a channel code. Upload 00_test_modes first.")
        code = found.group(1)

    address = PAGE + code
    print("Channel:", code)
    print("QR code page:", address)
    if not args.no_open:
        webbrowser.open(address)


if __name__ == "__main__":
    main()
