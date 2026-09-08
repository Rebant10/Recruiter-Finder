/**
 * Recruiter Finder — Multi-Source Email Discovery Engine
 * Adapters for 7 email finders + 2 SERP search + 1 verification + pattern engine
 */

// ═══════════════════════════════════════════════════════════════════
//  SERVICE REGISTRY
// ═══════════════════════════════════════════════════════════════════

const SERVICES = {
  hunter:       { name: 'Hunter.io',           icon: '🏹', color: '#ff6b35', type: 'finder',   signupUrl: 'https://hunter.io/users/sign_up' },
  snov:         { name: 'Snov.io',             icon: '📧', color: '#5b7fff', type: 'finder',   signupUrl: 'https://app.snov.io/register' },
  tomba:        { name: 'Tomba.io',            icon: '🔍', color: '#14b8a6', type: 'finder',   signupUrl: 'https://app.tomba.io/auth/register' },
  getprospect:  { name: 'GetProspect',         icon: '📋', color: '#6366f1', type: 'finder',   signupUrl: 'https://getprospect.com/signup' },
  prospeo:      { name: 'Prospeo.io',          icon: '🎯', color: '#ec4899', type: 'finder',   signupUrl: 'https://app.prospeo.io/register' },
  dropcontact:  { name: 'Dropcontact',         icon: '💧', color: '#06b6d4', type: 'finder',   signupUrl: 'https://app.dropcontact.com/signup' },
  anymailfinder:{ name: 'AnyMailFinder',       icon: '📬', color: '#f59e0b', type: 'finder',   signupUrl: 'https://anymailfinder.com/signup' },
  serper:       { name: 'Serper.dev',          icon: '🌐', color: '#22c55e', type: 'serp',     signupUrl: 'https://serper.dev' },
  serpapi:      { name: 'SerpApi',             icon: '🔎', color: '#84cc16', type: 'serp',     signupUrl: 'https://serpapi.com/users/sign_up' },
  quickemail:   { name: 'QuickEmailVerify',    icon: '✓',  color: '#10b981', type: 'verifier', signupUrl: 'https://quickemailverification.com/register' }
};

const FINDER_ORDER = ['hunter', 'snov', 'tomba', 'getprospect', 'prospeo', 'dropcontact', 'anymailfinder'];
const SERP_ORDER   = ['serper', 'serpapi'];

// ═══════════════════════════════════════════════════════════════════
//  EMAIL REGEX
// ═══════════════════════════════════════════════════════════════════

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmailsFromText(text, targetDomain) {
  if (!text || !targetDomain) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  const domainLower = targetDomain.toLowerCase();
  return [...new Set(
    matches
      .map(e => e.toLowerCase().trim())
      .filter(e => e.endsWith('@' + domainLower))
      .filter(e => !e.startsWith('noreply') && !e.startsWith('info@') &&
                   !e.startsWith('support@') && !e.startsWith('contact@') &&
                   !e.startsWith('admin@') && !e.startsWith('hello@') &&
                   !e.startsWith('sales@') && !e.startsWith('hr@') &&
                   !e.startsWith('careers@') && !e.startsWith('jobs@'))
  )];
}

// ═══════════════════════════════════════════════════════════════════
//  HR / RECRUITER TITLE MATCHING
// ═══════════════════════════════════════════════════════════════════

const HR_KEYWORDS = [
  'recruit', 'talent', 'hr ', 'human resource', 'people', 'hiring',
  'staffing', 'workforce', 'h.r.', 'head of people', 'people ops',
  'talent acquisition', 'campus', 'university relations'
];

function isHRTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return HR_KEYWORDS.some(kw => lower.includes(kw));
}

function filterByRole(contacts, role) {
  if (role === 'all') return contacts;
  return contacts.filter(c => {
    if (!c.title) return false;
    const t = c.title.toLowerCase();
    switch (role) {
      case 'recruiter':       return t.includes('recruit') || t.includes('talent') || t.includes('staffing');
      case 'hr':              return isHRTitle(t);
      case 'hiring_manager':  return t.includes('hiring') || t.includes('manager');
      default:                return true;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
//  SERVICE ADAPTERS — each returns [{ email, name, title, source }]
// ═══════════════════════════════════════════════════════════════════

// ─── Hunter.io ───────────────────────────────────────────────────

async function hunterSearch(domain, apiKey) {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&department=hr&limit=20&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hunter ${res.status}`);
  const data = await res.json();
  return (data.data?.emails || []).map(e => ({
    email:  e.value,
    name:   [e.first_name, e.last_name].filter(Boolean).join(' ') || '',
    title:  e.position || '',
    source: 'hunter',
    confidence: e.confidence || 0
  }));
}

// ─── Snov.io ─────────────────────────────────────────────────────

async function snovGetToken(apiKey) {
  // Snov uses clientId + clientSecret; for simplicity we take the full key as "userId:secret"
  // But actually Snov's API uses user_id and client_secret. We'll accept "userId:secret" format.
  const [userId, secret] = apiKey.split(':');
  if (!userId || !secret) throw new Error('Snov key format: userId:secret');
  const res = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: userId, client_secret: secret })
  });
  if (!res.ok) throw new Error(`Snov auth ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function snovSearch(domain, apiKey) {
  const token = await snovGetToken(apiKey);
  const res = await fetch('https://api.snov.io/v2/domain-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ domain, limit: 20 })
  });
  if (!res.ok) throw new Error(`Snov ${res.status}`);
  const data = await res.json();
  return (data.emails || data.result?.emails || []).map(e => ({
    email:  e.email || e.value || '',
    name:   [e.firstName || e.first_name, e.lastName || e.last_name].filter(Boolean).join(' ') || '',
    title:  e.position || e.title || '',
    source: 'snov',
    confidence: e.confidence || 0
  }));
}

// ─── Tomba.io ────────────────────────────────────────────────────

async function tombaSearch(domain, apiKey) {
  const url = `https://api.tomba.io/v1/domain-search?domain=${encodeURIComponent(domain)}&department=human_resources&limit=20`;
  const res = await fetch(url, {
    headers: { 'X-Tomba-Key': apiKey, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Tomba ${res.status}`);
  const data = await res.json();
  return (data.data?.emails || []).map(e => ({
    email:  e.email || '',
    name:   [e.first_name, e.last_name].filter(Boolean).join(' ') || '',
    title:  e.position || '',
    source: 'tomba',
    confidence: e.confidence || 0
  }));
}

// ─── GetProspect ─────────────────────────────────────────────────

async function getProspectSearch(domain, apiKey) {
  const url = `https://api.getprospect.com/api/v1/emails/search?domain=${encodeURIComponent(domain)}&limit=20`;
  const res = await fetch(url, {
    headers: { 'apiKey': apiKey, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`GetProspect ${res.status}`);
  const data = await res.json();
  return (data.data || data.emails || data.results || []).map(e => ({
    email:  e.email || e.value || '',
    name:   e.name || [e.firstName, e.lastName].filter(Boolean).join(' ') || '',
    title:  e.title || e.position || '',
    source: 'getprospect',
    confidence: e.confidence || 0
  }));
}

// ─── Prospeo.io ──────────────────────────────────────────────────

async function prospeoSearch(domain, apiKey) {
  const res = await fetch('https://api.prospeo.io/domain-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ company: domain, limit: 20 })
  });
  if (!res.ok) throw new Error(`Prospeo ${res.status}`);
  const data = await res.json();
  return (data.response?.emails || data.emails || []).map(e => ({
    email:  e.email || '',
    name:   e.name || [e.first_name, e.last_name].filter(Boolean).join(' ') || '',
    title:  e.title || e.position || '',
    source: 'prospeo',
    confidence: e.confidence || 0
  }));
}

// ─── Dropcontact ─────────────────────────────────────────────────

async function dropcontactSearch(domain, apiKey) {
  const res = await fetch('https://api.dropcontact.com/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': apiKey },
    body: JSON.stringify({
      data: [{ company: domain }],
      siren: false, language: 'en'
    })
  });
  if (!res.ok) throw new Error(`Dropcontact ${res.status}`);
  const data = await res.json();
  // Dropcontact is enrichment-first; it may return differently
  const contacts = data.data || [];
  return contacts.filter(c => c.email).map(c => ({
    email:  c.email || '',
    name:   [c.first_name, c.last_name].filter(Boolean).join(' ') || '',
    title:  c.job_title || '',
    source: 'dropcontact',
    confidence: c.email_confidence || 0
  }));
}

// ─── AnyMailFinder ───────────────────────────────────────────────

async function anyMailFinderSearch(domain, apiKey) {
  const res = await fetch('https://api.anymailfinder.com/v5/search/company.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ domain })
  });
  if (!res.ok) throw new Error(`AnyMailFinder ${res.status}`);
  const data = await res.json();
  const emails = data.emails || data.results || [];
  if (Array.isArray(emails) && typeof emails[0] === 'string') {
    return emails.map(e => ({ email: e, name: '', title: '', source: 'anymailfinder', confidence: 0 }));
  }
  return emails.map(e => ({
    email:  e.email || e.value || '',
    name:   e.name || '',
    title:  e.title || '',
    source: 'anymailfinder',
    confidence: e.confidence || 0
  }));
}

// ─── SERP: Serper.dev ────────────────────────────────────────────

async function serperSearch(query, apiKey) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 20 })
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();
  return data.organic || [];
}

// ─── SERP: SerpApi ───────────────────────────────────────────────

async function serpApiSearch(query, apiKey) {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&num=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const data = await res.json();
  return data.organic_results || [];
}

// ─── SERP orchestrator ───────────────────────────────────────────

async function searchViaSERP(domain, location, apiKeys) {
  const roleTerms = 'recruiter OR "talent acquisition" OR "HR manager" OR "hiring"';
  const locTerm = location !== 'any' ? ` ${location}` : '';
  const query = `"@${domain}" ${roleTerms}${locTerm}`;

  const results = [];

  // Try Serper first
  if (apiKeys.serper) {
    try {
      const organic = await serperSearch(query, apiKeys.serper);
      for (const item of organic) {
        const text = `${item.title || ''} ${item.snippet || ''}`;
        const emails = extractEmailsFromText(text, domain);
        for (const email of emails) {
          results.push({ email, name: '', title: '', source: 'serper', confidence: 0 });
        }
      }
    } catch (_) { /* skip */ }
  }

  // Try SerpApi
  if (apiKeys.serpapi) {
    try {
      const organic = await serpApiSearch(query, apiKeys.serpapi);
      for (const item of organic) {
        const text = `${item.title || ''} ${item.snippet || ''}`;
        const emails = extractEmailsFromText(text, domain);
        for (const email of emails) {
          if (!results.some(r => r.email === email)) {
            results.push({ email, name: '', title: '', source: 'serpapi', confidence: 0 });
          }
        }
      }
    } catch (_) { /* skip */ }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN SEARCH ORCHESTRATOR — Sequential + Smart Dedup
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {string}   domain       - Company domain
 * @param {string}   role         - 'recruiter' | 'hr' | 'hiring_manager' | 'all'
 * @param {string}   location     - 'india' | 'us' | 'uk' | 'any'
 * @param {number}   targetCount  - How many emails the user wants
 * @param {Object}   apiKeys      - { hunter: 'key', snov: 'uid:secret', ... }
 * @param {string[]} existingEmails - Emails already in the target sheet (skip these)
 * @param {Function} onProgress   - callback({ service, status, found, total })
 * @returns {Promise<{ results: Array, pattern: Object|null }>}
 */
async function searchAll(domain, role, location, targetCount, apiKeys, existingEmails = [], onProgress = () => {}) {
  const allResults = [];
  const seenEmails = new Set(existingEmails.map(e => e.toLowerCase()));

  function addResults(newContacts) {
    for (const contact of newContacts) {
      const emailLower = (contact.email || '').toLowerCase().trim();
      if (!emailLower || !emailLower.includes('@') || seenEmails.has(emailLower)) continue;
      seenEmails.add(emailLower);
      allResults.push({ ...contact, email: emailLower });
    }
  }

  // Phase 1: Email finder APIs (sequential — stop when target reached)
  for (const serviceId of FINDER_ORDER) {
    if (allResults.length >= targetCount) break;
    if (!apiKeys[serviceId]) continue;

    onProgress({ service: serviceId, status: 'searching', found: allResults.length, total: targetCount });

    try {
      let contacts = [];
      switch (serviceId) {
        case 'hunter':        contacts = await hunterSearch(domain, apiKeys.hunter); break;
        case 'snov':          contacts = await snovSearch(domain, apiKeys.snov); break;
        case 'tomba':         contacts = await tombaSearch(domain, apiKeys.tomba); break;
        case 'getprospect':   contacts = await getProspectSearch(domain, apiKeys.getprospect); break;
        case 'prospeo':       contacts = await prospeoSearch(domain, apiKeys.prospeo); break;
        case 'dropcontact':   contacts = await dropcontactSearch(domain, apiKeys.dropcontact); break;
        case 'anymailfinder': contacts = await anyMailFinderSearch(domain, apiKeys.anymailfinder); break;
      }
      // Filter by role
      if (role !== 'all') contacts = filterByRole(contacts, role);
      addResults(contacts);
      onProgress({ service: serviceId, status: 'done', found: allResults.length, total: targetCount });
    } catch (err) {
      onProgress({ service: serviceId, status: 'error', error: err.message, found: allResults.length, total: targetCount });
    }
  }

  // Phase 2: SERP search (if still under target and SERP keys configured)
  if (allResults.length < targetCount && (apiKeys.serper || apiKeys.serpapi)) {
    onProgress({ service: 'serp', status: 'searching', found: allResults.length, total: targetCount });
    try {
      const serpResults = await searchViaSERP(domain, location, apiKeys);
      addResults(serpResults);
      onProgress({ service: 'serp', status: 'done', found: allResults.length, total: targetCount });
    } catch (err) {
      onProgress({ service: 'serp', status: 'error', error: err.message, found: allResults.length, total: targetCount });
    }
  }

  // Trim to target
  const finalResults = allResults.slice(0, targetCount);

  // Detect pattern
  const pattern = detectPattern(finalResults.map(r => r.email), domain);

  return { results: finalResults, pattern };
}

// ═══════════════════════════════════════════════════════════════════
//  PATTERN DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

const PATTERN_TEMPLATES = [
  { id: 'first.last',  fn: (f, l) => `${f}.${l}` },
  { id: 'first_last',  fn: (f, l) => `${f}_${l}` },
  { id: 'first-last',  fn: (f, l) => `${f}-${l}` },
  { id: 'first',       fn: (f)    => f },
  { id: 'last',        fn: (_, l) => l },
  { id: 'flast',       fn: (f, l) => `${f[0]}${l}` },
  { id: 'firstl',      fn: (f, l) => `${f}${l[0]}` },
  { id: 'last.first',  fn: (f, l) => `${l}.${f}` },
  { id: 'f.last',      fn: (f, l) => `${f[0]}.${l}` },
  { id: 'first.l',     fn: (f, l) => `${f}.${l[0]}` }
];

function extractNameParts(fullName) {
  if (!fullName) return null;
  const parts = fullName.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  return { first: parts[0], last: parts[parts.length - 1] };
}

function detectPattern(emails, domain) {
  const domainLower = domain.toLowerCase();
  const emailsAtDomain = emails
    .map(e => e.toLowerCase())
    .filter(e => e.endsWith('@' + domainLower));

  if (emailsAtDomain.length < 2) return null;

  // We need email-name pairs to detect patterns.
  // Without names, we can still detect the structure
  const localParts = emailsAtDomain.map(e => e.split('@')[0]);

  // Check if all use dots (first.last pattern)
  const withDots   = localParts.filter(lp => lp.includes('.')).length;
  const withUnderscore = localParts.filter(lp => lp.includes('_')).length;
  const withHyphen = localParts.filter(lp => lp.includes('-')).length;
  const plainSingle = localParts.filter(lp => !lp.includes('.') && !lp.includes('_') && !lp.includes('-')).length;

  const total = localParts.length;
  let bestPattern = 'first.last';
  let bestScore = 0;

  if (withDots / total > bestScore)      { bestPattern = 'first.last'; bestScore = withDots / total; }
  if (withUnderscore / total > bestScore) { bestPattern = 'first_last'; bestScore = withUnderscore / total; }
  if (withHyphen / total > bestScore)     { bestPattern = 'first-last'; bestScore = withHyphen / total; }
  if (plainSingle / total > bestScore)    { bestPattern = 'first'; bestScore = plainSingle / total; }

  return {
    pattern: bestPattern,
    confidence: Math.round(bestScore * 100),
    sampleSize: total
  };
}

function generateEmail(firstName, lastName, domain, patternId) {
  const f = firstName.toLowerCase().trim();
  const l = lastName.toLowerCase().trim();
  const d = domain.toLowerCase().trim();
  const tmpl = PATTERN_TEMPLATES.find(t => t.id === patternId);
  if (!tmpl) return `${f}.${l}@${d}`;
  return `${tmpl.fn(f, l)}@${d}`;
}

function generateAllPatterns(firstName, lastName, domain) {
  const f = firstName.toLowerCase().trim();
  const l = lastName.toLowerCase().trim();
  const d = domain.toLowerCase().trim();
  return PATTERN_TEMPLATES.map(t => ({
    pattern: t.id,
    email: `${t.fn(f, l)}@${d}`
  }));
}

// ═══════════════════════════════════════════════════════════════════
//  EMAIL VERIFICATION
// ═══════════════════════════════════════════════════════════════════

async function quickEmailVerify(email, apiKey) {
  const url = `https://api.quickemailverification.com/v1/verify?email=${encodeURIComponent(email)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QEV ${res.status}`);
  const data = await res.json();
  // result: 'valid', 'invalid', 'unknown'
  return {
    email,
    result: data.result || 'unknown',
    disposable: data.disposable === 'true',
    reason: data.reason || ''
  };
}

async function bulkVerify(emails, apiKey, onVerified = () => {}) {
  const results = [];
  for (let i = 0; i < emails.length; i++) {
    try {
      const result = await quickEmailVerify(emails[i], apiKey);
      results.push(result);
      onVerified({ index: i, total: emails.length, result });
    } catch (err) {
      results.push({ email: emails[i], result: 'unknown', reason: err.message });
      onVerified({ index: i, total: emails.length, result: { email: emails[i], result: 'error' } });
    }
    // Rate limit: 1 request per second
    if (i < emails.length - 1) {
      await new Promise(r => setTimeout(r, 1100));
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
//  DOMAIN RESOLUTION
// ═══════════════════════════════════════════════════════════════════

async function resolveDomain(companyName, apiKeys) {
  // Try Serper first for domain resolution
  if (apiKeys.serper) {
    try {
      const organic = await serperSearch(`${companyName} official website`, apiKeys.serper);
      if (organic.length > 0) {
        const url = organic[0].link || '';
        const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
        if (match) return match[1];
      }
    } catch (_) { /* try next */ }
  }

  // Try SerpApi
  if (apiKeys.serpapi) {
    try {
      const organic = await serpApiSearch(`${companyName} official website`, apiKeys.serpapi);
      if (organic.length > 0) {
        const url = organic[0].link || '';
        const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
        if (match) return match[1];
      }
    } catch (_) { /* fallback */ }
  }

  // Fallback: guess common domain patterns
  const cleaned = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleaned}.com`;
}

// ═══════════════════════════════════════════════════════════════════
//  DEDUPLICATION HELPER
// ═══════════════════════════════════════════════════════════════════

function deduplicateResults(results) {
  const map = new Map();
  for (const r of results) {
    const key = r.email.toLowerCase();
    if (!map.has(key) || (r.confidence > (map.get(key).confidence || 0))) {
      map.set(key, r);
    }
  }
  return [...map.values()];
}
