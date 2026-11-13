# Journal: a Weave client service for a journal kept together

A board shown its own way. A project's maintainers pin this service to a board; every member's own Weave then fetches it and shows the board through it. An entry is a post; a day is one page with everyone's entries of that day; a day can have a question that everyone answers in a line; a ribbon of faces shows how the last weeks felt. It's built into a WebAssembly component that Weave runs itself, with no key, no network and no files: it only turns the board's events into a state, and an action into events for the member to sign.

```
npm install
npm run build              # → board.wasm
tar -czf journal.tar.gz board.wasm site
```

## What one sees

Made for the room a board has in Weave's window (about 540 × 480; the page scrolls). From the top:

- **The journal's name and counts**: days, entries, words.
- **The mood of the days**: a ribbon of the last three weeks that stays on top while one leafs. A day is a face in the color of how it felt (what most moods on its entries say; among equals the one said last), a dot where something was written but nobody said how it felt, a star where a highlight is. A click goes to the day; the arrows turn a week back and on.
- **A blank page**: a headline; once one writes, the text, the day it is about (today, yesterday, a date) and whether it is the week in a few lines.
- **Today's page**, then the days before, the latest first. A page has the date, how the day felt, the day's question with everyone's answer, and everyone's entries of that day, each with its writer's color at its edge: headline, who and when ("written 13 Nov" if that was a later day, "via claude" if their agent wrote it down), the text (a long one cut, "read on" opens it in place), five faces to say how it felt, a ribbon to mark it as a highlight.
- **Weeks**: a past week has its name on a line ("Last week · 2–8 Nov"); the week in a few lines stands there as a card of its own.
- Under the pages: the highlights, and who wrote how much.

Wider than 900 the highlights and the writers stand beside the pages, and a day's entries side by side; narrower than 430 it's a phone. People are chips with their initials in a color made from their name, and an entry's picture is only a mark: the frame gets no pictures. Text is shown as written (no Markdown).

## How it fits together

- `src/board.js` is the logic. Weave calls it (`wit/service.wit`, the `board` world): `fold(board, items)` gets the board (`{name, title}`) and its events, oldest first, and returns the state as JSON; `act(name, input, state, me)` says what an action means: events for the member to sign, as JSON `[{kind, body}]`, or a thrown string that says why not. Both are pure and have no clock and no time zone: `fold` keeps the days and times the events carry; what "today" and "this week" are, the view says, where the viewer is.
- `site/` is the view: plain HTML, CSS and JavaScript in a sandboxed frame in Weave (no network, no forms). It talks only to Weave, by `postMessage`: it gets `{weave: 'view', state, actions, board, me}` whenever the board changes, asks with `{weave: 'act', id, name, input}`, hears `{weave: 'acted', id, error?}`, and opens a post with `{weave: 'open', post}` (a double-click, or Enter).
- `weave.app.json` is its contract: `client.writes` are the kinds its actions may propose: `weave.post`, `journal.mood`, `journal.highlight`, `journal.question`. Weave checks every proposed event against it, and that it's about this board, before the member signs it with their own rights.

What `fold` gets, and nothing else: the board's posts (title, text, author and their name, time, whether there is a picture), their edits and deletions, votes on them, the messages in their chats, and the events of this lens's own three kinds. `journal.mood` and `journal.highlight` are about a post (`target`); a `journal.question` is about no post: it belongs to the board (Weave writes the board's name into it).

## An entry is a post

Its title is the headline, its text what was written, its author who wrote it. What else the lens needs stands at the end (or the beginning) of the title, so the post reads well in Weave's own list too:

| title | |
| --- | --- |
| `Garlic goes in · 4 Nov 2026` | the day it is about. Also `· 4 Nov` (the last such day up to when it was posted) and `· 2026-11-04`. Without one, or with one later than the day after it was posted: the day it was posted, in the calendar of whoever looks |
| `Soil test · 10 Nov 2026 · via claude` | written down by its author's agent. It is still the author's entry |
| `The week: Garlic in, slugs ahead · 8 Nov 2026` | the week in a few lines: a card at the week of its day (Monday to Sunday, in the viewer's calendar) |
| `Q: What surprised you today? · 12 Nov 2026` | an answer to that day's question; the text is the answer |

An entry written through the lens always carries its day, so everyone sees it on the same day whatever their time zone, and entries written down later (three weeks in one evening) land on their days. An edited title is read anew.

`via` is what the post says, not what Weave vouches for: Weave hands `fold` an event's author (the person, also when their agent signed it), not its signer. Weave's own view of the post shows who signed it.

## A day's question

Anyone who may write in the board sets a day's question (`journal.question` `{day, text}`; the latest for a day holds, and `act` won't change one that has answers). An answer is a post as above. In the view the others' answers stay folded until you have given yours: that is a courtesy of the view, not secrecy. "unfold anyway" shows them, and so does Weave's own list: everything on the board can be read by its members.

## The state

`fold` returns `{board, entries, questions, writers, words, moods, actions}`:

| | |
| --- | --- |
| `entries` | in the order they were posted: `{id, title, text, by, author, time, day?, via?, kind?, edited?, image?, words, moods: [{by, name, time, mood}], highlight?: {by, name, time}, votes, chats}`. `title`: the headline without what was read from it; `day`: `2026-11-04`, if the title names one; `kind`: `week` or `answer` (then `title` is the question it answers); `time`: when it was posted |
| `questions` | by day: `{day, text, by, name, time}` |
| `writers` | who wrote how much, the most words first: `{by, name, entries, answers, words}` |
| `moods` | `wonderful`, `happy`, `calm`, `tired`, `rough` |

## What one can do, by hand or as an agent

| action | input | proposes |
| --- | --- | --- |
| `write` | `{title, text, day?, week?, via?}` | `weave.post` `{title, text}`, the title as above |
| `ask` | `{day, text}` | `journal.question` `{day, text}`; nothing when that is the day's question already |
| `answer` | `{day, text, via?}` | `weave.post` `{title: 'Q: <the day's question> · <day>', text}`; refused when you have answered that day already |
| `mood` | `{post, mood}` | `journal.mood` `{target, mood}`: each member's latest counts; `mood: null` takes yours back |
| `highlight` | `{post, on?}` | `journal.highlight` `{target, on}`: the latest counts, whoever's it is; nothing when it's that way already |

`write` takes: `title`, a headline of at most 140 characters (with `week: true` it may be left out); `text`; `day`, as `2026-11-03` (left out: the day it's posted); `week: true` for the week in a few lines; `via`, an agent's own name in one lowercase word. `ask` takes a question of at most 150 characters, `answer` one line of at most 280. The lens has no clock, so "today" and "yesterday" are the caller's to turn into a date: the view does, an agent has to. `act` refuses what isn't that (also a headline that would be read as something else: one that begins "Q:" or "The week:", or ends in a day or "via …"); `fold` takes what comes and reads what makes sense.

An agent writes through the same actions, signed as the agent for its person (`weave_board_action`, or):

```
weave board view journal -p <project>
weave board act journal write -p <project> --as claude --input '{"title": "Soil test", "text": "pH 6.4, short of nitrogen: clover over winter.", "day": "2026-11-13", "via": "claude"}'
weave board act journal write -p <project> --as claude --input '{"week": true, "title": "Garlic in, a hedgehog arrived", "text": "…", "day": "2026-11-08", "via": "claude"}'
weave board act journal ask -p <project> --as claude --input '{"day": "2026-11-13", "text": "What surprised you in the garden today?"}'
weave board act journal answer -p <project> --as claude --input '{"day": "2026-11-13", "text": "The compost is still warm.", "via": "claude"}'
weave board act journal mood -p <project> --as claude --input '{"post": "<an entry's id>", "mood": "happy"}'
weave board act journal highlight -p <project> --as claude --input '{"post": "<an entry's id>"}'
```

An agent signs only the kinds its person allowed it: `weave.post` to write and to answer, and the lens's own `journal.question`, `journal.mood` and `journal.highlight` for the rest.

## Looking at it without Weave

`preview/` is not part of the lens (it isn't released): a page that shows `site/` in a frame of the board's size and plays Weave's part with the real `fold` and `act`: three weeks of a garden's autumn by four friends (you are Mara), written through the lens's own actions, and what an action proposes checked against `weave.app.json`.

```
node preview/serve.js      # → http://127.0.0.1:8843/preview/
node preview/shoot.js      # photographs into preview/out/ (needs ../tools/cdp.js and Chrome)
```

`?play=1` plays a scene (a friend writes today's entry; the day's question gets its last two answers, yours among them, and the answers unfold; a mood colors the day; a friend's agent writes an entry for him); `?w=1050&h=900` another size; `?theme=light`; `?evening=1` the same three weeks, all written down within the last hour, each entry with its day; `?empty=1` a journal with nothing in it.

## Releasing it and showing a board with it

Release the archive (`weave app release v1.0 --asset wasm=journal.tar.gz -p <project>`), then a maintainer pins it to a board:

```
weave board lens journal -p <project> --artifact <project>            # suggested: each member chooses
weave board lens journal -p <project> --artifact <project> --require  # every member's Weave shows it
```
