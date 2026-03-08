const sections = [
  { key: 'gebaeude64', label: 'Gebaeude 64' },
  { key: 'wegZurMensa', label: 'Weg zur Mensa' },
  { key: 'inDerMensa', label: 'In der Mensa' },
  { key: 'vrVorlesung', label: 'VR Vorlesung' }
];

const defaultConfig = {
  url: 'https://gwxiqwswifmjkfwgenhz.supabase.co',
  anonKey: 'sb_publishable_xQBC_KIq4s8kHN1uXhbqKQ_8jHs0nzL',
  sessionId: 'study01'
};

const configKeys = {
  url: 'mobti_supabase_url',
  anonKey: 'mobti_supabase_anon_key',
  sessionId: 'mobti_supabase_session_id',
  setupCollapsed: 'mobti_setup_collapsed'
};

const modeVariants = {
  A: { gebaeude64: 'A', wegZurMensa: 'A', inDerMensa: 'A', vrVorlesung: 'A' },
  B: { gebaeude64: 'B', wegZurMensa: 'B', inDerMensa: 'B', vrVorlesung: 'B' },
  ABAB: { gebaeude64: 'A', wegZurMensa: 'B', inDerMensa: 'A', vrVorlesung: 'B' },
  BABA: { gebaeude64: 'B', wegZurMensa: 'A', inDerMensa: 'B', vrVorlesung: 'A' }
};

const el = {
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseAnonKey: document.getElementById('supabaseAnonKey'),
  sessionId: document.getElementById('sessionId'),
  connectBtn: document.getElementById('connectBtn'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  saveStateBtn: document.getElementById('saveStateBtn'),
  saveDelaysBtn: document.getElementById('saveDelaysBtn'),
  toggleSetupBtn: document.getElementById('toggleSetupBtn'),
  setupPanel: document.getElementById('setupPanel'),
  status: document.getElementById('status'),
  connectionBadge: document.getElementById('connectionBadge'),
  language: document.getElementById('language'),
  mode: document.getElementById('mode'),
  triggerEntryBtn: document.getElementById('triggerEntryBtn'),
  triggerArrivalBtn: document.getElementById('triggerArrivalBtn'),
  delayTable: document.getElementById('delayTable'),
  log: document.getElementById('log'),
  stepCounter: document.getElementById('stepCounter'),
  stepChips: document.getElementById('stepChips'),
  currentStepTitle: document.getElementById('currentStepTitle'),
  currentStepSubtitle: document.getElementById('currentStepSubtitle'),
  currentModePill: document.getElementById('currentModePill'),
  currentLanguagePill: document.getElementById('currentLanguagePill'),
  currentEntryDelay: document.getElementById('currentEntryDelay'),
  currentArrivalDelay: document.getElementById('currentArrivalDelay'),
  prevStepBtn: document.getElementById('prevStepBtn'),
  nextStepBtn: document.getElementById('nextStepBtn'),
  jumpToCurrentBtn: document.getElementById('jumpToCurrentBtn'),
  clearLogBtn: document.getElementById('clearLogBtn')
};

let connected = false;
let pollTimer = null;
let lastSeq = -1;
let currentStepIndex = 0;

function loadConfig() {
  const storedUrl = (localStorage.getItem(configKeys.url) || '').trim();
  const storedAnonKey = (localStorage.getItem(configKeys.anonKey) || '').trim();
  el.supabaseUrl.value = storedUrl.includes('supabase.co') ? storedUrl : defaultConfig.url;
  el.supabaseAnonKey.value = storedAnonKey.startsWith('sb_publishable_') && storedAnonKey.length >= 40
    ? storedAnonKey
    : defaultConfig.anonKey;
  el.sessionId.value = localStorage.getItem(configKeys.sessionId) || defaultConfig.sessionId;
}

function saveConfig() {
  localStorage.setItem(configKeys.url, el.supabaseUrl.value.trim());
  localStorage.setItem(configKeys.anonKey, el.supabaseAnonKey.value.trim());
  localStorage.setItem(configKeys.sessionId, el.sessionId.value.trim() || defaultConfig.sessionId);
  appendLog('Config saved');
}

function supabaseBaseUrl() {
  return el.supabaseUrl.value.trim().replace(/\/+$/, '');
}

function supabaseHeaders() {
  const anonKey = el.supabaseAnonKey.value.trim();
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`
  };
}

function sessionId() {
  return el.sessionId.value.trim() || defaultConfig.sessionId;
}

function currentSection() {
  return sections[currentStepIndex];
}

function modeForSection(sectionKey) {
  const mode = el.mode.value || 'A';
  return modeVariants[mode]?.[sectionKey] || 'A';
}

function renderDelayTable(delays) {
  el.delayTable.innerHTML = '';

  sections.forEach((section) => {
    const row = document.createElement('div');
    row.className = 'delay-row';
    row.innerHTML = `
      <div class="section-name">${section.label}</div>
      <input type="number" min="0" step="1" data-delay-section="${section.key}" data-delay-type="entryA" value="${delays?.[section.key]?.entryA ?? 8}" />
      <input type="number" min="0" step="1" data-delay-section="${section.key}" data-delay-type="entryB" value="${delays?.[section.key]?.entryB ?? 8}" />
      <input type="number" min="0" step="1" data-delay-section="${section.key}" data-delay-type="arrival" value="${delays?.[section.key]?.arrival ?? 8}" />
    `;
    el.delayTable.appendChild(row);
  });
}

function collectDelays() {
  const result = {};
  sections.forEach((section) => {
    result[section.key] = { entryA: 8, entryB: 8, arrival: 8 };
  });

  document.querySelectorAll('[data-delay-section]').forEach((input) => {
    const section = input.dataset.delaySection;
    const type = input.dataset.delayType;
    const value = Math.max(0, parseInt(input.value || '0', 10) || 0);
    if (result[section] && type in result[section]) {
      result[section][type] = value;
    }
  });

  return result;
}

function appendLog(line) {
  const ts = new Date().toLocaleTimeString();
  el.log.textContent = `[${ts}] ${line}\n${el.log.textContent}`;
}

function setStatus(message, tone = 'neutral') {
  el.status.textContent = message;
  el.connectionBadge.textContent = tone === 'connected' ? 'Connected' : tone === 'error' ? 'Error' : 'Not connected';
  el.connectionBadge.classList.remove('connected', 'error');
  if (tone === 'connected') {
    el.connectionBadge.classList.add('connected');
  } else if (tone === 'error') {
    el.connectionBadge.classList.add('error');
  }
}

function validateConfig() {
  if (!supabaseBaseUrl()) {
    throw new Error('Missing Supabase URL');
  }
  if (!el.supabaseAnonKey.value.trim()) {
    throw new Error('Missing Supabase anon key');
  }
}

async function apiFetch(path, options = {}) {
  validateConfig();
  const url = `${supabaseBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...supabaseHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid API response (${response.status})`);
    }
  }

  if (!response.ok) {
    const message = json?.message || json?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return json;
}

async function ensureSession() {
  const payload = { p_session_id: sessionId() };
  const session = await apiFetch('/rest/v1/rpc/ensure_session', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return Array.isArray(session) ? session[0] : session;
}

function sessionPayload() {
  return {
    session_id: sessionId(),
    state: {
      language: el.language.value,
      mode: el.mode.value,
      section: currentSection().key,
      delays: collectDelays()
    }
  };
}

async function upsertSessionState() {
  const payload = sessionPayload();
  const json = await apiFetch('/rest/v1/sessions?on_conflict=session_id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });
  return Array.isArray(json) ? json[0] : json;
}

async function enqueueCommand(type) {
  const payload = {
    p_session_id: sessionId(),
    p_type: type,
    p_payload: {
      language: el.language.value,
      mode: el.mode.value,
      section: currentSection().key
    }
  };

  return apiFetch('/rest/v1/rpc/enqueue_command', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function fetchCommands() {
  const query = `/rest/v1/commands?session_id=eq.${encodeURIComponent(sessionId())}&seq=gt.${lastSeq}&select=id,seq,type,payload,acked_at,ack_by&order=seq.asc`;
  return apiFetch(query, { method: 'GET' });
}

function applySessionState(session) {
  const state = session?.state || {};
  el.language.value = state.language || 'eng';
  el.mode.value = state.mode || 'A';
  renderDelayTable(state.delays || {});

  const index = sections.findIndex((section) => section.key === state.section);
  currentStepIndex = index >= 0 ? index : 0;
  updateStudyView();
}

function updateStudyView() {
  const section = currentSection();
  const delays = collectDelays();
  const sectionDelays = delays[section.key] || { entryA: 8, entryB: 8, arrival: 8 };
  const variant = modeForSection(section.key);
  const entryDelay = variant === 'A' ? sectionDelays.entryA : sectionDelays.entryB;

  el.stepCounter.textContent = `Step ${currentStepIndex + 1} / ${sections.length}`;
  el.currentStepTitle.textContent = section.label;
  el.currentModePill.textContent = `Mode ${variant}`;
  el.currentLanguagePill.textContent = el.language.value;
  el.currentEntryDelay.textContent = `${entryDelay}s`;
  el.currentArrivalDelay.textContent = `${sectionDelays.arrival}s`;
  el.currentStepSubtitle.textContent = variant === 'A'
    ? 'Complex cue flow with entry and arrival cue.'
    : 'Simple cue flow with text-only entry cue.';

  el.triggerArrivalBtn.disabled = variant !== 'A' || !connected;
  el.triggerEntryBtn.disabled = !connected;
  el.saveStateBtn.disabled = !connected;
  el.saveDelaysBtn.disabled = !connected;
  el.prevStepBtn.disabled = currentStepIndex === 0;
  el.nextStepBtn.disabled = currentStepIndex === sections.length - 1;

  el.stepChips.innerHTML = '';
  sections.forEach((step, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `step-chip${index === currentStepIndex ? ' is-active' : ''}`;
    button.innerHTML = `
      <span class="step-chip-index">Step ${index + 1}</span>
      <span class="step-chip-title">${step.label}</span>
    `;
    button.addEventListener('click', async () => {
      currentStepIndex = index;
      updateStudyView();
      if (connected) {
        try {
          await upsertSessionState();
          appendLog(`Step synced to ${step.label}`);
        } catch (error) {
          appendLog(`Step sync failed: ${error.message}`);
        }
      }
    });
    el.stepChips.appendChild(button);
  });
}

function setSetupCollapsed(collapsed) {
  el.setupPanel.classList.toggle('is-collapsed', collapsed);
  el.toggleSetupBtn.textContent = collapsed ? 'Show Setup' : 'Hide Setup';
  localStorage.setItem(configKeys.setupCollapsed, collapsed ? '1' : '0');
}

function loadSetupCollapsed() {
  setSetupCollapsed(localStorage.getItem(configKeys.setupCollapsed) === '1');
}

async function connect() {
  const session = await ensureSession();
  applySessionState(session);
  connected = true;
  setStatus(`Connected. Revision ${session.revision || 1}`, 'connected');
  appendLog('Connected');

  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = setInterval(async () => {
    try {
      const commands = await fetchCommands();
      if (Array.isArray(commands)) {
        commands.forEach((command) => {
          lastSeq = Math.max(lastSeq, Number(command.seq));
          appendLog(`Command #${command.seq} ${command.type}`);
        });
      }
    } catch (error) {
      setStatus(`Poll error: ${error.message}`, 'error');
      appendLog(`Poll error: ${error.message}`);
    }
  }, 1500);

  updateStudyView();
}

async function saveCurrentSetup() {
  const session = await upsertSessionState();
  applySessionState(session);
}

el.connectBtn.addEventListener('click', async () => {
  try {
    await connect();
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error');
    appendLog(`Connect failed: ${error.message}`);
  }
});

el.saveConfigBtn.addEventListener('click', () => {
  saveConfig();
});

el.saveStateBtn.addEventListener('click', async () => {
  if (!connected) {
    appendLog('Connect the session before saving setup.');
    return;
  }
  try {
    await saveCurrentSetup();
    appendLog('Setup saved');
  } catch (error) {
    appendLog(`Save setup failed: ${error.message}`);
  }
});

el.saveDelaysBtn.addEventListener('click', async () => {
  if (!connected) {
    appendLog('Connect the session before saving delays.');
    return;
  }
  try {
    await saveCurrentSetup();
    updateStudyView();
    appendLog('Delays saved');
  } catch (error) {
    appendLog(`Save delays failed: ${error.message}`);
  }
});

el.triggerEntryBtn.addEventListener('click', async () => {
  if (!connected) {
    appendLog('Connect the session before triggering cues.');
    return;
  }
  try {
    await enqueueCommand('trigger_entry');
    appendLog(`Entry cue triggered for ${currentSection().label}`);
  } catch (error) {
    appendLog(`Trigger failed: ${error.message}`);
  }
});

el.triggerArrivalBtn.addEventListener('click', async () => {
  if (!connected) {
    appendLog('Connect the session before triggering cues.');
    return;
  }
  if (modeForSection(currentSection().key) !== 'A') {
    appendLog('Arrival cue is disabled for mode B.');
    return;
  }
  try {
    await enqueueCommand('trigger_arrival');
    appendLog(`Arrival cue triggered for ${currentSection().label}`);
  } catch (error) {
    appendLog(`Trigger failed: ${error.message}`);
  }
});

el.prevStepBtn.addEventListener('click', async () => {
  if (currentStepIndex === 0) {
    return;
  }
  currentStepIndex -= 1;
  updateStudyView();
  if (connected) {
    try {
      await saveCurrentSetup();
      appendLog(`Moved to ${currentSection().label}`);
    } catch (error) {
      appendLog(`Step sync failed: ${error.message}`);
    }
  }
});

el.nextStepBtn.addEventListener('click', async () => {
  if (currentStepIndex >= sections.length - 1) {
    return;
  }
  currentStepIndex += 1;
  updateStudyView();
  if (connected) {
    try {
      await saveCurrentSetup();
      appendLog(`Moved to ${currentSection().label}`);
    } catch (error) {
      appendLog(`Step sync failed: ${error.message}`);
    }
  }
});

el.jumpToCurrentBtn.addEventListener('click', async () => {
  if (!connected) {
    appendLog('Connect the session before syncing the current step.');
    return;
  }
  try {
    await saveCurrentSetup();
    appendLog(`Current step synced: ${currentSection().label}`);
  } catch (error) {
    appendLog(`Step sync failed: ${error.message}`);
  }
});

el.toggleSetupBtn.addEventListener('click', () => {
  const collapsed = !el.setupPanel.classList.contains('is-collapsed');
  setSetupCollapsed(collapsed);
});

el.clearLogBtn.addEventListener('click', () => {
  el.log.textContent = '';
});

el.mode.addEventListener('change', updateStudyView);
el.language.addEventListener('change', updateStudyView);
el.delayTable.addEventListener('input', updateStudyView);

loadConfig();
renderDelayTable({});
loadSetupCollapsed();
setStatus('Waiting for setup');
updateStudyView();
