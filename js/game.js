// XP, serduszka (5, +1 co 30 min), streak dni.
import { get, save, MAX_HEARTS } from './storage.js';

export const HEART_REFILL_MS = 30 * 60 * 1000;
export const XP_CORRECT = 10;
export const XP_LESSON_PASS = 20;
export const XP_EXAM_CORRECT = 5;

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Przelicza serduszka na podstawie upływu czasu.
export function hearts(now = Date.now()) {
  const s = get();
  const h = s.hearts;
  if (h.count >= MAX_HEARTS) {
    h.count = MAX_HEARTS;
    h.updatedAt = now;
    return { count: h.count, nextIn: null };
  }
  const gained = Math.floor((now - h.updatedAt) / HEART_REFILL_MS);
  if (gained > 0) {
    h.count = Math.min(MAX_HEARTS, h.count + gained);
    h.updatedAt = h.count >= MAX_HEARTS ? now : h.updatedAt + gained * HEART_REFILL_MS;
    save();
  }
  const nextIn = h.count >= MAX_HEARTS ? null : HEART_REFILL_MS - (now - h.updatedAt);
  return { count: h.count, nextIn };
}

export function loseHeart(now = Date.now()) {
  const cur = hearts(now);
  const s = get();
  if (cur.count >= MAX_HEARTS) s.hearts.updatedAt = now; // licznik odnowienia startuje od pierwszej straty
  s.hearts.count = Math.max(0, cur.count - 1);
  save();
  return s.hearts.count;
}

export function addXP(amount, now = Date.now()) {
  if (amount <= 0) return;
  const s = get();
  s.xp += amount;
  const k = dayKey(now);
  s.days[k] = (s.days[k] || 0) + amount;
  save();
}

// Wywoływane po ukończeniu sesji. Zwraca true, jeśli streak wzrósł dzisiaj.
export function touchStreak(now = Date.now()) {
  const s = get();
  const today = dayKey(now);
  const st = s.streak;
  if (st.lastDay === today) return false;
  const yesterday = dayKey(now - 86400000);
  st.count = st.lastDay === yesterday ? st.count + 1 : 1;
  st.best = Math.max(st.best, st.count);
  st.lastDay = today;
  save();
  return true;
}

// Streak do wyświetlenia: wygasa, jeśli ostatni dzień nauki był przed wczoraj.
export function currentStreak(now = Date.now()) {
  const st = get().streak;
  if (!st.lastDay) return { count: 0, today: false };
  const today = dayKey(now);
  const yesterday = dayKey(now - 86400000);
  if (st.lastDay === today) return { count: st.count, today: true };
  if (st.lastDay === yesterday) return { count: st.count, today: false };
  return { count: 0, today: false };
}

export function addHistory(entry) {
  const s = get();
  s.history.unshift(entry);
  s.history = s.history.slice(0, 50);
  save();
}
