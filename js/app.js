import * as store from './storage.js';
import { MAX_HEARTS } from './storage.js';
import { dueIds, boxCounts, mistakeIds, nextDue, BOX_INTERVAL_DAYS } from './srs.js';
import { hearts, addXP, touchStreak, currentStreak, addHistory, dayKey, XP_LESSON_PASS } from './game.js';
import { runSession, renderSummary } from './quiz.js';
import { esc, inline, md, shuffle, toast, formatMinutes } from './ui.js';

const D = {}; // dane z JSON + indeksy
const view = document.getElementById('view');
const overlay = document.getElementById('overlay');
const nav = document.getElementById('tabbar');
let currentTab = 'lessons';
let quickScope = null;
let activeSession = null;

const REVIEW_SESSION_MAX = 20;
const MISTAKES_SESSION_MAX = 15;

// ---------- start ----------

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function init() {
  store.load();
  try {
    const [sections, lessons, questions] = await Promise.all([
      loadJSON('data/sections.json'),
      loadJSON('data/lessons.json'),
      loadJSON('data/questions.json'),
    ]);
    buildIndex(sections, lessons, questions);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><div class="empty-emoji">⚠️</div>
      <h2>Nie udało się wczytać treści</h2>
      <p>${esc(e.message)}</p>
      <p>Apka musi być uruchomiona przez serwer HTTP (np. <code>python -m http.server 8000 --bind 0.0.0.0</code>), a nie otwarta jako plik.</p></div>`;
    return;
  }
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) location.hash = `#/${b.dataset.tab}`;
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', () => { if (!overlay.hidden && !history.state?.overlay) closeOverlay(true); });
  setInterval(() => { if (overlay.hidden) refreshStatus(); }, 30000);
  route();
}

function buildIndex(sections, lessons, questions) {
  D.config = sections;
  D.sections = sections.sections;
  D.sectionById = Object.fromEntries(D.sections.map((s) => [s.id, s]));
  D.subtopics = lessons.subtopics || [];
  D.lessons = lessons.lessons || [];
  D.lessonById = Object.fromEntries(D.lessons.map((l) => [l.id, l]));
  D.questions = questions.questions || [];
  D.qById = Object.fromEntries(D.questions.map((q) => [q.id, q]));
  D.allIds = new Set(D.questions.map((q) => q.id));
  D.qBySection = groupBy(D.questions, 'section');
  D.qByTopic = groupBy(D.questions, 'topic');
  D.lessonsBySection = groupBy(D.lessons, 'section');
}

function groupBy(arr, key) {
  const out = {};
  for (const x of arr) (out[x[key]] ||= []).push(x);
  return out;
}

// ---------- routing ----------

function route() {
  const tab = (location.hash.replace(/^#\/?/, '') || 'lessons').split('/')[0];
  currentTab = ['lessons', 'quiz', 'review', 'profile'].includes(tab) ? tab : 'lessons';
  nav.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === currentTab));
  ({ lessons: renderLessons, quiz: renderQuiz, review: renderReview, profile: renderProfile })[currentTab]();
  view.scrollTop = 0;
}

function rerender() {
  ({ lessons: renderLessons, quiz: renderQuiz, review: renderReview, profile: renderProfile })[currentTab]();
}

function openOverlay() {
  activeSession?.stop();
  activeSession = null;
  overlay.hidden = false;
  overlay.innerHTML = '';
  overlay.scrollTop = 0;
  document.body.classList.add('overlay-open');
  if (!history.state?.overlay) history.pushState({ overlay: true }, '');
  return overlay;
}

function session(cfg) {
  activeSession?.stop();
  activeSession = runSession(overlay.hidden ? openOverlay() : overlay, cfg);
  overlay.scrollTop = 0;
}

function closeOverlay(fromPop = false) {
  activeSession?.stop();
  activeSession = null;
  overlay.hidden = true;
  overlay.innerHTML = '';
  document.body.classList.remove('overlay-open');
  if (!fromPop && history.state?.overlay) history.back();
  rerender();
}

// ---------- wspólne ----------

function statusBar() {
  const s = store.get();
  const st = currentStreak();
  const h = hearts();
  return `<div class="statusbar">
    <span class="pill streak ${st.today ? 'on' : ''}" title="Streak">🔥 ${st.count}</span>
    <span class="pill xp" title="XP">⭐ ${s.xp}</span>
    <span class="pill hearts" title="Serduszka">❤️ ${h.count}${h.nextIn ? `<small> +1 za ${formatMinutes(h.nextIn)}</small>` : ''}</span>
  </div>`;
}

function refreshStatus() {
  const el = view.querySelector('.statusbar');
  if (el) el.outerHTML = statusBar();
  if (currentTab === 'profile') renderProfile();
}

function sectionHasContent(id) {
  return (D.lessonsBySection[id] || []).length > 0 || (D.qBySection[id] || []).length > 0;
}

function lessonUnlocked(lesson) {
  const list = D.lessonsBySection[lesson.section] || [];
  const i = list.indexOf(lesson);
  if (i <= 0) return true;
  return !!store.get().lessons[list[i - 1].id]?.done;
}

function requireHearts() {
  const h = hearts();
  if (h.count > 0) return true;
  toast(`💔 Brak serduszek. Następne za ${formatMinutes(h.nextIn)}. Zrób Powtórki albo Próbny egzamin.`);
  return false;
}

function questionsFor(ids) {
  return ids.map((id) => D.qById[id]).filter(Boolean);
}

function finishCommon(r, extraXP = 0) {
  const total = r.xp + extraXP;
  addXP(total);
  const streakUp = r.answers.length > 0 ? touchStreak() : false;
  addHistory({ mode: r.mode, at: Date.now(), percent: r.percent, total: r.total, correct: r.correct, xp: total, ms: r.durationMs });
  return { xpTotal: total, streakUp };
}

function streakNote(streakUp) {
  return streakUp ? `<div class="streak-up">🔥 Streak: ${currentStreak().count} ${currentStreak().count === 1 ? 'dzień' : 'dni'}!</div>` : '';
}

// ---------- LEKCJE ----------

function renderLessons() {
  const s = store.get();
  const due = dueIds(D.allIds).length;
  let html = statusBar();
  html += `<h1 class="page-title">Lekcje</h1>
    <button class="tile review-tile ${due ? '' : 'muted'}" data-go="review">
      <span class="tile-emoji">🔁</span>
      <span class="tile-main"><span class="tile-title">Powtórki na dziś: ${due}</span>
      <span class="tile-sub">${due ? 'Tapnij, żeby powtórzyć' : 'Wszystko powtórzone 👌'}</span></span>
      <span class="chev">›</span>
    </button>`;

  for (const sec of D.sections) {
    const lessons = D.lessonsBySection[sec.id] || [];
    if (!lessons.length) {
      html += `<section class="section soon"><div class="section-head">
        <span class="section-icon">${sec.icon || '📘'}</span>
        <div class="section-info"><div class="section-name">${esc(sec.name)}</div><div class="section-meta">${sec.weight}% egzaminu</div></div>
        <span class="soon-badge">Wkrótce</span></div></section>`;
      continue;
    }
    const done = lessons.filter((l) => s.lessons[l.id]?.done).length;
    html += `<section class="section"><div class="section-head">
      <span class="section-icon">${sec.icon || '📘'}</span>
      <div class="section-info"><div class="section-name">${esc(sec.name)}</div>
      <div class="section-meta">${sec.weight}% egzaminu · ${done}/${lessons.length} lekcji</div>
      <div class="mini-progress"><div style="width:${(done / lessons.length) * 100}%"></div></div></div></div>`;
    const subs = D.subtopics.filter((st) => st.section === sec.id);
    const groups = subs.length ? subs.map((st) => ({ st, items: lessons.filter((l) => l.subtopic === st.id) })) : [{ st: null, items: lessons }];
    for (const g of groups) {
      if (!g.items.length) continue;
      if (g.st) html += `<h3 class="subtopic">${esc(g.st.name)}</h3>`;
      html += '<div class="path">';
      g.items.forEach((l, i) => {
        const prog = s.lessons[l.id];
        const unlocked = lessonUnlocked(l);
        const state = prog?.done ? 'done' : unlocked ? 'open' : 'locked';
        html += `<button class="lesson-node ${state} ${i % 2 ? 'alt' : ''}" data-lesson="${esc(l.id)}">
          <span class="node-circle">${state === 'done' ? '✓' : state === 'locked' ? '🔒' : (l.icon || '📘')}</span>
          <span class="node-label"><span class="node-title">${esc(l.title)}</span>
          <span class="node-sub">${state === 'done' ? `Zaliczona · najlepszy wynik ${prog.best}%` : state === 'locked' ? 'Zalicz poprzednią lekcję' : `${l.cards.length} kart · ${l.checks.length} pytania`}</span></span>
        </button>`;
      });
      html += '</div>';
    }
    html += '</section>';
  }
  view.innerHTML = html;
  view.querySelector('[data-go="review"]').addEventListener('click', () => (location.hash = '#/review'));
  view.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => {
    const l = D.lessonById[b.dataset.lesson];
    if (!lessonUnlocked(l)) return toast('🔒 Najpierw zalicz poprzednią lekcję (min. ' + D.config.lessonPassPercent + '%).');
    openLesson(l);
  }));
}

function renderCard(c) {
  const src = `<div class="card-source">📄 ${esc(c.source)}</div>`;
  switch (c.type) {
    case 'explain':
      return `<div class="card card-explain"><div class="card-kicker">💡 Wyjaśnienie</div><h2>${inline(c.title)}</h2>${md(c.body)}${src}</div>`;
    case 'steps':
      return `<div class="card card-steps"><div class="card-kicker">🪜 Krok po kroku</div><h2>${inline(c.title)}</h2>
        <ol>${c.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>${src}</div>`;
    case 'table':
      return `<div class="card card-table"><div class="card-kicker">📊 Porównanie</div><h2>${inline(c.title)}</h2>
        <div class="table-wrap"><table><thead><tr>${c.headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>
        <tbody>${c.rows.map((r) => `<tr>${r.map((x, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${inline(x)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>${src}</div>`;
    case 'trap':
      return `<div class="card card-trap"><div class="card-kicker">🎯 Pułapka egzaminacyjna</div>${c.title ? `<h2>${inline(c.title)}</h2>` : ''}${md(c.body)}${src}</div>`;
    case 'mnemonic':
      return `<div class="card card-mnemonic"><div class="card-kicker">🧠 Mnemotechnika</div>${md(c.body)}${src}</div>`;
    case 'warning':
      return `<div class="card card-warning"><div class="card-kicker">⚠️ Do sprawdzenia</div>${md(c.body)}${src}</div>`;
    case 'scenario':
      return `<div class="card card-scenario"><div class="card-kicker">🛠️ Scenariusz</div>${c.title ? `<h2>${inline(c.title)}</h2>` : ''}
        <div class="psr"><div class="psr-step p"><span>Problem</span>${inline(c.problem)}</div>
        <div class="psr-step c"><span>Przyczyna</span>${inline(c.cause)}</div>
        <div class="psr-step s"><span>Rozwiązanie</span>${inline(c.solution)}</div></div>${src}</div>`;
    default:
      return '';
  }
}

function openLesson(lesson) {
  const root = openOverlay();
  const n = lesson.cards.length + 1;
  root.innerHTML = `
    <div class="reader">
      <header class="session-top">
        <button class="icon-btn" data-act="close" aria-label="Zamknij">✕</button>
        <div class="progress"><div class="progress-bar"></div></div>
        <span class="session-stat" data-count>1/${n}</span>
      </header>
      <div class="reader-title">${lesson.icon || ''} ${esc(lesson.title)}</div>
      <div class="cards" tabindex="0">
        ${lesson.cards.map((c) => `<div class="card-slide">${renderCard(c)}</div>`).join('')}
        <div class="card-slide"><div class="card card-final">
          <div class="summary-emoji">🎯</div>
          <h2>Sprawdź się</h2>
          <p>${lesson.checks.length} szybkie pytania. Zaliczenie od ${D.config.lessonPassPercent}% odblokowuje następną lekcję.</p>
          <p class="muted-text">Za błąd tracisz ❤️.</p>
          <button class="btn btn-primary btn-block" data-act="start">Zaczynam</button>
        </div></div>
      </div>
      <footer class="session-foot reader-foot">
        <button class="btn btn-ghost" data-act="prev">‹ Wstecz</button>
        <button class="btn btn-primary" data-act="next">Dalej ›</button>
      </footer>
    </div>`;
  const cards = root.querySelector('.cards');
  const bar = root.querySelector('.progress-bar');
  const count = root.querySelector('[data-count]');
  const prev = root.querySelector('[data-act="prev"]');
  const nextB = root.querySelector('[data-act="next"]');
  const cur = () => Math.round(cards.scrollLeft / cards.clientWidth);
  const update = () => {
    const i = Math.min(n - 1, Math.max(0, cur()));
    bar.style.width = `${((i + 1) / n) * 100}%`;
    count.textContent = `${i + 1}/${n}`;
    prev.disabled = i === 0;
    nextB.style.visibility = i === n - 1 ? 'hidden' : 'visible';
  };
  const go = (i) => cards.scrollTo({ left: i * cards.clientWidth, behavior: 'smooth' });
  cards.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  prev.addEventListener('click', () => go(cur() - 1));
  nextB.addEventListener('click', () => go(cur() + 1));
  root.querySelector('[data-act="close"]').addEventListener('click', () => closeOverlay());
  root.querySelector('[data-act="start"]').addEventListener('click', () => {
    if (!requireHearts()) return;
    startLessonQuiz(lesson);
  });
  update();
}

function startLessonQuiz(lesson) {
  const root = overlay;
  session({
    mode: 'lesson',
    questions: questionsFor(lesson.checks),
    onExit: () => closeOverlay(),
    onFinish: (r) => {
      const s = store.get();
      const pass = !r.outOfHearts && r.total === r.planned && r.percent >= D.config.lessonPassPercent;
      const prog = s.lessons[lesson.id] || { done: false, best: 0, attempts: 0 };
      const firstPass = pass && !prog.done;
      prog.attempts += 1;
      prog.best = Math.max(prog.best, r.total === r.planned ? r.percent : 0);
      prog.done = prog.done || pass;
      s.lessons[lesson.id] = prog;
      store.save();
      const { xpTotal, streakUp } = finishCommon(r, pass ? XP_LESSON_PASS : 0);
      r.xpTotal = xpTotal;
      const list = D.lessonsBySection[lesson.section];
      const nextLesson = list[list.indexOf(lesson) + 1];
      const actions = [];
      if (pass && nextLesson) actions.push({ label: `Następna lekcja: ${nextLesson.title}`, onClick: () => openLesson(nextLesson) });
      if (!pass) actions.push({ label: 'Spróbuj ponownie', onClick: () => { if (requireHearts()) startLessonQuiz(lesson); } });
      if (!pass) actions.push({ label: 'Przeczytaj lekcję jeszcze raz', onClick: () => openLesson(lesson) });
      actions.push({ label: 'Wróć do lekcji', onClick: () => closeOverlay() });
      renderSummary(root, r, {
        emoji: pass ? '🎉' : r.outOfHearts ? '💔' : '😕',
        title: pass ? (firstPass ? 'Lekcja zaliczona!' : 'Zaliczone ponownie!') : 'Jeszcze nie tym razem',
        subtitle: pass
          ? (firstPass && nextLesson ? `Odblokowano: ${nextLesson.title}` : `+${XP_LESSON_PASS} XP bonusu za zaliczenie`)
          : r.outOfHearts ? 'Skończyły się serduszka.' : `Potrzebujesz min. ${D.config.lessonPassPercent}%.`,
        extraHTML: streakNote(streakUp),
        actions,
      });
    },
  });
}

// ---------- QUIZ ----------

function quizScopes() {
  const scopes = [];
  for (const sec of D.sections) {
    const qs = D.qBySection[sec.id] || [];
    if (!qs.length) continue;
    scopes.push({ key: `section:${sec.id}`, label: `Cały dział: ${sec.name}`, count: qs.length, ids: qs.map((q) => q.id), group: sec.name });
    for (const l of D.lessonsBySection[sec.id] || []) {
      const tq = D.qByTopic[l.id] || [];
      if (tq.length) scopes.push({ key: `topic:${l.id}`, label: l.title, count: tq.length, ids: tq.map((q) => q.id), group: sec.name, icon: l.icon });
    }
    // tematy pytań bez lekcji
    for (const [topic, tq] of Object.entries(groupBy(qs, 'topic'))) {
      if (!D.lessonById[topic]) scopes.push({ key: `topic:${topic}`, label: topic, count: tq.length, ids: tq.map((q) => q.id), group: sec.name });
    }
  }
  return scopes;
}

function examPlan() {
  const cfg = D.config.mockExam;
  const secs = D.sections.filter((s) => (D.qBySection[s.id] || []).length);
  const available = secs.reduce((a, s) => a + D.qBySection[s.id].length, 0);
  const n = Math.min(cfg.questions, available);
  const wsum = secs.reduce((a, s) => a + s.weight, 0);
  // największe reszty, z limitem dostępnych pytań
  const alloc = secs.map((s) => {
    const exact = (s.weight / wsum) * n;
    return { s, take: Math.min(Math.floor(exact), D.qBySection[s.id].length), rem: exact - Math.floor(exact) };
  });
  let left = n - alloc.reduce((a, x) => a + x.take, 0);
  while (left > 0) {
    const cand = alloc.filter((x) => x.take < D.qBySection[x.s.id].length).sort((a, b) => b.rem - a.rem || b.s.weight - a.s.weight);
    if (!cand.length) break;
    cand[0].take += 1; cand[0].rem = -1; left -= 1;
    if (cand.every((x) => x.rem === -1)) alloc.forEach((x) => { if (x.rem === -1) x.rem = 0; });
  }
  return { n, alloc, seconds: n * cfg.secondsPerQuestion, wsum };
}

function renderQuiz() {
  const scopes = quizScopes();
  if (!quickScope || !scopes.find((s) => s.key === quickScope)) quickScope = scopes[0]?.key;
  const mistakes = mistakeIds(D.allIds);
  const plan = examPlan();
  let html = statusBar() + '<h1 class="page-title">Quiz</h1>';

  if (!scopes.length) {
    view.innerHTML = html + '<div class="empty"><div class="empty-emoji">📭</div><p>Brak pytań w data/questions.json.</p></div>';
    return;
  }

  let lastGroup = null;
  html += `<section class="mode-card">
      <div class="mode-head"><span class="mode-emoji">⚡</span><div><h2>Szybki quiz</h2><p>${D.config.quickQuizSize} losowych pytań z wybranego działu lub tematu.</p></div></div>
      <div class="chips" role="radiogroup">`;
  for (const sc of scopes) {
    if (sc.group !== lastGroup) { html += `<div class="chip-group">${esc(sc.group)}</div>`; lastGroup = sc.group; }
    html += `<button class="chip ${sc.key === quickScope ? 'on' : ''}" role="radio" aria-checked="${sc.key === quickScope}" data-scope="${esc(sc.key)}">${sc.icon ? sc.icon + ' ' : ''}${esc(sc.label)} <small>${sc.count}</small></button>`;
  }
  html += `</div><button class="btn btn-primary btn-block" data-start="quick">Start</button></section>`;

  html += `<section class="mode-card">
      <div class="mode-head"><span class="mode-emoji">🩹</span><div><h2>Moje błędy</h2><p>${mistakes.length ? `${mistakes.length} pytań, na których się pomyliłeś. Dobra odpowiedź usuwa pytanie z listy.` : 'Brak błędów do poprawy. Tak trzymaj!'}</p></div></div>
      <button class="btn btn-primary btn-block" data-start="mistakes" ${mistakes.length ? '' : 'disabled'}>Popraw błędy${mistakes.length ? ` (${Math.min(mistakes.length, MISTAKES_SESSION_MAX)})` : ''}</button>
    </section>`;

  html += `<section class="mode-card">
      <div class="mode-head"><span class="mode-emoji">🏁</span><div><h2>Próbny egzamin</h2>
      <p>${plan.n} pytań · ${Math.round(plan.seconds / 60)} min · bez podpowiedzi w trakcie, wynik i przegląd błędów na końcu. Nie zużywa serduszek.</p></div></div>
      <ul class="plan">${plan.alloc.map((x) => `<li><span>${esc(x.s.name)}</span><span>${x.take} pyt. · waga ${x.s.weight}%</span></li>`).join('')}</ul>
      ${D.sections.some((s) => !sectionHasContent(s.id)) ? `<p class="muted-text">Losowanie tylko z działów, które mają pytania. Pozostałe: ${D.sections.filter((s) => !sectionHasContent(s.id)).map((s) => esc(s.name)).join(', ')} – wkrótce.</p>` : ''}
      <button class="btn btn-primary btn-block" data-start="exam">Rozpocznij egzamin</button>
    </section>`;

  view.innerHTML = html;
  view.querySelectorAll('[data-scope]').forEach((b) => b.addEventListener('click', () => {
    quickScope = b.dataset.scope;
    view.querySelectorAll('[data-scope]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
  }));
  view.querySelector('[data-start="quick"]').addEventListener('click', () => {
    if (!requireHearts()) return;
    const sc = scopes.find((s) => s.key === quickScope);
    startQuick(sc);
  });
  view.querySelector('[data-start="mistakes"]').addEventListener('click', () => {
    if (!requireHearts()) return;
    startSimple('mistakes', shuffle(mistakeIds(D.allIds).slice(0, MISTAKES_SESSION_MAX)));
  });
  view.querySelector('[data-start="exam"]').addEventListener('click', startExam);
}

function startQuick(sc) {
  const ids = shuffle(sc.ids).slice(0, D.config.quickQuizSize);
  startSimple('quick', ids, () => startQuick(sc), sc.label);
}

function startSimple(mode, ids, again, label) {
  const root = overlay;
  session({
    mode,
    questions: questionsFor(ids),
    onExit: () => closeOverlay(),
    onFinish: (r) => {
      const { xpTotal, streakUp } = finishCommon(r);
      r.xpTotal = xpTotal;
      const titles = { quick: 'Quiz ukończony!', mistakes: 'Błędy przerobione!', review: 'Powtórka zrobiona!' };
      const actions = [];
      if (mode === 'quick' && again) actions.push({ label: 'Jeszcze raz', onClick: () => { if (requireHearts()) again(); } });
      if (mode === 'mistakes' && mistakeIds(D.allIds).length) actions.push({ label: `Dalej poprawiaj (${mistakeIds(D.allIds).length})`, onClick: () => { if (requireHearts()) startSimple('mistakes', shuffle(mistakeIds(D.allIds).slice(0, MISTAKES_SESSION_MAX))); } });
      if (mode === 'review' && dueIds(D.allIds).length) actions.push({ label: `Kolejne powtórki (${dueIds(D.allIds).length})`, onClick: () => startSimple('review', dueIds(D.allIds).slice(0, REVIEW_SESSION_MAX)) });
      actions.push({ label: 'Gotowe', onClick: () => closeOverlay() });
      renderSummary(root, r, {
        emoji: r.outOfHearts ? '💔' : r.percent >= 80 ? '🎉' : r.percent >= 50 ? '💪' : '📚',
        title: r.outOfHearts ? 'Koniec serduszek' : titles[mode],
        subtitle: label || (r.outOfHearts ? `Przerwano po ${r.total} z ${r.planned} pytań.` : ''),
        extraHTML: streakNote(streakUp),
        actions,
      });
    },
  });
}

function startExam() {
  const plan = examPlan();
  const ids = [];
  for (const x of plan.alloc) ids.push(...shuffle(D.qBySection[x.s.id].map((q) => q.id)).slice(0, x.take));
  const root = overlay;
  session({
    mode: 'exam',
    questions: questionsFor(shuffle(ids)),
    seconds: plan.seconds,
    onExit: () => closeOverlay(),
    onFinish: (r) => {
      const { xpTotal, streakUp } = finishCommon(r);
      r.xpTotal = xpTotal;
      const per = {};
      for (const a of r.answers) {
        const p = (per[a.q.section] ||= { ok: 0, n: 0 });
        p.n += 1; if (a.ok) p.ok += 1;
      }
      const s = store.get();
      s.history[0].perSection = per;
      store.save();
      const breakdown = `<div class="breakdown"><h3>Wynik per dział</h3>
        ${Object.entries(per).map(([sid, p]) => {
          const pct = Math.round((p.ok / p.n) * 100);
          return `<div class="bd-row"><div class="bd-label"><span>${esc(D.sectionById[sid]?.name || sid)}</span><span>${p.ok}/${p.n} · ${pct}%</span></div>
            <div class="bd-bar"><div class="${pct >= 65 ? 'ok' : 'bad'}" style="width:${pct}%"></div></div></div>`;
        }).join('')}
        </div>`;
      renderSummary(root, r, {
        emoji: r.percent >= 80 ? '🏆' : r.percent >= 65 ? '👍' : '📚',
        title: `Wynik: ${r.percent}%`,
        subtitle: `${r.correct} z ${r.total} poprawnych${r.timedOut ? ' · skończył się czas' : ''}`,
        extraHTML: breakdown + streakNote(streakUp),
        actions: [
          { label: 'Nowy egzamin', onClick: () => startExam() },
          { label: 'Gotowe', onClick: () => closeOverlay() },
        ],
      });
    },
  });
}

// ---------- POWTÓRKI ----------

function renderReview() {
  const due = dueIds(D.allIds);
  const boxes = boxCounts(D.allIds);
  const seen = boxes.reduce((a, b) => a + b, 0);
  const nd = nextDue(D.allIds);
  const max = Math.max(1, ...boxes);
  let html = statusBar() + '<h1 class="page-title">Powtórki</h1>';
  html += `<section class="hero ${due.length ? '' : 'calm'}">
      <div class="hero-num">${due.length}</div>
      <div class="hero-label">powtórek na dziś</div>
      ${due.length
        ? `<button class="btn btn-primary btn-block" data-start="review">Powtarzaj${due.length > REVIEW_SESSION_MAX ? ` (${REVIEW_SESSION_MAX})` : ''}</button><p class="muted-text">Powtórki nie zużywają serduszek.</p>`
        : `<p class="muted-text">${seen ? (nd ? `Następna powtórka: ${new Date(nd).toLocaleString('pl-PL', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : '') : 'Zrób lekcję albo quiz – pytania trafią do pudełek.'}</p>`}
    </section>`;
  html += `<section class="mode-card"><h2>Pudełka Leitnera</h2>
      <div class="boxes">${boxes.map((c, i) => `<div class="box"><div class="box-bar"><div style="height:${(c / max) * 100}%"></div></div>
        <div class="box-count">${c}</div><div class="box-label">${i + 1}</div>
        <div class="box-int">${BOX_INTERVAL_DAYS[i] === 0 ? 'od razu' : `${BOX_INTERVAL_DAYS[i]} d`}</div></div>`).join('')}</div>
      <p class="muted-text">Dobra odpowiedź przesuwa pytanie do następnego pudełka, więc wraca rzadziej. Błąd cofa je do pudełka 1, więc wraca od razu. Poznane pytania: ${seen}/${D.questions.length}.</p>
    </section>`;
  view.innerHTML = html;
  view.querySelector('[data-start="review"]')?.addEventListener('click', () => startSimple('review', dueIds(D.allIds).slice(0, REVIEW_SESSION_MAX)));
}

// ---------- PROFIL ----------

function renderProfile() {
  const s = store.get();
  const st = currentStreak();
  const h = hearts();
  const srs = Object.entries(s.srs).filter(([id]) => D.allIds.has(id)).map(([, v]) => v);
  const seen = srs.reduce((a, x) => a + x.seen, 0);
  const correct = srs.reduce((a, x) => a + x.correct, 0);
  const lessonsDone = D.lessons.filter((l) => s.lessons[l.id]?.done).length;
  const exams = s.history.filter((x) => x.mode === 'exam').slice(0, 5);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const ts = Date.now() - i * 86400000;
    days.push({ k: dayKey(ts), label: new Date(ts).toLocaleDateString('pl-PL', { weekday: 'short' }), xp: s.days[dayKey(ts)] || 0 });
  }
  const maxXp = Math.max(10, ...days.map((d) => d.xp));

  let html = statusBar() + '<h1 class="page-title">Profil</h1>';
  html += `<div class="stat-grid">
      <div class="stat-tile"><div class="stat-label">🔥 Streak</div><div class="stat-value">${st.count}</div><div class="stat-foot">rekord ${s.streak.best}</div></div>
      <div class="stat-tile"><div class="stat-label">⭐ XP</div><div class="stat-value">${s.xp}</div><div class="stat-foot">dziś ${s.days[dayKey()] || 0}</div></div>
      <div class="stat-tile"><div class="stat-label">📘 Lekcje</div><div class="stat-value">${lessonsDone}/${D.lessons.length}</div><div class="stat-foot">zaliczone</div></div>
      <div class="stat-tile"><div class="stat-label">🎯 Trafność</div><div class="stat-value">${seen ? Math.round((correct / seen) * 100) : 0}%</div><div class="stat-foot">${seen} odpowiedzi</div></div>
    </div>`;
  html += `<section class="mode-card"><h2>Serduszka</h2>
      <div class="hearts-row">${Array.from({ length: MAX_HEARTS }, (_, i) => `<span class="${i < h.count ? '' : 'empty'}">❤️</span>`).join('')}</div>
      <p class="muted-text">${h.nextIn ? `Następne serduszko za ${formatMinutes(h.nextIn)}.` : 'Komplet serduszek.'} Tracisz 1 za błąd w lekcjach, Szybkim quizie i Moich błędach.</p></section>`;
  html += `<section class="mode-card"><h2>Ostatnie 7 dni</h2>
      <div class="week">${days.map((d) => `<div class="day"><div class="day-bar"><div style="height:${(d.xp / maxXp) * 100}%"></div></div><div class="day-xp">${d.xp || ''}</div><div class="day-label">${esc(d.label)}</div></div>`).join('')}</div></section>`;
  if (exams.length) {
    html += `<section class="mode-card"><h2>Próbne egzaminy</h2><ul class="plan">${exams.map((e) => `<li><span>${new Date(e.at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span><strong>${e.percent}%</strong> · ${e.correct}/${e.total}</span></li>`).join('')}</ul></section>`;
  }
  html += `<section class="mode-card"><h2>Ustawienia</h2>
      ${store.isPersistent() ? '' : '<p class="warn-text">⚠️ Przeglądarka blokuje zapis (np. tryb prywatny). Postęp zniknie po zamknięciu karty – użyj eksportu.</p>'}
      <button class="btn btn-ghost btn-block" data-act="export">⬇️ Eksportuj postęp do pliku</button>
      <label class="btn btn-ghost btn-block file-btn">⬆️ Importuj postęp z pliku<input type="file" accept="application/json,.json" data-act="import" hidden></label>
      <button class="btn btn-danger-ghost btn-block" data-act="reset">🗑️ Resetuj postęp</button>
    </section>
    <section class="mode-card about"><h2>O apce</h2>
      <p>${esc(D.config.exam)}</p>
      <p class="muted-text">${D.lessons.length} lekcji · ${D.questions.length} pytań · źródła: ${[...new Set([...D.lessons, ...D.questions].map((x) => x.source))].map(esc).join(', ')}</p>
      <p class="muted-text">Na iPhonie: Safari → Udostępnij → „Do ekranu początkowego”. Na Androidzie: Chrome → ⋮ → „Dodaj do ekranu głównego”.</p>
    </section>`;
  view.innerHTML = html;

  view.querySelector('[data-act="export"]').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mce-study-postep-${dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Zapisano plik z postępem');
  });
  view.querySelector('[data-act="import"]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      store.importJSON(await f.text());
      toast('✅ Zaimportowano postęp');
      renderProfile();
    } catch (err) {
      toast('❌ ' + err.message);
    }
  });
  view.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (confirm('Na pewno usunąć cały postęp (XP, streak, lekcje, powtórki)?') && confirm('To nieodwracalne. Kontynuować?')) {
      store.reset();
      toast('Postęp wyczyszczony');
      renderProfile();
    }
  });
}

init();
