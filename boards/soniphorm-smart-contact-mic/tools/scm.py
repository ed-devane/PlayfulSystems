"""Send one command to the test sketch on the board and print the reply.

Run it with PlatformIO's Python, which already has the serial library:

  Windows:  & "$env:USERPROFILE\\.platformio\\penv\\Scripts\\python.exe" tools/scm.py 2
  Mac:      ~/.platformio/penv/bin/python tools/scm.py 2

Examples:  scm.py 1        scm.py speaker      scm.py vol 0.5
           scm.py check    scm.py help         scm.py --wait 8 8
The serial monitor must be closed first.
"""

import argparse
import os
import sys
import time

import serial
from serial.tools import list_ports

ESPRESSIF_USB_ID = 0x303A


def find_port():
    ports = [p.device for p in list_ports.comports() if p.vid == ESPRESSIF_USB_ID]
    if len(ports) == 1:
        return ports[0]
    if not ports:
        sys.exit("No board found. Is it plugged in with a data cable?")
    sys.exit("More than one board found: " + ", ".join(ports) + ". Add --port <name>.")


def talk(command, port=None, wait=2.0, echo=True, until=None):
    """Sends one command line and returns what the board says in reply.

    Listens for `wait` seconds, or less if the text `until` arrives.
    """
    board = serial.Serial()
    board.port = port or find_port()
    board.baudrate = 115200
    board.timeout = 0.1
    board.write_timeout = 2
    if os.name == "nt":
        # Opening the port must not reset the board.
        board.dtr = False
        board.rts = False

    received = b""
    try:
        board.open()
        board.reset_input_buffer()
        board.write((command + "\n").encode())
        end = time.time() + wait
        while time.time() < end:
            data = board.read(256)
            received += data
            if until and until.encode() in received:
                time.sleep(0.2)
                received += board.read(256)
                break
            if echo:
                sys.stdout.write(data.decode(errors="replace"))
                sys.stdout.flush()
        board.close()
    except serial.SerialException as error:
        sys.exit(f"Serial problem: {error}\nIs the serial monitor still open?")
    return received.decode(errors="replace")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("command", nargs="+", help="for example: 1, speaker, check")
    parser.add_argument("--port", help="serial port, if more than one board")
    parser.add_argument("--wait", type=float, default=2.0, help="seconds to listen")
    args = parser.parse_args()

    if not talk(" ".join(args.command), args.port, args.wait):
        sys.exit("No reply. Is the test sketch (00_test_modes) the one uploaded?")


if __name__ == "__main__":
    main()
