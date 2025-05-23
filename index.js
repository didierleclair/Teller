// index.js – eenvoudige backend met live sync via WebSocket
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});


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
      if (data.type === 'in') countIn++;
      else if (data.type === 'out') countOut++;
      broadcastCounts();
    } catch (err) {
      console.error('Fout bij verwerken bericht:', err);
    }
  });
});

app.post('/reset', (req, res) => {
  countIn = 0;
  countOut = 0;
  broadcastCounts();
  res.status(200).json({ message: 'Teller gereset' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server actief op poort ${PORT}`);
});
