// Checks what a phone sends before the rest of the program uses it.

const SOURCES = ['sim', 'gps'];

const isNumberBetween = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

// Returns { position } if the message is good, or { error } saying what is wrong.
export function readPosition(text, maxNameLength) {
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return { error: 'the message is not JSON' };
  }
  if (message?.type !== 'position') return { error: 'unknown message type' };

  const { id, name, lat, lon, accuracy, t, source } = message;
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) return { error: 'bad id' };
  if (typeof name !== 'string' || !name.trim()) return { error: 'missing name' };
  if (!isNumberBetween(lat, -90, 90)) return { error: 'bad latitude' };
  if (!isNumberBetween(lon, -180, 180)) return { error: 'bad longitude' };
  if (!isNumberBetween(accuracy, 0, 1e7)) return { error: 'bad accuracy' };
  if (!isNumberBetween(t, 0, 1e14)) return { error: 'bad time' };
  if (!SOURCES.includes(source)) return { error: 'bad source' };

  return {
    position: { id, name: name.trim().slice(0, maxNameLength), lat, lon, accuracy, t, source },
  };
}
