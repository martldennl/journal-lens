// The journal's view, in a sandboxed frame inside Weave. It gets the state its fold made ({weave: 'view', state}) and
// asks Weave for actions ({weave: 'act', id, name, input}); Weave answers {weave: 'acted', id, error?}. It has no
// network and no access to anything else: Weave signs what the action proposes, as the member, if they may.
const $ = (id) => document.getElementById(id);
const el = (tag, className = '', text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pending = new Map();
let next = 0;
let me = {}; // who is looking: {did}
let shown; // the state as it's drawn
let days = []; // the journal by day, oldest first: [{key, date, entries, answers, notes, question?, feel?}]
let back = 0; // how many weeks back the ribbon of days is turned
let here; // the day at the top of the window (its key): the ribbon marks it
const open = new Set(); // the long entries that were opened ("read on")
const peeked = new Set(); // the days whose answers were unfolded without giving one's own
const folded = new Set(); // the days whose answers are drawn folded
const typed = new Map(); // what is typed into the pages' own lines (an answer, a question), by line: it stays when the journal is drawn anew
const born = new Map(); // by entry: since when it's there, if it came while we looked (it unfolds)
const flags = new Map(); // by entry: what a friend just did with it ({name, text, since}), said for a moment

function act(name, input) {
  const id = ++next;
  window.parent.postMessage({ weave: 'act', id, name, input }, '*');
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const say = (error = '') => ($('status').textContent = error);
const show = (post) => window.parent.postMessage({ weave: 'open', post }, '*');

/** Ask Weave for an action from a button: it waits (and breathes) until Weave has answered. Whether it went well. */
function ask(button, name, input) {
  button.disabled = true;
  button.classList.add('asking');
  const done = (error) => {
    button.disabled = false;
    button.classList.remove('asking');
    say(error);
    return !error;
  };
  return act(name, input).then(() => done(), done);
}

// ---------------------------------------------------------------- days and weeks

// The fold has no clock and no time zone (every member folds the same state). An entry says which day it is about
// ("2026-11-04"); one that doesn't is of the day it was posted, as the calendar of whoever looks has it. Today,
// yesterday and the weeks (Monday to Sunday) are the viewer's too.
const LOCALE = 'en-GB';
const format = (options) => {
  const f = new Intl.DateTimeFormat(LOCALE, options);
  return (date) => f.format(date);
};
const MONTH = format({ month: 'short' });
const WEEKDAY = format({ weekday: 'long' });
const DATE = format({ weekday: 'long', day: 'numeric', month: 'long' });
const SHORT = format({ day: 'numeric', month: 'short' });
const CLOCK = format({ hour: '2-digit', minute: '2-digit' });
const SPAN = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const plus = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const keyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateOf = (key) => new Date(+key.slice(0, 4), key.slice(5, 7) - 1, +key.slice(8));
const mondayOf = (date) => plus(date, -((date.getDay() + 6) % 7));
const today = () => keyOf(new Date());
/** How many days ago a day was. */
const ago = (date) => Math.round((dateOf(today()) - date) / 864e5);

/** The journal by day, oldest first: a day's entries, the answers to its question, and the week's lines written on it. */
function daysOf(state) {
  const byKey = new Map();
  const at = (key) => byKey.get(key) ?? byKey.set(key, { key, date: dateOf(key), entries: [], answers: [], notes: [] }).get(key);
  for (const entry of state.entries) {
    const posted = new Date(entry.time);
    if (!entry.day && Number.isNaN(posted.getTime())) continue;
    const day = at(entry.day ?? keyOf(posted));
    (entry.kind === 'answer' ? day.answers : entry.kind === 'week' ? day.notes : day.entries).push(entry);
  }
  for (const question of state.questions ?? []) at(question.day).question = question;
  at(today()); // today's page is always there
  const all = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const day of all) {
    // Answers without a question that was set: they say themselves what was asked.
    if (!day.question && day.answers.length) day.question = { text: day.answers[0].title };
    day.feel = feel(day.entries.flatMap((entry) => entry.moods));
  }
  return all;
}
/** Whether a day has a page: something was written, or asked, or it's today. */
const paged = (day) => day.entries.length > 0 || Boolean(day.question) || day.key === today();

/** The weeks, the latest first: each with the week's lines written in it, and its days' pages, the latest first. */
function weeksOf() {
  const byMonday = new Map();
  for (const day of [...days].reverse()) {
    const monday = keyOf(mondayOf(day.date));
    const week = byMonday.get(monday) ?? byMonday.set(monday, { monday: dateOf(monday), notes: [], days: [] }).get(monday);
    week.notes.push(...day.notes);
    if (paged(day)) week.days.push(day);
  }
  return [...byMonday.values()].filter((week) => week.notes.length || week.days.length);
}

/** The mood most of these say; among equals, the one said last. */
function feel(moods) {
  const tally = new Map();
  for (const { mood, time } of moods) {
    const t = tally.get(mood) ?? tally.set(mood, { mood, n: 0, last: '' }).get(mood);
    t.n += 1;
    if (time > t.last) t.last = time;
  }
  return [...tally.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last))[0]?.mood;
}

// ---------------------------------------------------------------- people, faces, ribbons

/** A color (its hue) made from a name: the same name, the same color, in every member's journal. */
const hue = (text) => [...String(text)].reduce((h, letter) => (h * 31 + letter.codePointAt(0)) % 360, 0);

/** A person as a round chip: their initials on their color (the frame gets no pictures of them). */
function chip(name) {
  const words = String(name).match(/[\p{L}\p{N}]+/gu) ?? ['?'];
  const c = el('span', 'chip', words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2));
  c.style.setProperty('--hue', hue(name));
  c.title = name;
  return c;
}
const called = (who) => (who.by === me.did ? 'you' : who.name);

// The five moods as small faces: eyes and a mouth on a round face in the mood's color (the color is in the stylesheet).
const FACES = {
  wonderful: '<path d="M6.6 10.6q1.7-2.8 3.4 0M14 10.6q1.7-2.8 3.4 0"/><path class="full" d="M7.2 13.4h9.6a4.8 4.8 0 0 1-9.6 0z"/>',
  happy: '<circle class="full" cx="8.7" cy="10" r="1.25"/><circle class="full" cx="15.3" cy="10" r="1.25"/><path d="M7.8 14.2q4.2 3.6 8.4 0"/>',
  calm: '<path d="M6.8 9.8q1.7 1.7 3.4 0M13.8 9.8q1.7 1.7 3.4 0M9.4 14.8q2.6 1.5 5.2 0"/>',
  tired: '<path d="M6.8 10.2h3.2M14 10.2h3.2M6.6 8l3.2.9M17.4 8l-3.2.9"/><ellipse class="full" cx="12" cy="15.4" rx="1.7" ry="2.1"/>',
  rough: '<circle class="full" cx="8.7" cy="10.4" r="1.2"/><circle class="full" cx="15.3" cy="10.4" r="1.2"/><path d="M8 16.6q4-3.4 8 0M6.6 7.2l3.4 1.3M17.4 7.2L14 8.5"/>',
};
function face(mood) {
  const f = el('span', 'face');
  f.dataset.mood = mood;
  f.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="round" cx="12" cy="12" r="10.5"/>${FACES[mood] ?? ''}</svg>`;
  return f;
}

/** A bookmark's ribbon with a star: what a highlight wears. */
const RIBBON = '<svg viewBox="0 0 22 32" aria-hidden="true"><path d="M1.5 0h19v29.5L11 23l-9.5 6.5z"/><path class="star" d="M11 5.2l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z"/></svg>';

// ---------------------------------------------------------------- an entry

/** How an entry felt: the five faces. One that someone chose is in color, with who; a click says (or takes back) yours. */
function moodsOf(entry) {
  const row = el('div', 'moods');
  for (const mood of shown.moods ?? Object.keys(FACES)) {
    const said = entry.moods.filter((m) => m.mood === mood);
    const mine = said.some((m) => m.by === me.did);
    const b = el('button', `mood${said.length ? ' said' : ''}${mine ? ' mine' : ''}`);
    b.type = 'button';
    b.dataset.mood = mood;
    b.title = b.ariaLabel = said.length ? `It felt ${mood} to ${said.map(called).join(', ')}${mine ? ': click to take yours back' : ''}` : `Say it felt ${mood}`;
    b.append(face(mood), ...said.map((m) => chip(m.name)));
    b.addEventListener('click', () => ask(b, 'mood', { post: entry.id, mood: mine ? null : mood }));
    row.append(b);
  }
  return row;
}

/** Who wrote it and when: the time, or the day it was written if that was a later one; "via" if their agent wrote it down. */
function byline(entry, day) {
  const by = el('div', 'byline');
  const posted = new Date(entry.time);
  const time = el('time', '', keyOf(posted) === day ? CLOCK(posted) : `written ${SHORT(posted)}`);
  by.append(chip(entry.by), el('span', 'by', entry.by), Object.assign(time, { dateTime: entry.time, title: posted.toLocaleString(LOCALE) }));
  if (entry.via) by.append(Object.assign(el('span', 'via', `via ${entry.via}`), { title: `${entry.by}’s agent wrote it down, the post says` }));
  if (entry.edited) by.append(Object.assign(el('span', 'edited', 'edited'), { title: `Changed ${new Date(entry.edited).toLocaleString(LOCALE)}` }));
  return by;
}

/**
 * An entry of the day `day`, in its writer's color: its headline, who wrote it and when, what was written (a long
 * text cut, with "read on"), how it felt, and its ribbon if it's a highlight. The week's lines are one too, as a card.
 */
function entryFor(entry, day) {
  const note = entry.kind === 'week';
  const c = el('article', `entry${note ? ' note' : ''}${entry.highlight ? ' best' : ''}`);
  c.id = `entry-${entry.id}`;
  c.tabIndex = 0;
  c.style.setProperty('--hue', hue(entry.by));

  const ribbon = el('button', 'ribbon');
  ribbon.type = 'button';
  ribbon.innerHTML = RIBBON;
  ribbon.title = ribbon.ariaLabel = entry.highlight ? `A highlight (${called(entry.highlight)} marked it): click to take the ribbon off` : 'Mark it as a highlight';
  ribbon.addEventListener('click', () => ask(ribbon, 'highlight', { post: entry.id, on: !entry.highlight }));

  const text = el('p', `text${open.has(entry.id) ? '' : ' cut'}`, entry.text);
  const more = el('button', 'more', open.has(entry.id) ? 'fold up' : 'read on');
  more.type = 'button';
  more.hidden = !open.has(entry.id); // shown once we know the text doesn't fit (see fit)
  more.addEventListener('click', () => readOn(entry.id, text, more));

  const foot = el('div', 'foot');
  foot.append(note ? '' : moodsOf(entry), el('span', 'gap'));
  if (entry.image) foot.append(Object.assign(el('span', 'extra', '📷'), { title: 'It has a picture: double-click to see it in Weave' }));
  if (entry.votes) foot.append(Object.assign(el('span', 'extra', `▲ ${entry.votes}`), { title: 'Votes: ups minus downs' }));
  if (entry.chats) foot.append(Object.assign(el('span', 'extra', `💬 ${entry.chats}`), { title: 'Messages in its chat' }));

  if (note) c.append(el('span', 'label', 'The week in a few lines'));
  c.append(ribbon, el('h3', '', entry.title), byline(entry, day), text, more, foot);
  c.addEventListener('dblclick', (e) => e.target.closest('button') || show(entry.id));
  c.addEventListener('keydown', (e) => e.target === c && e.key === 'Enter' && show(entry.id));
  return c;
}

/** "read on" under every text that is cut (it doesn't fit its lines). */
function fit() {
  for (const text of document.querySelectorAll('.text.cut')) text.nextElementSibling.hidden = text.scrollHeight <= text.clientHeight + 2;
}

/** Open a long entry in place, or fold it up again: the text grows to its whole height, or shrinks back. */
function readOn(id, text, more) {
  const from = text.offsetHeight;
  if (!open.delete(id)) open.add(id);
  text.classList.toggle('cut', !open.has(id));
  more.textContent = open.has(id) ? 'fold up' : 'read on';
  if (still) return;
  text.classList.add('growing');
  text.animate({ height: [`${from}px`, `${text.offsetHeight}px`] }, { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)' }).onfinish = () => text.classList.remove('growing');
}

// ---------------------------------------------------------------- a day, as a page

/** A line to write on and a button that sends it as an action (Enter does too): `send` makes [name, input] of what was typed. */
function lineFor(key, placeholder, label, most, send) {
  const row = el('div', 'line');
  const input = Object.assign(el('input'), { placeholder, maxLength: most, autocomplete: 'off', value: typed.get(key) ?? '' });
  const button = Object.assign(el('button', '', label), { type: 'button' });
  const go = () => input.value.trim() && ask(button, ...send(input.value.trim())).then((went) => went && typed.delete(key));
  input.dataset.key = key;
  input.addEventListener('input', () => typed.set(key, input.value));
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  button.addEventListener('click', go);
  row.append(input, button);
  return row;
}

/**
 * A day's question and everyone's answer to it, each a line. Until you have given yours, the others' stay folded
 * (a courtesy, not a secret: "unfold anyway" shows them, and Weave's own list does too).
 */
function questionFor(day) {
  const q = el('div', 'question');
  const asked = el('p', 'asked', day.question.text);
  if (day.question.name) asked.append(el('span', 'asker', `asked by ${called(day.question)}`));
  q.append(asked);
  const mine = day.answers.some((answer) => answer.author === me.did);
  if (day.answers.length && (mine || peeked.has(day.key))) {
    const list = q.appendChild(el('ul', 'answers'));
    day.answers.forEach((answer, i) => {
      const li = list.appendChild(el('li'));
      li.id = `entry-${answer.id}`;
      li.style.cssText = `--hue: ${hue(answer.by)}; --i: ${i}`;
      li.append(chip(answer.by), el('b', '', answer.by), el('span', 'said', answer.text));
      if (answer.via) li.append(Object.assign(el('span', 'via', `via ${answer.via}`), { title: `${answer.by}’s agent wrote it down, the post says` }));
      li.addEventListener('dblclick', () => show(answer.id));
    });
  } else if (day.answers.length) {
    folded.add(day.key);
    const waiting = q.appendChild(el('div', 'folded'));
    const peek = Object.assign(el('button', 'peek', 'unfold anyway'), { type: 'button' });
    peek.addEventListener('click', () => {
      peeked.add(day.key);
      render(shown);
    });
    waiting.append(...day.answers.map((answer) => Object.assign(chip(answer.by), { id: `entry-${answer.id}` })), el('span', '', `${day.answers.length === 1 ? 'One answer' : `${day.answers.length} answers`}, folded until you have given yours`), peek);
  }
  // Answering needs a question that was set (journal.question), not only answers that quote one.
  if (!mine && day.question.day) q.append(lineFor(`answer ${day.key}`, 'Your answer, in a line…', 'Answer', 280, (text) => ['answer', { day: day.key, text }]));
  return q;
}

/** A day of the journal, as one page: its date, how it felt, its question, and everyone's entries of that day. */
function pageFor(day) {
  const page = el('section', 'day');
  page.id = `day-${day.key}`;
  page.dataset.day = day.key;
  const since = ago(day.date);
  const head = el('header', 'top');
  const leaf = el('div', 'leaf');
  leaf.append(el('span', 'mon', MONTH(day.date)), el('b', '', day.date.getDate()));
  leaf.title = DATE(day.date);
  const what = el('div', 'what');
  what.append(el('b', '', since === 0 ? 'Today' : since === 1 ? 'Yesterday' : WEEKDAY(day.date)));
  if (since < 2) what.append(el('span', '', WEEKDAY(day.date)));
  head.append(leaf, what, el('span', 'gap'));
  if (day.feel) head.appendChild(Object.assign(el('span', 'feel', day.feel), { title: `It felt ${day.feel}, most say` })).prepend(face(day.feel));
  page.append(head);
  if (day.question) page.append(questionFor(day));
  else if (since === 0) page.append(lineFor(`ask ${day.key}`, 'Ask today’s question: everyone answers in a line…', 'Ask', 150, (text) => ['ask', { day: day.key, text }]));
  const entries = page.appendChild(el('div', 'entries'));
  entries.append(...[...day.entries].reverse().map((entry) => entryFor(entry, day.key))); // the latest first, as the days are
  if (!day.entries.length && !day.question) entries.append(el('p', 'empty', 'Nothing written yet today.'));
  return page;
}

/** A week: its name (a past week's always, this week's if someone wrote its lines), the week's lines as a card, then its days. */
function weekFor(week) {
  const section = el('section', 'week');
  const weeks = Math.round((mondayOf(new Date()) - week.monday) / (7 * 864e5));
  const span = SPAN.formatRange(week.monday, plus(week.monday, 6));
  if (weeks > 0 || week.notes.length) section.append(el('h2', '', weeks === 0 ? `This week · ${span}` : weeks === 1 ? `Last week · ${span}` : span));
  section.append(...week.notes.map((note) => entryFor(note, note.day ?? keyOf(new Date(note.time)))), ...week.days.map(pageFor));
  return section;
}

// ---------------------------------------------------------------- around the pages

/** What the journal is: its name and its counts. */
function head(state) {
  const counts = [[days.filter((day) => day.entries.length || day.answers.length).length, 'day'], [state.entries.filter((entry) => entry.kind !== 'answer').length, 'entry', 'entries'], [state.words ?? 0, 'word']];
  $('name').textContent = state.board?.title ?? 'Journal';
  $('counts').textContent = counts.map(([n, one, many = `${one}s`]) => `${n.toLocaleString(LOCALE)} ${n === 1 ? one : many}`).join(' · ');
}

/**
 * The mood of the days: the last weeks (as many as there is room for), a face for every day in the color of how it
 * felt; a dot where something was written but nobody said how it felt; a star where a highlight is. A click goes to
 * the day. `fresh`: the days that just changed (they pop).
 */
function ribbon(fresh = new Set()) {
  const byKey = new Map(days.map((day) => [day.key, day]));
  const weeks = innerWidth < 430 ? 2 : innerWidth < 900 ? 3 : 4;
  const end = plus(new Date(), -7 * back);
  const cells = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const date = plus(end, -i);
    const key = keyOf(date);
    const day = byKey.get(key);
    const written = day ? day.entries.length + day.answers.length : 0;
    const cell = el(day && paged(day) ? 'button' : 'span', 'cell');
    cell.dataset.day = key;
    cell.title = `${DATE(date)}${written ? `: ${written === 1 ? 'one entry' : `${written} entries`}` : ''}${day?.feel ? `, it felt ${day.feel}` : ''}`;
    cell.classList.toggle('monday', date.getDay() === 1);
    cell.classList.toggle('today', key === today());
    cell.classList.toggle('fresh', fresh.has(key));
    cell.classList.toggle('starred', Boolean(day?.entries.some((entry) => entry.highlight)));
    cell.append(day?.feel ? face(day.feel) : el('i', written ? 'dot some' : 'dot'), el('span', 'n', date.getDate()));
    if (cell.tagName === 'BUTTON') {
      cell.type = 'button';
      cell.addEventListener('click', () => go(`day-${key}`));
    }
    cells.push(cell);
  }
  $('strip').style.setProperty('--n', cells.length);
  $('strip').replaceChildren(...cells);
  $('later').disabled = back === 0;
  $('earlier').disabled = !days.length || plus(end, 1 - weeks * 7) <= days[0].date;
  mark();
}
/** The day at the top of the window (its key), and the ribbon's mark on it. */
const topDay = () => [...document.querySelectorAll('.day')].find((d) => d.getBoundingClientRect().bottom > $('ribbon').getBoundingClientRect().bottom + 40)?.dataset.day;
const mark = () => [...$('strip').children].forEach((cell) => cell.classList.toggle('here', cell.dataset.day === here));
/** Turn the ribbon so that it ends this many weeks ago. */
function turn(weeks) {
  back = weeks;
  ribbon();
}
$('earlier').addEventListener('click', () => turn(back + 1));
$('later').addEventListener('click', () => turn(back - 1));

/** While leafing: the ribbon marks the day at the top of the window, and turns to its weeks if it isn't among them. */
function spy() {
  const at = topDay();
  if (at === here) return;
  here = at;
  if (at && ![...$('strip').children].some((cell) => cell.dataset.day === at)) turn(Math.floor(ago(dateOf(at)) / 7));
  else mark();
}
addEventListener('scroll', spy, { passive: true });
addEventListener('resize', () => {
  fit();
  ribbon();
});

/** Go to a day or an entry: the pages scroll there, and it lights up for a moment. */
function go(id) {
  const there = $(id);
  if (!there) return;
  there.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: there.classList.contains('day') ? 'start' : 'center' });
  there.classList.remove('lit');
  void there.offsetWidth; // so the light starts anew
  there.classList.add('lit');
}

/** The highlights, in the journal's order: a click goes to the entry. `fresh`: the ones that just became one. */
function highlights(fresh) {
  const best = days.flatMap((day) => [...day.notes, ...day.entries].filter((entry) => entry.highlight).map((entry) => ({ day, entry })));
  $('highlights').hidden = !best.length;
  $('best').replaceChildren(
    ...best.map(({ day, entry }) => {
      const b = el('button', fresh.has(entry.id) ? 'fresh' : '');
      b.type = 'button';
      b.innerHTML = RIBBON;
      b.append(el('span', 'title', entry.title), el('span', 'where', `${SHORT(day.date)} · ${entry.by}`));
      b.addEventListener('click', () => go(`entry-${entry.id}`));
      return el('li').appendChild(b).parentNode;
    }),
  );
}

/** Who wrote how much: each writer's words as a bar (the longest: who wrote most), their entries and answers. */
function writers(state) {
  const most = Math.max(1, ...state.writers.map((w) => w.words));
  const some = (n, one, many = `${one}s`) => (n ? `${n} ${n === 1 ? one : many}` : '');
  $('writers').hidden = !state.writers.length;
  $('pens').replaceChildren(
    ...state.writers.map((w) => {
      const li = el('li');
      li.style.setProperty('--hue', hue(w.name));
      const bar = el('span', 'bar');
      bar.appendChild(el('i')).style.width = `${(w.words / most) * 100}%`;
      li.append(chip(w.name), el('span', 'by', w.by === me.did ? `${w.name} (you)` : w.name), el('span', 'n', [some(w.entries, 'entry', 'entries'), some(w.answers, 'answer'), some(w.words, 'word')].filter(Boolean).join(' · ')), bar);
      return li;
    }),
  );
}

// ---------------------------------------------------------------- drawing the journal

/**
 * Draw the journal as it is now, the latest week and day on top, and show what changed since the last drawing as
 * motion: a new entry unfolds into its day's page, a day whose mood changed pops in the ribbon and a mood on its
 * face, answers unfold once yours is given, a ribbon drops onto a new highlight, and what a friend did says for a
 * moment who.
 */
function render(state) {
  const first = !shown;
  const before = new Map((shown?.entries ?? []).map((entry) => [entry.id, entry]));
  const look = (day) => `${day.feel} ${day.entries.length + day.answers.length}`; // what the ribbon shows of a day
  const looked = new Map(days.map((day) => [day.key, look(day)]));
  const pages = new Set([...document.querySelectorAll('.day')].map((page) => page.dataset.day));
  const wereFolded = new Set(folded);
  const writing = document.activeElement?.dataset?.key;
  const now = performance.now();
  shown = state;
  days = daysOf(state);
  folded.clear();

  // What is new since the last drawing.
  const newBest = new Set();
  const popped = []; // [entry, mood]: moods to pop
  let arrived; // a new entry (not an answer): a friend's, or my own
  for (const entry of first ? [] : state.entries) {
    const was = before.get(entry.id);
    if (!was) {
      born.set(entry.id, now);
      if (entry.kind === 'answer') continue;
      if (entry.author !== me.did) flags.set(entry.id, { name: entry.by, text: `wrote this${entry.via ? ` · via ${entry.via}` : ''}`, since: now + 900 }); // once it has unfolded
      arrived = entry;
      continue;
    }
    for (const m of entry.moods) if (was.moods.find((w) => w.by === m.by)?.mood !== m.mood) popped.push([entry.id, m.mood]);
    if (entry.highlight && !was.highlight) {
      newBest.add(entry.id);
      if (entry.highlight.by !== me.did) flags.set(entry.id, { name: entry.highlight.name, text: 'marked it a highlight', since: now });
    }
  }

  $('pages').replaceChildren(...weeksOf().map(weekFor));
  if (writing) document.querySelector(`[data-key="${writing}"]`)?.focus();
  fit();
  here = topDay();
  head(state);
  ribbon(new Set(first ? [] : days.filter((day) => looked.get(day.key) !== look(day)).map((day) => day.key)));
  highlights(newBest);
  writers(state);
  if (still) return;

  // Motion. An unfolding that a later drawing interrupts goes on where it was (it began `age` ms ago).
  // The first drawing: the pages come in one after the other (the ones in sight; the rest are there already).
  for (const [i, page] of first ? [...document.querySelectorAll('.day, .note')].slice(0, 6).entries() : []) {
    page.classList.add('enter');
    page.style.setProperty('--i', i);
  }
  for (const c of document.querySelectorAll('#pages [id^="entry-"]')) {
    const age = now - (born.get(c.id.slice(6)) ?? -Infinity);
    if (age > 1000) continue;
    if (!c.matches('.entry')) c.classList.add('pop'); // an answer: its line, or its writer's chip while it's folded
    else {
      // Its place opens (a page that wasn't there opens whole), and it turns down into it.
      const page = c.closest('.day');
      const whole = page && !pages.has(page.dataset.day) ? page : c;
      if (!whole.classList.contains('growing')) grow(whole, age);
      c.classList.add('new');
      c.style.setProperty('--since', `${-age}ms`);
    }
  }
  for (const key of wereFolded) if (!folded.has(key)) $(`day-${key}`)?.querySelector('.answers')?.classList.add('unfolding');
  for (const [id, said] of flags) {
    if (now - said.since > 3400 || !$(`entry-${id}`)) flags.delete(id);
    else flag($(`entry-${id}`), said, now - said.since);
  }
  for (const [id, mood] of popped) $(`entry-${id}`)?.querySelector(`.mood[data-mood="${mood}"]`)?.classList.add('pop');
  for (const id of newBest) $(`entry-${id}`)?.classList.add('crowned');
  if (arrived?.author === me.did) $(`entry-${arrived.id}`).scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // my own: into sight
  else if (arrived) tell(arrived);
}

/** Something new opens: its height grows from nothing, and what's under it moves down. It began `age` ms ago. */
function grow(node, age) {
  const { height, marginBottom } = getComputedStyle(node);
  node.classList.add('growing');
  const growth = node.animate({ height: ['0px', height], marginBottom: ['0px', marginBottom] }, { duration: 800, easing: 'cubic-bezier(.35, 0, .2, 1)' });
  growth.currentTime = age;
  growth.onfinish = () => node.classList.remove('growing');
}

/** For a moment, on an entry: what a friend did with it, and who. It began `since` ms ago (or begins in -since ms). */
function flag(c, { name, text }, since) {
  const f = el('span', 'flag', `${name} ${text}`);
  f.prepend(chip(name));
  c.append(f);
  c.classList.add('touched');
  c.style.setProperty('--who', hue(name));
  c.style.setProperty('--said', `${-since}ms`);
}

let hush; // the timer that takes the news away again
/** A friend's new entry that is out of sight: say so on top of the window; a click goes there. */
function tell(entry) {
  const r = $(`entry-${entry.id}`).getBoundingClientRect();
  if (r.top >= $('ribbon').getBoundingClientRect().bottom && r.top < innerHeight - 60) return; // it unfolds before our eyes
  const news = $('news');
  news.replaceChildren(chip(entry.by), `${entry.by} wrote “${entry.title}”`);
  news.onclick = () => {
    news.hidden = true;
    go(`entry-${entry.id}`);
  };
  news.hidden = false;
  clearTimeout(hush);
  hush = setTimeout(() => (news.hidden = true), 7000);
}

// ---------------------------------------------------------------- talking to Weave

let last; // the view as Weave last sent it: one that says the same again isn't drawn again
window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const m = event.data;
  if (m?.weave === 'view' && Array.isArray(m.state?.entries)) {
    const same = JSON.stringify([m.state, m.me]);
    if (same === last) return;
    last = same;
    me = m.me ?? {};
    render(m.state);
  }
  if (m?.weave === 'acted' && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(m.error);
    else resolve();
  }
});

/** Write the entry on the blank page down: a headline, what happened, and the day it is about (today, yesterday, a date). */
function write() {
  const title = $('title').value.trim();
  const text = $('text').value.trim();
  const week = $('week').checked;
  const day = $('when').value ? keyOf(plus(new Date(), -$('when').value)) : $('date').value;
  if ((!title && !week) || !text) return (title || week ? $('text') : $('title')).focus();
  if (!day) return $('date').focus();
  $('write-it').disabled = true;
  act('write', { title, text, day, ...(week ? { week } : {}) })
    .then(() => {
      $('title').value = $('text').value = '';
      $('text').style.height = '';
      $('week').checked = false;
      document.activeElement.blur();
      say();
    }, say)
    .then(() => ($('write-it').disabled = false));
}
$('write-it').addEventListener('click', write);
$('title').addEventListener('keydown', (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey ? write() : $('text').focus()));
$('text').addEventListener('keydown', (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && write());
// The page grows with what is written on it.
$('text').addEventListener('input', () => {
  $('text').style.height = 'auto';
  $('text').style.height = `${$('text').scrollHeight}px`;
});
// "Another day…": a date to choose, up to today.
$('when').addEventListener('change', () => {
  $('date').hidden = $('when').value !== '';
  $('date').max = today();
  $('date').value ||= keyOf(plus(new Date(), -2));
});
