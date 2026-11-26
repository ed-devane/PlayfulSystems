// The MODE button, debounced. Does not block, so it is safe in an audio loop.
//
//   scm::ModeButton button;
//   button.begin();                 // in setup()
//   if (button.wasPressed()) ...    // in loop(): true once per press
#pragma once

#include <Arduino.h>
#include "pins.h"

namespace scm {

class ModeButton {
 public:
  void begin() { pinMode(SCM_PIN_MODE_BTN, INPUT); }

  bool wasPressed() {
    bool reading = digitalRead(SCM_PIN_MODE_BTN) == LOW;
    uint32_t now = millis();
    if (reading != down && now - changedAt > 30) {
      down = reading;
      changedAt = now;
      return down;
    }
    return false;
  }

 private:
  bool down = false;
  uint32_t changedAt = 0;
};

}  // namespace scm
