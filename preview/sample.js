// Sample pages for the preview: four friends of a project called Plot 17 share an allotment garden and keep its
// journal together, through three weeks of its autumn. Laid out by how many days ago a thing happened, so the journal
// reaches up to today whenever one looks. preview/weave.js writes them through the lens's own actions.
export const board = { name: 'journal', title: 'Journal' };
export const people = { mara: 'Mara', jonas: 'Jonas', aylin: 'Aylin', tobi: 'Tobi' };
export const did = (who) => `did:key:${who}`;

/** How many days ago the n-th Sunday before today was: that's when a week's lines are written. */
const sunday = (n) => (new Date().getDay() || 7) + 7 * (n - 1);

// Who wrote it, how many days ago it was (`ago`), at what time of day, its headline and text. And, if any: `moods`
// (how it felt to the others), `best` (who marked it a highlight), `chat` (what was said under it), `late` (written
// so many days after its day), `plain` (posted in Weave's own list, with no day in its title), `week` (the week in a
// few lines), `via` (written down by their agent), `image` (it has a picture).
export const ENTRIES = [
  { who: 'mara', ago: 20, at: '18:40', title: 'We have the key', text: 'Plot 17 is ours. Brambles to the hip, a shed that leans as if it were listening, and one apple tree nobody has pruned in years. I love it already.', moods: { jonas: 'wonderful', aylin: 'wonderful', tobi: 'happy' } },
  { who: 'tobi', ago: 19, at: '17:15', title: 'The first bed, cleared', text: 'Four hours, two barrows of couch grass, one blister each. Under it all the soil is black and full of worms. Jonas dug up a spade head and now wants to find the handle.', moods: { mara: 'tired', jonas: 'happy', aylin: 'tired' } },
  { who: 'aylin', ago: 18, at: '16:30', title: 'The last tomatoes', text: 'Mostly green, a few blushing. I took them all in before the cold does, and lined them up on the windowsill like a jury. The green ones are for chutney.', moods: { mara: 'happy', tobi: 'calm' }, best: 'mara', image: true },
  { who: 'jonas', ago: 17, at: '21:50', title: 'Slugs: a census', text: 'Counted by torchlight: twenty-three on the chard alone. They were here before us and they know it. Beer traps tomorrow, and I am not sharing.', moods: { tobi: 'rough', aylin: 'rough', mara: 'happy' }, chat: [['aylin', 'Copper tape. I keep saying.'], ['tobi', 'Twenty-three is a rookie number.']] },
  { who: 'mara', ago: 15, at: '09:10', late: 1, title: 'A rain barrel', text: 'A tenner on the classifieds, rolled here through the lanes, which got looks. Tobi cut the downpipe a hand too short. It rained that night and we caught every drop anyway.', moods: { tobi: 'happy', aylin: 'happy' } },
  { who: 'mara', ago: sunday(2), at: '21:00', week: true, title: 'Brambles 0, us 1', text: 'Three beds are clear and the barrel stands. The slugs are ahead on points. Next week: the shed, and something in the ground at last.' },
  { who: 'jonas', ago: 13, at: '20:20', title: 'Beer traps: the count', text: 'Nine drowned, and happily, by the look of them. The rest have moved over to the lettuce, so I call it a draw. Aylin says copper tape. I say a hedgehog.', moods: { aylin: 'happy', mara: 'happy' } },
  { who: 'tobi', ago: 12, at: '16:45', title: 'The shed stands straight', text: 'Two props, a car jack and a lot of standing back and squinting. It no longer leans. The door only closes if you lift it, which we have agreed to call a feature.', moods: { mara: 'wonderful', jonas: 'happy', aylin: 'wonderful' } },
  { who: 'aylin', ago: 10, at: '15:10', plain: true, title: 'Leaves for the beds', text: 'Raked the lane with old Mr Brandt, who has had plot 16 for thirty-one years. He says leaf mould is the whole secret, and that our apple is a Boskoop. Six sacks, tucked in over the bare beds.', moods: { mara: 'calm', tobi: 'calm' } },
  {
    who: 'mara',
    ago: 9,
    at: '18:30',
    title: 'Garlic goes in',
    text: [
      'Forty cloves, pointed end up, a hand apart, in the bed Tobi cleared. Mr Brandt leaned on the fence the whole time and said nothing, which I am told is praise.',
      'It is an odd thing to plant in November. Everything else is coming out or dying back, and here I am on my knees, pushing something into cold ground and trusting it to get on with it in the dark. Aylin read out the packet: harvest in July. None of us has ever planned anything that far ahead.',
      'We marked the rows with twigs, and Jonas wrote GARLIC on a lolly stick, in capitals, in case the slugs can read.',
    ].join('\n\n'),
    moods: { jonas: 'calm', aylin: 'happy', tobi: 'calm' },
    chat: [['jonas', 'They can. I have seen them.']],
  },
  { who: 'jonas', ago: 8, at: '17:40', title: 'A hedgehog!', text: 'Under the heap of prunings at dusk, snuffling like a very small engine. I take full credit. That corner stays untidy from now on, by order.', moods: { mara: 'wonderful', aylin: 'wonderful', tobi: 'wonderful' }, best: 'tobi' },
  { who: 'aylin', ago: sunday(1), at: '21:00', week: true, via: 'claude', title: 'Garlic in, a hedgehog arrived', text: 'The garlic is in, the leaves are down and the shed stands straight. Claude went through the week’s pages for me: most of them cheerful, two about slugs. Next: frost is coming, so the dahlias have to come out.' },
  { who: 'tobi', ago: 6, at: '11:20', title: 'The compost steams', text: 'Actual steam, in November, from a heap of what we threw away. I stood there with the fork and felt as if I had built a power station.', moods: { jonas: 'happy', mara: 'happy' } },
  { who: 'aylin', ago: 5, at: '08:15', title: 'First frost', text: 'White on the chard this morning, and the barrel had a skin of ice you could lift out in one pane. The dahlias went black overnight. Everything else just looks very awake.', moods: { mara: 'calm', jonas: 'tired', tobi: 'calm' } },
  { who: 'mara', ago: 4, at: '08:40', late: 1, title: 'Dahlias, lifted', text: 'Dug the tubers up before the ground closes: knobbly, like ginger with ambitions. They are drying on newspaper in the shed, each with a label, because last year’s me labelled nothing.', moods: { aylin: 'happy' } },
  { who: 'tobi', ago: 2, at: '13:00', title: 'The pumpkin comes home', text: 'The one pumpkin that came with the plot weighs eleven kilos. It rode home on my bike rack like a passenger. It has a name now, which may be a problem for the soup.', moods: { mara: 'happy', aylin: 'wonderful', jonas: 'happy' } },
  { who: 'mara', ago: 1, at: '14:20', title: 'The apple tree, pruned', text: 'Mr Brandt showed me where: out with what crosses, what points inward, what shoots straight up. The tree looks shocked. He says it will thank us in May.', moods: { jonas: 'calm', tobi: 'happy' } },
  { who: 'aylin', ago: 1, at: '19:45', title: 'Soup from the pumpkin', text: 'Eleven kilos make a lot of soup: ginger, a little chilli, cream on top. We ate it in the shed with the door propped open and our breath showing. Sorry, Gustav.', moods: { tobi: 'wonderful', jonas: 'wonderful', mara: 'wonderful' } },
];

// A day's question: who asked it, how many days ago, and everyone's answer so far ([who, their line]).
export const QUESTIONS = [
  { who: 'tobi', ago: 12, text: 'What should we grow first in spring?', answers: [['aylin', 'Broad beans, before anything else.'], ['jonas', 'Potatoes. A whole bed of them.'], ['tobi', 'Sweet peas, up the side of the shed.']] },
  { who: 'aylin', ago: 5, text: 'What did the frost get?', answers: [['mara', 'The dahlias. All of them.'], ['jonas', 'My confidence in the lettuce.'], ['tobi', 'The hose. I left it out.'], ['aylin', 'Not the garlic, thank goodness.']] },
  { who: 'jonas', ago: 0, text: 'What surprised you in the garden today?', answers: [['jonas', 'The compost is still warm at two degrees.'], ['tobi', 'A robin sat on the fork while I was holding it.']] },
];

// The scene (?play=1): what happens today, one thing after the other. `day` is put in by preview/weave.js (today),
// and `post` (the entry the scene's first step made).
export const SCENE = [
  ['tobi', 'write', { title: 'Clover sown', text: 'Scattered over the bare beds before the rain and raked in, as Mr Brandt showed us. Now it is up to the clover.' }],
  ['aylin', 'answer', { text: 'The fig still has every one of its leaves.' }],
  ['mara', 'answer', { text: 'How quiet it gets before the rain.' }],
  ['jonas', 'mood', { mood: 'happy' }],
  ['jonas', 'write', { title: 'Soil test', text: 'pH 6.4, plenty of potash, short of nitrogen. I photographed the strip and Claude read it for me: clover over winter, and no lime.', via: 'claude' }],
];
