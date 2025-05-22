// index.js – backend met bundeling van tellingen per minuut
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
const history = []; // [{ timestamp, in, out, net }]

let bufferIn = 0;
let bufferOut = 0;

function flushBuffer() {
  if (bufferIn === 0 && bufferOut === 0) return;
  countIn += bufferIn;
  countOut += bufferOut;
  const timestamp = new Date().toISOString();
  history.push({ timestamp, in: countIn, out: countOut, net: countIn - countOut });
  bufferIn = 0;
  bufferOut = 0;
  broadcastAll();
}

setInterval(flushBuffer, 60 * 1000); // elke minuut bundelen

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
  ws.send(JSON.stringify({ type: 'sync', history }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'in') bufferIn++;
      else if (data.type === 'out') bufferOut++;
    } catch (err) {
      console.error('WebSocket-verwerkingsfout:', err);
    }
  });
});

app.post('/reset', (req, res) => {
  countIn = 0;
  countOut = 0;
  bufferIn = 0;
  bufferOut = 0;
  history.length = 0;
  broadcastAll();
  res.status(200).json({ message: 'Teller gereset' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket-server actief op poort ${PORT}`);
});
