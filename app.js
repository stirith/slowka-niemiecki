'use strict';

const STORE_KEY = 'slowka-de-v2';

// Listy startowe: Wörterliste str. 23 (78 słówek), podział na dni wg planu nauki.
// Format "niemiecki = polski", kilka znaczeń po ukośniku lub przecinku.
const START_DECKS = [
  ['dzien1', 'Dzień 1', '1️⃣', `der Papagei = papuga
Alles Gute! = Wszystkiego dobrego!
die Schwester = siostra
das Jahr = rok
die Deutsche = Niemka
tschüss = pa, pa
wie = jak
genial = genialny
die Mutter = mama
toll = świetnie`],
  ['dzien2', 'Dzień 2', '2️⃣', `beantworten = odpowiadać
heißen = nazywać się
der Geburtstag = urodziny
aber = ale
der Lehrer = nauczyciel
acht = 8
auch = też
drei = 3
hallo = cześć
der Computer = komputer`],
  ['dzien3', 'Dzień 3', '3️⃣', `zwölf = 12
das Geschenk = prezent
Ich weiß! = Ja wiem!
schön = ładny
(das) Deutschland = Niemcy
fünf = 5
vier = 4
alt = stary
die Familie = rodzina
(das) Spanien = Hiszpania`],
  ['dzien4', 'Dzień 4', '4️⃣', `sieben = 7
sein = być
die Polin = Polka
kommen = pochodzić
der Vater = tata
was = co
der Deutsche = Niemiec
der Opa = dziadek
das Haus = dom
danke = dziękuję`],
  ['dzien5', 'Dzień 5', '5️⃣', `die Großmutter = babcia
der Großvater = dziadek
die Katze = kot
der Hund = pies
sechs = 6
sehr = bardzo
und = i
zwei = 2
mein = mój
eins = 1`],
  ['dzien6', 'Dzień 6', '6️⃣', `die Geschwister = rodzeństwo
sein = jego
neun = 9
der Pole = Polak
die Sonne = słońce
die Frage = pytanie
ich = ja
du = ty
zehn = 10
(das) Polen = Polska`],
  ['dzien7', 'Dzień 7', '7️⃣', `wunderbar = wspaniale
woher = skąd
ihr = jej
haben = mieć
jetzt = teraz
dein = twój
und du? = a ty?
(das) England = Anglia
die Oma = babcia`],
  ['dzien8', 'Dzień 8', '8️⃣', `buchstabieren = przeliterować
auf Wiedersehen = do widzenia
elf = 11
aus = z (Ich komme aus Polen. – Pochodzę z Polski.)
sie = ona
sagen = mówić, powiedzieć
(das) Italien = Włochy
er = on
es = ono`],
];

const DEFAULT_SETTINGS = {
  direction: 'pl-de',   // pl-de | de-pl | mix
  testType: 'choice',   // choice | type | mix
  count: 10,            // 0 = wszystkie
  requireArticle: false,
  speak: true,
  planStart: '2026-10-31',
  testDate: '2026-11-18', // nauka do dnia przed testem
};

const LABELS = {
  direction: { 'pl-de': 'PL → DE', 'de-pl': 'DE → PL', mix: 'Mieszany' },
  testType: { choice: 'Wybór z 3', type: 'Wpisywanie', mix: 'Wybór + wpisywanie' },
};

const PRAISE = ['Brawo! 🎉', 'Super! ⭐', 'Świetnie! 🙌', 'Tak jest! 💪', 'Ekstra! 🌟'];

// Ile kolejnych dobrych odpowiedzi, żeby słówko liczyło się jako „umiem”.
const MASTERED_AFTER = 2;

// ---------- czyste funkcje (testowalne bez przeglądarki) ----------

function parseWords(text) {
  const words = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(.+?)\s*(?:=|\t|\s[-–—]\s)\s*(.+)$/);
    if (m) words.push({ de: m[1].trim(), pl: m[2].trim() });
  }
  return words;
}

function wordsToText(words) {
  return words.map(w => `${w.de} = ${w.pl}`).join('\n');
}

function startDecks() {
  return START_DECKS.map(([id, name, emoji, text]) => ({ id, name, emoji, words: parseWords(text) }));
}

const FOLD = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', ä: 'a', ö: 'o', ü: 'u', ß: 'ss' };
const ARTICLE = /^(der|die|das|ein|eine|einen) /;

function basic(s) {
  return String(s).toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
}

// Wersja „wyrozumiała”: bez umlautów (ä = a = ae), bez polskich znaków, bez interpunkcji.
function loose(s, stripArticle) {
  let t = basic(s).replace(/\(.*?\)/g, ' ');
  t = t.replace(/[ąćęłńóśźżäöüß]/g, c => FOLD[c]);
  t = t.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  t = t.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (stripArticle) t = t.replace(ARTICLE, '');
  return t;
}

// "(das) Deutschland" przyjmuje odpowiedź z rodzajnikiem i bez; inne nawiasy to tylko podpowiedź.
function alternatives(target) {
  const s = String(target);
  const variants = [s, s.replace(/\((der|die|das)\)/g, '$1')];
  return [...new Set(variants.flatMap(v =>
    v.replace(/\(.*?\)/g, ' ').split(/[/,;]/).map(x => x.trim()).filter(Boolean)))];
}

// 'exact' – idealnie, 'close' – dobrze, ale bez umlautu/rodzajnika/polskiej litery, 'wrong'.
function checkTyped(input, target, german, requireArticle) {
  const inp = basic(input);
  if (!inp) return 'wrong';
  const alts = alternatives(target);
  if (alts.some(a => basic(a) === inp)) return 'exact';
  const strip = german && !requireArticle;
  const li = loose(input, strip);
  if (li && alts.some(a => loose(a, strip) === li)) return 'close';
  return 'wrong';
}

// Rodzajnik ma znaczenie: der Deutsche (Niemiec) i die Deutsche (Niemka) to różne słówka.
function overlaps(a, b) {
  const la = alternatives(a).map(x => loose(x, false));
  return alternatives(b).some(x => la.includes(loose(x, false)));
}

// Rzeczownik z rodzajnikiem: "der Hund" → {art: 'der', rest: 'Hund'}; "(das) Polen" → paren: true.
function splitArticle(de) {
  const m = String(de).match(/^(\()?(der|die|das)\)?\s+(.+)$/);
  return m ? { art: m[2], rest: m[3], paren: !!m[1] } : null;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const keyOf = w => w.de + '|' + w.pl;

function uniqueWords(words) {
  const seen = new Set();
  return words.filter(w => (seen.has(keyOf(w)) ? false : seen.add(keyOf(w))));
}

// Daty jako 'YYYY-MM-DD' w czasie lokalnym; dayNum to numer dnia do odejmowania.
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayNum(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function isoFromNum(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

// Podział słówek na dni nauki; ostatnie 2 dni przed testem to powtórka całości (jak w planie z PDF).
function splitPlan(words, start, test) {
  const totalDays = Math.max(1, test - start);
  const reviewDays = totalDays >= 8 ? 2 : totalDays >= 4 ? 1 : 0;
  const learnDays = totalDays - reviewDays;
  const chunks = Array.from({ length: learnDays }, (_, i) =>
    words.slice(Math.round((i * words.length) / learnDays), Math.round(((i + 1) * words.length) / learnDays)));
  return { totalDays, reviewDays, learnDays, chunks };
}

function dni(n) {
  return n === 1 ? 'dzień' : 'dni';
}

// ---------- stan ----------

let state;
let view = 'home';
let session = null;
let editingId = null;
let advanceTimer = null;

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* brak dostępu do pamięci */ }
  if (!s || !Array.isArray(s.decks)) {
    return { decks: startDecks(), selected: [], settings: { ...DEFAULT_SETTINGS }, stats: {}, plan: { days: {} }, activity: {} };
  }
  return {
    decks: s.decks,
    selected: Array.isArray(s.selected) ? s.selected : [],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    stats: s.stats || {},
    plan: s.plan && s.plan.days ? s.plan : { days: {} },
    activity: s.activity || {},
  };
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* tryb prywatny */ }
}

// ?dzis=2026-11-05 w adresie podmienia dzisiejszą datę (do sprawdzania planu).
function todayIso() {
  const forced = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dzis');
  return forced && /^\d{4}-\d{2}-\d{2}$/.test(forced) ? forced : isoDate(new Date());
}

function selectedWords() {
  return uniqueWords(state.decks.filter(d => state.selected.includes(d.id)).flatMap(d => d.words));
}

function allWords() {
  return uniqueWords(state.decks.flatMap(d => d.words));
}

function wordByKey(k) {
  return allWords().find(w => keyOf(w) === k);
}

const statOf = w => state.stats[keyOf(w)] || { r: 0, w: 0, c: 0 };
const isMastered = w => (statOf(w).c || 0) >= MASTERED_AFTER;

function hardWords() {
  return allWords().filter(w => {
    const st = state.stats[keyOf(w)];
    return st && st.w > 0 && st.w >= st.r;
  });
}

// Najpierw nieopanowane, potem te z największą liczbą błędów.
function weakFirst(a, b) {
  const sa = statOf(a), sb = statOf(b);
  return (isMastered(a) - isMastered(b)) || ((sb.w - sb.r) - (sa.w - sa.r)) || ((sa.c || 0) - (sb.c || 0));
}

function record(w, ok) {
  const st = { c: 0, ...statOf(w) };
  if (ok) { st.r++; st.c++; } else { st.w++; st.c = 0; }
  state.stats[keyOf(w)] = st;
  state.activity[todayIso()] = true;
  save();
}

function streak() {
  let n = dayNum(todayIso());
  if (!state.activity[isoFromNum(n)]) n--;
  let count = 0;
  while (state.activity[isoFromNum(n)]) { count++; n--; }
  return count;
}

function pickMode(value, a, b) {
  return value === 'mix' ? (Math.random() < 0.5 ? a : b) : value;
}

// Inne słówka o tym samym pytaniu, np. babcia = die Oma i die Großmutter, sein = być i jego.
function sameMeaning(w, dir) {
  const p = dir === 'pl-de' ? 'pl' : 'de';
  return allWords().filter(c => keyOf(c) !== keyOf(w) && overlaps(c[p], w[p]));
}

function makeOptions(w, dir) {
  const field = dir === 'pl-de' ? 'de' : 'pl';
  const prompt = dir === 'pl-de' ? 'pl' : 'de';
  const correct = w[field];
  const used = [correct];
  const out = [];
  for (const source of [shuffle(selectedWords()), shuffle(allWords())]) {
    for (const c of source) {
      if (out.length === 2) break;
      if (overlaps(c[prompt], w[prompt]) || used.some(u => overlaps(u, c[field]))) continue;
      used.push(c[field]);
      out.push(c[field]);
    }
  }
  return out.length < 2 ? null : shuffle([correct, ...out]);
}

// opts.type: choice | type | mix | auto (wybór, dopóki słówko nie było znane, potem wpisywanie) | listen | article
function buildQuestion(w, opts = {}) {
  if (opts.type === 'article') return { w, dir: 'pl-de', type: 'article', options: ['der', 'die', 'das'] };
  if (opts.type === 'listen') {
    const options = makeOptions(w, 'de-pl');
    if (options) return { w, dir: 'de-pl', type: 'listen', options };
  }
  const dir = opts.dir || pickMode(state.settings.direction, 'pl-de', 'de-pl');
  let type = opts.type === 'auto' ? (statOf(w).r > 0 ? 'type' : 'choice')
    : opts.type === 'choice' || opts.type === 'type' ? opts.type
    : pickMode(state.settings.testType, 'choice', 'type');
  let options = null;
  if (type === 'choice') {
    options = makeOptions(w, dir);
    if (!options) type = 'type';
  }
  return { w, dir, type, options };
}

function answerOf(q) {
  if (q.type === 'article') return splitArticle(q.w.de).art;
  return q.dir === 'pl-de' ? q.w.de : q.w.pl;
}

// ---------- plan „Dzisiaj” ----------

function planInfo() {
  const s = state.settings;
  const start = dayNum(s.planStart);
  const test = dayNum(s.testDate);
  const words = allWords();
  const today = dayNum(todayIso());
  return { ...splitPlan(words, start, test), start, test, words, idx: today - start, daysToTest: test - today };
}

function todayEntry(info) {
  const date = todayIso();
  const cfg = state.settings.planStart + '|' + state.settings.testDate;
  const old = state.plan.days[date];
  if (old && (old.cfg === cfg || Object.keys(old.done).length)) return old;
  const i = Math.max(0, info.idx);
  let e;
  if (i >= info.totalDays) {
    e = { steps: ['mock'], newKeys: [], reviewKeys: [] };
  } else if (i >= info.learnDays) {
    const weak = info.words.filter(w => !isMastered(w)).sort(weakFirst).slice(0, 20);
    e = { steps: weak.length ? ['weak', 'mock'] : ['mock'], newKeys: [], reviewKeys: weak.map(keyOf) };
  } else {
    // Nowe: słówka z dni do dziś, których jeszcze nie było (nadrabia opuszczone dni, maks. 15 naraz).
    const fresh = info.chunks.slice(0, i + 1).flat().filter(w => !state.stats[keyOf(w)]).slice(0, 15);
    const freshKeys = new Set(fresh.map(keyOf));
    const review = info.words.filter(w => state.stats[keyOf(w)] && !freshKeys.has(keyOf(w))).sort(weakFirst).slice(0, 8);
    const steps = [];
    if (review.length) steps.push('review');
    if (fresh.length) steps.push('cards', 'newtest');
    if (!steps.length) steps.push('mock');
    e = { steps, newKeys: fresh.map(keyOf), reviewKeys: review.map(keyOf) };
  }
  Object.assign(e, { cfg, done: {}, day: i });
  state.plan.days[date] = e;
  save();
  return e;
}

const dayDone = e => !!e && e.steps.every(s => e.done[s]);

const STEP_INFO = {
  review: ['🔁', 'Powtórka z poprzednich dni', 'reviewKeys'],
  cards: ['🃏', 'Nowe słówka: fiszki', 'newKeys'],
  newtest: ['✅', 'Nowe słówka: test', 'newKeys'],
  weak: ['🔁', 'Powtórka nieopanowanych', 'reviewKeys'],
  mock: ['📝', 'Próbny test (z rodzajnikiem)', null],
};

function runStep(step) {
  const e = state.plan.days[todayIso()];
  if (!e) return;
  const words = keys => keys.map(wordByKey).filter(Boolean);
  const onDone = () => { e.done[step] = true; save(); };
  if (step === 'review' || step === 'weak') startTest(words(e.reviewKeys), { type: 'auto', all: true, plan: true, onDone });
  if (step === 'cards') startCards(words(e.newKeys), { plan: true, onDone });
  if (step === 'newtest') startTest(words(e.newKeys), { type: 'choice', all: true, plan: true, onDone });
  if (step === 'mock') {
    startTest(planInfo().words, { dir: 'pl-de', type: 'type', requireArticle: true, noRequeue: true, all: true, mock: true, plan: true, onDone });
  }
}

// ---------- mowa ----------

let deVoice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  deVoice = vs.find(v => v.lang === 'de-DE') || vs.find(v => v.lang && v.lang.startsWith('de')) || null;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const t = String(text).replace(/\(.*?\)/g, '').split('/')[0].trim();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'de-DE';
  if (deVoice) u.voice = deVoice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

function autoSpeak(text) {
  if (state.settings.speak) speak(text);
}

// ---------- widoki ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Niemieckie słówko z kolorowym rodzajnikiem: der niebieski, die czerwony, das zielony.
function deHtml(de) {
  const a = splitArticle(de);
  if (!a) return esc(de);
  const art = a.paren ? `(${a.art})` : a.art;
  return `<span class="art art-${a.art}">${art}</span> ${esc(a.rest)}`;
}

const fmt = (text, german) => (german ? deHtml(text) : esc(text));

function speakBtn(de, extra = '') {
  return `<button type="button" class="speak ${extra}" data-action="speak" data-text="${esc(de)}" aria-label="Posłuchaj">🔊</button>`;
}

function topbar(idx, total) {
  const pct = total ? Math.round((idx / total) * 100) : 0;
  return `<div class="bar">
    <button class="close" data-action="home" aria-label="Zakończ">✕</button>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <span class="pos">${Math.min(idx + 1, total)}/${total}</span>
  </div>`;
}

function viewToday() {
  const info = planInfo();
  const e = todayEntry(info);
  const mastered = info.words.filter(isMastered).length;
  const fire = streak();
  let title;
  if (info.idx >= info.totalDays) title = info.daysToTest === 0 ? 'Dziś test! Powodzenia 🍀' : 'Plan zakończony 🎉';
  else if (e.day >= info.learnDays) title = `Powtórka · dzień ${e.day + 1} z ${info.totalDays}`;
  else title = `Dzień ${e.day + 1} z ${info.totalDays}`;
  const meta = [
    info.daysToTest > 0 ? `do testu <b>${info.daysToTest} ${dni(info.daysToTest)}</b>` : '',
    `umiesz <b>${mastered}/${info.words.length}</b>`,
  ].filter(Boolean).join(' · ');
  const next = e.steps.find(s => !e.done[s]);
  const steps = e.steps.map((s, i) => {
    const [ico, label, keys] = STEP_INFO[s];
    const n = keys ? e[keys].length : info.words.length;
    const done = e.done[s];
    return `<button class="step ${done ? 'done' : ''} ${s === next ? 'next' : ''}" data-action="planStep" data-step="${s}">
      <span class="num">${done ? '✓' : i + 1}</span><span class="lbl">${ico} ${label}</span><small>${n}</small></button>`;
  }).join('');
  const strip = Array.from({ length: info.totalDays }, (_, i) => {
    const d = state.plan.days[isoFromNum(info.start + i)];
    const cls = dayDone(d) ? 'done' : i === info.idx ? 'now' : i < info.idx ? 'missed' : '';
    return `<span class="${cls}" title="${isoFromNum(info.start + i)}">${dayDone(d) ? '★' : '☆'}</span>`;
  }).join('');
  return `
  <section class="today">
    <div class="today-head">
      <div><small>Dzisiaj${info.idx < 0 ? ' · plan startuje ' + esc(plDate(state.settings.planStart)) : ''}</small><h2>${title}</h2></div>
      ${fire ? `<div class="streak" title="Dni nauki z rzędu">🔥 ${fire}</div>` : ''}
    </div>
    <p class="today-meta">${meta}</p>
    <div class="meter"><span style="width:${Math.round((mastered / Math.max(1, info.words.length)) * 100)}%"></span></div>
    <div class="steps">${steps}</div>
    ${dayDone(e) ? '<p class="today-done">Dzień zaliczony! ⭐ Jutro kolejne słówka.</p>' : ''}
    <div class="strip" aria-label="Dni planu">${strip}<span class="flag" title="Test">🏁</span></div>
  </section>`;
}

function plDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
}

function viewHome() {
  const sel = selectedWords();
  const hard = hardWords();
  const nouns = sel.filter(w => splitArticle(w.de));
  const s = state.settings;
  const dis = sel.length ? '' : 'disabled';
  return `
  <header class="top">
    <h1>Słówka <span aria-hidden="true">🇩🇪</span></h1>
  </header>
  ${viewToday()}
  <h2 class="section">Wolna nauka</h2>
  <section class="chips">
    ${state.decks.map(d => `<button class="chip ${state.selected.includes(d.id) ? 'on' : ''}" data-action="toggleDeck" data-id="${esc(d.id)}">
      <span>${esc(d.emoji || '📘')}</span>${esc(d.name)}<small>${d.words.length}</small></button>`).join('')}
  </section>
  <p class="count">${sel.length ? `Wybrane słówka: <b>${sel.length}</b>` : 'Zaznacz dni, które chcesz poćwiczyć'}</p>
  <div class="big">
    <button class="big-btn cards" data-action="startCards" ${dis}>
      <span class="ico">🃏</span><span><b>Fiszki</b><small>${LABELS.direction[s.direction]}</small></span>
    </button>
    <button class="big-btn test" data-action="startTest" ${dis}>
      <span class="ico">✅</span><span><b>Test</b><small>${LABELS.testType[s.testType]} · ${LABELS.direction[s.direction]}</small></span>
    </button>
    <div class="extra">
      <button class="mini-btn" data-action="startListen" ${dis}><span>🎧</span><b>Posłuchaj i wybierz</b></button>
      <button class="mini-btn" data-action="startArticles" ${nouns.length ? '' : 'disabled'}>
        <span><i class="art art-der">der</i> <i class="art art-die">die</i> <i class="art art-das">das</i></span><b>Rodzajniki</b></button>
    </div>
    ${hard.length ? `<button class="big-btn hard" data-action="startHard">
      <span class="ico">🔁</span><span><b>Trudne słówka</b><small>${hard.length} do powtórki</small></span>
    </button>` : ''}
  </div>`;
}

function viewLists() {
  return `
  <header class="top"><h1>Listy słówek</h1><p class="sub">Dotknij listy, żeby ją zmienić</p></header>
  <ul class="lists">
    ${state.decks.map(d => `<li><button class="list-row" data-action="editDeck" data-id="${esc(d.id)}">
      <span class="ico">${esc(d.emoji || '📘')}</span><span class="name">${esc(d.name)}</span><small>${d.words.length} słówek</small><span class="chev">›</span>
    </button></li>`).join('')}
  </ul>
  <button class="primary wide" data-action="newDeck">+ Nowa lista</button>`;
}

function viewEdit() {
  const d = state.decks.find(x => x.id === editingId) || { name: '', emoji: '📘', words: [] };
  return `
  <header class="top"><h1>${editingId ? 'Edytuj listę' : 'Nowa lista'}</h1></header>
  <div class="form">
    <div class="row2">
      <label class="field emoji"><span>Ikona</span><input id="deck-emoji" maxlength="4" value="${esc(d.emoji || '')}"></label>
      <label class="field"><span>Nazwa</span><input id="deck-name" value="${esc(d.name)}" placeholder="np. Lekcja 5"></label>
    </div>
    <label class="field"><span>Słówka</span>
      <textarea id="deck-text" rows="14" autocapitalize="off" autocorrect="off" spellcheck="false"
        placeholder="der Hund = pies&#10;die Katze = kot">${esc(wordsToText(d.words))}</textarea>
    </label>
    <p class="hint">Każde słówko w nowej linii: <b>niemiecki = polski</b>. Rzeczowniki z rodzajnikiem (der / die / das).
      Kilka znaczeń po ukośniku: <i>die Mutter = mama / matka</i>.</p>
    <button class="primary wide" data-action="saveDeck">Zapisz</button>
    <button class="ghost wide" data-action="lists">Anuluj</button>
    ${editingId ? '<button class="danger wide" data-action="deleteDeck">Usuń listę</button>' : ''}
  </div>`;
}

function seg(key, options) {
  const cur = state.settings[key];
  return `<div class="seg" role="radiogroup">${options.map(([val, label]) =>
    `<button role="radio" aria-checked="${cur === val}" class="${cur === val ? 'on' : ''}" data-action="set" data-key="${key}" data-val="${val}">${label}</button>`).join('')}</div>`;
}

function toggle(key, label, hint) {
  return `<label class="toggle"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span>
    <input type="checkbox" data-setting="${key}" ${state.settings[key] ? 'checked' : ''}><i></i></label>`;
}

function viewSettings() {
  const s = state.settings;
  return `
  <header class="top"><h1>Ustawienia</h1></header>
  <div class="settings">
    <section><h2>Plan „Dzisiaj”</h2>
      <div class="row2 dates">
        <label class="field"><span>Początek nauki</span><input type="date" data-date="planStart" value="${esc(s.planStart)}"></label>
        <label class="field"><span>Data testu</span><input type="date" data-date="testDate" value="${esc(s.testDate)}"></label>
      </div>
      <p class="hint">Słówka dzielą się na dni do dnia przed testem. Ostatnie 2 dni to powtórka całości i próbny test.</p></section>
    <section><h2>Kierunek</h2>${seg('direction', [['pl-de', 'PL → DE'], ['de-pl', 'DE → PL'], ['mix', 'Mieszany']])}
      <p class="hint">Dotyczy fiszek i testu. Mieszany losuje kierunek przy każdym słówku.</p></section>
    <section><h2>Rodzaj testu</h2>${seg('testType', [['choice', 'Wybór z 3'], ['type', 'Wpisywanie'], ['mix', 'Mix']])}</section>
    <section><h2>Liczba pytań w teście</h2>${seg('count', [[5, '5'], [10, '10'], [20, '20'], [0, 'Wszystkie']])}</section>
    <section class="toggles">
      ${toggle('requireArticle', 'Wymagaj rodzajnika', 'Przy wpisywaniu trzeba podać der / die / das')}
      ${toggle('speak', 'Czytaj po niemiecku', 'Wymowa słówka po odpowiedzi')}
    </section>
    <p class="hint">Przy wpisywaniu brak umlautu nie jest błędem: <b>kase</b>, <b>kaese</b> i <b>Käse</b> są zaliczane,
      a aplikacja pokazuje poprawną pisownię.</p>
    <section><h2>Dane</h2>
      <button class="ghost wide" data-action="resetStats">Wyzeruj postępy</button>
      <button class="ghost wide" data-action="resetDecks">Przywróć listy startowe</button>
    </section>
  </div>`;
}

function viewCards() {
  const s = session;
  if (s.idx >= s.queue.length) return cardsSummary();
  const it = s.queue[s.idx];
  const frontDe = it.dir === 'de-pl';
  const front = frontDe ? it.w.de : it.w.pl;
  const back = frontDe ? it.w.pl : it.w.de;
  const also = sameMeaning(it.w, it.dir).map(c => (frontDe ? c.pl : c.de));
  return `
  ${topbar(s.idx, s.queue.length)}
  <div class="stage ${s.flipped ? 'flipped' : ''}" id="stage">
    <button class="flashcard" data-action="flip" aria-label="Odwróć fiszkę">
      <span class="inner">
        <span class="face front"><small>${frontDe ? 'niemiecki' : 'polski'}</small><b>${fmt(front, frontDe)}</b><em>Dotknij, aby odwrócić</em></span>
        <span class="face back"><small>${frontDe ? 'polski' : 'niemiecki'}</small><b>${fmt(back, !frontDe)}</b>${also.length
          ? `<em>też: ${also.map(a => fmt(a, !frontDe)).join(', ')}</em>` : ''}</span>
      </span>
    </button>
    <div class="card-tools">${speakBtn(it.w.de, frontDe ? '' : 'only-flipped')}</div>
    <div class="rate">
      <button class="rate-btn no" data-action="cardNo">😕 Jeszcze nie</button>
      <button class="rate-btn yes" data-action="cardYes">😊 Umiem</button>
    </div>
  </div>`;
}

function cardsSummary() {
  const s = session;
  return `
  <div class="summary">
    <div class="big-emoji">${s.unknown.length ? '💪' : '🏆'}</div>
    <h1>Umiesz ${s.known.length} z ${s.queue.length}</h1>
    <p class="sub">${s.unknown.length ? 'Powtórz te, których jeszcze nie znasz.' : 'Wszystkie słówka opanowane!'}</p>
    ${s.unknown.length ? `<button class="primary wide" data-action="repeatCards">Powtórz nieumiane (${s.unknown.length})</button>` : ''}
    ${s.opts.plan ? '<button class="primary wide" data-action="home">Dalej: następny krok →</button>'
      : '<button class="ghost wide" data-action="startTestFromCards">Zrób test z tych słówek</button>'}
    <button class="ghost wide" data-action="home">Wróć</button>
  </div>`;
}

function viewTest() {
  const s = session;
  if (s.idx >= s.items.length) return testSummary();
  const q = s.items[s.idx];
  const toGerman = q.dir === 'pl-de';
  const target = answerOf(q);
  const f = s.feedback;
  let prompt;
  if (q.type === 'listen') {
    prompt = `<small>Posłuchaj i wybierz znaczenie</small>
      <button class="listen-big" data-action="speak" data-text="${esc(q.w.de)}" aria-label="Posłuchaj jeszcze raz">🔊</button>
      ${f ? `<b>${deHtml(q.w.de)}</b>` : '<em class="listen-hint">Dotknij, żeby posłuchać jeszcze raz</em>'}`;
  } else if (q.type === 'article') {
    prompt = `<small>der, die czy das?</small><b>${f ? deHtml(q.w.de) : esc(splitArticle(q.w.de).rest)}</b>
      <em class="listen-hint">${esc(q.w.pl)}</em>`;
  } else {
    prompt = `<small>${toGerman ? 'Jak to jest po niemiecku?' : 'Co to znaczy po polsku?'}</small>
      <b>${fmt(toGerman ? q.w.pl : q.w.de, !toGerman)}</b>${!toGerman ? speakBtn(q.w.de) : ''}`;
  }
  let body;
  if (q.type === 'article') {
    body = `<div class="art-options">${q.options.map((o, i) => {
      const cls = f ? (o === target ? 'right' : o === f.given ? 'wrong' : 'dim') : '';
      return `<button class="art-btn art-bg-${o} ${cls}" data-action="choose" data-i="${i}" ${f ? 'disabled' : ''}>${o}</button>`;
    }).join('')}</div>`;
  } else if (q.type === 'choice' || q.type === 'listen') {
    const german = q.type === 'choice' && toGerman;
    body = `<div class="options">${q.options.map((o, i) => {
      const cls = f ? (o === target ? 'right' : o === f.given ? 'wrong' : 'dim') : '';
      return `<button class="opt ${cls}" data-action="choose" data-i="${i}" ${f ? 'disabled' : ''}>${fmt(o, german)}</button>`;
    }).join('')}</div>`;
  } else {
    body = `<form id="type-form" class="type" autocomplete="off">
      <input id="answer" type="text" lang="${toGerman ? 'de' : 'pl'}" autocapitalize="off" autocomplete="off" autocorrect="off"
        spellcheck="false" enterkeyhint="done" placeholder="${toGerman ? 'Wpisz po niemiecku' : 'Wpisz po polsku'}"
        value="${f ? esc(f.given) : ''}" ${f ? 'disabled' : ''} class="${f ? (f.ok ? 'ok' : 'bad') : ''}">
      ${toGerman && !f ? `<div class="uml">${['ä', 'ö', 'ü', 'ß'].map(c =>
        `<button type="button" class="uml-key" data-action="uml" data-c="${c}">${c}</button>`).join('')}</div>` : ''}
      ${f ? '' : '<button class="primary wide" type="submit">Sprawdź</button>'}
    </form>`;
  }
  let fb = '';
  if (f) {
    const lines = [];
    if (q.type === 'article' || q.type === 'listen') {
      if (!f.ok || q.type === 'listen') lines.push(`<p>${deHtml(q.w.de)} = <b>${esc(q.w.pl)}</b></p>`);
    } else {
      const others = [target, ...sameMeaning(q.w, q.dir).map(c => (toGerman ? c.de : c.pl))].filter(t => t !== f.matched);
      if (f.result === 'close') lines.push(`<p>Poprawna pisownia: <b>${fmt(f.matched, toGerman)}</b></p>`);
      if (!f.ok) lines.push(`<p>Poprawnie: <b>${fmt(target, toGerman)}</b></p>`);
      if (f.ok && q.type === 'type' && others.length) lines.push(`<p>Też dobrze: ${others.map(o => fmt(o, toGerman)).join(', ')}</p>`);
      if (!f.ok && others.length > 1) lines.push(`<p>albo: ${others.slice(1).map(o => fmt(o, toGerman)).join(', ')}</p>`);
    }
    if (f.requeued) lines.push('<p class="again">🔁 To słówko wróci za chwilę.</p>');
    fb = `<div class="feedback ${f.ok ? 'ok' : 'bad'}">
      <p class="fb-title">${f.title}</p>${lines.join('')}
      <div class="fb-actions">${speakBtn(q.w.de)}<button class="primary" data-action="next">Dalej →</button></div>
    </div>`;
  }
  return `
  ${topbar(s.idx, s.items.length)}
  <div class="prompt">${prompt}</div>
  ${body}
  ${fb}`;
}

function testSummary() {
  const s = session;
  const total = s.base;
  const pct = total ? Math.round((s.score / total) * 100) : 0;
  const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
  const retried = s.items.length > s.base;
  return `
  <div class="summary">
    <div class="stars">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
    ${s.opts.mock ? '<p class="sub">Wynik próbnego testu</p>' : ''}
    <h1>${s.score} / ${total}</h1>
    <p class="sub">${retried ? 'za pierwszym razem · ' : ''}${pct >= 90 ? 'Rewelacja!' : pct >= 70 ? 'Bardzo dobrze!' : pct >= 40 ? 'Nieźle, ćwicz dalej!' : 'Spróbuj jeszcze raz, dasz radę!'}</p>
    ${s.mistakes.length ? `<ul class="mistakes">${s.mistakes.map(m => {
      const toGerman = m.q.dir === 'pl-de';
      return `<li><span>${fmt(toGerman ? m.q.w.pl : m.q.w.de, !toGerman)}</span><b>${fmt(toGerman ? m.q.w.de : m.q.w.pl, toGerman)}</b></li>`;
    }).join('')}</ul>
    <button class="${s.opts.plan && !s.opts.mock ? 'ghost' : 'primary'} wide" data-action="repeatMistakes">Powtórz błędy (${s.mistakes.length})</button>` : ''}
    ${s.opts.plan ? '<button class="primary wide" data-action="home">Dalej: następny krok →</button>'
      : '<button class="ghost wide" data-action="again">Jeszcze raz</button>'}
    <button class="ghost wide" data-action="home">Wróć</button>
  </div>`;
}

const VIEWS = { home: viewHome, lists: viewLists, edit: viewEdit, settings: viewSettings, cards: viewCards, test: viewTest };
const TABS = [['home', '📚', 'Nauka'], ['lists', '📝', 'Listy'], ['settings', '⚙️', 'Ustawienia']];

function render() {
  document.getElementById('app').innerHTML = VIEWS[view]();
  const tabs = document.getElementById('tabs');
  const tabbed = view === 'home' || view === 'lists' || view === 'settings' || view === 'edit';
  tabs.hidden = !tabbed;
  const active = view === 'edit' ? 'lists' : view;
  tabs.innerHTML = tabbed ? TABS.map(([v, ico, label]) =>
    `<button class="${active === v ? 'on' : ''}" data-action="${v}"><span>${ico}</span>${label}</button>`).join('') : '';
  if (view === 'test' && session && !session.feedback) {
    const input = document.getElementById('answer');
    if (input) input.focus();
  }
}

function go(v) {
  clearTimeout(advanceTimer);
  view = v;
  render();
  window.scrollTo(0, 0);
}

// ---------- akcje ----------

function finishSession() {
  if (session.onDone && !session.finished) {
    session.finished = true;
    session.onDone();
  }
}

function startCards(words, opts = {}) {
  if (!words.length) return;
  session = {
    queue: shuffle(words).map(w => ({ w, dir: pickMode(state.settings.direction, 'pl-de', 'de-pl') })),
    idx: 0, flipped: false, known: [], unknown: [], opts, onDone: opts.onDone,
  };
  go('cards');
  speakCardFront();
}

function speakCardFront() {
  const it = session.queue[session.idx];
  if (it && it.dir === 'de-pl') autoSpeak(it.w.de);
}

function rateCard(knew) {
  const it = session.queue[session.idx];
  (knew ? session.known : session.unknown).push(it.w);
  session.idx++;
  session.flipped = false;
  if (session.idx >= session.queue.length) finishSession();
  render();
  speakCardFront();
}

function startTest(words, opts = {}) {
  if (!words.length) return;
  const n = opts.all ? words.length : state.settings.count || words.length;
  const chosen = shuffle(words).slice(0, Math.min(n, words.length));
  session = {
    items: chosen.map(w => buildQuestion(w, opts)), base: chosen.length, idx: 0, score: 0, mistakes: [],
    feedback: null, words, opts, onDone: opts.onDone,
  };
  go('test');
  speakListen();
}

function speakListen() {
  const q = session.items[session.idx];
  if (q && q.type === 'listen') speak(q.w.de);
}

function answer(given, result, matched) {
  const s = session;
  const q = s.items[s.idx];
  const ok = result !== 'wrong';
  record(q.w, ok);
  if (!q.retry) {
    if (ok) s.score++;
    else s.mistakes.push({ q, given });
  }
  // Błędne słówko wraca 3 pytania później, aż padnie dobra odpowiedź.
  let requeued = false;
  if (!ok && !s.opts.noRequeue) {
    const again = { ...buildQuestion(q.w, { dir: q.dir, type: q.type }), retry: true };
    s.items.splice(Math.min(s.idx + 4, s.items.length), 0, again);
    requeued = true;
  }
  const title = !ok ? 'Ups, nie tym razem' : result === 'close' ? 'Dobrze! 👍' : PRAISE[Math.floor(Math.random() * PRAISE.length)];
  s.feedback = { ok, result, given, title, matched, requeued };
  render();
  if (q.type !== 'listen') autoSpeak(q.w.de);
  // Mowa z timera bywa blokowana na iPhonie, więc przy słuchaniu zawsze „Dalej”.
  if (result === 'exact' && q.type !== 'listen') advanceTimer = setTimeout(nextQuestion, 1100);
}

function nextQuestion() {
  clearTimeout(advanceTimer);
  if (view !== 'test' || !session.feedback) return;
  session.idx++;
  session.feedback = null;
  if (session.idx >= session.items.length) finishSession();
  render();
  speakListen();
}

function submitTyped() {
  const input = document.getElementById('answer');
  if (!input || session.feedback || !input.value.trim()) return;
  const q = session.items[session.idx];
  const toGerman = q.dir === 'pl-de';
  const requireArticle = session.opts.requireArticle ?? state.settings.requireArticle;
  // Zaliczamy każde słówko o tym samym pytaniu (babcia: die Oma albo die Großmutter).
  const targets = [q.w, ...sameMeaning(q.w, q.dir)].map(w => (toGerman ? w.de : w.pl));
  let result = 'wrong';
  let matched = targets[0];
  for (const t of targets) {
    const r = checkTyped(input.value, t, toGerman, requireArticle);
    if (r === 'exact') { result = r; matched = t; break; }
    if (r === 'close' && result === 'wrong') { result = r; matched = t; }
  }
  answer(input.value.trim(), result, matched);
}

const actions = {
  home: () => go('home'),
  lists: () => go('lists'),
  settings: () => go('settings'),
  toggleDeck(el) {
    const id = el.dataset.id;
    state.selected = state.selected.includes(id) ? state.selected.filter(x => x !== id) : [...state.selected, id];
    save();
    render();
  },
  planStep: el => runStep(el.dataset.step),
  startCards: () => startCards(selectedWords()),
  startTest: () => startTest(selectedWords()),
  startHard: () => startTest(hardWords()),
  startListen: () => startTest(selectedWords(), { type: 'listen' }),
  startArticles: () => startTest(selectedWords().filter(w => splitArticle(w.de)), { type: 'article' }),
  again: () => startTest(session.words, session.opts),
  flip() {
    session.flipped = !session.flipped;
    document.getElementById('stage').classList.toggle('flipped', session.flipped);
    const it = session.queue[session.idx];
    if (session.flipped && it.dir === 'pl-de') autoSpeak(it.w.de);
  },
  cardYes: () => rateCard(true),
  cardNo: () => rateCard(false),
  repeatCards: () => startCards(session.unknown),
  startTestFromCards: () => startTest(session.queue.map(it => it.w)),
  speak: el => speak(el.dataset.text),
  choose(el) {
    const q = session.items[session.idx];
    const given = q.options[Number(el.dataset.i)];
    const target = answerOf(q);
    answer(given, given === target ? 'exact' : 'wrong', target);
  },
  uml(el) {
    const input = document.getElementById('answer');
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.setRangeText(el.dataset.c, start, end, 'end');
    input.focus();
  },
  next: () => nextQuestion(),
  repeatMistakes() {
    const { onDone, mock, ...opts } = session.opts;
    startTest(session.mistakes.map(m => m.q.w), { ...opts, all: true, plan: false });
  },
  set(el) {
    const key = el.dataset.key;
    state.settings[key] = key === 'count' ? Number(el.dataset.val) : el.dataset.val;
    save();
    render();
  },
  editDeck(el) { editingId = el.dataset.id; go('edit'); },
  newDeck() { editingId = null; go('edit'); },
  saveDeck() {
    const name = document.getElementById('deck-name').value.trim() || 'Moja lista';
    const emoji = document.getElementById('deck-emoji').value.trim() || '📘';
    const words = parseWords(document.getElementById('deck-text').value);
    if (!words.length) { alert('Dodaj co najmniej jedno słówko w formacie: niemiecki = polski'); return; }
    const d = state.decks.find(x => x.id === editingId);
    if (d) Object.assign(d, { name, emoji, words });
    else {
      const id = 'l' + Date.now().toString(36);
      state.decks.push({ id, name, emoji, words });
      state.selected.push(id);
    }
    save();
    go('lists');
  },
  deleteDeck() {
    if (!confirm('Usunąć tę listę?')) return;
    state.decks = state.decks.filter(x => x.id !== editingId);
    state.selected = state.selected.filter(x => x !== editingId);
    save();
    go('lists');
  },
  resetStats() {
    if (!confirm('Wyzerować postępy (plan, serię dni i trudne słówka)?')) return;
    state.stats = {};
    state.plan = { days: {} };
    state.activity = {};
    save();
    render();
  },
  resetDecks() {
    if (!confirm('Przywrócić listy startowe? Twoje własne listy zostaną.')) return;
    const fresh = startDecks();
    const ids = fresh.map(d => d.id);
    state.decks = [...fresh, ...state.decks.filter(d => !ids.includes(d.id))];
    save();
    render();
  },
};

function init() {
  state = load();
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el, e);
  });
  // Klawisze umlautów nie zabierają fokusu z pola (na iPhonie klawiatura zostaje).
  document.addEventListener('pointerdown', e => { if (e.target.closest('.uml-key')) e.preventDefault(); });
  document.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'type-form') submitTyped(); });
  document.addEventListener('change', e => {
    const key = e.target.dataset.setting;
    if (key) { state.settings[key] = e.target.checked; save(); }
    const date = e.target.dataset.date;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { state.settings[date] = e.target.value; save(); }
  });
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  render();
}

if (typeof document !== 'undefined') init();
