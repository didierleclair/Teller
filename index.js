// Node.js backend met WebSocket voor realtime synchronisatie
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let countIn = 0;
let countOut = 0;

function broadcastCounts() {
  const data = JSON.stringify({ type: 'update', in: countIn, out: countOut });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  // Initiele data verzenden
  ws.send(JSON.stringify({ type: 'update', in: countIn, out: countOut }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'in') countIn++;
      if (data.type === 'out') countOut++;
      broadcastCounts();
    } catch (e) {
      console.error('Fout bij verwerken bericht:', e);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server draait op poort ${PORT}`);
});
