const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEMO_MODE = process.env.DEMO_MODE === '1';

const PROFILE = `
- Name: Anmol More
- Location: Bengaluru, India
- Experience: 15+ years (Cloud, ML, Backend Dev)
- Current: Co-founder, Adrija Labs (EdTech, ML consulting)
- Previous: Senior Staff Engineer, Synopsys (3.5 yrs) — chip design analytics, GenAI chatbots with RAG, MLOps on Kubernetes/Kubeflow/MLFlow/KServe, graph databases (Neo4j, ArangoDB, DuckDB), AWS Spot advisory
- Previous: Principal Engineer, Tagnos ($6.5M Series A healthtech startup, 5.5 yrs) — OR surgery ML prediction (saved $0.5M/hospital), COVID tracing 10k pings/sec, Computer Vision (GCP Vision AI + TensorFlow), EHR integration (HL7, EPIC, Redox), voice AI (Alexa)
- Previous: Pegasystems (Senior SWE), Oracle (Senior Apps Dev)
- Education: ISB Silver Medal, Business Analytics (GPA 3.9/4); B.Tech IT CUSAT
- Skills: Python, Java, GCP, AWS, Azure, Docker, Kubernetes, GenAI/RAG, MLFlow, TensorFlow, Vertex AI, SageMaker, DuckDB, ArangoDB, Neo4j, PostgreSQL, BigQuery, Snowflake, Kubeflow, pySpark, HL7, Salesforce Health Cloud, EPIC, NodeJS
- Awards: Synopsys Q1 2026 Recognition, Q4 2024 Achievement, 2023 SPOT Award; ISB Silver Medal; Pegasystems WOW Award
- Teaching: AI/ML at University of Texas (4.8/5 rating)
- Published: IEEE paper on education tech (cited 16 times)
- ISB consulting background: Singapore & UK clients
`.trim();

const SYSTEM_PROMPT = `You are an expert job search agent for India's startup ecosystem, with live web search access.
You know the Indian startup scene deeply — YC India, Sequoia Surge, Accel India, Elevation Capital, Nexus Venture Partners portfolios.
You know job boards: Wellfound (AngelList India), LinkedIn, Instahyre, Cutshort, YC Work at a Startup, Naukri.

Use web search to find REAL, CURRENTLY OPEN job postings at REAL India-based (or India-hiring) startups that match the candidate below.
Do not invent postings. Only include a job if your search actually surfaced a matching real listing, and set "applyUrl" to the real URL you found.
Only include postings that were posted within the last 7 days — set "postedDays" to your best honest estimate of how many days ago it was posted, and exclude anything you believe is older than 7 days.
If you cannot find enough real matches posted in the last week, return fewer than 8 jobs rather than fabricating any or including older postings — never fabricate.

Be very specific in "matchReason" about why each role fits this exact background, citing concrete facts (Tagnos healthtech, Synopsys MLOps, ISB, specific skills).

After searching, respond with ONLY valid JSON — no markdown fences, no explanation, no preamble, no text before or after the JSON object.

Required JSON structure:
{
  "jobs": [
    {
      "id": 1,
      "title": "exact senior title from the listing",
      "company": "Real startup name (sector in parens if helpful)",
      "companyDesc": "One line on what this company does",
      "logo": "single relevant emoji",
      "stage": "Series A",
      "sector": "Healthtech",
      "location": "Bengaluru / Remote",
      "salary": "as listed, or best estimate labeled '(est.)' if not disclosed",
      "equity": "as listed if disclosed, else omit",
      "experience": "as listed",
      "matchScore": 94,
      "matchReason": "2-3 sentences explaining specifically why Anmol's background makes him a fit for THIS real role",
      "summary": "What this role actually does day-to-day, based on the real listing",
      "matchedSkills": ["his actual skills that directly apply"],
      "skillGaps": ["skills the listing wants that he may need to brush up"],
      "applyUrl": "the real URL of the listing you found",
      "postedDays": 3,
      "accentColor": "#5B6FFF"
    }
  ],
  "searchSummary": "One sentence summary of what was found, noting it's based on live search"
}

Generate up to 8 highly tailored jobs from real, current listings only. Match scores should be honest and varied (55-96%). accentColor should vary: use #5B6FFF, #00D4AA, #FF6B6B, #FFB347, #A78BFA alternating.`;

function buildUserPrompt({ roles, stages, domains, locations }) {
  return `Find the best real, currently open India startup jobs for Anmol More using web search.

His profile:
${PROFILE}

Preferred roles: ${roles?.length ? roles.join(', ') : 'ML/AI/backend senior leadership'}
Startup stages: ${stages?.length ? stages.join(', ') : 'Seed to Series B'}
Domains: ${domains?.length ? domains.join(', ') : 'Healthtech, AI/ML, Fintech, DevTools'}
Locations: ${locations?.length ? locations.join(', ') : 'Bengaluru, Remote'}

Search job boards and company career pages (Wellfound, LinkedIn Jobs, Instahyre, Cutshort, YC Work at a Startup, and startup career pages directly) for real, currently open senior/leadership roles matching these filters. Only include postings from the last 7 days — skip anything older. Prioritize roles where his healthtech experience, MLOps/GenAI depth, ISB business acumen, and startup experience converge. Be VERY specific in match reasons — cite his actual experience at Tagnos, Synopsys, ISB etc. Only return real listings you actually found via search.`;
}

function extractJson(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const s = clean.indexOf('{');
  const e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON object found in model output');
  return JSON.parse(clean.slice(s, e + 1));
}

function buildDemoResponse() {
  return {
    jobs: [
      {
        id: 1,
        title: '[DEMO DATA — NOT A REAL LISTING] Head of AI Platform',
        company: '[Sample Startup] Series A Healthtech Co.',
        companyDesc: 'Illustrative example — not a real company. Shows what a card looks like once billing is fixed.',
        logo: '🏥',
        stage: 'Series A',
        sector: 'Healthtech',
        location: 'Bengaluru / Remote',
        salary: '₹70-95 LPA (sample)',
        equity: '0.2-0.4% (sample)',
        experience: '12-16 years',
        matchScore: 92,
        matchReason: 'DEMO CONTENT — once you add API credit, this card will be replaced by a real, live-searched job posting with a real match reason citing your actual background at Tagnos, Synopsys, and ISB.',
        summary: 'This is placeholder text so you can see the card layout, spacing, and badge colors before running a real search.',
        matchedSkills: ['Python', 'MLOps', 'GenAI/RAG'],
        skillGaps: ['Sample gap'],
        applyUrl: 'https://wellfound.com',
        postedDays: 2,
        accentColor: '#5B6FFF'
      },
      {
        id: 2,
        title: '[DEMO DATA — NOT A REAL LISTING] Founding ML Engineer',
        company: '[Sample Startup] Seed AI/ML Co.',
        companyDesc: 'Illustrative example — not a real company.',
        logo: '🤖',
        stage: 'Seed',
        sector: 'AI / ML Platform',
        location: 'Remote',
        salary: '₹55-80 LPA (sample)',
        equity: '0.5-1.0% (sample)',
        experience: '10+ years',
        matchScore: 84,
        matchReason: 'DEMO CONTENT — this is a placeholder to demonstrate a lower-scored card. Real results appear once OPENROUTER_API_KEY has credit and DEMO_MODE is turned off.',
        summary: 'Placeholder summary text for layout preview purposes only.',
        matchedSkills: ['Kubernetes', 'AWS', 'Computer Vision'],
        skillGaps: ['Sample gap 2'],
        applyUrl: 'https://wellfound.com',
        postedDays: 5,
        accentColor: '#00D4AA'
      }
    ],
    searchSummary: 'DEMO MODE — these are sample cards to preview the UI, not real search results. Set DEMO_MODE=0 (or remove it) and add API credit to get real, live-searched listings.'
  };
}

/**
 * Runs a live (or demo) job search and returns { jobs, searchSummary, usage }.
 * Shared by the web app (server.js) and the MCP server (mcp-server/).
 */
async function searchJobs({ roles = [], stages = [], domains = [], locations = [] } = {}) {
  if (DEMO_MODE) {
    const demo = buildDemoResponse();
    return { ...demo, usage: { demo: true, estCostUsd: 0 } };
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key.');
  }

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Startup Job Agent'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt({ roles, stages, domains, locations }) }
      ],
      plugins: [{ id: 'web', max_results: 6 }],
      usage: { include: true }
    })
  });

  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(data.error?.message || `OpenRouter error (${resp.status})`);
  }

  const raw = data.choices?.[0]?.message?.content || '';
  if (!raw.trim()) throw new Error('Model returned no text output');

  const parsed = extractJson(raw);
  if (Array.isArray(parsed.jobs)) {
    parsed.jobs = parsed.jobs.filter(j => j.postedDays == null || j.postedDays <= 7);
  }

  const usage = data.usage || {};
  return {
    jobs: parsed.jobs || [],
    searchSummary: parsed.searchSummary || '',
    usage: { ...usage, estCostUsd: usage.cost != null ? Number(usage.cost) : null }
  };
}

module.exports = {
  searchJobs,
  buildDemoResponse,
  PROFILE,
  MODEL,
  DEMO_MODE
};
