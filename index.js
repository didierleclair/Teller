// Nieuwe backend met correcte opslag van individuele tellingen per actie
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

let countIn = 0;
let countOut = 0;
const history = []; // [{ timestamp, deltaIn, deltaOut, net }]

function broadcastAll() {
  const payload = JSON.stringify({
    type: 'sync',
    history
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'sync',
    history
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const now = new Date().toISOString();

      if (data.type === 'in') {
        countIn++;
        history.push({ timestamp: now, deltaIn: 1, deltaOut: 0, net: countIn - countOut });
        broadcastAll();
      }

      if (data.type === 'out') {
        countOut++;
        history.push({ timestamp: now, deltaIn: 0, deltaOut: 1, net: countIn - countOut });
        broadcastAll();
      }
    } catch (err) {
      console.error('Fout bij verwerken WebSocket-bericht:', err);
    }
  });
});

app.post('/reset', (req, res) => {
  countIn = 0;
  countOut = 0;
  history.length = 0;
  broadcastAll();
  res.status(200).json({ message: 'Teller gereset' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket-server actief op poort ${PORT}`);
});
