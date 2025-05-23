// index.js – Render backend met /history endpoint voor export
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(express.json());

let countIn = 0;
let countOut = 0;
const history = [];

function broadcastCounts() {
  const message = JSON.stringify({
    type: 'update',
    in: countIn,
    out: countOut,
    net: countIn - countOut
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'update', in: countIn, out: countOut, net: countIn - countOut }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      const now = new Date().toISOString();
      if (data.type === 'in') countIn++;
      else if (data.type === 'out') countOut++;
      history.push({ timestamp: now, in: countIn, out: countOut, net: countIn - countOut });
      broadcastCounts();
    } catch (err) {
      console.error('Fout bij verwerken bericht:', err);
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

app.post('/reset', (req, res) => {
  countIn = 0;
  countOut = 0;
  history.length = 0;
  broadcastCounts();
  res.status(200).json({ message: 'Teller gereset' });
});

app.get('/history', (req, res) => {
  res.json({ history });
});

app.get('/', (req, res) => {
  res.send('Teller backend actief.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});
