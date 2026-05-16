const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-memory call log ───────────────────────────────────────────
let callLog = [];

// ─── Resend email client ──────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Vapi webhook ─────────────────────────────────────────────────
app.post('/webhook/vapi', async (req, res) => {
  const event = req.body;

  if (event.message?.type !== 'end-of-call-report') {
    return res.sendStatus(200);
  }

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

  const logEntry = {
    id: Date.now(),
    timestamp,
    callerNumber,
    customerName,
    customerEmail,
    message,
    summary,
    transcript,
    callDuration,
  };
  callLog.unshift(logEntry);
  if (callLog.length > 100) callLog.pop();

  try {
    await resend.emails.send({
      from: 'AI Receptionist <onboarding@resend.dev>',
      to: process.env.EMAIL_TO,
      subject: `New message from ${customerName} (${callerNumber})`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a1a1a; margin-top: 0; border-bottom: 2px solid #c8a96e; padding-bottom: 12px;">New Voicemail Message</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">Caller number</td><td style="padding: 8px 0; font-weight: bold;">${callerNumber}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Customer name</td><td style="padding: 8px 0; font-weight: bold;">${customerName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Customer email</td><td style="padding: 8px 0; font-weight: bold;">${customerEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0;">${new Date(timestamp).toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })}</td></tr>
            ${callDuration ? `<tr><td style="padding: 8px 0; color: #666;">Duration</td><td style="padding: 8px 0;">${callDuration} seconds</td></tr>` : ''}
          </table>
          <div style="background: #fff; border-left: 4px solid #c8a96e; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
            <p style="margin: 0 0 4px; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Message</p>
            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">${message}</p>
          </div>
          <details style="margin-bottom: 16px;">
            <summary style="cursor: pointer; color: #666; font-size: 13px;">View full transcript</summary>
            <pre style="background: #f0f0f0; padding: 16px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; margin-top: 8px; line-height: 1.5;">${transcript}</pre>
          </details>
          <p style="color: #999; font-size: 12px; margin: 0;">Sent by your AI Receptionist</p>
        </div>
      `,
    });
    console.log(`Email sent for call from ${callerNumber}`);
  } catch (err) {
    console.error('Email send failed:', err.message);
  }

  res.sendStatus(200);
});

// ─── API: get call log ─────────────────────────────────────────────
app.get('/api/calls', (req, res) => {
  res.json(callLog);
});

// ─── API: Anthropic proxy for O'Neill app ─────────────────────────
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
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Anthropic proxy error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── API: get config ───────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    emailTo: process.env.EMAIL_TO || '',
    vapiAssistantId: process.env.VAPI_ASSISTANT_ID || '',
    configured: !!(process.env.RESEND_API_KEY && process.env.EMAIL_TO),
  });
});

// ─── Serve frontend ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ AI Receptionist server running on http://localhost:${PORT}\n`);
});
