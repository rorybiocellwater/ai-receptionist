const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database ─────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT[],
        status TEXT DEFAULT 'active',
        brief TEXT,
        outcome TEXT,
        cost_estimate NUMERIC,
        revenue NUMERIC,
        profitable BOOLEAN,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS memory (
        id SERIAL PRIMARY KEY,
        staff_id TEXT NOT NULL UNIQUE,
        summary TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}

initDB();

// ─── In-memory call log ───────────────────────────────────────────
let callLog = [];

// ─── Resend email client ──────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Vapi webhook ─────────────────────────────────────────────────
app.post('/webhook/vapi', async (req, res) => {
  const event = req.body;
  if (event.message?.type !== 'end-of-call-report') return res.sendStatus(200);
  const report = event.message;
  const summary = report.summary || 'No summary available.';
  const transcript = report.transcript || 'No transcript available.';
  const callerNumber = report.call?.customer?.number || 'Unknown number';
  const callDuration = report.call?.endedAt
    ? Math.round((new Date(report.call.endedAt) - new Date(report.call.startedAt)) / 1000)
    : null;
  const timestamp = new Date().toISOString();
  const structuredData = report.analysis?.structuredData || {};
  const customerName = structuredData.customerName || 'Not provided';
  const customerEmail = structuredData.customerEmail || 'Not provided';
  const message = structuredData.message || summary;
  const logEntry = { id: Date.now(), timestamp, callerNumber, customerName, customerEmail, message, summary, transcript, callDuration };
  callLog.unshift(logEntry);
  if (callLog.length > 100) callLog.pop();
  try {
    await resend.emails.send({
      from: 'AI Receptionist <onboarding@resend.dev>',
      to: process.env.EMAIL_TO,
      subject: `New message from ${customerName} (${callerNumber})`,
      html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;background:#fafafa;border:1px solid #e0e0e0;border-radius:8px"><h2 style="color:#1a1a1a;margin-top:0;border-bottom:2px solid #c8a96e;padding-bottom:12px">New Voicemail Message</h2><table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tr><td style="padding:8px 0;color:#666;width:140px">Caller number</td><td style="padding:8px 0;font-weight:bold">${callerNumber}</td></tr><tr><td style="padding:8px 0;color:#666">Customer name</td><td style="padding:8px 0;font-weight:bold">${customerName}</td></tr><tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0">${new Date(timestamp).toLocaleString('en-IE',{timeZone:'Europe/Dublin'})}</td></tr></table><div style="background:#fff;border-left:4px solid #c8a96e;padding:16px 20px;margin-bottom:24px"><p style="margin:0;font-size:16px;line-height:1.6;color:#1a1a1a">${message}</p></div><p style="color:#999;font-size:12px;margin:0">Sent by your AI Receptionist</p></div>`,
    });
    console.log(`Email sent for call from ${callerNumber}`);
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
  res.sendStatus(200);
});

// ─── API: call log ────────────────────────────────────────────────
app.get('/api/calls', (req, res) => res.json(callLog));

// ─── API: Anthropic proxy ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { system, messages } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system, messages })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Anthropic proxy error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── API: Projects (Ledger) ───────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { title, description, assigned_to, status, brief, outcome, cost_estimate, revenue, profitable, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (title, description, assigned_to, status, brief, outcome, cost_estimate, revenue, profitable, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, description, assigned_to || [], status || 'active', brief, outcome, cost_estimate, revenue, profitable, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assigned_to, status, brief, outcome, cost_estimate, revenue, profitable, notes } = req.body;
    const result = await pool.query(
      `UPDATE projects SET title=$1, description=$2, assigned_to=$3, status=$4, brief=$5,
       outcome=$6, cost_estimate=$7, revenue=$8, profitable=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [title, description, assigned_to, status, brief, outcome, cost_estimate, revenue, profitable, notes, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Memory ──────────────────────────────────────────────────
app.get('/api/memory/:staffId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM memory WHERE staff_id=$1', [req.params.staffId]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memory/:staffId', async (req, res) => {
  try {
    const { summary } = req.body;
    const result = await pool.query(
      `INSERT INTO memory (staff_id, summary) VALUES ($1, $2)
       ON CONFLICT (staff_id) DO UPDATE SET summary=$2, updated_at=NOW() RETURNING *`,
      [req.params.staffId, summary]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: config ──────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    emailTo: process.env.EMAIL_TO || '',
    configured: !!(process.env.RESEND_API_KEY && process.env.EMAIL_TO),
  });
});

// ─── Serve frontend ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Starling Holdings server running on http://localhost:${PORT}\n`);
});
