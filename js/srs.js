// Leitner: 5 pudełek na id pytania.
// Dobra odpowiedź -> pudełko +1 (max 5), zła -> pudełko 1.
// Pudełko określa, za ile dni pytanie wraca do powtórek.
import { get, save } from './storage.js';

export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14]; // pudełka 1..5

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dueFor(box, now) {
  const days = BOX_INTERVAL_DAYS[box - 1];
  if (days === 0) return now; // od razu: wraca w najbliższych powtórkach
  return startOfDay(now) + days * 86400000;
}

export function record(questionId, isCorrect, now = Date.now()) {
  const s = get();
  const item = s.srs[questionId] || { box: 1, due: now, seen: 0, correct: 0, wrong: 0, last: null };
  item.seen += 1;
  if (isCorrect) {
    item.correct += 1;
    item.box = Math.min(5, item.box + 1);
    delete s.mistakes[questionId];
  } else {
    item.wrong += 1;
    item.box = 1;
    s.mistakes[questionId] = now;
  }
  item.due = dueFor(item.box, now);
  item.last = now;
  s.srs[questionId] = item;
  save();
  return item;
}

export function dueIds(validIds, now = Date.now()) {
  const s = get();
  return Object.entries(s.srs)
    .filter(([id, it]) => validIds.has(id) && it.due <= now)
    .sort((a, b) => a[1].box - b[1].box || a[1].due - b[1].due)
    .map(([id]) => id);
}

export function boxCounts(validIds) {
  const counts = [0, 0, 0, 0, 0];
  for (const [id, it] of Object.entries(get().srs)) {
    if (validIds.has(id)) counts[it.box - 1] += 1;
  }
  return counts;
}

export function mistakeIds(validIds) {
  return Object.entries(get().mistakes)
    .filter(([id]) => validIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

export function nextDue(validIds, now = Date.now()) {
  let min = Infinity;
  for (const [id, it] of Object.entries(get().srs)) {
    if (validIds.has(id) && it.due > now) min = Math.min(min, it.due);
  }
  return min === Infinity ? null : min;
}
