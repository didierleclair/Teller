// index.js – backend met Supabase REST-opslag via fetch
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(express.json());

const SUPABASE_URL = 'https://okpazxteycdjicomewxd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGF6eHRleWNkamljb21ld3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDQ4NzAsImV4cCI6MjA2MzU4MDg3MH0.lN-wzBlZFshayqSJvESJ-kS592ZumMcw8yM5Kl04Bso';

async function getTelling() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tellingen?select=soort,timestamp`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  let inCount = 0, outCount = 0;
  data.forEach(row => {
    if (row.soort === 'in') inCount++;
    else if (row.soort === 'out') outCount++;
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

wss.on('connection', async (ws) => {
  const current = await getTelling();
  ws.send(JSON.stringify({ type: 'update', ...current }));

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'in' || data.type === 'out') {
        await fetch(`${SUPABASE_URL}/rest/v1/tellingen`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{ soort: data.type }])
        });
        const updated = await getTelling();
        broadcast(updated);
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

app.post('/reset', async (req, res) => {
  await fetch(`${SUPABASE_URL}/rest/v1/tellingen`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  });
  const current = await getTelling();
  broadcast(current);
  res.status(200).json({ message: 'Teller gereset' });
});

app.get('/history', async (req, res) => {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/tellingen?select=soort,timestamp&order=timestamp.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const rows = await result.json();
  let inCount = 0;
  let outCount = 0;
  const history = rows.map(row => {
    if (row.soort === 'in') inCount++;
    else if (row.soort === 'out') outCount++;
    return {
      timestamp: row.timestamp,
      in: inCount,
      out: outCount,
      net: inCount - outCount
    };
  });
  res.json({ history });
});

app.get('/', (req, res) => {
  res.send('Teller backend actief via Supabase REST API.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server actief op poort ${PORT}`);
});
