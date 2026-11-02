// Silnik sesji pytań: lekcja, szybki quiz, moje błędy, powtórki, próbny egzamin.
import { esc, inline, shuffle, formatDuration, vibrate } from './ui.js';
import { record } from './srs.js';
import { hearts, loseHeart, XP_CORRECT, XP_EXAM_CORRECT } from './game.js';

export const MODES = {
  lesson:   { hearts: true,  feedback: true,  label: 'Lekcja' },
  quick:    { hearts: true,  feedback: true,  label: 'Szybki quiz' },
  mistakes: { hearts: true,  feedback: true,  label: 'Moje błędy' },
  review:   { hearts: false, feedback: true,  label: 'Powtórki' },
  exam:     { hearts: false, feedback: false, label: 'Próbny egzamin' },
};

const TYPE_BADGE = {
  single: 'Single choice',
  scenario: '📋 Scenario',
  truefalse: 'True or False',
  multi: null, // "Choose N"
  match: '🔗 Match',
};

const LETTERS = 'ABCDEFGH';

// ---------- logika pytań (czysta, testowalna) ----------

export function prepare(q) {
  const p = { ...q };
  if (q.type === 'match') {
    p.left = shuffle(q.options.left);
    p.right = shuffle(q.options.right);
  } else if (q.type === 'truefalse' || q.shuffle === false) {
    p.opts = q.options.slice();
  } else {
    p.opts = shuffle(q.options);
  }
  return p;
}

export function needed(q) {
  return q.type === 'multi' ? q.correct.length : 1;
}

export function isCorrect(q, given) {
  if (given == null) return false;
  if (q.type === 'multi') {
    const a = [...given].sort();
    const b = [...q.correct].sort();
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (q.type === 'match') {
    const keys = Object.keys(q.correct);
    return keys.length === Object.keys(given).length && keys.every((k) => given[k] === q.correct[k]);
  }
  return given === q.correct;
}

function optText(q, id) {
  const o = q.options.find((x) => x.id === id);
  return o ? o.text : id;
}

export function answerText(q, given) {
  if (given == null) return '— brak odpowiedzi —';
  if (q.type === 'multi') return given.map((id) => optText(q, id)).join(' + ');
  if (q.type === 'match') {
    return q.options.left
      .map((l) => {
        const r = q.options.right.find((x) => x.id === given[l.id]);
        return `${l.text} → ${r ? r.text : '?'}`;
      })
      .join('\n');
  }
  return optText(q, given);
}

// ---------- sesja ----------

export function runSession(root, cfg) {
  const mode = MODES[cfg.mode];
  const qs = cfg.questions.map(prepare);
  const startedAt = Date.now();
  const answers = [];
  let idx = 0;
  let selection = null;
  let checked = false;
  let finished = false;
  let timerId = null;
  const deadline = cfg.mode === 'exam' ? startedAt + cfg.seconds * 1000 : null;

  root.innerHTML = `
    <div class="session" data-mode="${cfg.mode}">
      <header class="session-top">
        <button class="icon-btn" data-act="close" aria-label="Zamknij">✕</button>
        <div class="progress" aria-hidden="true"><div class="progress-bar"></div></div>
        <span class="session-stat" data-stat></span>
      </header>
      <main class="session-body"></main>
      <footer class="session-foot">
        <button class="btn btn-primary btn-block" data-act="check" disabled>${mode.feedback ? 'Sprawdź' : 'Zatwierdź'}</button>
      </footer>
      <div class="feedback" aria-live="polite"></div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const body = $('.session-body');
  const checkBtn = $('[data-act="check"]');
  const sheet = $('.feedback');
  const stat = $('[data-stat]');

  $('[data-act="close"]').addEventListener('click', () => {
    if (answers.length === 0 || confirm('Przerwać sesję? XP z tej sesji przepadnie.')) {
      stop();
      cfg.onExit?.();
    }
  });
  checkBtn.addEventListener('click', onCheck);

  function stop() {
    finished = true;
    if (timerId) clearInterval(timerId);
  }

  function updateTop() {
    $('.progress-bar').style.width = `${(idx / qs.length) * 100}%`;
    if (mode.hearts) {
      const h = hearts();
      stat.innerHTML = `<span class="heart">❤️</span> ${h.count}`;
    } else if (deadline) {
      const left = deadline - Date.now();
      stat.innerHTML = `⏱ ${formatDuration(left)}`;
      stat.classList.toggle('warn', left < 60000);
    } else {
      stat.textContent = `${idx + 1}/${qs.length}`;
    }
  }

  if (deadline) {
    timerId = setInterval(() => {
      if (finished) return;
      updateTop();
      if (Date.now() >= deadline) finish({ timedOut: true });
    }, 500);
  }

  function renderQuestion() {
    const q = qs[idx];
    selection = q.type === 'match' ? {} : q.type === 'multi' ? [] : null;
    checked = false;
    checkBtn.disabled = true;
    checkBtn.textContent = mode.feedback ? 'Sprawdź' : (idx === qs.length - 1 ? 'Zakończ egzamin' : 'Zatwierdź');
    sheet.className = 'feedback';
    $('.session').dataset.state = '';
    updateTop();

    const badge = q.type === 'multi' ? `Choose ${needed(q)}` : TYPE_BADGE[q.type];
    let html = `<div class="q-card slide-in">
      <div class="q-meta"><span class="badge badge-${q.type}">${esc(badge)}</span>
        ${cfg.mode === 'exam' ? `<span class="q-count">${idx + 1} / ${qs.length}</span>` : ''}</div>
      <h2 class="q-text">${inline(q.question)}</h2>`;

    if (q.type === 'match') {
      html += `<p class="hint">Tapnij element po lewej, potem pasujący po prawej. Tapnij połączony, żeby go odpiąć.</p>
        <div class="match">
          <div class="match-col">${q.left.map((o) => `<button class="match-item" data-side="left" data-id="${esc(o.id)}">${inline(o.text)}</button>`).join('')}</div>
          <div class="match-col">${q.right.map((o) => `<button class="match-item" data-side="right" data-id="${esc(o.id)}">${inline(o.text)}</button>`).join('')}</div>
        </div>`;
    } else {
      const tf = q.type === 'truefalse';
      html += `<div class="options ${tf ? 'options-tf' : ''}">` +
        q.opts.map((o, i) => `<button class="option" data-id="${esc(o.id)}" aria-pressed="false">
            ${tf ? '' : `<span class="opt-key">${LETTERS[i]}</span>`}<span class="opt-text">${inline(o.text)}</span>
          </button>`).join('') + '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
    body.scrollTop = 0;

    if (q.type === 'match') bindMatch(q);
    else bindOptions(q);
  }

  function bindOptions(q) {
    const need = needed(q);
    body.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (checked) return;
        const id = btn.dataset.id;
        if (q.type === 'multi') {
          if (selection.includes(id)) selection = selection.filter((x) => x !== id);
          else if (selection.length < need) selection.push(id);
          else {
            btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
            return;
          }
        } else {
          selection = id;
        }
        body.querySelectorAll('.option').forEach((b) => {
          const on = q.type === 'multi' ? selection.includes(b.dataset.id) : selection === b.dataset.id;
          b.classList.toggle('selected', on);
          b.setAttribute('aria-pressed', String(on));
        });
        checkBtn.disabled = q.type === 'multi' ? selection.length !== need : selection == null;
      });
    });
  }

  function bindMatch(q) {
    let pending = null; // {side, id}
    const pairColor = {}; // leftId -> color index
    const items = body.querySelectorAll('.match-item');

    const paint = () => {
      const rightToLeft = Object.fromEntries(Object.entries(selection).map(([l, r]) => [r, l]));
      items.forEach((b) => {
        const { side, id } = b.dataset;
        const leftId = side === 'left' ? (selection[id] ? id : null) : rightToLeft[id];
        b.classList.remove(...[0, 1, 2, 3, 4, 5].map((n) => `pair-${n}`));
        if (leftId) b.classList.add(`pair-${pairColor[leftId]}`);
        b.classList.toggle('pending', !!pending && pending.side === side && pending.id === id);
        b.classList.toggle('paired', !!leftId);
      });
      checkBtn.disabled = Object.keys(selection).length !== q.left.length;
    };

    const freeColor = () => {
      const used = new Set(Object.values(pairColor));
      for (let i = 0; i < 6; i++) if (!used.has(i)) return i;
      return 0;
    };

    items.forEach((b) => {
      b.addEventListener('click', () => {
        if (checked) return;
        const { side, id } = b.dataset;
        // odpinanie istniejącej pary
        if (side === 'left' && selection[id]) {
          delete selection[id]; delete pairColor[id]; pending = null; paint(); return;
        }
        if (side === 'right') {
          const l = Object.keys(selection).find((k) => selection[k] === id);
          if (l) { delete selection[l]; delete pairColor[l]; pending = null; paint(); return; }
        }
        if (!pending || pending.side === side) {
          pending = pending && pending.id === id ? null : { side, id };
          paint();
          return;
        }
        const leftId = side === 'left' ? id : pending.id;
        const rightId = side === 'right' ? id : pending.id;
        selection[leftId] = rightId;
        pairColor[leftId] = freeColor();
        pending = null;
        paint();
      });
    });
  }

  function revealOptions(q, ok) {
    const correctSet = new Set(Array.isArray(q.correct) ? q.correct : [q.correct]);
    body.querySelectorAll('.option').forEach((b) => {
      const id = b.dataset.id;
      const chosen = Array.isArray(selection) ? selection.includes(id) : selection === id;
      b.disabled = true;
      b.classList.remove('selected');
      if (correctSet.has(id)) b.classList.add('correct');
      else if (chosen) b.classList.add('wrong');
    });
    if (!ok) body.querySelector('.q-card')?.classList.add('shake');
  }

  function revealMatch(q) {
    body.querySelectorAll('.match-item').forEach((b) => {
      b.disabled = true;
      b.classList.remove('pending', 'paired', ...[0, 1, 2, 3, 4, 5].map((n) => `pair-${n}`));
      const { side, id } = b.dataset;
      const leftId = side === 'left' ? id : Object.keys(selection).find((k) => selection[k] === id);
      b.classList.add(leftId && selection[leftId] === q.correct[leftId] ? 'correct' : 'wrong');
    });
  }

  function onCheck() {
    if (finished) return;
    const q = qs[idx];
    if (checked) return next();
    const ok = isCorrect(q, selection);
    const given = Array.isArray(selection) ? selection.slice() : (selection && typeof selection === 'object' ? { ...selection } : selection);
    answers.push({ q, given, ok });

    if (!mode.feedback) {
      // egzamin: bez podpowiedzi, od razu dalej
      checked = true;
      return next();
    }

    checked = true;
    record(q.id, ok);
    let heartsLeft = null;
    if (!ok && mode.hearts) heartsLeft = loseHeart();
    vibrate(ok ? 15 : [30, 40, 30]);

    if (q.type === 'match') revealMatch(q); else revealOptions(q, ok);
    updateTop();

    const outOfHearts = mode.hearts && heartsLeft === 0;
    sheet.innerHTML = `
      <div class="feedback-inner">
        <div class="fb-title">${ok ? '✅ Dobrze!' : '❌ Niepoprawnie'}</div>
        ${ok ? '' : `<div class="fb-correct"><span>Poprawna odpowiedź:</span> ${inline(answerText(q, q.correct)).replace(/\n/g, '<br>')}</div>`}
        <div class="fb-expl">${inline(q.explanation)}</div>
        <div class="fb-source">📄 ${esc(q.source)}</div>
        ${outOfHearts ? '<div class="fb-hearts">💔 Skończyły się serduszka. Odnawiają się 1 na 30 min. Powtórki i Próbny egzamin działają bez serduszek.</div>' : ''}
      </div>`;
    sheet.className = `feedback show ${ok ? 'ok' : 'bad'}`;
    $('.session').dataset.state = ok ? 'ok' : 'bad';
    checkBtn.disabled = false;
    checkBtn.textContent = outOfHearts ? 'Zakończ' : 'Dalej';
    checkBtn.classList.toggle('btn-danger', !ok);
    if (outOfHearts) checkBtn.dataset.end = '1';
  }

  function next() {
    checkBtn.classList.remove('btn-danger');
    if (checkBtn.dataset.end) {
      delete checkBtn.dataset.end;
      return finish({ outOfHearts: true });
    }
    idx += 1;
    if (idx >= qs.length) return finish({});
    renderQuestion();
  }

  function finish({ timedOut = false, outOfHearts = false }) {
    if (finished) return;
    stop();
    // egzamin: nieodpowiedziane = błędne; SRS zapisujemy dopiero teraz
    if (cfg.mode === 'exam') {
      for (const a of answers) record(a.q.id, a.ok);
      for (let i = answers.length; i < qs.length; i++) answers.push({ q: qs[i], given: null, ok: false });
    }
    const correct = answers.filter((a) => a.ok).length;
    const total = cfg.mode === 'exam' ? qs.length : answers.length;
    const xp = correct * (cfg.mode === 'exam' ? XP_EXAM_CORRECT : XP_CORRECT);
    cfg.onFinish?.({
      mode: cfg.mode,
      answers,
      correct,
      total,
      planned: qs.length,
      percent: total ? Math.round((correct / total) * 100) : 0,
      durationMs: Date.now() - startedAt,
      xp,
      timedOut,
      outOfHearts,
    });
  }

  renderQuestion();
  return { stop };
}

// ---------- podsumowanie ----------

export function renderSummary(root, r, opts) {
  const { title, emoji, subtitle, extraHTML = '', actions = [], showReview = true } = opts;
  const wrong = r.answers.filter((a) => !a.ok);
  root.innerHTML = `
    <div class="summary pop-in">
      <div class="summary-emoji">${emoji}</div>
      <h1 class="summary-title">${esc(title)}</h1>
      ${subtitle ? `<p class="summary-sub">${esc(subtitle)}</p>` : ''}
      <div class="stat-row">
        <div class="stat-tile xp"><div class="stat-label">XP</div><div class="stat-value">+${r.xpTotal ?? r.xp}</div></div>
        <div class="stat-tile acc"><div class="stat-label">Trafność</div><div class="stat-value">${r.percent}%</div></div>
        <div class="stat-tile time"><div class="stat-label">Czas</div><div class="stat-value">${formatDuration(r.durationMs)}</div></div>
      </div>
      ${extraHTML}
      ${showReview && wrong.length ? `
        <details class="review" ${r.mode === 'exam' ? 'open' : ''}>
          <summary>Przegląd błędnych odpowiedzi (${wrong.length})</summary>
          ${wrong.map((a) => `
            <div class="review-item">
              <div class="review-q">${inline(a.q.question)}</div>
              <div class="review-row bad"><span>Twoja:</span> ${inline(answerText(a.q, a.given)).replace(/\n/g, '<br>')}</div>
              <div class="review-row ok"><span>Poprawna:</span> ${inline(answerText(a.q, a.q.correct)).replace(/\n/g, '<br>')}</div>
              <div class="review-expl">${inline(a.q.explanation)}</div>
              <div class="fb-source">📄 ${esc(a.q.source)}</div>
            </div>`).join('')}
        </details>` : ''}
      <div class="summary-actions">
        ${actions.map((a, i) => `<button class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'} btn-block" data-i="${i}">${esc(a.label)}</button>`).join('')}
      </div>
    </div>`;
  root.querySelectorAll('.summary-actions button').forEach((b) => {
    b.addEventListener('click', () => actions[Number(b.dataset.i)].onClick());
  });
}
