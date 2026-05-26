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
        production_status TEXT,
        tools_used TEXT,
        distribution TEXT,
        promotion TEXT,
        earnings_to_date NUMERIC DEFAULT 0,
        activity_log JSONB DEFAULT '[]',
        latoya_clearance TEXT,
        latoya_cleared BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS memory (
        id SERIAL PRIMARY KEY,
        staff_id TEXT NOT NULL UNIQUE,
        summary TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        author TEXT NOT NULL DEFAULT 'liren',
        title TEXT,
        content TEXT NOT NULL,
        chief_assessment TEXT,
        read_by_chief BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Add new columns if they don't exist (for existing deployments)
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS production_status TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS tools_used TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS distribution TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS promotion TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS earnings_to_date NUMERIC DEFAULT 0;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS latoya_clearance TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS latoya_cleared BOOLEAN DEFAULT FALSE;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS chief_assessment TEXT;
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
let resend = null;
try {
  if(process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email client ready');
  } else {
    console.warn('⚠️  RESEND_API_KEY not set — email notifications disabled');
  }
} catch(err) {
  console.warn('⚠️  Resend init failed:', err.message);
}

// ─── Li Ren Intelligence Job ──────────────────────────────────────
const LI_REN_SYSTEM = `You are Li Ren, financial analyst and trend hunter at O'Neill & Associates / Starling Holdings, Tarbert, Co. Kerry. You are filing an unsolicited intelligence report for Chief O'Neill.

The company has the following capabilities:
- Music production (Bjorn Chapeau-Rouge) — original compositions, ambient, commercial, sync licensing
- Film and video production (Doc Brown) — from short ads to features
- Adult and fantasy content creation (Lami Belle) — erotic and fantasy visual content, animated manga
- Dropshipping and e-commerce (Ulysses Becker) — any physical product, fast to market
- Influencer and brand promotion (Lorraine Hunter) — social media, product promotion
- Written content (Henry Turner) — copy, articles, scripts, books
- Digital design (Theo) — graphics, CAD, product design, branding
- Children's educational content and esoteric/ancient civilisations content (Layton Sutton)
- Web and app development (Norm Woods)
- Craft and bespoke forged steel and ceramic objects (The MD)
- Bespoke memorial books for humans and animals — digital and print (Meabh Molyneaux, Molyneaux Memorials)
- MD personal assistance and scheduling (Maddie Twister)

Your job is to identify THREE specific, actionable market opportunities that match one or more of these capabilities. For each opportunity provide:
1. A clear title
2. The market opportunity and why it exists right now
3. Which staff member(s) are best placed to execute it
4. Realistic revenue potential and how it would be monetised
5. Estimated effort and cost to produce

Be specific. Name real platforms, real trends, real buyers. No vague generalities. Back everything with current market logic. Write as a professional analyst filing a report to her CEO.`;


const ONEILL_REVIEW_SYSTEM = `You are Chief O'Neill, chief executive of O'Neill & Associates / Starling Holdings, Tarbert, Co. Kerry. You have just read Li Ren's latest intelligence report. You need to assess each opportunity she has identified and decide which ones to recommend to the MD for greenlight.

For each opportunity consider:
- Does it match the company's current capabilities?
- Which staff member(s) would execute it?
- What is the realistic cost and timeline?
- What is the realistic revenue potential?
- Does it conflict with or complement existing projects?
- What are the risks?

Write your assessment as a briefing you will deliver to the MD. Be direct and decisive — you are recommending specific actions, not presenting options for discussion.

IMPORTANT: Format each project you are recommending using EXACTLY this structure so the MD can greenlight them individually:

---PROJECT---
Title: [clear project title]
Assigned to: [staff member first names]
Estimated cost: EUR[amount]
Expected return: [brief description]
Rationale: [1-2 sentences on why]
---END PROJECT---

If you are not recommending an opportunity explain why briefly without using the PROJECT format.

Sign off with a clear statement of what you are asking the MD to greenlight.

Write in your voice — direct, wisecracking, no-nonsense but fair.`;

async function runONeillReview() {
  console.log('🎯 O\'Neill review job starting...');
  try {
    // Get latest Li Ren report
    const reportResult = await pool.query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 1');
    if(!reportResult.rows.length) { console.log('No reports to review'); return; }
    const latestReport = reportResult.rows[0];

    // Get current projects for context
    const projectsResult = await pool.query('SELECT title, status, assigned_to FROM projects ORDER BY created_at DESC LIMIT 10');
    const projectContext = projectsResult.rows.length
      ? 'Current projects: ' + projectsResult.rows.map(function(p){ return p.title + ' (' + p.status + ')'; }).join(', ')
      : 'No current projects.';

    const now = new Date().toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: ONEILL_REVIEW_SYSTEM,
        messages: [{
          role: 'user',
          content: 'Date: ' + now + '. ' + projectContext + '\n\nLi Ren\'s report:\n' + latestReport.content + '\n\nReview this report and prepare your recommendation for the MD.'
        }]
      })
    });

    const data = await response.json();
    const recommendation = data.content && data.content[0] ? data.content[0].text : null;

    if(recommendation) {
      // Save as a special memory entry for O'Neill
      await pool.query(
        `INSERT INTO memory (staff_id, summary) VALUES ($1, $2)
         ON CONFLICT (staff_id) DO UPDATE SET summary=$2, updated_at=NOW()`,
        ['chief_recommendation', '[RECOMMENDATION PREPARED: ' + now + ']\n' + recommendation]
      );
      // Mark report as read by chief
      await pool.query('UPDATE reports SET read_by_chief = TRUE WHERE id = $1', [latestReport.id]);
      console.log('✅ O\'Neill recommendation prepared');
    }
  } catch(err) {
    console.error('O\'Neill review job failed:', err.message);
  }
}

async function runLiRenIntelligence() {
  console.log('Li Ren intelligence job starting — filing 3 separate reports...');
  try {
    const projectsResult = await pool.query("SELECT title, status FROM projects WHERE status IN ('active','greenlit') ORDER BY created_at DESC LIMIT 10");
    const projectContext = projectsResult.rows.length
      ? 'Current active projects: ' + projectsResult.rows.map(p => p.title).join(', ')
      : 'No current projects.';
    const now = new Date().toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            system: LI_REN_SYSTEM,
            messages: [{
              role: 'user',
              content: 'Date: ' + now + '. ' + projectContext + '. Search for ONE specific actionable market opportunity that matches any of the company capabilities. Range freely — consider music, film, content creation, dropshipping, memorials, adult content, illustration, ancient civilisations content, programming, influencer marketing, writing, or any other area where our staff have skills. Report ' + (i+1) + ' of 3 — find a different opportunity from any you have already identified today. Write a single focused intelligence report. Include: what it is, why now, market size, which staff member executes it, revenue potential, and estimated cost. Give it a clear descriptive title.'
            }]
          })
        });

        const data = await response.json();
        if (data.error) { console.error('Li Ren call ' + (i+1) + ' failed:', data.error.message); continue; }

        const reportText = data.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n').trim();

        if (reportText) {
          // Extract structured project data from the report
          try {
            const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 400,
                system: 'Extract project details from this intelligence report. Respond ONLY with valid JSON, no markdown, no backticks. Format: {"title": "clear project title", "description": "2-3 sentence project brief", "assigned_to": ["FirstName"], "cost_estimate": null, "tools_used": "tools and platforms mentioned", "distribution": "distribution channels mentioned"}. For cost_estimate use only explicitly stated numbers — if none stated use null. Staff first names only from: Bjorn, Sandy, Henry, Theo, Norm, Lami, Ulysses, Lorraine, Latoya, Meabh, Layton, Doc, Tina, Steve, Sidney.',
                messages: [{ role: 'user', content: 'Extract project details:\n\n' + reportText.substring(0, 3000) }]
              })
            });
            const extractData = await extractRes.json();
            let projectData = { title: 'New Project', description: '', assigned_to: [], cost_estimate: null, tools_used: null, distribution: null };
            if (extractData.content && extractData.content[0]) {
              const parsed = JSON.parse(extractData.content[0].text.replace(/```json|```/g,'').trim());
              projectData = {
                title: parsed.title || 'New Project',
                description: parsed.description || '',
                assigned_to: Array.isArray(parsed.assigned_to) ? parsed.assigned_to : [],
                cost_estimate: parsed.cost_estimate || null,
                tools_used: parsed.tools_used || null,
                distribution: parsed.distribution || null
              };
            }
            const activityLog = JSON.stringify([{ date: new Date().toISOString(), note: 'Project created from Li Ren intelligence report' }]);
            const projResult = await pool.query(
              'INSERT INTO projects (title, description, assigned_to, status, cost_estimate, tools_used, distribution, production_status, activity_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
              [projectData.title, projectData.description, projectData.assigned_to, 'active', projectData.cost_estimate, projectData.tools_used, projectData.distribution, 'Not started', activityLog]
            );
            console.log('Li Ren created project ' + (i+1) + ': ' + projectData.title);
            // Trigger Latoya review
            runLatoyaReview(projResult.rows[0]);
          } catch(extractErr) {
            console.error('Project extraction failed:', extractErr.message);
            // Fallback — save with just title from report
            const titleMatch = reportText.match(/^#+ (.+)$/m) || reportText.match(/\*\*(.+?)\*\*/);
            const title = titleMatch ? titleMatch[1].replace(/[*#_]/g,'').trim() : ('Project ' + (i+1) + ' — ' + now);
            await pool.query(
              'INSERT INTO projects (title, description, status, production_status) VALUES ($1, $2, $3, $4)',
              [title.substring(0,120), reportText.substring(0,500), 'active', 'Not started']
            );
          }
        }

        // Wait 90 seconds between calls to avoid rate limits
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 90000));

      } catch(callErr) {
        console.error('Li Ren report ' + (i+1) + ' failed:', callErr.message);
      }
    }

    const reportText = 'done'; // placeholder to skip old block

    console.log('Li Ren intelligence job complete');
  } catch (err) {
    console.error('Li Ren intelligence job failed:', err.message);
  }
}

// ─── Scheduler — every 12 hours ──────────────────────────────────
function startScheduler() {
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  const THIRTY_MINS = 30 * 60 * 1000;

  // Li Ren runs first, then O'Neill reviews 30 mins later
  setTimeout(function() {
    runLiRenIntelligence().then(function() {
      setTimeout(runONeillReview, THIRTY_MINS);
    });
    setInterval(function() {
      runLiRenIntelligence().then(function() {
        setTimeout(runONeillReview, THIRTY_MINS);
      });
    }, TWELVE_HOURS);
  }, 30000);

  console.log('📅 Scheduler started — Li Ren reports every 12h, O Neill reviews 30 mins after');
}

startScheduler();

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
    if(!resend) { console.log('Email skipped — Resend not configured'); return res.sendStatus(200); }
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


// ─── API: OpenRouter proxy (Maddie) ──────────────────────────────────
app.post('/api/chat/openrouter', async (req, res) => {
  try {
    const { system, messages } = req.body;
    const openaiMessages = [];
    if(system) openaiMessages.push({ role: 'system', content: system });
    messages.forEach(function(m) {
      openaiMessages.push({ role: m.role, content: m.content });
    });
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'HTTP-Referer': 'https://starlingholdings.com',
        'X-Title': 'Starling Holdings'
      },
      body: JSON.stringify({
        model: 'thedrummer/cydonia-24b-v4.1',
        max_tokens: 1000,
        messages: openaiMessages
      })
    });
    const data = await response.json();
    const text = data.choices && data.choices[0] ? data.choices[0].message.content : 'No response.';
    res.json({ content: [{ type: 'text', text: text }] });
  } catch (err) {
    console.error('OpenRouter proxy error:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});


// ─── API: Greenlight from report with Claude extraction ───────────────
app.post('/api/greenlight-from-report', async (req, res) => {
  try {
    const { reportId, title, content, assessment } = req.body;
    const fullText = (assessment || '') + '\n\n' + (content || '');

    // Extract structured project data using Claude
    const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: 'Extract project details from this intelligence report. Respond ONLY with valid JSON, no markdown, no backticks. Format: {"title": "clear project title", "description": "2-3 sentence project brief", "assigned_to": ["FirstName1", "FirstName2"], "cost_estimate": null, "tools_used": "platforms and tools mentioned", "distribution": "distribution channels mentioned", "production_status": "Not started"}. For cost_estimate use only explicitly stated numbers from the report — if no specific cost is mentioned use null, never invent a number. Use only first names from: Bjorn, Sandy, Henry, Theo, Norm, Lami, Ulysses, Lorraine, Latoya, Meabh, Layton, Doc, Tina, Steve, Sidney, Li Ren.',
        messages: [{ role: 'user', content: 'Extract project details from this report:\n\n' + fullText.substring(0, 3000) }]
      })
    });

    const extractData = await extractRes.json();
    let projectData = { title: title || 'New Project', description: '', assigned_to: [], cost_estimate: null };

    if (extractData.content && extractData.content[0]) {
      try {
        const parsed = JSON.parse(extractData.content[0].text.replace(/```json|```/g, '').trim());
        projectData = {
          title: parsed.title || title || 'New Project',
          description: parsed.description || '',
          assigned_to: Array.isArray(parsed.assigned_to) ? parsed.assigned_to : [],
          cost_estimate: (parsed.cost_estimate && parsed.cost_estimate !== 1000) ? parsed.cost_estimate : null,
          tools_used: parsed.tools_used || null,
          distribution: parsed.distribution || null
        };
      } catch(e) {
        console.error('JSON parse failed, using defaults:', e.message);
      }
    }

    const activityLog = JSON.stringify([{ date: new Date().toISOString(), note: 'Project greenlighted by MD' }]);
    const result = await pool.query(
      'INSERT INTO projects (title, description, assigned_to, status, cost_estimate, tools_used, distribution, production_status, activity_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [projectData.title, projectData.description, projectData.assigned_to, 'greenlit', projectData.cost_estimate || null, projectData.tools_used || null, projectData.distribution || null, 'Not started', activityLog]
    );

    const project = result.rows[0];
    res.json({ success: true, project });

    // Trigger Latoya review in background
    runLatoyaReview(project);

  } catch(err) {
    console.error('Greenlight from report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Greenlight project ─────────────────────────────────────────
app.post('/api/greenlight', async (req, res) => {
  try {
    const { title, description, assigned_to, cost_estimate } = req.body;

    const activityLog = JSON.stringify([{ date: new Date().toISOString(), note: 'Project greenlighted by MD' }]);

    const result = await pool.query(
      `INSERT INTO projects (title, description, assigned_to, status, cost_estimate, activity_log)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title || 'New Project', description || '', assigned_to || [], 'greenlit', cost_estimate || null, activityLog]
    );

    const project = result.rows[0];
    res.json({ success: true, project });

    // Trigger Latoya review in background
    runLatoyaReview(project);

  } catch (err) {
    console.error('Greenlight error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Update project detail ───────────────────────────────────────
app.patch('/api/projects/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const { production_status, tools_used, distribution, promotion, earnings_to_date, note } = req.body;

    // Append to activity log if note provided
    if(note) {
      const existing = await pool.query('SELECT activity_log FROM projects WHERE id=$1', [id]);
      const log = existing.rows[0] ? (existing.rows[0].activity_log || []) : [];
      log.push({ date: new Date().toISOString(), note });
      await pool.query('UPDATE projects SET activity_log=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(log), id]);
    }

    const fields = [];
    const values = [];
    let idx = 1;
    if(production_status !== undefined) { fields.push('production_status=$' + idx++); values.push(production_status); }
    if(tools_used !== undefined) { fields.push('tools_used=$' + idx++); values.push(tools_used); }
    if(distribution !== undefined) { fields.push('distribution=$' + idx++); values.push(distribution); }
    if(promotion !== undefined) { fields.push('promotion=$' + idx++); values.push(promotion); }
    if(earnings_to_date !== undefined) { fields.push('earnings_to_date=$' + idx++); values.push(earnings_to_date); }
    fields.push('updated_at=NOW()');
    values.push(id);

    if(fields.length > 1) {
      await pool.query('UPDATE projects SET ' + fields.join(', ') + ' WHERE id=$' + idx, values);
    }

    const updated = await pool.query('SELECT * FROM projects WHERE id=$1', [id]);
    res.json(updated.rows[0]);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Latoya auto-review ───────────────────────────────────────────────
async function runLatoyaReview(project) {
  try {
    console.log('Latoya reviewing project:', project.title);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: "You are Latoya Mayflower, legal counsel at O'Neill & Associates. Review this project brief for legal and compliance issues. Be concise — 3-4 sentences. Flag any IP concerns, content restrictions, platform terms issues, age verification requirements, or licensing needs. State whether you clear it or require changes before proceeding.",
        messages: [{ role: 'user', content: 'Project: ' + project.title + '\nDescription: ' + (project.description || 'No description provided') + '\nAssigned to: ' + (project.assigned_to ? project.assigned_to.join(', ') : 'TBD') + '\nProduction status: ' + (project.production_status || 'Not specified') + '\nTools/platforms: ' + (project.tools_used || 'Not specified') + '\nDistribution: ' + (project.distribution || 'Not specified') + '\nPromotion: ' + (project.promotion || 'Not specified') + '\n\nProvide your legal assessment.' }]
      })
    });
    const data = await response.json();
    const clearance = data.content && data.content[0] ? data.content[0].text : null;
    if(clearance) {
      const cleared = !clearance.toLowerCase().includes('require') && !clearance.toLowerCase().includes('cannot') && !clearance.toLowerCase().includes('flag');
      await pool.query(
        'UPDATE projects SET latoya_clearance=$1, latoya_cleared=$2, updated_at=NOW() WHERE id=$3',
        [clearance, cleared, project.id]
      );
      console.log('Latoya clearance saved for:', project.title);
    }
  } catch(err) {
    console.error('Latoya review failed:', err.message);
  }
}


// ─── API: Latoya re-review ────────────────────────────────────────────
app.post('/api/projects/:id/latoya-review', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if(!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, message: 'Latoya review triggered' });
    runLatoyaReview(result.rows[0]);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── API: Bjorn music generation via Replicate ────────────────────────
app.post('/api/generate/music', async (req, res) => {
  try {
    const { prompt, duration, projectId } = req.body;
    if (!process.env.REPLICATE_API_KEY) {
      return res.status(500).json({ error: 'REPLICATE_API_KEY not set' });
    }

    console.log('Bjorn generating music:', prompt);

    // Start the prediction
    const startRes = await fetch('https://api.replicate.com/v1/models/meta/musicgen/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.REPLICATE_API_KEY
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          duration: duration || 30,
          model_version: 'stereo-large',
          output_format: 'mp3',
          normalization_strategy: 'peak'
        }
      })
    });

    const prediction = await startRes.json();
    if (prediction.error) throw new Error(prediction.error);

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 60) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch('https://api.replicate.com/v1/predictions/' + result.id, {
        headers: { 'Authorization': 'Bearer ' + process.env.REPLICATE_API_KEY }
      });
      result = await pollRes.json();
      attempts++;
    }

    if (result.status === 'failed') throw new Error('Music generation failed');
    if (result.status !== 'succeeded') throw new Error('Timed out');

    const audioUrl = result.output;

    // Log to project activity if projectId provided
    if (projectId) {
      const proj = await pool.query('SELECT activity_log FROM projects WHERE id=$1', [projectId]);
      if (proj.rows.length) {
        const log = proj.rows[0].activity_log || [];
        log.push({ date: new Date().toISOString(), note: 'Bjorn generated track: ' + prompt.substring(0,80) + ' — ' + audioUrl });
        await pool.query('UPDATE projects SET activity_log=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(log), projectId]);
      }
    }

    res.json({ success: true, url: audioUrl, prompt });
  } catch(err) {
    console.error('Music generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Projects ────────────────────────────────────────────────
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

// ─── API: Reports ─────────────────────────────────────────────────

// ─── API: Archive/clear reports ───────────────────────────────────────
app.delete('/api/reports/all', async (req, res) => {
  try {
    await pool.query('DELETE FROM reports');
    res.json({ success: true, message: 'All reports cleared' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reports/archive-all', async (req, res) => {
  try {
    await pool.query('UPDATE reports SET read_by_chief = TRUE');
    res.json({ success: true, message: 'All reports archived' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 20');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/unread', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM reports WHERE read_by_chief = FALSE');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reports/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE reports SET read_by_chief = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports/run', async (req, res) => {
  res.json({ message: 'Li Ren intelligence run triggered' });
  runLiRenIntelligence().then(function() {
    setTimeout(runONeillReview, 30000); // O'Neill reviews 30 seconds after manual trigger
  });
});

app.post('/api/reports/oneill-review', async (req, res) => {
  res.json({ message: 'O Neill review triggered' });
  runONeillReview();
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
