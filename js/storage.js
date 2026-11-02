// Postęp w localStorage pod wersjonowanym kluczem. Każdy dostęp w try/catch:
// Safari w trybie prywatnym / pełny storage nie mogą wywalić apki.

export const STORAGE_KEY = 'mce-study:v1';
const STATE_VERSION = 1;

export const MAX_HEARTS = 5;

function defaults() {
  return {
    version: STATE_VERSION,
    xp: 0,
    hearts: { count: MAX_HEARTS, updatedAt: Date.now() },
    streak: { count: 0, best: 0, lastDay: null },
    lessons: {},     // lessonId -> { done, best, attempts }
    srs: {},         // questionId -> { box, due, seen, correct, wrong, last }
    mistakes: {},    // questionId -> timestamp ostatniego błędu
    history: [],     // ostatnie sesje
    days: {},        // 'YYYY-MM-DD' -> xp danego dnia
  };
}

let memoryFallback = null;
let state = null;
let storageOk = true;

function merge(base, saved) {
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (saved && saved[k] !== undefined) {
      const b = base[k];
      const s = saved[k];
      out[k] = b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)
        ? { ...b, ...s }
        : s;
    }
  }
  return out;
}

export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    storageOk = false;
    raw = memoryFallback;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    state = parsed && parsed.version === STATE_VERSION ? merge(defaults(), parsed) : defaults();
  } catch (e) {
    console.warn('Uszkodzony zapis postępu – start od zera', e);
    state = defaults();
  }
  return state;
}

export function get() {
  return state || load();
}

export function save() {
  const json = JSON.stringify(state);
  try {
    localStorage.setItem(STORAGE_KEY, json);
    storageOk = true;
  } catch (e) {
    storageOk = false;
    memoryFallback = json;
    console.warn('Nie udało się zapisać postępu w localStorage', e);
  }
  return storageOk;
}

export function isPersistent() {
  return storageOk;
}

export function reset() {
  state = defaults();
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  memoryFallback = null;
  save();
}

export function exportJSON() {
  return JSON.stringify({ app: 'mce-study', key: STORAGE_KEY, exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  const incoming = data && data.app === 'mce-study' ? data.state : data;
  if (!incoming || typeof incoming !== 'object' || incoming.version !== STATE_VERSION) {
    throw new Error('To nie jest plik postępu tej apki (albo inna wersja).');
  }
  state = merge(defaults(), incoming);
  save();
  return state;
}
