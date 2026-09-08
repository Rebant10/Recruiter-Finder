/**
 * Recruiter Finder — Background Service Worker
 * Handles message routing, search orchestration, Google Sheets API, and settings.
 */

/* global chrome, searchAll, resolveDomain, bulkVerify, quickEmailVerify,
          generateEmail, generateAllPatterns, detectPattern, deduplicateResults,
          extractNameParts, SERVICES, FINDER_ORDER, SERP_ORDER */

// ─── Side Panel Behaviour ────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─── Import shared modules ──────────────────────────────────────
try { importScripts('finder.js'); } catch (_) { /* loaded via script tag in panel */ }

// ─── Message Router ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(err =>
    sendResponse({ success: false, error: err.message })
  );
  return true;
});

async function handleMessage(msg) {
  switch (msg.action) {
    // Auth
    case 'authenticate':
      return { success: true, token: await getAuthToken() };

    // Settings
    case 'getSettings':
      return { success: true, settings: await getSettings() };
    case 'saveSettings':
      await saveSettings(msg.settings);
      return { success: true };

    // Search
    case 'resolveDomain':
      return { success: true, domain: await resolveCompanyDomain(msg.company) };
    case 'searchCompany':
      return await executeSearch(msg);

    // Verification
    case 'verifyEmails':
      return await executeVerification(msg.emails);

    // Pattern generation
    case 'generateFromPattern':
      return { success: true, results: generateFromPattern(msg.names, msg.domain, msg.pattern) };

    // Sheets
    case 'getExistingEmails':
      return { success: true, emails: await getExistingEmails(msg.sheetUrl) };
    case 'exportToSheet':
      return await exportToSheet(msg);

    default:
      return { success: false, error: `Unknown action: ${msg.action}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Auth failed'));
      } else {
        resolve(token);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════

async function getSettings() {
  const r = await chrome.storage.local.get('finderSettings');
  return r.finderSettings || { apiKeys: {}, targetCount: 20, role: 'recruiter', location: 'india', sheetUrl: '' };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ finderSettings: settings });
}

async function getApiKeys() {
  const settings = await getSettings();
  return settings.apiKeys || {};
}

// ═══════════════════════════════════════════════════════════════════
//  SEARCH ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════

async function resolveCompanyDomain(companyName) {
  const keys = await getApiKeys();
  return await resolveDomain(companyName, keys);
}

async function executeSearch(msg) {
  const { domain, role, location, targetCount, existingEmails } = msg;
  const apiKeys = await getApiKeys();

  // Broadcast progress to the side panel
  const onProgress = (progress) => {
    chrome.runtime.sendMessage({
      action: 'searchProgress',
      ...progress
    }).catch(() => {});
  };

  const { results, pattern } = await searchAll(
    domain, role || 'recruiter', location || 'india',
    targetCount || 20, apiKeys, existingEmails || [], onProgress
  );

  return { success: true, results, pattern };
}

// ═══════════════════════════════════════════════════════════════════
//  VERIFICATION
// ═══════════════════════════════════════════════════════════════════

async function executeVerification(emails) {
  const apiKeys = await getApiKeys();
  if (!apiKeys.quickemail) {
    return { success: false, error: 'QuickEmailVerification API key not configured' };
  }

  const onVerified = (progress) => {
    chrome.runtime.sendMessage({
      action: 'verifyProgress',
      ...progress
    }).catch(() => {});
  };

  const results = await bulkVerify(emails, apiKeys.quickemail, onVerified);
  return { success: true, results };
}

// ═══════════════════════════════════════════════════════════════════
//  PATTERN GENERATION
// ═══════════════════════════════════════════════════════════════════

function generateFromPattern(names, domain, patternId) {
  return names.map(name => {
    const parts = extractNameParts(name);
    if (!parts) return null;
    const email = generateEmail(parts.first, parts.last, domain, patternId);
    return { email, name, title: '', source: 'pattern', confidence: 0 };
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS API
// ═══════════════════════════════════════════════════════════════════

async function apiFetch(url) {
  const token = await getAuthToken();
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API ${res.status}`);
  }
  return res.json();
}

async function apiPost(url, body) {
  const token = await getAuthToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API POST ${res.status}`);
  }
  return res.json();
}

async function apiPut(url, body) {
  const token = await getAuthToken();
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API PUT ${res.status}`);
  }
  return res.json();
}

function extractSheetId(url) {
  if (!url) return null;
  url = url.trim();
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/**
 * Read existing emails from a Google Sheet to avoid duplicates.
 */
async function getExistingEmails(sheetUrl) {
  if (!sheetUrl) return [];
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return [];

  try {
    // Get first tab name
    const meta = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
    );
    const tabName = meta.sheets[0]?.properties?.title || 'Sheet1';

    // Read all data
    const data = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}`
    );
    const values = data.values || [];
    if (values.length < 2) return [];

    // Find the Email column
    const headers = values[0].map(h => h.toLowerCase().trim());
    const emailIdx = headers.indexOf('email');
    if (emailIdx === -1) return [];

    // Extract all existing emails
    return values.slice(1)
      .map(row => (row[emailIdx] || '').toLowerCase().trim())
      .filter(e => e && e.includes('@'));
  } catch (_) {
    return [];
  }
}

/**
 * Export contacts to a Google Sheet.
 * Creates new sheet or appends to existing.
 */
async function exportToSheet(msg) {
  const { contacts, companyName, sheetUrl, createNew } = msg;
  const HEADERS = ['Email', 'Name', 'Company Name', 'Title', 'Source', 'Verified'];

  if (createNew) {
    // Create a new spreadsheet
    const sheet = await apiPost(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        properties: { title: `Recruiter Finder — ${companyName || 'Contacts'}` },
        sheets: [{ properties: { title: 'Contacts' } }]
      }
    );
    const newSheetId = sheet.spreadsheetId;
    const newUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`;

    // Write headers
    await apiPut(
      `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/${encodeURIComponent('Contacts!A1:F1')}?valueInputOption=RAW`,
      { values: [HEADERS] }
    );

    // Write data
    const rows = contacts.map(c => [
      c.email, c.name || '', companyName || '', c.title || '',
      (SERVICES[c.source]?.name || c.source || ''), c.verified || ''
    ]);

    if (rows.length > 0) {
      await apiPut(
        `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/${encodeURIComponent('Contacts!A2:F' + (rows.length + 1))}?valueInputOption=RAW`,
        { values: rows }
      );
    }

    return { success: true, sheetUrl: newUrl, count: rows.length };
  } else {
    // Append to existing sheet
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) throw new Error('Invalid Google Sheets URL');

    // Get first tab
    const meta = await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
    );
    const tabName = meta.sheets[0]?.properties?.title || 'Sheet1';

    // Check if headers exist
    let existingData;
    try {
      existingData = await apiFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName + '!A1:F1')}`
      );
    } catch (_) {
      existingData = { values: [] };
    }

    // Add headers if empty
    if (!existingData.values || existingData.values.length === 0) {
      await apiPut(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName + '!A1:F1')}?valueInputOption=RAW`,
        { values: [HEADERS] }
      );
    }

    // Append rows
    const rows = contacts.map(c => [
      c.email, c.name || '', companyName || '', c.title || '',
      (SERVICES[c.source]?.name || c.source || ''), c.verified || ''
    ]);

    if (rows.length > 0) {
      await apiPost(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName + '!A:F')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { values: rows }
      );
    }

    return { success: true, sheetUrl: sheetUrl, count: rows.length };
  }
}
