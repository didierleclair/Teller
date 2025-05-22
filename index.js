// Node.js backend met WebSocket en persistente historiek
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
const history = []; // [{ timestamp, in, out }]

function broadcastAll() {
  const payload = JSON.stringify({
    type: 'sync',
    history,
    in: countIn,
    out: countOut
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
    history,
    in: countIn,
    out: countOut
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const now = new Date().toISOString();
      if (data.type === 'in') countIn++;
      if (data.type === 'out') countOut++;
      if (data.type === 'in' || data.type === 'out') {
        history.push({ timestamp: now, in: countIn, out: countOut });
        broadcastAll();
      }
    } catch (err) {
      console.error('Fout bij WebSocket-bericht:', err);
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
