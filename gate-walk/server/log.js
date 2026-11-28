// Messages in the terminal, each with the time.

const time = () => new Date().toLocaleTimeString('en-GB');

export const log = {
  info: (message) => console.log(`${time()}  ${message}`),
  warn: (message) => console.warn(`${time()}  WARNING: ${message}`),
  error: (message) => console.error(`${time()}  ERROR: ${message}`),
};
