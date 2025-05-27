// index.js – Supabase backend met volledige ES module syntax
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

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

  let data;
  try {
    data = await res.json();
  } catch (e) {
    console.error("Ongeldige JSON van Supabase in getTelling()");
    return { in: 0, out: 0, net: 0 };
  }

  if (!Array.isArray(data)) {
    console.error("Supabase gaf geen array terug in getTelling():", data);
    return { in: 0, out: 0, net: 0 };
  }

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
    if (client.readyState === 1) { // WebSocket.OPEN
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
      const actie = data.actie;

      if (actie === 'in' || actie === 'out') {
        await fetch(`${SUPABASE_URL}/rest/v1/tellingen`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{ soort: actie }])
        });

        const updated = await getTelling();
        ws.send(JSON.stringify({ type: 'update', ...updated }));
        broadcast(updated);
      }
    } catch (err) {
      console.error('Fout bij verwerking:', err);
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

app.post('/reset', async (req, res) => {
  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/tellingen`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!result.ok) {
      const text = await result.text();
      console.error("Fout bij verwijderen:", text);
      return res.status(500).json({ message: "Verwijderen mislukt", error: text });
    }

    const current = await getTelling();
    broadcast(current);
    res.status(200).json({ message: 'Teller succesvol gereset' });
  } catch (err) {
    console.error("Fout bij reset:", err);
    res.status(500).json({ message: 'Serverfout bij reset' });
  }
});

app.get('/history', async (req, res) => {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/tellingen?select=soort,timestamp&order=timestamp.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  let rows = [];
  try {
    rows = await result.json();
  } catch (e) {
    console.error("Fout bij JSON in /history");
  }

  if (!Array.isArray(rows)) {
    console.error("Supabase gaf geen array terug in /history:", rows);
    rows = [];
  }

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

setInterval(() => {
  fetch(`http://localhost:${PORT}/`)
    .then(res => res.text())
    .then(txt => console.log("Self-ping OK:", txt))
    .catch(err => console.warn("Self-ping mislukt:", err));
}, 14 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server actief op poort ${PORT}`);
});
