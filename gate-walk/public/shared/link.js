// The live connection to the computer. Reconnects by itself if it drops.

export function connect({ onMessage, onState }) {
  let socket;
  let retryMs = 2000;

  function open() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}/socket`);
    socket.onopen = () => onState(true);
    socket.onclose = () => {
      onState(false);
      setTimeout(open, retryMs);
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'welcome') retryMs = message.settings.reconnectMs;
      if (message.type === 'error') console.warn(`The computer refused a message: ${message.message}`);
      onMessage(message);
    };
  }
  open();

  return {
    // Returns false if there is no connection right now.
    send(message) {
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
  };
}
