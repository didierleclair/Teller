// index.js – aangepaste backend met cumulatieve opslag voor grafiek
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
const history = []; // [{ timestamp, in: totaal, out: totaal, net: totaal }]

function broadcastAll() {
  const payload = JSON.stringify({
    type: 'sync',
    history: history.map(entry => ({
      timestamp: entry.timestamp,
      in: entry.in,
      out: entry.out,
      net: entry.net
    }))
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
      } else if (data.type === 'out') {
        countOut++;
      }

      const net = countIn - countOut;
      history.push({ timestamp: now, in: countIn, out: countOut, net });
      broadcastAll();
    } catch (err) {
      console.error('WebSocket-verwerkingsfout:', err);
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
