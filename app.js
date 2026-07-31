const sections = [
  { key: 'gebaeude64', label: 'Building 64' },
  { key: 'wegZurMensa', label: 'Walk to the Cafeteria' },
  { key: 'inDerMensa', label: 'In the Cafeteria' },
  { key: 'vrVorlesung', label: 'VR Lecture' }
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

// Standardized cue delay (seconds) — identical on the phone and in the web remote.
const DEFAULT_CUE_DELAY = 1;

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
  engine: document.getElementById('engine'),
  currentEnginePill: document.getElementById('currentEnginePill'),
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

function sectionLabel(sectionKey, language = (el.language?.value || 'eng')) {
  const labels = {
    eng: {
      gebaeude64: 'Building 64',
      wegZurMensa: 'Walk to the Cafeteria',
      inDerMensa: 'In the Cafeteria',
      vrVorlesung: 'VR Lecture'
    },
    ger: {
      gebaeude64: 'Gebäude 64',
      wegZurMensa: 'Weg zur Mensa',
      inDerMensa: 'In der Mensa',
      vrVorlesung: 'VR Vorlesung'
    }
  };

  return labels[language]?.[sectionKey] || labels.eng[sectionKey] || sectionKey;
}

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
      <div class="section-name">${sectionLabel(section.key)}</div>
      <input type="number" min="0" step="1" data-delay-section="${section.key}" data-delay-type="entryA" value="${delays?.[section.key]?.entryA ?? DEFAULT_CUE_DELAY}" />
      <input type="number" min="0" step="1" data-delay-section="${section.key}" data-delay-type="entryB" value="${delays?.[section.key]?.entryB ?? DEFAULT_CUE_DELAY}" />
      <input type="number" min="0" step="1" data-delay-section="${section.key}" data-delay-type="arrival" value="${delays?.[section.key]?.arrival ?? DEFAULT_CUE_DELAY}" />
    `;
    el.delayTable.appendChild(row);
  });
}

function collectDelays() {
  const result = {};
  sections.forEach((section) => {
    result[section.key] = { entryA: DEFAULT_CUE_DELAY, entryB: DEFAULT_CUE_DELAY, arrival: DEFAULT_CUE_DELAY };
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
      engine: el.engine.value,
      delays: collectDelays()
    }
  };
}

function arrivalMessage() {
  const section = currentSection().key;
  const language = el.language.value;

  const messages = {
    eng: {
      gebaeude64: 'You reached your destination and have 5 minutes till your lecture begins',
      wegZurMensa: 'Your friend already got his food and is waiting at a table',
      inDerMensa: 'Your meal is already paid for, you can pick it up at counter 1',
      vrVorlesung: 'Your friend is using the restroom and wants you to wait for him'
    },
    ger: {
      gebaeude64: 'Du hast dein Ziel erreicht und hast noch 5 Minuten bis deine Vorlesung beginnt',
      wegZurMensa: 'Dein Freund hat schon sein Essen und wartet an einem Tisch',
      inDerMensa: 'Dein Essen ist bereits bezahlt, du kannst es an Theke 1 abholen',
      vrVorlesung: 'Dein Freund ist auf der Toilette und möchte, dass du auf ihn wartest'
    }
  };

  return messages[language]?.[section] || messages.eng[section];
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
      section: currentSection().key,
      engine: el.engine.value
    }
  };

  return apiFetch('/rest/v1/rpc/enqueue_command', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function sendArrivalPush() {
  const response = await fetch('/api/send-arrival', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: sessionId(),
      title: el.language.value === 'ger' ? 'Ankunftshinweis' : 'Arrival Cue',
      body: arrivalMessage(),
      data: {
        type: 'arrival_cue',
        section: currentSection().key,
        mode: el.mode.value,
        language: el.language.value
      }
    })
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Push HTTP ${response.status}`);
  }

  return json;
}

async function fetchCommands() {
  const query = `/rest/v1/commands?session_id=eq.${encodeURIComponent(sessionId())}&seq=gt.${lastSeq}&select=id,seq,type,payload,acked_at,ack_by&order=seq.asc`;
  return apiFetch(query, { method: 'GET' });
}

function applySessionState(session) {
  const state = session?.state || {};
  el.language.value = state.language || 'eng';
  el.mode.value = state.mode || 'A';
  el.engine.value = state.engine === 'llm' ? 'llm' : 'designed';
  renderDelayTable(state.delays || {});

  const index = sections.findIndex((section) => section.key === state.section);
  currentStepIndex = index >= 0 ? index : 0;
  updateStudyView();
}

function updateStudyView() {
  const section = currentSection();
  const delays = collectDelays();
  const sectionDelays = delays[section.key] || { entryA: DEFAULT_CUE_DELAY, entryB: DEFAULT_CUE_DELAY, arrival: DEFAULT_CUE_DELAY };
  const variant = modeForSection(section.key);
  const entryDelay = variant === 'A' ? sectionDelays.entryA : sectionDelays.entryB;

  const llmEngine = el.engine.value === 'llm';
  el.stepCounter.textContent = `Step ${currentStepIndex + 1} / ${sections.length}`;
  el.currentStepTitle.textContent = sectionLabel(section.key, el.language.value);
  el.currentModePill.textContent = `Mode ${variant}`;
  el.currentLanguagePill.textContent = el.language.value;
  el.currentEnginePill.textContent = llmEngine ? 'LLM' : 'Designed';
  el.currentEntryDelay.textContent = `${entryDelay}s`;
  el.currentArrivalDelay.textContent = `${sectionDelays.arrival}s`;
  el.currentStepSubtitle.textContent = llmEngine
    ? 'LLM voice-assistant cue for entry and arrival.'
    : variant === 'A'
      ? 'Complex cue flow with entry and arrival cue.'
      : 'Simple cue flow with text-only entry cue.';

  // LLM engine always has an arrival cue; the designed engine only in variant A.
  el.triggerArrivalBtn.disabled = (!llmEngine && variant !== 'A') || !connected;
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
      <span class="step-chip-title">${sectionLabel(step.key, el.language.value)}</span>
    `;
    button.addEventListener('click', async () => {
      currentStepIndex = index;
      updateStudyView();
      if (connected) {
        try {
          await upsertSessionState();
          appendLog(`Step synced to ${sectionLabel(step.key, el.language.value)}`);
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

el.language.addEventListener('change', () => {
  renderDelayTable(collectDelays());
  updateStudyView();
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
    appendLog(`Entry cue triggered for ${sectionLabel(currentSection().key, el.language.value)}`);
  } catch (error) {
    appendLog(`Trigger failed: ${error.message}`);
  }
});

el.triggerArrivalBtn.addEventListener('click', async () => {
  if (!connected) {
    appendLog('Connect the session before triggering cues.');
    return;
  }
  if (el.engine.value !== 'llm' && modeForSection(currentSection().key) !== 'A') {
    appendLog('Arrival cue is disabled for mode B.');
    return;
  }
  try {
    await enqueueCommand('trigger_arrival');
    if (el.engine.value !== 'llm') {
      await sendArrivalPush();
    }
    appendLog(`Arrival cue triggered for ${sectionLabel(currentSection().key, el.language.value)}`);
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
      appendLog(`Moved to ${sectionLabel(currentSection().key, el.language.value)}`);
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
      appendLog(`Moved to ${sectionLabel(currentSection().key, el.language.value)}`);
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
    appendLog(`Current step synced: ${sectionLabel(currentSection().key, el.language.value)}`);
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

// Engine switch: update the view immediately and push it to the phone when connected.
el.engine.addEventListener('change', async () => {
  updateStudyView();
  if (!connected) {
    return;
  }
  try {
    await upsertSessionState();
    await enqueueCommand('set_engine');
    appendLog(`Cue engine set to ${el.engine.value === 'llm' ? 'LLM' : 'Designed'}`);
  } catch (error) {
    appendLog(`Engine sync failed: ${error.message}`);
  }
});

loadConfig();
renderDelayTable({});
loadSetupCollapsed();
setStatus('Waiting for setup');
updateStudyView();
