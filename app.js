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
  sessionId: 'mobti_supabase_session_id'
};

const el = {
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseAnonKey: document.getElementById('supabaseAnonKey'),
  sessionId: document.getElementById('sessionId'),
  connectBtn: document.getElementById('connectBtn'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  status: document.getElementById('status'),
  language: document.getElementById('language'),
  mode: document.getElementById('mode'),
  section: document.getElementById('section'),
  saveStateBtn: document.getElementById('saveStateBtn'),
  triggerEntryBtn: document.getElementById('triggerEntryBtn'),
  triggerArrivalBtn: document.getElementById('triggerArrivalBtn'),
  saveDelaysBtn: document.getElementById('saveDelaysBtn'),
  delayTable: document.getElementById('delayTable'),
  log: document.getElementById('log')
};

let connected = false;
let pollTimer = null;
let lastSeq = -1;

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
  localStorage.setItem(configKeys.sessionId, el.sessionId.value.trim() || 'study01');
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
  return el.sessionId.value.trim() || 'study01';
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
      section: el.section.value,
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
      section: el.section.value
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
  el.section.value = state.section || 'gebaeude64';
  renderDelayTable(state.delays || {});
}

async function connect() {
  const session = await ensureSession();
  applySessionState(session);
  connected = true;
  el.status.textContent = `Connected. Revision ${session.revision || 1}`;
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
      appendLog(`Poll error: ${error.message}`);
    }
  }, 1500);
}

el.connectBtn.addEventListener('click', async () => {
  try {
    await connect();
  } catch (error) {
    el.status.textContent = `Error: ${error.message}`;
    appendLog(`Connect failed: ${error.message}`);
  }
});

el.saveConfigBtn.addEventListener('click', () => {
  saveConfig();
});

el.saveStateBtn.addEventListener('click', async () => {
  if (!connected) {
    return;
  }
  try {
    const session = await upsertSessionState();
    applySessionState(session);
    appendLog('State saved');
  } catch (error) {
    appendLog(`Save state failed: ${error.message}`);
  }
});

el.saveDelaysBtn.addEventListener('click', async () => {
  if (!connected) {
    return;
  }
  try {
    const session = await upsertSessionState();
    applySessionState(session);
    appendLog('Delays saved');
  } catch (error) {
    appendLog(`Save delays failed: ${error.message}`);
  }
});

el.triggerEntryBtn.addEventListener('click', async () => {
  if (!connected) {
    return;
  }
  try {
    await enqueueCommand('trigger_entry');
    appendLog('Triggered trigger_entry');
  } catch (error) {
    appendLog(`Trigger failed: ${error.message}`);
  }
});

el.triggerArrivalBtn.addEventListener('click', async () => {
  if (!connected) {
    return;
  }
  try {
    await enqueueCommand('trigger_arrival');
    appendLog('Triggered trigger_arrival');
  } catch (error) {
    appendLog(`Trigger failed: ${error.message}`);
  }
});

loadConfig();
renderDelayTable({});
