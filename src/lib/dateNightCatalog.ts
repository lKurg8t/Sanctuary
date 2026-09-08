import { DateNightIdea } from '../types';

interface GenerateOptions {
  vibe?: string;
  budget?: string;
  location?: string;
  season?: string;
  timeAvailable?: string;
  customNote?: string;
  partner1Name?: string;
  partner2Name?: string;
}

interface IdeaTemplate {
  vibeCategory: 'surprise' | 'cozy' | 'romantic' | 'creative' | 'adventure' | 'budget';
  title: string;
  tagline: string;
  estimatedTime: string;
  cost: string;
  location: string;
  description: string;
  steps: string[];
  conversationStarters: string[];
  romanticTouches: string[];
  playlistTheme: string;
}

const IDEA_TEMPLATES: IdeaTemplate[] = [
  // COZY AT-HOME
  {
    vibeCategory: 'cozy',
    title: 'Living Room Pillow Fort & Candlelit Cinema',
    tagline: 'Transform the living room into a private cinematic sanctuary.',
    estimatedTime: '2.5 hours',
    cost: 'Free - $15 (Snacks)',
    location: 'Living Room Floor',
    description: 'Construct an opulent blanket fort with fairy lights, plush cushions, and warm blankets. Screen a nostalgic favorite film with gourmet stovetop popcorn and spiced cocoa.',
    steps: [
      'Assemble cushions, blankets, and clamp sheets to create a cozy hideaway with glowing warm lights.',
      'Prepare warm drinks (spiced chai, hot chocolate with marshmallows, or mulled cider) and sweet treats.',
      'Cuddle up and watch a comforting movie, pausing halfway for dessert.'
    ],
    conversationStarters: [
      'What is your all-time happiest childhood memory involving a movie or story?',
      'If we could build our dream cozy cabin anywhere in the world, what would it look like?'
    ],
    romanticTouches: [
      'Warm up the blankets in the dryer for 5 minutes before wrapping your partner in them.',
      'Slip a handwritten note into the popcorn bowl that reads "You are my favorite view."'
    ],
    playlistTheme: 'Acoustic Indie & Warm Fireside Instrumental'
  },
  {
    vibeCategory: 'cozy',
    title: 'Two-Chef Homemade Pasta & Vinyl Evening',
    tagline: 'Cook an artisanal dinner together with no rush and timeless jazz.',
    estimatedTime: '2 hours',
    cost: '$15 - $25',
    location: 'Kitchen & Dining Table',
    description: 'Turn cooking from a daily chore into a slow, sensory ritual. Hand-craft fresh pasta or gourmet gnocchi together while sipping wine and trading childhood kitchen memories.',
    steps: [
      'Put on vintage jazz, pour your favorite drinks, and roll up your sleeves.',
      'Work as a team: one kneads the dough, the other creates a velvety garlic-herb sauce from scratch.',
      'Plate by candlelight with freshly grated parmesan and enjoy slowly with no phones in sight.'
    ],
    conversationStarters: [
      'What was the exact meal or moment you knew you were falling in love with me?',
      'If you could master any single culinary skill in the universe, what would it be?'
    ],
    romanticTouches: [
      'Tie your partner’s apron around their waist and whisper a sweet whisper in their ear.',
      'Feed each other the first taste of the pasta sauce directly from the wooden spoon.'
    ],
    playlistTheme: 'Vintage Italian Bistro & Warm Acoustic Jazz'
  },
  {
    vibeCategory: 'cozy',
    title: 'Sanctuary Spa & Aromatherapy Massage Night',
    tagline: 'Melt away weekly stress with soothing touch and botanical scents.',
    estimatedTime: '1.5 - 2 hours',
    cost: '$0 - $10',
    location: 'Bedroom / Warm Sanctuary',
    description: 'Set up warm towels, dim the lamps to a soft amber glow, diffuse lavender or sandalwood essential oils, and take turns giving luxurious back and shoulder massages.',
    steps: [
      'Diffuse calming essential oils, light unscented soy candles, and warm massage oil in hot water.',
      'Take turns giving each other dedicated 25-minute neck, shoulder, and back massages.',
      'Finish with herbal chamomile tea and relaxing ambient music in fresh bedsheets.'
    ],
    conversationStarters: [
      'Where in your body do you hold the most tension during a stressful week?',
      'What is one small way I can help you feel more grounded when life gets hectic?'
    ],
    romanticTouches: [
      'Tuck warm damp lavender-infused washcloths over their shoulders before beginning.',
      'Spritz their pillow with a delicate mist of pure rosewater or sweet orange.'
    ],
    playlistTheme: 'Deep Ambient Sanctuary & Tibetan Singing Bowls'
  },

  // ROMANTIC & DEEP
  {
    vibeCategory: 'romantic',
    title: 'Candlelight Love Letter & Memory Capsule Exchange',
    tagline: 'Celebrate the poetic journey of how your two paths intertwined.',
    estimatedTime: '2 hours',
    cost: 'Free',
    location: 'Cozy Dining Table or Bed',
    description: 'Spend 20 minutes in quiet reflection writing letters answering prompts about the moment you first met, what you adore about the present, and your dreams for your future together.',
    steps: [
      'Set out fine paper, fountain pens, and your favorite treats by soft candlelight.',
      'Spend 20 silent minutes writing a heartfelt letter detailing 5 specific things you cherish about your partner.',
      'Read your letters out loud to each other over a glass of wine or sparkling cider.'
    ],
    conversationStarters: [
      'What is a subtle thing I do every day that makes you feel deeply loved?',
      'When was a moment recently when you looked at me and thought "I am so lucky"?'
    ],
    romanticTouches: [
      'Seal your letter with a drop of wax or a scented stamp to keep forever in your Sanctuary keepsake box.',
      'Frame a handwritten quote from their letter to place on the nightstand.'
    ],
    playlistTheme: 'Soulful Cello & Intimate Piano Sonatas'
  },
  {
    vibeCategory: 'romantic',
    title: 'Rooftop / Balcony Stargazing & Acoustic Melodies',
    tagline: 'Under the open night sky, reconnecting in the quiet stillness of the universe.',
    estimatedTime: '1.5 hours',
    cost: 'Free',
    location: 'Balcony, Porch, or Open Park',
    description: 'Spread thick wool blankets under the night sky, share an insulated thermos of hot spiced cider or tea, and stargaze while talking about cosmic dreams and life wonders.',
    steps: [
      'Layer up warmly and bring cozy throws and insulated drink mugs outside.',
      'Use a stargazing constellation app to locate planets and name your own couple constellation.',
      'Share slow sips and talk about where you hope your lives will be in 10 years.'
    ],
    conversationStarters: [
      'What is the biggest philosophical question that keeps you in wonder?',
      'If our love story was a constellation in the sky, what shape would it form?'
    ],
    romanticTouches: [
      'Bring an oversized jacket to drape over both of your shoulders as you sit together.',
      'Whisper three wishes for your shared future into the night air.'
    ],
    playlistTheme: 'Dreamy Acoustic Folk & Ambient Twilight'
  },
  {
    vibeCategory: 'romantic',
    title: '36 Questions That Lead to Love Revisited',
    tagline: 'Rediscover the hidden layers of your partner’s mind and soul.',
    estimatedTime: '2 hours',
    cost: 'Free',
    location: 'Cozy Lounge Chairs / Rug',
    description: 'Light three candles, put your phones on Do Not Disturb, and explore curated psychological deep-dive questions designed to foster profound mutual vulnerability.',
    steps: [
      'Sit facing each other closely on floor pillows with warm tea or dessert.',
      'Take turns pulling deep intimacy and curiosity cards, answering with absolute honesty.',
      'End with 4 minutes of uninterrupted, silent eye contact holding hands.'
    ],
    conversationStarters: [
      'If you could wake up tomorrow having gained any one quality or ability, what would it be?',
      'What does true partnership mean to you in its most beautiful form?'
    ],
    romanticTouches: [
      'Gently hold both of their hands during the hardest or most vulnerable answer.',
      'Give them a tender kiss on the forehead when they finish speaking.'
    ],
    playlistTheme: 'Neo-Classical Piano & Soft Ambient Strings'
  },

  // CREATIVE & ARTSY
  {
    vibeCategory: 'creative',
    title: 'Two-Canvas Portrait Swap & Wine Painting',
    tagline: 'Laugh, paint, and create quirky artistic masterpieces of each other.',
    estimatedTime: '2 hours',
    cost: '$10 - $20 (Canvas & Acrylics)',
    location: 'Dining Table / Studio Corner',
    description: 'Set up two small canvases and paints facing each other. Paint your partner’s portrait with a twist: swap canvases every 10 minutes without talking!',
    steps: [
      'Cover the table with kraft paper, set out paints, brushes, and sparkling drinks.',
      'Paint each other’s portrait (or abstract interpretation) with music playing.',
      'Swap canvases halfway through and reveal the finished joint artwork at the end.'
    ],
    conversationStarters: [
      'If you had to describe my personality using three colors, which would you pick and why?',
      'What is an artistic or creative hobby you’ve always secretly wanted to try?'
    ],
    romanticTouches: [
      'Sign both of your names and the date on the back of the canvases as a keepsake.',
      'Dab a tiny heart paint mark on the tip of their nose during the session.'
    ],
    playlistTheme: 'French Café Accordion & Bohemian Indie Pop'
  },
  {
    vibeCategory: 'creative',
    title: 'DIY Craft Cocktail / Mocktail Mixology Showdown',
    tagline: 'Become artisanal mixologists creating bespoke drinks named after each other.',
    estimatedTime: '1.5 hours',
    cost: '$15 - $20',
    location: 'Kitchen Bar Counter',
    description: 'Gather interesting juices, fresh herbs (mint, rosemary, basil), fruits, and mixers. Each partner invents a signature custom drink tailored to their partner’s unique taste.',
    steps: [
      'Lay out glassware, ice, citrus, syrups, sparkling water, and spirits or botanicals.',
      'Each partner designs a drink crafted specifically for the other’s personality and flavor preferences.',
      'Present your drinks with an elaborate backstory, garnish, and custom romantic name.'
    ],
    conversationStarters: [
      'If you were an artisanal drink, what ingredients would capture your spirit?',
      'What was the most adventurous culinary flavor you’ve ever tasted with me?'
    ],
    romanticTouches: [
      'Write a tiny handwritten menu card featuring your partner’s bespoke beverage name.',
      'Clink glasses with a heartfelt toast expressing gratitude for each other.'
    ],
    playlistTheme: 'Bossa Nova Sunset & Smooth Lounge Grooves'
  },

  // PLAYFUL ADVENTURE
  {
    vibeCategory: 'adventure',
    title: 'Mystery Destination Progressive Dinner Drive',
    tagline: 'A spontaneous culinary roadmap where each course is a surprise.',
    estimatedTime: '3 hours',
    cost: '$20 - $40',
    location: 'Across Town / Scenic Route',
    description: 'Take a progressive road trip: appetizers at a quirky food truck, dinner at your favorite hidden gem, dessert at a gourmet bakery, and drinks under city lights.',
    steps: [
      'Flip a coin at intersections to decide left vs. right on your way to dinner.',
      'Order one shared item at three completely different neighborhood spots.',
      'Park in a high-elevation scenic spot to eat dessert and listen to your couple soundtrack.'
    ],
    conversationStarters: [
      'If we could pack a single bag right now and board a flight to anywhere, where are we landing?',
      'What was the most spontaneous thing you’ve ever done in your life?'
    ],
    romanticTouches: [
      'Curate a secret playlist of songs that carry special inside jokes or memories from your dating days.',
      'Steal a quick kiss at every red traffic light you stop at.'
    ],
    playlistTheme: 'Upbeat Road Trip Anthems & Sunset Dream Pop'
  },
  {
    vibeCategory: 'adventure',
    title: 'Flashlight Thrift Store Challenge & Runway Show',
    tagline: 'Hunt for wild vintage gems and host a hysterical living room fashion runway.',
    estimatedTime: '2.5 hours',
    cost: '$10 - $15',
    location: 'Local Thrift Shop & Living Room',
    description: 'Head to a local vintage or thrift store with a $10 budget each. Pick out the funniest, most eccentric, or most glamorous outfit for each other, then model them at home.',
    steps: [
      'Spend 30 minutes in a thrift shop finding an outfit for your partner without them looking.',
      'Return home, turn on disco lights, and walk down the living room runway with full theatrical flair.',
      'Take goofy instant photos and vote on the best look of the night.'
    ],
    conversationStarters: [
      'Which fashion era do you think our relationship naturally belongs in?',
      'What is the funniest style phase you ever went through in your teenage years?'
    ],
    romanticTouches: [
      'Introduce your partner on the runway like an haute couture supermodel with excessive praise.',
      'Save the funniest photo as your partner’s custom contact wallpaper.'
    ],
    playlistTheme: 'Funky Disco & Retro 80s Dance Pop'
  },

  // ZERO BUDGET / THOUGHTFUL DIY
  {
    vibeCategory: 'budget',
    title: 'Living Room Sunset Picnic & Audio Time Machine',
    tagline: 'Pure romance and memory sharing that costs zero dollars.',
    estimatedTime: '2 hours',
    cost: '$0 (Pantry Favorites)',
    location: 'Living Room / Balcony Floor',
    description: 'Spread a checked sheet or quilt on the floor. Plate whatever cheese, fruits, crackers, and snacks are in your pantry into an elegant charcuterie board.',
    steps: [
      'Plate everyday pantry snacks with artistic presentation on wooden boards or fine china.',
      'Open your phone photo albums to the exact month you first started dating and scroll back through old pictures.',
      'Share stories about what you were secretly thinking during those early days.'
    ],
    conversationStarters: [
      'What was your very first impression of me the first day we met?',
      'What is something I did in our first few dates that completely charmed you?'
    ],
    romanticTouches: [
      'Play the exact song that was playing during your first slow dance or road trip.',
      'Write a 1-sentence note of gratitude on a napkin and hide it under their plate.'
    ],
    playlistTheme: 'Warm Folk Duets & Nostalgic Acoustic Ballads'
  },
  {
    vibeCategory: 'budget',
    title: 'Couple Sanctuary Game Night & Truth Or Dare Extravaganza',
    tagline: 'High energy, playful rivalry, and zero expenses.',
    estimatedTime: '1.5 - 2 hours',
    cost: 'Free',
    location: 'Living Room / Coffee Table',
    description: 'Settle in for an epic tournament of competitive mini-games, truth or dare revelations, and scribble drawing rounds where the loser gives the winner a 10-minute foot rub.',
    steps: [
      'Set up your favorite board games, card decks, or play the interactive Sanctuary Games Hub.',
      'Declare custom romantic stakes: winner gets breakfast in bed, loser does tomorrow’s dishes.',
      'Celebrate every round with celebratory high-fives and silly victory dances.'
    ],
    conversationStarters: [
      'What is one playful dare you’ve always wanted to challenge me to do?',
      'Who in this relationship is genuinely the more competitive gamer?'
    ],
    romanticTouches: [
      'Surprise your partner with a homemade victory trophy made out of foil and cardboard.',
      'Give the runner-up a warm consolation hug and sweet treat.'
    ],
    playlistTheme: 'Lo-Fi Chillhop & Playful Indie Beats'
  }
];

export function generateRomanticDateNight(options: GenerateOptions = {}): DateNightIdea {
  const { vibe, partner1Name, partner2Name, customNote } = options;

  let categoryKey: IdeaTemplate['vibeCategory'] = 'surprise';
  const vLower = (vibe || '').toLowerCase();

  if (vLower.includes('cozy') || vLower.includes('home') || vLower.includes('indoor')) {
    categoryKey = 'cozy';
  } else if (vLower.includes('romantic') || vLower.includes('deep') || vLower.includes('intimate')) {
    categoryKey = 'romantic';
  } else if (vLower.includes('creative') || vLower.includes('art') || vLower.includes('cook')) {
    categoryKey = 'creative';
  } else if (vLower.includes('adventure') || vLower.includes('outdoor') || vLower.includes('explore')) {
    categoryKey = 'adventure';
  } else if (vLower.includes('budget') || vLower.includes('free') || vLower.includes('zero')) {
    categoryKey = 'budget';
  }

  let matchingTemplates = IDEA_TEMPLATES.filter(t => categoryKey === 'surprise' || t.vibeCategory === categoryKey);
  if (matchingTemplates.length === 0) {
    matchingTemplates = IDEA_TEMPLATES;
  }

  const selected = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)];
  const starter = selected.conversationStarters[Math.floor(Math.random() * selected.conversationStarters.length)];
  const touch = selected.romanticTouches[Math.floor(Math.random() * selected.romanticTouches.length)];

  const p1 = partner1Name || 'You';
  const p2 = partner2Name || 'your partner';

  return {
    title: selected.title,
    category: selected.vibeCategory.charAt(0).toUpperCase() + selected.vibeCategory.slice(1),
    tagline: selected.tagline,
    estimatedTime: selected.estimatedTime,
    cost: selected.cost,
    location: selected.location,
    vibe: vibe || selected.vibeCategory,
    description: selected.description.replace(/your partner/g, p2),
    steps: selected.steps.map(s => s.replace(/your partner/g, p2)),
    conversationStarter: starter,
    romanticTouch: touch.replace(/your partner/g, p2),
    playlistTheme: selected.playlistTheme
  };
}
