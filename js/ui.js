// Drobne helpery UI: escapowanie, mini-markdown, toast, losowanie.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inline: **bold**, `code`, ⚠️ -> znacznik "do sprawdzenia"
export function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/⚠️?/g, '<span class="flag">⚠️ do sprawdzenia</span>');
}

// Bloki: akapity rozdzielone pustą linią, linie zaczynające się od "- " -> lista
export function md(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      const out = [];
      let list = [];
      const flush = () => {
        if (list.length) out.push('<ul>' + list.map((l) => `<li>${inline(l)}</li>`).join('') + '</ul>');
        list = [];
      };
      for (const line of lines) {
        if (/^\s*-\s+/.test(line)) list.push(line.replace(/^\s*-\s+/, ''));
        else {
          flush();
          if (line.trim()) out.push(`<p>${inline(line)}</p>`);
        }
      }
      flush();
      return out.join('');
    })
    .join('');
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMinutes(ms) {
  const m = Math.ceil(ms / 60000);
  return m <= 1 ? '1 min' : `${m} min`;
}

let toastTimer = null;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
}
