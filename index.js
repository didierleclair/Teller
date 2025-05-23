// index.js – backend met PostgreSQL voor persistente telling
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(express.json());

// PostgreSQL pool (vervang waarden door je echte databaseconfiguratie)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@host:port/database',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teller (
      id SERIAL PRIMARY KEY,
      soort TEXT NOT NULL CHECK (soort IN ('in', 'out')),
      timestamp TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function getTelling() {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE soort = 'in') AS in,
      COUNT(*) FILTER (WHERE soort = 'out') AS out
    FROM teller
  `);
  const { in: inCount, out: outCount } = result.rows[0];
  return {
    in: parseInt(inCount, 10),
    out: parseInt(outCount, 10),
    net: parseInt(inCount, 10) - parseInt(outCount, 10)
  };
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
        await pool.query('INSERT INTO teller (soort) VALUES ($1)', [data.type]);
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
  await pool.query('TRUNCATE teller');
  const current = await getTelling();
  broadcast(current);
  res.status(200).json({ message: 'Teller gereset' });
});

app.get('/history', async (req, res) => {
  const result = await pool.query('SELECT * FROM teller ORDER BY timestamp ASC');
  let inCount = 0;
  let outCount = 0;
  const history = result.rows.map(row => {
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
  res.send('Teller backend actief met PostgreSQL.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await setupDatabase();
  console.log(`Server actief op poort ${PORT}`);
});
