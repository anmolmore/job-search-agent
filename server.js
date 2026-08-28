require('dotenv').config();
const express = require('express');
const { searchJobs, DEMO_MODE } = require('./lib/jobSearch');

const PORT = process.env.PORT || 3000;

if (!process.env.OPENROUTER_API_KEY && !DEMO_MODE) {
  console.error('Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/search', async (req, res) => {
  try {
    const { roles = [], stages = [], domains = [], locations = [] } = req.body || {};
    const result = await searchJobs({ roles, stages, domains, locations });

    const u = result.usage || {};
    console.log(
      `[usage] prompt=${u.prompt_tokens ?? '?'} completion=${u.completion_tokens ?? '?'} ` +
      `total=${u.total_tokens ?? '?'} est_cost=$${u.estCostUsd != null ? u.estCostUsd.toFixed(4) : '?'}`
    );

    res.json({ jobs: result.jobs, searchSummary: result.searchSummary, _usage: result.usage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Startup Job Agent running at http://localhost:${PORT}`);
});
