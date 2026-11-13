// Weave's part, played for the lens, to look at it without Weave: it keeps a board's events, folds them with the real
// fold, sends the frame {weave: 'view'}, and answers its {weave: 'act'} by running the real act, checking what it
// proposes against the contract (weave.app.json), "signing" it as Mara and folding again.
//
//   ?play=1        a short scene plays by itself: a friend writes today's entry, the day's question gets its last
//                  answers and they unfold, a mood colors the day, a friend's agent writes an entry for him
//   ?evening=1     the same three weeks, all written down within the last hour, each entry with its day
//   ?empty=1       a journal with nothing in it
//   ?theme=light   light instead of dark        ?w=1050&h=900   the frame's size (540 × 480: a board's room in Weave)
//   ?sandbox=0     the frame unsandboxed, to look into it from outside (never how Weave shows it)
import { act, fold } from '../src/board.js';
import { board, did, ENTRIES, people, QUESTIONS, SCENE } from './sample.js';

const params = new URLSearchParams(location.search);
const frame = document.getElementById('lens');
const manifest = await (await fetch('../weave.app.json')).json();
const ME = 'mara';
const MIN = 60_000;

// ---------------------------------------------------------------- Weave's part

const items = [];
/** An event as the fold gets it, signed by one of the four at some time (left out: now). Its id. */
function sign(who, kind, body, time = Date.now()) {
  items.push({ id: `e${String(items.length + 1).padStart(3, '0')}`, kind, body, author: did(who), authorName: people[who], time: new Date(time).toISOString() });
  return items.at(-1).id;
}

/** The state: the events, oldest first as Weave hands them over, folded. */
const folded = () => fold(JSON.stringify(board), JSON.stringify([...items].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))));

/** Send the frame the view, as whenever the board changes. */
function view() {
  const state = JSON.parse(folded());
  frame.contentWindow.postMessage({ weave: 'view', state, actions: state.actions, board, me: { did: did(ME) } }, '*');
}

/** An action, by one of the four: what the lens proposes is checked against its contract, as Weave does, and signed. The new events' ids. */
function action(who, name, input, time) {
  let proposed;
  try {
    proposed = JSON.parse(act(name, JSON.stringify(input ?? null), folded(), JSON.stringify({ did: did(who), name: people[who] })));
  } catch (error) {
    throw new Error(`${manifest.name} won't: ${error instanceof Error ? error.message : error}`);
  }
  const posts = new Set(items.filter((item) => item.kind === 'weave.post').map((item) => item.id));
  for (const { kind, body } of proposed) {
    if (!manifest.client.writes.includes(kind)) throw new Error(`${manifest.name} may not propose ${kind} (its contract: ${manifest.client.writes.join(', ')})`);
    const about = body.post ?? body.target;
    if (about !== undefined && !posts.has(about)) throw new Error(`${manifest.name} proposed a ${kind} about something not in ${board.title}`);
  }
  // What is about no post belongs to the board: Weave writes the board's name into it.
  return proposed.map(({ kind, body }) => sign(who, kind, body.post ?? body.target ? body : { ...body, board: board.name }, time));
}

// ---------------------------------------------------------------- the sample: three weeks of a garden's autumn

/** A day so many days ago, as the actions take it ("2026-11-03"), in the calendar here. */
function dayAgo(days) {
  const then = new Date();
  then.setDate(then.getDate() - days);
  return `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, '0')}-${String(then.getDate()).padStart(2, '0')}`;
}
const evening = params.has('evening');
let written = 0;
/**
 * When a sample event was signed: on its day at its time of day, so many minutes later (never later than a moment
 * ago). With ?evening=1: this evening, one after the other within the last hour, whatever day it is about.
 */
function signedAt(ago, clock, minutes = 0) {
  if (evening) return Date.now() - 58 * MIN + written++ * 36_000;
  const [hours, mins] = clock.split(':').map(Number);
  const then = new Date();
  then.setDate(then.getDate() - ago);
  then.setHours(hours, mins + minutes, 0, 0);
  return Math.min(then.getTime(), Date.now() - MIN);
}

for (const entry of params.has('empty') ? [] : ENTRIES) {
  const posted = entry.ago - (entry.late ?? 0); // written so many days after its day
  const write = { title: entry.title, text: entry.text, day: dayAgo(entry.ago), ...(entry.week ? { week: true } : {}), ...(entry.via ? { via: entry.via } : {}) };
  // Written through the lens, with its day. Or (plain) posted in Weave's own list on the day itself: no day in its title.
  const id = entry.plain && !evening ? sign(entry.who, 'weave.post', { title: entry.title, text: entry.text, board: board.name }, signedAt(posted, entry.at)) : action(entry.who, 'write', write, signedAt(posted, entry.at))[0];
  if (entry.image) items.find((item) => item.id === id).body.image = 'wblob:a-picture'; // the lens only learns that there is one
  Object.entries(entry.moods ?? {}).forEach(([who, mood], i) => action(who, 'mood', { post: id, mood }, signedAt(posted, entry.at, (i + 1) * 9)));
  if (entry.best) action(entry.best, 'highlight', { post: id }, signedAt(posted, entry.at, 45));
  (entry.chat ?? []).forEach(([who, text], i) => sign(who, 'weave.msg', { post: id, text }, signedAt(posted, entry.at, 50 + i * 4)));
}
for (const question of params.has('empty') ? [] : QUESTIONS) {
  action(question.who, 'ask', { day: dayAgo(question.ago), text: question.text }, signedAt(question.ago, '08:00'));
  question.answers.forEach(([who, text], i) => action(who, 'answer', { day: dayAgo(question.ago), text }, signedAt(question.ago, '12:00', i * 50)));
}

// ---------------------------------------------------------------- the lens asks

const note = (text) => {
  const n = document.getElementById('note');
  n.textContent = text;
  n.classList.add('on');
  setTimeout(() => n.classList.remove('on'), 2500);
};

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  const m = event.data;
  // A moment passes while Weave signs: the lens has to look right in the meantime.
  if (m?.weave === 'act') {
    setTimeout(() => {
      try {
        action(ME, m.name, m.input);
        frame.contentWindow.postMessage({ weave: 'acted', id: m.id }, '*');
        view();
      } catch (error) {
        frame.contentWindow.postMessage({ weave: 'acted', id: m.id, error: error.message }, '*');
        note(error.message);
      }
    }, 150);
  }
  if (m?.weave === 'open') note(`Weave would open “${items.find((item) => item.id === m.post)?.body.title}”`);
});

// ---------------------------------------------------------------- the scene

/** What happens today, one step after the other: ?play=1 plays them; window.scene[i]() does one. */
let made; // the entry the scene's first step made: the mood is about it
window.scene = SCENE.map(([who, name, input]) => () => {
  const ids = action(who, name, name === 'mood' ? { ...input, post: made } : { ...input, day: dayAgo(0) });
  made ??= ids[0];
  view();
});
// To look at and try from the console: what was signed, and the contract (take a kind out of it: Weave refuses it).
window.items = items;
window.contract = manifest.client.writes;

document.documentElement.classList.toggle('light', params.get('theme') === 'light');
frame.style.colorScheme = params.get('theme') === 'light' ? 'light' : 'dark';
frame.width = params.get('w') ?? 540;
frame.height = params.get('h') ?? 480;
if (params.get('sandbox') === '0') frame.removeAttribute('sandbox');
frame.addEventListener('load', () => {
  view();
  if (params.get('play')) window.scene.forEach((step, i) => setTimeout(step, 1800 + i * 2600));
});
frame.src = '../site/index.html';
