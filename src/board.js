// A journal kept together: a Weave client service in JavaScript, built into a WebAssembly component. A project's
// maintainers pin it to a board; every member's own Weave then shows the board through it. An entry is a post: its
// author wrote it, about the day its title names ("Garlic goes in · 4 Nov 2026"), or else the day it was posted. A
// day can have a question that everyone answers in a line. It's pure: Weave hands it the board's events (fold) and
// asks what an action means (act). It signs nothing: the member does, or their agent for them.

/** How an entry can feel, best first. The view draws a face for each. */
const MOODS = ['wonderful', 'happy', 'calm', 'tired', 'rough'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The most a headline and a question may have, so that a title with its day and "via" stays within Weave's 200. */
const HEADLINE = 140;
const QUESTION = 150;
const ANSWER = 280;

/** What can be done with the journal: Weave reads this, for the renderer and for agents (weave_board_action). */
const ACTIONS = [
  {
    name: 'write',
    label: 'Write an entry',
    input: {
      title: `the headline, at most ${HEADLINE} characters (with week: true it may be left out)`,
      text: 'what happened',
      day: 'the day it is about, as 2026-11-03 (left out: the day it is posted)',
      week: 'true: the week in a few lines, shown as the card that closes the week of its day (left out: an entry)',
      via: 'for an agent writing for its person: its own name, like claude (left out: written by hand)',
    },
  },
  { name: 'ask', label: 'Set a day\'s question', input: { day: 'the day, as 2026-11-03', text: `the question everyone answers in a line, at most ${QUESTION} characters` } },
  { name: 'answer', label: 'Answer a day\'s question', input: { day: 'the day, as 2026-11-03', text: `your answer: one line, at most ${ANSWER} characters`, via: 'for an agent answering for its person: its own name (left out: by hand)' } },
  { name: 'mood', label: 'Say how an entry felt', input: { post: 'the entry\'s id', mood: `${MOODS.join(' | ')} (null: take yours back)` } },
  { name: 'highlight', label: 'Mark an entry as a highlight', input: { post: 'the entry\'s id', on: 'true (left out: true) | false: no highlight after all' } },
];

const count = (text) => text.split(/\s+/).filter(Boolean).length;
/** Words on one line: what a headline, a question and an answer are. */
const line = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** A calendar day, as "2026-11-03", if there is such a day (months count from 0). */
function dayOf(year, month, date) {
  const day = new Date(Date.UTC(year, month, date));
  return year > 1969 && day.getUTCFullYear() === year && day.getUTCMonth() === month && day.getUTCDate() === date ? day.toISOString().slice(0, 10) : undefined;
}
/** Whether this is a day as the actions take it: "2026-11-03". */
const isDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dayOf(+day.slice(0, 4), day.slice(5, 7) - 1, +day.slice(8)) === day;
/** A day as a title says it: "3 Nov 2026". */
const spoken = (day) => `${+day.slice(8)} ${MONTHS[day.slice(5, 7) - 1].slice(0, 3)} ${day.slice(0, 4)}`;

/**
 * A post's title read as an entry: {title, day?, via?, kind?}. What the lens needs stands in the title, so the post
 * reads well in Weave's own list too:
 *
 *   Garlic goes in · 4 Nov 2026                      the day it is about; also "· 4 Nov" (the last such day up to when
 *                                                    it was posted) and "· 2026-11-04". A day after it was posted
 *                                                    counts for nothing: then, as without one, the post's own time does
 *   Soil test · 10 Nov 2026 · via claude             written by its author's agent, as the post itself says
 *   The week: Garlic in, slugs ahead · 8 Nov 2026    the week in a few lines (kind: week)
 *   Q: What surprised you today? · 12 Nov 2026       an answer to that day's question (kind: answer): the text is it
 *
 * `posted` is the post's own time (left out: any day is taken).
 */
function read(full, posted) {
  let title = full;
  // What a pattern says at the title's end; what matched is cut off, the rest is the headline.
  const take = (pattern, value) => {
    const found = pattern.exec(title);
    if (!found) return undefined;
    const said = value(found);
    if (said !== undefined) title = title.slice(0, found.index).trim();
    return said;
  };
  const via = take(/\s[·•|]\s*via\s+([a-z0-9][\w.-]{0,23})\s*$/i, (m) => m[1].toLowerCase());
  // Somewhere it is a day later already: so up to the day after it was posted.
  const latest = posted === undefined ? '9999' : new Date((Date.parse(posted) || 0) + 864e5).toISOString().slice(0, 10);
  const said =
    take(/\s[·•|]\s*(\d{4})-(\d{2})-(\d{2})\s*$/, (m) => dayOf(+m[1], m[2] - 1, +m[3]) ?? '') ??
    take(/\s[·•|]\s*(\d{1,2})\.?\s*([a-z]{3,9})\.?,?(?:\s+(\d{4}))?\s*$/i, (m) => {
      const month = MONTHS.findIndex((name) => name.toLowerCase().startsWith(m[2].toLowerCase())); // "Nov", "Sept", "November"
      if (month < 0) return undefined; // not a day: it stays in the headline
      const years = m[3] ? [+m[3]] : [+latest.slice(0, 4), latest.slice(0, 4) - 1];
      return years.map((year) => dayOf(year, month, +m[1])).find((day) => day && (m[3] || day <= latest)) ?? '';
    });
  const week = /^the week\s*(?::\s*|$)/i.exec(title);
  const answer = /^q\s*:\s*(?=\S)/i.exec(title);
  title = title.slice((week ?? answer)?.[0].length ?? 0) || (week ? 'The week' : '(untitled)');
  return { title, day: said && said <= latest ? said : undefined, via, kind: week ? 'week' : answer ? 'answer' : undefined };
}

/**
 * The journal's state from the board's events, oldest first: posts become entries (their titles read as above),
 * their author's edits change them (an edited title is read anew) and their deletion takes them away, journal.mood
 * says how an entry felt to someone (each member's latest counts), journal.highlight marks it as a highlight (the
 * latest counts, whoever's it is), journal.question sets a day's question (the latest for that day), votes and chat
 * messages are counted.
 */
export function fold(board, items) {
  const entries = new Map(); // by id, in the order they were posted
  const questions = new Map(); // by day
  const votes = new Map(); // per entry: each person's latest vote
  const who = (item) => ({ by: item.author, name: item.authorName ?? item.author, time: item.time });
  const titled = (title) => (typeof title === 'string' && title.trim() ? title.trim() : '(untitled)');
  for (const item of JSON.parse(items)) {
    const body = item.body ?? {};
    const entry = entries.get(body.target ?? body.post);
    if (item.kind === 'weave.post' || item.kind === 'weave.issue') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      // image: only that it has one. The picture itself never reaches the view (a frame without network).
      entries.set(item.id, { id: item.id, ...read(titled(body.title), item.time ?? ''), text, by: item.authorName ?? item.author, author: item.author, time: item.time, ...(body.image ? { image: true } : {}), moods: [], votes: 0, chats: 0 });
    } else if (item.kind === 'journal.question' && body.target === undefined) {
      // A day's question is the board's, not a post's. Whoever may write here may set it; what isn't one counts for nothing.
      if (isDay(body.day) && line(body.text)) questions.set(body.day, { day: body.day, text: line(body.text).slice(0, 200), ...who(item) });
    } else if (!entry) {
      continue; // about an entry that isn't there (any more)
    } else if (item.kind === 'weave.post.edit' && item.author === entry.author) {
      // Only its author's edits count, as in Weave.
      if (typeof body.title === 'string' && body.title.trim()) Object.assign(entry, read(body.title.trim(), entry.time ?? ''));
      if (typeof body.text === 'string') entry.text = body.text.trim();
      entry.edited = item.time;
    } else if (item.kind === 'weave.post.delete' && item.author === entry.author) {
      // Its author's deletion (what a maintainer deleted, Weave no longer hands over at all).
      entries.delete(entry.id);
    } else if (item.kind === 'weave.upvote' && [1, 0, -1].includes(body.value)) {
      votes.set(entry.id, (votes.get(entry.id) ?? new Map()).set(item.author, body.value));
    } else if (item.kind === 'weave.msg') {
      entry.chats += 1;
    } else if (item.kind === 'journal.mood' && (MOODS.includes(body.mood) || body.mood === null)) {
      // One mood per member and entry: a new one replaces theirs, null takes it back.
      entry.moods = entry.moods.filter((m) => m.by !== item.author);
      if (body.mood) entry.moods.push({ ...who(item), mood: body.mood });
    } else if (item.kind === 'journal.highlight') {
      if (body.on === false) delete entry.highlight;
      else entry.highlight = who(item);
    }
  }
  // Who wrote how much, the one with the most words first. An answer is not counted as an entry, its words are.
  const writers = new Map();
  for (const entry of entries.values()) {
    entry.words = count(entry.text);
    // Ups minus downs, each person's latest vote counting: as Weave counts them.
    entry.votes = [...(votes.get(entry.id)?.values() ?? [])].reduce((sum, v) => sum + v, 0);
    const writer = writers.get(entry.author) ?? writers.set(entry.author, { by: entry.author, name: entry.by, entries: 0, answers: 0, words: 0 }).get(entry.author);
    writer[entry.kind === 'answer' ? 'answers' : 'entries'] += 1;
    writer.words += entry.words;
  }
  const all = [...entries.values()];
  return JSON.stringify({
    board: JSON.parse(board),
    entries: all,
    questions: [...questions.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    writers: [...writers.values()].sort((a, b) => b.words - a.words),
    words: all.reduce((sum, entry) => sum + entry.words, 0),
    moods: MOODS,
    actions: ACTIONS,
  });
}

/** What an action proposes, as events for the member to sign; a throw is why not (Weave shows it). */
export function act(name, input, state, me) {
  const asked = JSON.parse(input) ?? {};
  const journal = JSON.parse(state);
  const my = JSON.parse(me) ?? {};

  if (['write', 'ask', 'answer'].includes(name)) {
    const day = asked.day ?? undefined;
    const via = asked.via ?? undefined;
    if (day !== undefined && !isDay(day)) throw 'a day is written like 2026-11-03';
    if (via !== undefined && !(typeof via === 'string' && /^[a-z0-9][\w.-]{0,23}$/.test(via))) throw '"via" is an agent\'s own name in one lowercase word, like claude';
    // A post whose title says the day and who wrote it down. It has to read back as what was meant (`headline`, of that kind).
    const post = (title, text, kind, headline) => {
      const full = [title, day && spoken(day), via && `via ${via}`].filter(Boolean).join(' · ');
      const back = read(full);
      if (back.day !== day || back.via !== via || back.kind !== kind || back.title !== headline) throw 'a headline can\'t begin with "Q:" or "The week:" or end in a day or "via …": the journal reads those itself';
      return JSON.stringify([{ kind: 'weave.post', body: { title: full, text } }]);
    };
    const said = (kind) => journal.entries.filter((e) => e.kind === kind && e.day === day);

    if (name === 'write') {
      const week = asked.week ?? false;
      const headline = line(asked.title);
      const text = typeof asked.text === 'string' ? asked.text.trim() : '';
      if (typeof week !== 'boolean') throw '"week" is true or false';
      if (!headline && !week) throw 'an entry needs a headline';
      if (headline.length > HEADLINE) throw `a headline has at most ${HEADLINE} characters`;
      if (!text) throw 'an entry needs a few words under its headline';
      return week ? post(`The week${headline ? `: ${headline}` : ''}`, text, 'week', headline || 'The week') : post(headline, text, undefined, headline);
    }
    if (!day) throw 'which day\'s question? "day", like 2026-11-03';
    const question = journal.questions.find((q) => q.day === day);
    const text = line(asked.text);
    if (name === 'ask') {
      if (!text) throw 'a question needs words';
      if (text.length > QUESTION) throw `a question has at most ${QUESTION} characters`;
      if (question?.text === text) return '[]'; // nothing to sign: it's that day's question already
      if (said('answer').length) throw 'that day\'s question has answers already';
      return JSON.stringify([{ kind: 'journal.question', body: { day, text } }]);
    }
    if (!question) throw 'nobody has asked a question for that day (the action "ask" sets one)';
    if (!text) throw 'an answer needs words';
    if (text.length > ANSWER) throw `an answer is one line, at most ${ANSWER} characters`;
    if (said('answer').some((e) => e.author === my.did)) throw 'you have answered that day\'s question already';
    return post(`Q: ${question.text}`, text, 'answer', question.text);
  }

  if (!['mood', 'highlight'].includes(name)) throw `no action "${name}"`;
  const entry = journal.entries.find((e) => e.id === asked.post);
  if (!entry) throw 'there is no such entry in this journal';
  if (name === 'mood') {
    const mood = asked.mood ?? null;
    const mine = entry.moods.find((m) => m.by === my.did)?.mood ?? null;
    if (mood !== null && !MOODS.includes(mood)) throw `the moods are ${MOODS.join(', ')}`;
    if (mood === null && mine === null) throw 'you gave this entry no mood';
    if (mood === mine) return '[]'; // nothing to sign: it's yours already
    return JSON.stringify([{ kind: 'journal.mood', body: { target: entry.id, mood } }]);
  }
  const on = asked.on ?? true;
  if (typeof on !== 'boolean') throw '"on" is true or false';
  if (on === Boolean(entry.highlight)) return '[]'; // nothing to sign: it's that way already
  return JSON.stringify([{ kind: 'journal.highlight', body: { target: entry.id, on } }]);
}
