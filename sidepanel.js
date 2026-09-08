/**
 * Recruiter Finder — Side Panel UI Controller
 */

/* global chrome, SERVICES */

document.addEventListener('DOMContentLoaded', async () => {
  // ─── State ───────────────────────────────────────────────────────
  let state = {
    results: [],
    pattern: null,
    domain: '',
    company: '',
    settings: {
      apiKeys: {},
      targetCount: 20,
      role: 'recruiter',
      location: 'india',
      sheetUrl: ''
    }
  };

  // ─── DOM Elements ────────────────────────────────────────────────
  const btnSettings = document.getElementById('btnSettings');
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const defaultSheetUrlInput = document.getElementById('defaultSheetUrlInput');

  const companyInput = document.getElementById('companyInput');
  const btnAutoDomain = document.getElementById('btnAutoDomain');
  const domainInput = document.getElementById('domainInput');
  const roleSelect = document.getElementById('roleSelect');
  const locationSelect = document.getElementById('locationSelect');
  const targetCountInput = document.getElementById('targetCountInput');
  const dedupSheetInput = document.getElementById('dedupSheetInput');
  const btnFindEmails = document.getElementById('btnFindEmails');
  const btnFindText = document.getElementById('btnFindText');

  const progressCard = document.getElementById('progressCard');
  const progressStatusText = document.getElementById('progressStatusText');
  const progressCounter = document.getElementById('progressCounter');
  const progressBar = document.getElementById('progressBar');
  const servicePills = document.getElementById('servicePills');

  const resultsCard = document.getElementById('resultsCard');
  const resultsMeta = document.getElementById('resultsMeta');
  const resultsTableBody = document.getElementById('resultsTableBody');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectedCountSpan = document.getElementById('selectedCount');
  const tableFilterInput = document.getElementById('tableFilterInput');
  const btnVerifyAll = document.getElementById('btnVerifyAll');
  const btnOpenExport = document.getElementById('btnOpenExport');

  const patternBanner = document.getElementById('patternBanner');
  const patternText = document.getElementById('patternText');
  const patternConfidence = document.getElementById('patternConfidence');
  const btnTogglePattern = document.getElementById('btnTogglePattern');
  const patternDrawer = document.getElementById('patternDrawer');
  const patternNamesInput = document.getElementById('patternNamesInput');
  const btnGeneratePatternEmails = document.getElementById('btnGeneratePatternEmails');

  const exportModal = document.getElementById('exportModal');
  const btnCloseExport = document.getElementById('btnCloseExport');
  const btnCancelExport = document.getElementById('btnCancelExport');
  const btnConfirmExport = document.getElementById('btnConfirmExport');
  const exportSheetGroup = document.getElementById('exportSheetGroup');
  const exportSheetUrl = document.getElementById('exportSheetUrl');
  const exportStatus = document.getElementById('exportStatus');

  const toastContainer = document.getElementById('toastContainer');

  // ─── Toast System ────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ─── Settings Management ─────────────────────────────────────────
  async function loadSettings() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (resp && resp.success && resp.settings) {
        state.settings = resp.settings;
        applySettingsToUI();
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  }

  function applySettingsToUI() {
    // Populate modal inputs
    document.querySelectorAll('.api-key-input').forEach(input => {
      const keyName = input.dataset.key;
      input.value = state.settings.apiKeys[keyName] || '';
    });
    defaultSheetUrlInput.value = state.settings.sheetUrl || '';

    // Populate search inputs
    if (state.settings.targetCount) targetCountInput.value = state.settings.targetCount;
    if (state.settings.role) roleSelect.value = state.settings.role;
    if (state.settings.location) locationSelect.value = state.settings.location;
    if (state.settings.sheetUrl && !dedupSheetInput.value) {
      dedupSheetInput.value = state.settings.sheetUrl;
    }
  }

  async function saveSettings() {
    const keys = {};
    document.querySelectorAll('.api-key-input').forEach(input => {
      const val = input.value.trim();
      if (val) keys[input.dataset.key] = val;
    });

    state.settings.apiKeys = keys;
    state.settings.sheetUrl = defaultSheetUrlInput.value.trim();
    state.settings.targetCount = parseInt(targetCountInput.value, 10) || 20;
    state.settings.role = roleSelect.value;
    state.settings.location = locationSelect.value;

    const resp = await chrome.runtime.sendMessage({ action: 'saveSettings', settings: state.settings });
    if (resp && resp.success) {
      showToast('Settings saved successfully', 'success');
      settingsModal.style.display = 'none';
    } else {
      showToast(resp?.error || 'Failed to save settings', 'error');
    }
  }

  btnSettings.addEventListener('click', () => {
    applySettingsToUI();
    settingsModal.style.display = 'flex';
  });
  btnCloseSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });
  btnCancelSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });
  btnSaveSettings.addEventListener('click', saveSettings);

  // ─── Domain Resolution ───────────────────────────────────────────
  async function autoDetectDomain() {
    const company = companyInput.value.trim();
    if (!company) {
      showToast('Please enter a company name first', 'error');
      return;
    }
    btnAutoDomain.disabled = true;
    btnAutoDomain.textContent = '...';
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'resolveDomain', company });
      if (resp && resp.success && resp.domain) {
        domainInput.value = resp.domain;
        showToast(`Detected domain: ${resp.domain}`, 'success');
      } else {
        const fallback = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
        domainInput.value = fallback;
      }
    } catch (e) {
      const fallback = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
      domainInput.value = fallback;
    } finally {
      btnAutoDomain.disabled = false;
      btnAutoDomain.textContent = 'Detect';
    }
  }

  btnAutoDomain.addEventListener('click', autoDetectDomain);
  companyInput.addEventListener('blur', () => {
    if (companyInput.value.trim() && !domainInput.value.trim()) {
      autoDetectDomain();
    }
  });

  // ─── Service Pill Helpers ────────────────────────────────────────
  function initServicePills() {
    servicePills.innerHTML = '';
    const activeKeys = state.settings.apiKeys || {};
    const configuredServices = Object.keys(SERVICES).filter(s => activeKeys[s] || s === 'quickemail');

    if (configuredServices.length === 0) {
      servicePills.innerHTML = '<span class="form-hint">No API keys configured. Click ⚙️ to add free keys.</span>';
      return;
    }

    configuredServices.forEach(s => {
      const info = SERVICES[s];
      const pill = document.createElement('div');
      pill.className = 'service-pill';
      pill.id = `pill-${s}`;
      pill.innerHTML = `<span>${info.icon}</span> <span>${info.name}</span>`;
      servicePills.appendChild(pill);
    });
  }

  function updateServicePill(serviceId, status, errorMsg) {
    const pill = document.getElementById(`pill-${serviceId}`);
    if (!pill) return;
    pill.className = `service-pill ${status}`;
    const sMeta = SERVICES[serviceId] || { icon: '🔍', name: serviceId };
    if (status === 'active') {
      pill.innerHTML = `<span>${sMeta.icon}</span> <span>${sMeta.name}</span> <span style="font-size:9px">⏳</span>`;
    } else if (status === 'error') {
      pill.title = errorMsg || 'Error querying service';
      pill.innerHTML = `<span>${sMeta.icon}</span> <span>${sMeta.name}</span> <span style="font-size:9px">⚠️</span>`;
    } else if (status === 'done') {
      pill.innerHTML = `<span>${sMeta.icon}</span> <span>${sMeta.name}</span> <span style="font-size:9px">✓</span>`;
    }
  }

  // ─── Progress Listener from Worker ───────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'searchProgress') {
      const { service, status, found, total, error } = msg;
      if (status === 'searching') {
        progressStatusText.textContent = `Querying ${SERVICES[service]?.name || service}...`;
        updateServicePill(service, 'active');
      } else if (status === 'done') {
        updateServicePill(service, 'done');
      } else if (status === 'error') {
        updateServicePill(service, 'error', error);
        if (error) {
          showToast(`${SERVICES[service]?.name || service}: ${error}`, 'error');
        }
      }
      progressCounter.textContent = `${found} / ${total}`;
      const pct = Math.min(100, Math.round((found / total) * 100));
      progressBar.style.width = `${pct}%`;
    } else if (msg.action === 'verifyProgress') {
      const { index, total, result } = msg;
      progressStatusText.textContent = `Verifying emails (${index + 1}/${total})...`;
      progressBar.style.width = `${Math.round(((index + 1) / total) * 100)}%`;
      if (result) {
        updateContactVerification(result.email, result.result);
      }
    }
  });

  // ─── Main Search Flow ────────────────────────────────────────────
  btnFindEmails.addEventListener('click', async () => {
    const company = companyInput.value.trim();
    let domain = domainInput.value.trim();

    if (!company) {
      showToast('Enter a company name', 'error');
      companyInput.focus();
      return;
    }
    if (!domain) {
      domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
      domainInput.value = domain;
    }

    state.company = company;
    state.domain = domain;

    const role = roleSelect.value;
    const location = locationSelect.value;
    const targetCount = parseInt(targetCountInput.value, 10) || 20;
    const sheetUrl = dedupSheetInput.value.trim();

    // Check if at least 1 key configured
    const configuredKeys = Object.keys(state.settings.apiKeys || {});
    if (configuredKeys.length === 0) {
      showToast('Please add at least 1 API key in Settings (⚙️)', 'error');
      settingsModal.style.display = 'flex';
      return;
    }

    // UI Loading state
    btnFindEmails.disabled = true;
    btnFindText.textContent = 'Searching...';
    progressCard.style.display = 'flex';
    resultsCard.style.display = 'none';
    progressBar.style.width = '0%';
    progressCounter.textContent = `0 / ${targetCount}`;
    initServicePills();

    // Step 1: Pre-fetch sheet to deduplicate
    let existingEmails = [];
    if (sheetUrl) {
      progressStatusText.textContent = 'Checking existing contacts in Sheet...';
      try {
        const sheetResp = await chrome.runtime.sendMessage({ action: 'getExistingEmails', sheetUrl });
        if (sheetResp && sheetResp.success && sheetResp.emails) {
          existingEmails = sheetResp.emails;
          if (existingEmails.length > 0) {
            showToast(`Found ${existingEmails.length} existing contacts in sheet — will skip them`, 'info');
          }
        }
      } catch (err) {
        console.warn('Could not read existing sheet:', err);
      }
    }

    // Step 2: Execute search
    progressStatusText.textContent = 'Querying email discovery APIs...';
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'searchCompany',
        domain,
        role,
        location,
        targetCount,
        existingEmails
      });

      if (!resp || !resp.success) {
        throw new Error(resp?.error || 'Search encountered an error');
      }

      state.results = (resp.results || []).map(c => ({
        ...c,
        selected: true,
        verified: 'unverified'
      }));
      state.pattern = resp.pattern;

      renderResults(resp.logs || []);
      if (state.results.length > 0) {
        showToast(`Discovered ${state.results.length} contacts!`, 'success');
      } else {
        showToast('0 contacts discovered — check diagnostics below', 'info');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnFindEmails.disabled = false;
      btnFindText.textContent = 'Find Recruiter Emails';
      progressCard.style.display = 'none';
    }
  });

  // ─── Test API Key Buttons ─────────────────────────────────────────
  document.querySelectorAll('.btn-test-key').forEach(btn => {
    btn.addEventListener('click', async () => {
      const serviceId = btn.dataset.service;
      const row = btn.closest('.service-row');
      const input = row?.querySelector('.api-key-input');
      const key = input ? input.value.trim() : '';

      if (!key) {
        showToast(`Please enter an API key for ${SERVICES[serviceId]?.name || serviceId}`, 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '...';
      try {
        const resp = await chrome.runtime.sendMessage({
          action: 'testService',
          service: serviceId,
          apiKey: key
        });

        if (resp && resp.success) {
          btn.style.color = '#34d399';
          btn.textContent = '✓ OK';
          showToast(`${SERVICES[serviceId]?.name || serviceId}: ${resp.message}`, 'success');
        } else {
          btn.style.color = '#f87171';
          btn.textContent = '✕ Failed';
          showToast(`${SERVICES[serviceId]?.name || serviceId}: ${resp?.error || 'Test failed'}`, 'error');
        }
      } catch (e) {
        btn.style.color = '#f87171';
        btn.textContent = '✕ Error';
        showToast(e.message, 'error');
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Test';
          btn.style.color = '';
        }, 3500);
      }
    });
  });

  // ─── Results Rendering ───────────────────────────────────────────
  function renderResults(logs = []) {
    resultsCard.style.display = 'flex';
    resultsMeta.textContent = `Found ${state.results.length} unique contacts for ${state.domain}`;

    const zeroBox = document.getElementById('zeroResultsBox');
    if (zeroBox) {
      if (state.results.length === 0) {
        zeroBox.style.display = 'flex';
        let logsHtml = (logs || []).map(l => {
          const name = SERVICES[l.service]?.name || l.service;
          if (l.status === 'error') {
            return `<div class="zero-results-item">❌ <strong>${escapeHtml(name)}:</strong> ${escapeHtml(l.error)}</div>`;
          } else {
            return `<div class="zero-results-item">ℹ️ <strong>${escapeHtml(name)}:</strong> Returned 0 contacts</div>`;
          }
        }).join('');

        zeroBox.innerHTML = `
          <div class="zero-results-title">⚠️ No contacts found</div>
          <div class="zero-results-list">
            ${logsHtml || '<div class="zero-results-item">No services returned contacts.</div>'}
          </div>
          <div style="margin-top: 4px; font-size: 11px; color: var(--text-dim);">
            Tip: Try adding <strong>Tomba.io</strong> (25 free/mo) or <strong>Serper.dev</strong> (2,500 free) in Settings (⚙️).
          </div>
        `;
      } else {
        zeroBox.style.display = 'none';
      }
    }

    // Pattern banner
    if (state.pattern && state.pattern.pattern) {
      patternBanner.style.display = 'flex';
      patternText.textContent = `${state.pattern.pattern}@${state.domain}`;
      patternConfidence.textContent = `${state.pattern.confidence}% confidence (${state.pattern.sampleSize} samples)`;
    } else {
      patternBanner.style.display = 'none';
    }

    updateTable();
  }

  function updateTable() {
    const filter = tableFilterInput.value.toLowerCase().trim();
    resultsTableBody.innerHTML = '';

    const filtered = state.results.filter(c => {
      if (!filter) return true;
      return (c.name || '').toLowerCase().includes(filter) ||
             (c.email || '').toLowerCase().includes(filter) ||
             (c.title || '').toLowerCase().includes(filter) ||
             (c.source || '').toLowerCase().includes(filter);
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-dim); padding: 24px;">No contacts match the filter.</td>`;
      resultsTableBody.appendChild(tr);
      return;
    }

    filtered.forEach((contact, idx) => {
      const tr = document.createElement('tr');

      // Checkbox
      const tdCheck = document.createElement('td');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = contact.selected !== false;
      chk.addEventListener('change', () => {
        contact.selected = chk.checked;
        updateSelectedCount();
      });
      tdCheck.appendChild(chk);

      // Name & Title
      const tdName = document.createElement('td');
      const displayName = contact.name || contact.email.split('@')[0];
      tdName.innerHTML = `
        <div class="contact-name">${escapeHtml(displayName)}</div>
        <div class="contact-title" title="${escapeHtml(contact.title || '')}">${escapeHtml(contact.title || 'Recruiter')}</div>
      `;

      // Email with Copy Button
      const tdEmail = document.createElement('td');
      tdEmail.innerHTML = `
        <div class="contact-email">
          <span>${escapeHtml(contact.email)}</span>
          <button class="btn-copy" title="Copy email">📋</button>
        </div>
      `;
      tdEmail.querySelector('.btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(contact.email);
        showToast(`Copied: ${contact.email}`, 'info');
      });

      // Source Badge
      const tdSource = document.createElement('td');
      const srcMeta = SERVICES[contact.source] || { icon: '🔍', name: contact.source };
      tdSource.innerHTML = `
        <span class="badge badge-source" style="border-left: 3px solid ${srcMeta.color || '#8b5cf6'}">
          ${srcMeta.icon} ${srcMeta.name}
        </span>
      `;

      // Status / Verification Badge
      const tdStatus = document.createElement('td');
      tdStatus.id = `status-${escapeEmail(contact.email)}`;
      tdStatus.innerHTML = getVerificationBadgeHtml(contact.verified);

      tr.appendChild(tdCheck);
      tr.appendChild(tdName);
      tr.appendChild(tdEmail);
      tr.appendChild(tdSource);
      tr.appendChild(tdStatus);

      resultsTableBody.appendChild(tr);
    });

    updateSelectedCount();
  }

  function getVerificationBadgeHtml(status) {
    if (status === 'valid') {
      return `<span class="badge badge-valid">✅ Valid</span>`;
    } else if (status === 'invalid') {
      return `<span class="badge badge-invalid">❌ Invalid</span>`;
    } else if (status === 'risky' || status === 'unknown') {
      return `<span class="badge badge-unknown">⚠️ Risky</span>`;
    } else {
      return `<span class="badge" style="color: var(--text-dim); background: rgba(255,255,255,0.04)">Unverified</span>`;
    }
  }

  function updateContactVerification(email, result) {
    const contact = state.results.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (contact) {
      contact.verified = result;
      const el = document.getElementById(`status-${escapeEmail(email)}`);
      if (el) el.innerHTML = getVerificationBadgeHtml(result);
    }
  }

  function updateSelectedCount() {
    const totalSelected = state.results.filter(c => c.selected !== false).length;
    selectedCountSpan.textContent = totalSelected;
    selectAllCheckbox.checked = totalSelected === state.results.length && totalSelected > 0;
  }

  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    state.results.forEach(c => { c.selected = isChecked; });
    updateTable();
  });

  tableFilterInput.addEventListener('input', () => {
    updateTable();
  });

  // ─── Pattern Drawer Toggle & Generate ─────────────────────────────
  btnTogglePattern.addEventListener('click', () => {
    const isVisible = patternDrawer.style.display !== 'none';
    patternDrawer.style.display = isVisible ? 'none' : 'flex';
    btnTogglePattern.textContent = isVisible ? 'Use Pattern ▾' : 'Close ▴';
  });

  btnGeneratePatternEmails.addEventListener('click', async () => {
    const text = patternNamesInput.value.trim();
    if (!text) {
      showToast('Enter at least one name', 'error');
      return;
    }
    const names = text.split('\n').map(n => n.trim()).filter(Boolean);
    if (!state.pattern || !state.pattern.pattern) {
      showToast('No pattern detected for this domain', 'error');
      return;
    }

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'generateFromPattern',
        names,
        domain: state.domain,
        pattern: state.pattern.pattern
      });

      if (resp && resp.success && resp.results) {
        const newContacts = resp.results.map(c => ({
          ...c,
          selected: true,
          verified: 'unverified'
        }));

        // Deduplicate with current results
        const existingSet = new Set(state.results.map(r => r.email.toLowerCase()));
        let addedCount = 0;
        newContacts.forEach(nc => {
          if (!existingSet.has(nc.email.toLowerCase())) {
            state.results.push(nc);
            existingSet.add(nc.email.toLowerCase());
            addedCount++;
          }
        });

        patternNamesInput.value = '';
        renderResults();
        showToast(`Added ${addedCount} contacts generated from pattern`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ─── Verify All (Built-in Google DNS MX Verifier) ───────────────
  btnVerifyAll.addEventListener('click', async () => {
    const selected = state.results.filter(c => c.selected !== false);
    if (selected.length === 0) {
      showToast('Select at least one contact to verify', 'error');
      return;
    }

    btnVerifyAll.disabled = true;
    showToast(`Verifying ${selected.length} emails with Google Public DNS...`, 'info');

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'verifyEmails',
        emails: selected.map(c => c.email)
      });

      if (resp && resp.success && resp.results) {
        resp.results.forEach(r => {
          updateContactVerification(r.email, r.result);
        });
        showToast('DNS verification complete!', 'success');
      } else {
        throw new Error(resp?.error || 'Verification failed');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnVerifyAll.disabled = false;
    }
  });

  // ─── Export Modal Flow ───────────────────────────────────────────
  btnOpenExport.addEventListener('click', () => {
    const selected = state.results.filter(c => c.selected !== false);
    if (selected.length === 0) {
      showToast('Select at least one contact to export', 'error');
      return;
    }
    exportStatus.style.display = 'none';
    exportModal.style.display = 'flex';
  });

  btnCloseExport.addEventListener('click', () => { exportModal.style.display = 'none'; });
  btnCancelExport.addEventListener('click', () => { exportModal.style.display = 'none'; });

  document.querySelectorAll('input[name="exportMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      exportSheetGroup.style.display = radio.value === 'existing' ? 'flex' : 'none';
      if (radio.value === 'existing' && !exportSheetUrl.value) {
        exportSheetUrl.value = dedupSheetInput.value || state.settings.sheetUrl || '';
      }
    });
  });

  btnConfirmExport.addEventListener('click', async () => {
    const selected = state.results.filter(c => c.selected !== false);
    const mode = document.querySelector('input[name="exportMode"]:checked').value;
    const createNew = mode === 'new';
    const sheetUrl = exportSheetUrl.value.trim();

    if (!createNew && !sheetUrl) {
      showToast('Please enter an existing Google Sheet URL', 'error');
      return;
    }

    btnConfirmExport.disabled = true;
    btnConfirmExport.textContent = 'Exporting...';
    exportStatus.style.display = 'block';
    exportStatus.innerHTML = 'Connecting to Google Sheets...';

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'exportToSheet',
        contacts: selected,
        companyName: state.company,
        sheetUrl: sheetUrl,
        createNew: createNew
      });

      if (resp && resp.success) {
        exportStatus.className = 'export-status';
        exportStatus.innerHTML = `
          ✅ Successfully exported <strong>${resp.count}</strong> contacts!<br>
          <a href="${resp.sheetUrl}" target="_blank" style="color:#34d399; text-decoration:underline; font-weight:600; display:inline-block; margin-top:6px;">
            Open Google Sheet ↗
          </a>
        `;
        showToast(`Exported ${resp.count} contacts!`, 'success');
      } else {
        throw new Error(resp?.error || 'Export failed');
      }
    } catch (err) {
      exportStatus.className = 'export-status';
      exportStatus.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      exportStatus.style.background = 'rgba(239, 68, 68, 0.1)';
      exportStatus.style.color = '#fca5a5';
      exportStatus.textContent = `Error: ${err.message}`;
    } finally {
      btnConfirmExport.disabled = false;
      btnConfirmExport.textContent = 'Export Now';
    }
  });

  // ─── Helpers ─────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeEmail(email) {
    return email.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // ─── Init ────────────────────────────────────────────────────────
  await loadSettings();
});
