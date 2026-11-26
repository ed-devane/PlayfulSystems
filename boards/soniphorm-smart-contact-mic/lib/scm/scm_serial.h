// Reads typed commands from the serial port, one line at a time. Copes with
// Backspace and arrow keys, which otherwise end up inside names and passwords.
//
//   scm::SerialLines lines;
//   String line;
//   while (lines.read(line)) { ... }   // in loop()
#pragma once

#include <Arduino.h>

namespace scm {

class SerialLines {
 public:
  // True when a complete, non-empty line has arrived.
  bool read(String& line) {
    while (Serial.available()) {
      char c = Serial.read();
      if (c == 27) {
        escape = 1;  // arrow keys arrive as ESC [ letter
      } else if (escape == 1) {
        escape = (c == '[' || c == 'O') ? 2 : 0;
      } else if (escape == 2) {
        if (c >= '@' && c <= '~') escape = 0;
      } else if (c == '\n' || c == '\r') {
        if (buffer.length() > 0) {
          line = buffer;
          buffer = "";
          return true;
        }
      } else if (c == '\b' || c == 127) {
        if (buffer.length() > 0) buffer.remove(buffer.length() - 1);
      } else if ((uint8_t)c >= 32 && buffer.length() < 100) {
        buffer += c;
      }
    }
    return false;
  }

 private:
  String buffer;
  int escape = 0;
};

}  // namespace scm
