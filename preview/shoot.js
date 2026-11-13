// Photographs of the preview, into preview/out/: the journal in a board's room (540 × 480: its top, and scrolled),
// in a window of its own (1050 wide, dark and light), on a phone, the "evening" sample (everything written within
// one hour, each entry with its day), four moments of the scene (and all four on one sheet), and a few things one
// does oneself. It starts the preview's server and a headless Chrome (through the videos' tools/cdp.js) and stops
// both again.
//
//   node preview/shoot.js
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.js';

const { launch } = createRequire(import.meta.url)(process.env.CDP ?? '../../tools/cdp.js');
const file = (name) => fileURLToPath(new URL(`out/${name}.png`, import.meta.url));
const page = (query = '') => `http://127.0.0.1:8843/preview/${query}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(fileURLToPath(new URL('out/', import.meta.url)), { recursive: true });

const server = await serve();
const b = await launch({ width: 600, height: 590, port: 9453 });
b.on((m) => m.method === 'Runtime.exceptionThrown' && console.log('error in the page:', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
const scheme = (value) => b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
/** The preview with a frame of this size, in a window that fits it, photographed. */
async function shoot(name, width, height, query = '', theme = 'dark') {
  await scheme(theme);
  await b.size(width + 60, height + 110);
  await b.goto(page(`?theme=${theme}&w=${width}&h=${height}${query}`), 1500);
  await b.shot(file(name));
}
/** Turn the wheel over the lens (it scrolls as it does in Weave, sandboxed). */
const wheel = (x, y, deltaY) => b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
/** Do something inside the lens (the frame unsandboxed, so it can be reached): `doc` is its document, `win` its window. */
const inside = (code) => b.eval(`(() => { const win = document.getElementById('lens').contentWindow, doc = win.document; ${code} })()`);

try {
  // A board's room in Weave: the top (what one sees first), and scrolled down the days.
  await shoot('540-dark-top', 540, 480);
  await wheel(300, 300, 620);
  await wait(700);
  await b.shot(file('540-dark-scrolled'));
  await shoot('540-light-top', 540, 480, '', 'light');
  // A window of its own, and a phone.
  await shoot('1050-dark', 1050, 900);
  await shoot('1050-light', 1050, 900, '', 'light');
  await shoot('narrow-dark', 390, 780);
  // Everything written down within one hour this evening, each entry with its day: the same three weeks.
  await shoot('evening-540', 540, 480, '&evening=1');
  await shoot('evening-1050', 1050, 900, '&evening=1');
  await shoot('empty-540', 540, 480, '&empty=1');

  // Four moments of the scene: a friend's entry has unfolded into today (it says who wrote it), the day's question
  // got its last answer and the answers unfold, a mood colors the day, an entry written by a friend's agent.
  await scheme('dark');
  await b.size(600, 590);
  await b.goto(page('?theme=dark'), 1500);
  await b.eval('scene[0]()');
  await wait(1500);
  await b.shot(file('scene-1'));
  await wait(1500);
  await b.eval('scene[1]()');
  await wait(1200);
  await b.eval('scene[2]()');
  await wait(330);
  await b.shot(file('scene-2'));
  await wait(2000);
  await b.eval('scene[3]()');
  await wait(450);
  await b.shot(file('scene-3'));
  await wait(2000);
  await b.eval('scene[4]()');
  await wait(1600);
  await b.shot(file('scene-4'));
  await wait(4000);
  await b.shot(file('scene-after'));
  await b.size(1200, 1180);
  await b.goto(page('sheet.html'), 800);
  await b.shot(file('scene-sheet'));

  // What one does oneself: write an entry about another day, read a long one on, unfold a past day's answers, and
  // what is under the pages.
  await b.size(600, 590);
  await b.goto(page('?theme=dark&sandbox=0'), 1500);
  await inside(`doc.getElementById('title').focus(); doc.getElementById('title').value = 'Bulbs along the fence'; const t = doc.getElementById('text'); t.value = 'Sixty tulips and a bag of mixed daffodils, a trowel deep, wherever the ground let me.'; t.dispatchEvent(new Event('input')); const w = doc.getElementById('when'); w.value = ''; w.dispatchEvent(new Event('change'))`);
  await wait(700);
  await b.shot(file('writing'));
  await inside(`doc.getElementById('write-it').click()`);
  await wait(2000);
  await b.shot(file('written'));
  await inside(`doc.querySelector('.more:not([hidden])').closest('.entry').scrollIntoView({ block: 'start' }); win.scrollBy(0, -70)`);
  await inside(`doc.querySelector('.more:not([hidden])').click()`);
  await wait(800);
  await b.shot(file('read-on'));
  await inside(`[...doc.querySelectorAll('.peek')].at(-1).closest('.day').scrollIntoView({ block: 'start' }); win.scrollBy(0, -60)`);
  await wait(300);
  await b.shot(file('folded'));
  await inside(`[...doc.querySelectorAll('.peek')].at(-1).click()`);
  await wait(300);
  await b.shot(file('unfolded'));
  await inside(`doc.querySelector('.note').scrollIntoView({ block: 'start' }); win.scrollBy(0, -110)`);
  await wait(300);
  await b.shot(file('week'));
  await inside(`win.scrollTo(0, doc.documentElement.scrollHeight)`);
  await wait(500);
  await b.shot(file('540-dark-bottom'));
} finally {
  b.close();
  server.closeAllConnections();
  server.close();
}
