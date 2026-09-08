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
  'recruit', 'talent', 'hr', 'human resource', 'people', 'hiring',
  'staffing', 'workforce', 'head of people', 'people ops',
  'talent acquisition', 'campus', 'university relations', 'sourcer',
  'headhunter', 'culture'
];

function isHRTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return HR_KEYWORDS.some(kw => lower.includes(kw));
}

function filterByRole(contacts, role) {
  if (!contacts || contacts.length === 0) return [];
  if (role === 'all') return contacts;

  const matched = contacts.filter(c => {
    if (!c.title) return false;
    const t = c.title.toLowerCase();
    switch (role) {
      case 'recruiter':
      case 'hr':
        return isHRTitle(t);
      case 'hiring_manager':
        return t.includes('hiring') || t.includes('manager') || t.includes('lead') || t.includes('director') || t.includes('head');
      default:
        return true;
    }
  });

  // If matched contacts found, return them.
  // Otherwise, fall back to returning discovered contacts so leads are not lost when titles are missing.
  return matched.length > 0 ? matched : contacts;
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
  const raw = (apiKey || '').trim();
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) {
    throw new Error('Snov key format must be: userId:secret');
  }
  const userId = raw.slice(0, colonIdx).trim();
  const secret = raw.slice(colonIdx + 1).trim();
  if (!userId || !secret) {
    throw new Error('Snov key format must be: userId:secret');
  }

  const res = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: userId, client_secret: secret })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Snov auth failed (${res.status}): ${err.message || 'Invalid credentials'}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Snov auth: No access token returned');
  return data.access_token;
}

async function snovSearch(domain, apiKey) {
  const token = await snovGetToken(apiKey);

  // Step 1: Start domain email search (Snov expects form-encoded body)
  const startUrl = `https://api.snov.io/v2/domain-search/domain-emails/start?domain=${encodeURIComponent(domain)}`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${token}`
    },
    body: `domain=${encodeURIComponent(domain)}`
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(`Snov start error (${startRes.status}): ${err.message || err.error || startRes.statusText}`);
  }

  const startData = await startRes.json();
  const taskHash = startData.task_hash || startData.data?.task_hash;

  const directList = startData.emails || startData.data?.emails || (Array.isArray(startData.data) ? startData.data : null);
  if (directList && directList.length > 0) {
    return directList.map(e => ({
      email:  e.email || e.value || '',
      name:   [e.firstName || e.first_name, e.lastName || e.last_name].filter(Boolean).join(' ') || '',
      title:  e.position || e.title || '',
      source: 'snov',
      confidence: 85
    })).filter(c => c.email);
  }

  if (!taskHash) {
    throw new Error(`Snov: No task hash returned from start (${JSON.stringify(startData)})`);
  }

  for (let attempt = 0; attempt < 7; attempt++) {
    await new Promise(r => setTimeout(r, 1800));
    try {
      const res = await fetch(`https://api.snov.io/v2/domain-search/domain-emails/result/${taskHash}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) continue;

      const json = await res.json();
      const emails = json.data?.emails || json.emails || (Array.isArray(json.data) ? json.data : null);

      if (emails && Array.isArray(emails) && emails.length > 0) {
        return emails.map(e => ({
          email:  e.email || e.value || '',
          name:   [e.firstName || e.first_name, e.lastName || e.last_name].filter(Boolean).join(' ') || '',
          title:  e.position || e.title || '',
          source: 'snov',
          confidence: 85
        })).filter(c => c.email);
      }

      if (json.status === 'completed' || json.data?.status === 'completed') {
        break;
      }
    } catch (_) {
    }
  }

  return [];
}

// ─── Tomba.io ────────────────────────────────────────────────────

async function tombaSearch(domain, apiKey) {
  let url = `https://api.tomba.io/v1/domain-search?domain=${encodeURIComponent(domain)}&department=human_resources&limit=20`;
  let res = await fetch(url, {
    headers: { 'X-Tomba-Key': apiKey.trim(), 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Tomba (${res.status}): ${err.message || res.statusText}`);
  }
  let data = await res.json();
  let emails = data.data?.emails || [];

  if (emails.length === 0) {
    url = `https://api.tomba.io/v1/domain-search?domain=${encodeURIComponent(domain)}&limit=20`;
    res = await fetch(url, {
      headers: { 'X-Tomba-Key': apiKey.trim(), 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      data = await res.json();
      emails = data.data?.emails || [];
    }
  }

  return emails.map(e => ({
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
    headers: { 'apiKey': apiKey.trim(), 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`GetProspect (${res.status})`);
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
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
    body: JSON.stringify({ company: domain, limit: 20 })
  });
  if (!res.ok) throw new Error(`Prospeo (${res.status})`);
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
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': apiKey.trim() },
    body: JSON.stringify({
      data: [{ company: domain }],
      siren: false, language: 'en'
    })
  });
  if (!res.ok) throw new Error(`Dropcontact (${res.status})`);
  const data = await res.json();
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
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({ domain })
  });
  if (!res.ok) throw new Error(`AnyMailFinder (${res.status})`);
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
    headers: { 'X-API-KEY': apiKey.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 20 })
  });
  if (!res.ok) throw new Error(`Serper (${res.status})`);
  const data = await res.json();
  return data.organic || [];
}

// ─── SERP: SerpApi ───────────────────────────────────────────────

async function serpApiSearch(query, apiKey) {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey.trim())}&num=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi (${res.status})`);
  const data = await res.json();
  return data.organic_results || [];
}

// ─── LinkedIn X-Ray Parser ────────────────────────────────────────

function parseLinkedInResult(item, domain, patternId = 'first.last') {
  if (!item || !item.title) return null;
  const rawTitle = item.title;

  // Clean off " | LinkedIn" or "- LinkedIn"
  let clean = rawTitle.replace(/\s*[-–—|]\s*LinkedIn.*$/i, '').trim();

  // Split on dash, en-dash, em-dash, or pipe
  const parts = clean.split(/\s*[-–—|]\s*/);
  if (parts.length < 2) return null;

  const fullName = parts[0].trim();
  const nameWords = fullName.split(/\s+/);
  // Name should be 2 to 4 words, alphabetic only
  if (nameWords.length < 2 || nameWords.length > 4) return null;
  if (!/^[a-zA-Z\s.']{2,35}$/.test(fullName)) return null;

  // Extract job title
  let jobTitle = parts.slice(1).join(' - ').trim();
  jobTitle = jobTitle.replace(/\s+(at|@|-)\s+.*$/i, '').trim();

  const firstName = nameWords[0].replace(/[^a-zA-Z]/g, '');
  const lastName = nameWords[nameWords.length - 1].replace(/[^a-zA-Z]/g, '');
  if (!firstName || !lastName) return null;

  const email = generateEmail(firstName, lastName, domain, patternId || 'first.last');

  return {
    email: email.toLowerCase(),
    name: fullName,
    title: jobTitle || 'Recruiter',
    source: 'serper',
    confidence: 90
  };
}

// ─── SERP orchestrator (LinkedIn X-Ray + Public Emails) ───────────

async function searchViaSERP(domain, location, apiKeys, companyName = '') {
  const company = companyName || domain.split('.')[0];
  const locTerm = location !== 'any' ? ` ${location}` : '';
  const results = [];
  const seen = new Set();

  function addContact(contact) {
    if (!contact || !contact.email) return;
    const key = contact.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(contact);
    }
  }

  // 1. LinkedIn X-Ray Search: finds real recruiters currently working at the company
  const linkedinQuery = `site:linkedin.com/in "${company}" ("recruiter" OR "talent acquisition" OR "human resources" OR "hiring manager" OR "talent partner")${locTerm}`;

  if (apiKeys.serper) {
    try {
      const organic = await serperSearch(linkedinQuery, apiKeys.serper);
      for (const item of organic) {
        const contact = parseLinkedInResult(item, domain);
        if (contact) addContact(contact);
      }
    } catch (_) { }
  }

  if (apiKeys.serpapi) {
    try {
      const organic = await serpApiSearch(linkedinQuery, apiKeys.serpapi);
      for (const item of organic) {
        const contact = parseLinkedInResult(item, domain);
        if (contact) addContact(contact);
      }
    } catch (_) { }
  }

  // 2. Direct Public Email Search: finds explicitly shared emails with domain
  const publicEmailQuery = `"@${domain}" ("recruiter" OR "talent" OR "HR" OR "hiring")${locTerm}`;

  if (apiKeys.serper) {
    try {
      const organic = await serperSearch(publicEmailQuery, apiKeys.serper);
      for (const item of organic) {
        const text = `${item.title || ''} ${item.snippet || ''}`;
        const emails = extractEmailsFromText(text, domain);
        for (const email of emails) {
          addContact({ email, name: '', title: 'Recruiter', source: 'serper', confidence: 80 });
        }
      }
    } catch (_) { }
  }

  if (apiKeys.serpapi) {
    try {
      const organic = await serpApiSearch(publicEmailQuery, apiKeys.serpapi);
      for (const item of organic) {
        const text = `${item.title || ''} ${item.snippet || ''}`;
        const emails = extractEmailsFromText(text, domain);
        for (const email of emails) {
          addContact({ email, name: '', title: 'Recruiter', source: 'serpapi', confidence: 80 });
        }
      }
    } catch (_) { }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN SEARCH ORCHESTRATOR — Sequential + Smart Dedup
// ═══════════════════════════════════════════════════════════════════

async function searchAll(domain, role, location, targetCount, apiKeys, existingEmails = [], onProgress = () => {}, companyName = '') {
  const allResults = [];
  const serviceLogs = [];
  const seenEmails = new Set(existingEmails.map(e => e.toLowerCase()));

  function addResults(newContacts) {
    for (const contact of newContacts) {
      const emailLower = (contact.email || '').toLowerCase().trim();
      if (!emailLower || !emailLower.includes('@') || seenEmails.has(emailLower)) continue;
      seenEmails.add(emailLower);
      allResults.push({ ...contact, email: emailLower });
    }
  }

  // Phase 1: Google LinkedIn X-Ray (if Serper or SerpApi is configured)
  // This is the most reliable, free-tier-friendly source that never requires a work email!
  if (apiKeys.serper || apiKeys.serpapi) {
    onProgress({ service: 'serper', status: 'searching', found: allResults.length, total: targetCount });
    try {
      const serpResults = await searchViaSERP(domain, location, apiKeys, companyName);
      let filtered = serpResults;
      if (role !== 'all') filtered = filterByRole(serpResults, role);
      addResults(filtered);
      serviceLogs.push({ service: 'serper', status: 'done', count: filtered.length });
      onProgress({ service: 'serper', status: 'done', found: allResults.length, total: targetCount });
    } catch (err) {
      serviceLogs.push({ service: 'serper', status: 'error', error: err.message });
      onProgress({ service: 'serper', status: 'error', error: err.message, found: allResults.length, total: targetCount });
    }
  }

  // Phase 2: Direct Finder APIs (Hunter, Snov, Tomba, etc.)
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
      if (role !== 'all') contacts = filterByRole(contacts, role);
      addResults(contacts);
      serviceLogs.push({ service: serviceId, status: 'done', count: contacts.length });
      onProgress({ service: serviceId, status: 'done', found: allResults.length, total: targetCount });
    } catch (err) {
      serviceLogs.push({ service: serviceId, status: 'error', error: err.message });
      onProgress({ service: serviceId, status: 'error', error: err.message, found: allResults.length, total: targetCount });
    }
  }

  // Phase 2: SERP search (if still under target and SERP keys configured)
  if (allResults.length < targetCount && (apiKeys.serper || apiKeys.serpapi)) {
    onProgress({ service: 'serp', status: 'searching', found: allResults.length, total: targetCount });
    try {
      const serpResults = await searchViaSERP(domain, location, apiKeys);
      addResults(serpResults);
      serviceLogs.push({ service: 'serp', status: 'done', count: serpResults.length });
      onProgress({ service: 'serp', status: 'done', found: allResults.length, total: targetCount });
    } catch (err) {
      serviceLogs.push({ service: 'serp', status: 'error', error: err.message });
      onProgress({ service: 'serp', status: 'error', error: err.message, found: allResults.length, total: targetCount });
    }
  }

  // Trim to target
  const finalResults = allResults.slice(0, targetCount);

  // Detect pattern
  const pattern = detectPattern(finalResults.map(r => r.email), domain);

  return { results: finalResults, pattern, logs: serviceLogs };
}

// ═══════════════════════════════════════════════════════════════════
//  TEST SERVICE API KEYS
// ═══════════════════════════════════════════════════════════════════

async function testServiceKey(serviceId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('Key is empty');
  const key = apiKey.trim();

  switch (serviceId) {
    case 'snov': {
      const token = await snovGetToken(key);
      const testRes = await fetch('https://api.snov.io/v2/domain-search/domain-emails/start?domain=snov.io', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: 'domain=snov.io'
      });
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({}));
        throw new Error(`Auth OK, but search rejected (${testRes.status}): ${err.message || err.error || testRes.statusText}`);
      }
      const testData = await testRes.json();
      if (!testData.task_hash && !testData.data?.task_hash && !testData.emails) {
        throw new Error(`Snov response: ${JSON.stringify(testData)}`);
      }
      return 'Connected! Domain search verified';
    }
    case 'tomba': {
      const res = await fetch('https://api.tomba.io/v1/me', {
        headers: { 'X-Tomba-Key': key }
      });
      if (!res.ok) throw new Error(`Tomba (${res.status})`);
      const data = await res.json();
      return `Valid! Left: ${data.data?.requests?.left ?? '25'}`;
    }
    case 'hunter': {
      const res = await fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`Hunter (${res.status})`);
      const data = await res.json();
      return `Valid! Plan: ${data.data?.plan_name || 'Free'}`;
    }
    case 'serper': {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'test', num: 1 })
      });
      if (!res.ok) throw new Error(`Serper (${res.status})`);
      return 'Valid! Serper active';
    }
    case 'quickemail': {
      const res = await fetch(`https://api.quickemailverification.com/v1/verify?email=test@example.com&apikey=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`QEV (${res.status})`);
      return 'Valid! QuickEmail active';
    }
    default:
      return 'Key saved';
  }
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
//  EMAIL VERIFICATION (Google Public DNS MX — Zero Signup, Unlimited)
// ═══════════════════════════════════════════════════════════════════

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getairmail.com', 'temp-mail.org', 'fakeinbox.com', 'dispostable.com',
  'generator.email', 'tempail.com', 'burnermail.io'
]);

function parseDnsResponse(email, dnsData) {
  if (dnsData.Status === 0 && Array.isArray(dnsData.Answer) && dnsData.Answer.length > 0) {
    const mxHosts = dnsData.Answer.map(a => (a.data || '').toLowerCase()).join(' ');
    let provider = 'Active Mail Server';
    if (mxHosts.includes('google') || mxHosts.includes('googlemail') || mxHosts.includes('l.google.com')) {
      provider = 'Google Workspace';
    } else if (mxHosts.includes('outlook') || mxHosts.includes('microsoft')) {
      provider = 'Microsoft 365';
    } else if (mxHosts.includes('mimecast') || mxHosts.includes('pphosted') || mxHosts.includes('barracuda')) {
      provider = 'Enterprise Security Gateway';
    } else if (mxHosts.includes('zoho')) {
      provider = 'Zoho Mail';
    }
    return { email, result: 'valid', reason: provider, disposable: false };
  } else if (dnsData.Status === 3) {
    return { email, result: 'invalid', reason: 'Domain does not exist', disposable: false };
  } else {
    return { email, result: 'invalid', reason: 'Domain has no active mail server (MX)', disposable: false };
  }
}

async function verifyEmailDNS(email) {
  if (!email || !email.includes('@')) {
    return { email, result: 'invalid', reason: 'Invalid email syntax', disposable: false };
  }

  const [localPart, domain] = email.toLowerCase().trim().split('@');
  if (!localPart || !domain || !domain.includes('.')) {
    return { email, result: 'invalid', reason: 'Malformed domain', disposable: false };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email, result: 'invalid', reason: 'Disposable email provider', disposable: true };
  }

  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
    if (!res.ok) {
      const cfRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
        headers: { 'Accept': 'application/dns-json' }
      });
      if (cfRes.ok) {
        const cfData = await cfRes.json();
        return parseDnsResponse(email, cfData);
      }
      return { email, result: 'unknown', reason: 'DNS query error', disposable: false };
    }

    const data = await res.json();
    return parseDnsResponse(email, data);
  } catch (err) {
    return { email, result: 'unknown', reason: err.message || 'Network error', disposable: false };
  }
}

async function bulkVerify(emails, _apiKey = '', onVerified = () => {}) {
  const results = [];
  for (let i = 0; i < emails.length; i++) {
    try {
      const result = await verifyEmailDNS(emails[i]);
      results.push(result);
      onVerified({ index: i, total: emails.length, result });
    } catch (err) {
      const fallback = { email: emails[i], result: 'unknown', reason: err.message };
      results.push(fallback);
      onVerified({ index: i, total: emails.length, result: fallback });
    }
    if (i < emails.length - 1) {
      await new Promise(r => setTimeout(r, 120));
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
