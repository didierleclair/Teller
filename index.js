// index.js – backend met persistente opslag in JSON-bestand
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(express.json());

const dataFile = path.join(__dirname, 'tellingen.json');

let tellerData = { history: [] };

function loadTellingen() {
  if (fs.existsSync(dataFile)) {
    try {
      tellerData = JSON.parse(fs.readFileSync(dataFile));
    } catch {
      tellerData = { history: [] };
    }
  }
}

function saveTellingen() {
  fs.writeFileSync(dataFile, JSON.stringify(tellerData, null, 2));
}

function getTelling() {
  let inCount = 0, outCount = 0;
  tellerData.history.forEach(r => {
    if (r.soort === 'in') inCount++;
    else if (r.soort === 'out') outCount++;
  });
  return { in: inCount, out: outCount, net: inCount - outCount };
}

function broadcast(data) {
  const message = JSON.stringify({ type: 'update', ...data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  const current = getTelling();
  ws.send(JSON.stringify({ type: 'update', ...current }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'in' || data.type === 'out') {
        tellerData.history.push({ soort: data.type, timestamp: new Date().toISOString() });
        saveTellingen();
        broadcast(getTelling());
      }
    } catch (err) {
      console.error('Fout bij verwerking:', err);
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

app.post('/reset', (req, res) => {
  tellerData = { history: [] };
  saveTellingen();
  broadcast(getTelling());
  res.status(200).json({ message: 'Teller gereset' });
});

app.get('/history', (req, res) => {
  let inCount = 0;
  let outCount = 0;
  const history = tellerData.history.map(entry => {
    if (entry.soort === 'in') inCount++;
    else if (entry.soort === 'out') outCount++;
    return {
      timestamp: entry.timestamp,
      in: inCount,
      out: outCount,
      net: inCount - outCount
    };
  });
  res.json({ history });
});

app.get('/', (req, res) => {
  res.send('Teller backend actief met JSON-opslag.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  loadTellingen();
  console.log(`Server actief op poort ${PORT}`);
});
