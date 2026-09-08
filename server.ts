import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  UserProfile,
  Couple,
  ChatMessage,
  Book,
  ReadingProgress,
  Bookmark,
  PhotoMemory,
  PhotoAlbum,
  CycleLog,
  CycleSettings,
  CyclePartnerSummary,
  GameSession,
  GameStats,
  CoupleStats,
  AppNotification,
  Achievement,
  DateNightIdea,
  GamePrompt,
  GameType,
  GameMove
} from './src/types';
import { generateRomanticDateNight } from './src/lib/dateNightCatalog';

// In-Memory & Persistent Storage Database Interface
interface AppDatabase {
  users: UserProfile[];
  couples: Couple[];
  messages: ChatMessage[];
  books: Book[];
  readingProgress: ReadingProgress[];
  bookmarks: Bookmark[];
  photos: PhotoMemory[];
  albums: PhotoAlbum[];
  cycleLogs: CycleLog[];
  cycleSettings: CycleSettings[];
  gamePrompts: GamePrompt[];
  gameSessions: GameSession[];
  gameMoves: GameMove[];
  notifications: AppNotification[];
  achievements: Achievement[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Built-in initial game prompts table population for standard couple game play
const DEFAULT_GAME_PROMPTS: GamePrompt[] = [
  // Truth or Dare (Romantic, Deep, Playful, Spicy)
  {
    id: 'tod-r-t1',
    gameType: 'truth_or_dare',
    category: 'romantic',
    prompt: 'What was the exact moment you realized you were falling in love with me?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-r-t2',
    gameType: 'truth_or_dare',
    category: 'romantic',
    prompt: 'What is your favorite quiet memory of us just existing together?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-r-t3',
    gameType: 'truth_or_dare',
    category: 'romantic',
    prompt: 'What is something small I do that always gives you butterflies?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-r-d1',
    gameType: 'truth_or_dare',
    category: 'romantic',
    prompt: 'Look into my eyes for 60 seconds without speaking or looking away.',
    extraData: { type: 'dare' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-r-d2',
    gameType: 'truth_or_dare',
    category: 'romantic',
    prompt: 'Give me a gentle 3-minute shoulder or neck massage right now.',
    extraData: { type: 'dare' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-d-t1',
    gameType: 'truth_or_dare',
    category: 'deep',
    prompt: 'What is something you are currently working on within yourself that you need my patience with?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-d-t2',
    gameType: 'truth_or_dare',
    category: 'deep',
    prompt: 'What does our future look like when you imagine us 10 years from now?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-d-d1',
    gameType: 'truth_or_dare',
    category: 'deep',
    prompt: 'Hold my hands and tell me one thing you admire about the way I handle adversity.',
    extraData: { type: 'dare' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-p-t1',
    gameType: 'truth_or_dare',
    category: 'playful',
    prompt: 'If our relationship was a sitcom or romantic comedy, what would its title be?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-p-d1',
    gameType: 'truth_or_dare',
    category: 'playful',
    prompt: 'Do your best dramatic impression of how I talk when I am sleepy.',
    extraData: { type: 'dare' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-s-t1',
    gameType: 'truth_or_dare',
    category: 'spicy',
    prompt: 'What outfit of mine is your absolute weakness?',
    extraData: { type: 'truth' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'tod-s-d1',
    gameType: 'truth_or_dare',
    category: 'spicy',
    prompt: 'Give me a kiss on 3 different places: cheek, forehead, and collarbone.',
    extraData: { type: 'dare' },
    active: true,
    createdAt: new Date().toISOString()
  },

  // Would You Rather
  {
    id: 'wyr-1',
    gameType: 'would_you_rather',
    category: 'Travel & Lifestyle',
    prompt: 'Spend a cozy week in a rainy cabin in the mountains with a fireplace OR Spend a sunny week in a private beachfront villa listening to ocean waves',
    extraData: {
      optionA: 'Spend a cozy week in a rainy mountain cabin with a fireplace',
      optionB: 'Spend a sunny week in a beachfront villa with ocean waves'
    },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'wyr-2',
    gameType: 'would_you_rather',
    category: 'Daily Romance',
    prompt: 'Have breakfast in bed cooked by your partner every weekend OR Have an evening candlelit foot massage from your partner every Sunday',
    extraData: {
      optionA: 'Have breakfast in bed cooked by your partner every weekend',
      optionB: 'Have an evening candlelit foot massage every Sunday'
    },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'wyr-3',
    gameType: 'would_you_rather',
    category: 'Memories & Future',
    prompt: 'Relive our very first date with all the exact initial butterflies OR Fast forward 20 years for 1 hour to see our future together',
    extraData: {
      optionA: 'Relive our very first date with all the exact initial butterflies',
      optionB: 'Fast forward 20 years for 1 hour to see our future together'
    },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'wyr-4',
    gameType: 'would_you_rather',
    category: 'Adventure',
    prompt: 'Take an unplanned cross-country road trip with no map OR Book a luxury 5-star surprise trip planned entirely by your partner',
    extraData: {
      optionA: 'Take an unplanned cross-country road trip with no map',
      optionB: 'Book a luxury 5-star surprise trip planned entirely by your partner'
    },
    active: true,
    createdAt: new Date().toISOString()
  },

  // Never Have I Ever
  {
    id: 'nhie-1',
    gameType: 'never_have_i_ever',
    category: 'Confessions',
    prompt: 'Never have I ever pretended to be asleep just so you would cuddle me closer.',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'nhie-2',
    gameType: 'never_have_i_ever',
    category: 'Confessions',
    prompt: 'Never have I ever re-read our old text messages and smiled like an idiot.',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'nhie-3',
    gameType: 'never_have_i_ever',
    category: 'Confessions',
    prompt: 'Never have I ever bought something just because it reminded me of you.',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'nhie-4',
    gameType: 'never_have_i_ever',
    category: 'Confessions',
    prompt: 'Never have I ever daydreamed about our wedding or future home during work.',
    active: true,
    createdAt: new Date().toISOString()
  },

  // Hangman Words
  {
    id: 'hm-1',
    gameType: 'hangman',
    category: 'Romantic Dates',
    prompt: 'SUNSET',
    extraData: { word: 'SUNSET', hint: 'Golden hour beauty we love watching together' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'hm-2',
    gameType: 'hangman',
    category: 'Night Activities',
    prompt: 'STARGAZING',
    extraData: { word: 'STARGAZING', hint: 'Looking up into the quiet infinite night' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'hm-3',
    gameType: 'hangman',
    category: 'Atmosphere',
    prompt: 'CANDLELIGHT',
    extraData: { word: 'CANDLELIGHT', hint: 'Warm flickering glow for dinner' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'hm-4',
    gameType: 'hangman',
    category: 'Our Sanctuary',
    prompt: 'SANCTUARY',
    extraData: { word: 'SANCTUARY', hint: 'A private peaceful haven safe from the world' },
    active: true,
    createdAt: new Date().toISOString()
  },

  // Emoji Puzzles
  {
    id: 'ep-1',
    gameType: 'emoji_guess',
    category: 'Famous Romantic Movie',
    prompt: 'Titanic',
    extraData: { emojis: '🎬 🚢 ❄️ 💔 🚪', answer: 'Titanic', hint: 'Jack and Rose on the unsinkable ship' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ep-2',
    gameType: 'emoji_guess',
    category: 'Couple Aesthetic & Vibe',
    prompt: 'Cozy Rainy Day',
    extraData: { emojis: '☕ 🌧️ 📖 🕯️ 🧦', answer: 'Cozy Rainy Day', hint: 'Warm drinks, books, and soft blankets while it pours' },
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ep-3',
    gameType: 'emoji_guess',
    category: 'Dream Vacation',
    prompt: 'Paris Trip',
    extraData: { emojis: '✈️ 🗼 🥐 🍷 🎨', answer: 'Paris Trip', hint: 'City of lights, croissants, and the Eiffel Tower' },
    active: true,
    createdAt: new Date().toISOString()
  },

  // Memory Match Symbols
  {
    id: 'mm-1',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '💌',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-2',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '🌹',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-3',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '🥂',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-4',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '💍',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-5',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '🧸',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-6',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '🌅',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-7',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '🏕️',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mm-8',
    gameType: 'memory_match',
    category: 'symbols',
    prompt: '🍰',
    active: true,
    createdAt: new Date().toISOString()
  },

  // Daily Reflection Prompts
  {
    id: 'dr-1',
    gameType: 'daily_reflection',
    category: 'daily',
    prompt: 'What was one moment today where you felt deeply appreciated or thought of?',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'dr-2',
    gameType: 'daily_reflection',
    category: 'daily',
    prompt: 'What is one small thing I did recently that made you smile?',
    active: true,
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-first-message',
    title: 'First Whisper',
    description: 'Send your very first message in our private couple chat',
    icon: 'MessageHeart',
    category: 'chat',
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'ach-first-memory',
    title: 'Memory Maker',
    description: 'Upload your first shared photo to our memory vault',
    icon: 'Camera',
    category: 'memories',
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'ach-game-night',
    title: 'Playful Hearts',
    description: 'Play your first couple game together',
    icon: 'Gamepad2',
    category: 'games',
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'ach-bookworm',
    title: 'Reading Partners',
    description: 'Open a shared book and leave a partner bookmark',
    icon: 'BookmarkCheck',
    category: 'reading',
    progress: 0,
    maxProgress: 1
  },
  {
    id: 'ach-7-day-streak',
    title: 'Weekly Devotion',
    description: 'Maintain a 7-day connection streak in My Space',
    icon: 'Flame',
    category: 'relationship',
    progress: 0,
    maxProgress: 7
  }
];

const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'user-liam-01',
    email: 'liam@myspace.love',
    displayName: 'Liam',
    username: 'liam',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    timezone: 'UTC',
    coupleId: 'couple-space-01',
    role: 'creator',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString()
  },
  {
    id: 'user-olivia-02',
    email: 'olivia@myspace.love',
    displayName: 'Olivia',
    username: 'olivia',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    timezone: 'UTC',
    coupleId: 'couple-space-01',
    role: 'partner',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString()
  }
];

const DEFAULT_COUPLES: Couple[] = [
  {
    id: 'couple-space-01',
    inviteCode: 'LOVE-777-MYSPACE',
    inviteExpiresAt: '2030-01-01T00:00:00.000Z',
    relationshipStartDate: '2023-04-14T00:00:00.000Z',
    members: DEFAULT_USERS,
    createdAt: '2023-04-14T00:00:00.000Z',
    updatedAt: '2023-04-14T00:00:00.000Z'
  }
];

const DEFAULT_CYCLE_SETTINGS: CycleSettings[] = [
  {
    userId: 'user-olivia-02',
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    partnerSharingLevel: 'full',
    sharedSymptoms: ['cramps', 'fatigue', 'mood changes'],
    showSupportCards: true
  }
];

function initializeDefaultDatabase(): AppDatabase {
  return {
    users: DEFAULT_USERS,
    couples: DEFAULT_COUPLES,
    messages: [],
    books: [],
    readingProgress: [],
    bookmarks: [],
    photos: [],
    albums: [],
    cycleLogs: [],
    cycleSettings: DEFAULT_CYCLE_SETTINGS,
    gamePrompts: DEFAULT_GAME_PROMPTS,
    gameSessions: [],
    gameMoves: [],
    notifications: [],
    achievements: DEFAULT_ACHIEVEMENTS
  };
}

let db: AppDatabase;

function loadDatabase(): AppDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed: AppDatabase = JSON.parse(data);

      const loadedUsers = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS;
      const loadedCouples = Array.isArray(parsed.couples) && parsed.couples.length > 0 ? parsed.couples : DEFAULT_COUPLES;

      const cleanDb: AppDatabase = {
        users: loadedUsers,
        couples: loadedCouples,
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        books: Array.isArray(parsed.books) ? parsed.books : [],
        readingProgress: Array.isArray(parsed.readingProgress) ? parsed.readingProgress : [],
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
        photos: Array.isArray(parsed.photos) ? parsed.photos : [],
        albums: Array.isArray(parsed.albums) ? parsed.albums : [],
        cycleLogs: Array.isArray(parsed.cycleLogs) ? parsed.cycleLogs : [],
        cycleSettings: Array.isArray(parsed.cycleSettings) && parsed.cycleSettings.length > 0 ? parsed.cycleSettings : DEFAULT_CYCLE_SETTINGS,
        gamePrompts: Array.isArray(parsed.gamePrompts) && parsed.gamePrompts.length > 0 ? parsed.gamePrompts : DEFAULT_GAME_PROMPTS,
        gameSessions: Array.isArray(parsed.gameSessions) ? parsed.gameSessions : [],
        gameMoves: Array.isArray(parsed.gameMoves) ? parsed.gameMoves : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        achievements: Array.isArray(parsed.achievements) && parsed.achievements.length > 0 ? parsed.achievements : DEFAULT_ACHIEVEMENTS
      };
      saveDatabase(cleanDb);
      return cleanDb;
    }
  } catch (err) {
    console.error('Failed to read db.json, reinitializing database...', err);
  }
  const initial = initializeDefaultDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(data: AppDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db.json:', err);
  }
}

db = loadDatabase();

// Realtime SSE Subscriptions Map: coupleId -> Set of express.Response
const sseClients = new Map<string, Set<express.Response>>();

function broadcastToCouple(coupleId: string, eventType: string, payload: any) {
  const clients = sseClients.get(coupleId);
  if (!clients || clients.size === 0) return;
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(res => {
    try {
      res.write(message);
    } catch (e) {
      // client connection closed
    }
  });
}

// Helpers for cycle calculations
function computePartnerCycleSummary(settings: CycleSettings | undefined, logs: CycleLog[]): CyclePartnerSummary | null {
  if (!settings || !settings.lastPeriodStartDate) {
    return null;
  }

  const cycleLength = settings.cycleLengthDays || 28;
  const periodLength = settings.periodLengthDays || 5;
  const lastStart = new Date(settings.lastPeriodStartDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
  const cycleDay = Math.max(1, (diffDays % cycleLength) + 1);
  const daysLeft = cycleLength - cycleDay + 1;

  const nextPeriod = new Date(lastStart.getTime() + Math.ceil(diffDays / cycleLength) * cycleLength * 86400000);

  let phase: any = 'follicular';
  let phaseDisplayName = 'Follicular (Rising Energy)';
  let supportTips: string[] = ['Plan an exciting date or try something new together.'];

  if (cycleDay <= periodLength) {
    phase = 'menstrual';
    phaseDisplayName = 'Menstrual (Rest & Nurture)';
    supportTips = ['Bring a warm beverage, heated blanket, or gentle back rub.', 'Keep evening plans relaxed and pressure-free.'];
  } else if (cycleDay >= 12 && cycleDay <= 16) {
    phase = 'ovulation';
    phaseDisplayName = 'Ovulation (Peak Connection)';
    supportTips = ['High romantic energy; great for deep conversations and date nights.'];
  } else if (cycleDay > 16) {
    phase = 'luteal';
    phaseDisplayName = 'Luteal (Cozy Comfort)';
    supportTips = ['Offer extra hugs, reassurance, and favorite comfort snacks.'];
  }

  const todayStr = now.toISOString().split('T')[0];
  const todayLog = logs.find(l => l.date === todayStr);

  return {
    phase,
    phaseDisplayName,
    cycleDay,
    nextPeriodEstimateDate: nextPeriod.toISOString().split('T')[0],
    daysUntilNextPeriod: Math.max(0, daysLeft),
    reportedMoods: todayLog?.moods || [],
    reportedSymptoms: todayLog?.symptoms ? todayLog.symptoms.filter(s => settings.sharedSymptoms.includes(s)) : [],
    energyLevel: todayLog?.energyLevel || 3,
    supportTips,
    canViewFull: settings.partnerSharingLevel === 'full'
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Realtime Server-Sent Events (SSE) route
  app.get('/api/realtime/:coupleId', (req, res) => {
    const { coupleId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(coupleId)) {
      sseClients.set(coupleId, new Set());
    }
    sseClients.get(coupleId)!.add(res);

    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to realtime couple channel', coupleId })}\n\n`);

    req.on('close', () => {
      const set = sseClients.get(coupleId);
      if (set) {
        set.delete(res);
        if (set.size === 0) sseClients.delete(coupleId);
      }
    });
  });

  // Client broadcast route for instant couple-wide events (games, canvas, typing, reactions)
  app.post('/api/realtime/:coupleId/broadcast', (req, res) => {
    const { coupleId } = req.params;
    const { event, payload } = req.body;
    if (!event) return res.status(400).json({ error: 'event is required' });
    broadcastToCouple(coupleId, event, payload);
    res.json({ success: true });
  });

  // --- AUTH & PROFILE ---
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      // Create user profile on first login/sign in
      const defaultName = email.split('@')[0];
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        email: email.toLowerCase().trim(),
        displayName: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
        username: defaultName.toLowerCase(),
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
        timezone: 'UTC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(user);
      saveDatabase(db);
    }

    const couple = user.coupleId ? db.couples.find(c => c.id === user.coupleId) || null : null;
    res.json({ user, couple });
  });

  app.post('/api/auth/register', (req, res) => {
    const { email, displayName, username, avatarUrl, dateOfBirth, timezone } = req.body;
    if (!email || !displayName) return res.status(400).json({ error: 'Email and display name are required' });

    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (user) {
      user.displayName = displayName;
      if (username) user.username = username;
      if (avatarUrl) user.avatarUrl = avatarUrl;
      if (dateOfBirth) user.dateOfBirth = dateOfBirth;
      if (timezone) user.timezone = timezone;
      user.updatedAt = new Date().toISOString();
    } else {
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        email: email.toLowerCase().trim(),
        displayName,
        username: username || displayName.toLowerCase().replace(/\s+/g, ''),
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        dateOfBirth,
        timezone: timezone || 'UTC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(user);
    }
    saveDatabase(db);

    const couple = user.coupleId ? db.couples.find(c => c.id === user.coupleId) || null : null;
    res.json({ user, couple });
  });

  app.put('/api/auth/profile', (req, res) => {
    const { userId, displayName, username, avatarUrl, dateOfBirth, timezone } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (displayName) user.displayName = displayName;
    if (username) user.username = username;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (timezone) user.timezone = timezone;
    user.updatedAt = new Date().toISOString();

    saveDatabase(db);
    if (user.coupleId) {
      broadcastToCouple(user.coupleId, 'couple_updated', { user });
    }
    res.json({ user });
  });

  app.get('/api/auth/profiles', (req, res) => {
    res.json(db.users);
  });

  app.get('/api/auth/all-demo-users', (req, res) => {
    res.json(db.users);
  });

  // --- COUPLE SANCTUARY MANAGEMENT ---
  app.post('/api/couples/create', (req, res) => {
    const { userId, relationshipStartDate } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inviteCode = 'US-';
    for (let i = 0; i < 6; i++) {
      inviteCode += codeChars.charAt(Math.floor(Math.random() * codeChars.length));
    }

    const newCouple: Couple = {
      id: `couple-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      inviteCode,
      inviteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      relationshipStartDate: relationshipStartDate || new Date().toISOString().split('T')[0],
      members: [user],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    user.coupleId = newCouple.id;
    user.role = 'creator';
    db.couples.push(newCouple);
    saveDatabase(db);

    res.json({ couple: newCouple, user });
  });

  app.post('/api/couples/join', (req, res) => {
    const { userId, inviteCode } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cleanCode = (inviteCode || '').trim().toUpperCase();
    const targetCouple = db.couples.find(c => c.inviteCode === cleanCode);
    if (!targetCouple) return res.status(404).json({ error: 'Invalid or expired invite code' });

    if (targetCouple.members.length >= 2 && !targetCouple.members.some(m => m.id === user.id)) {
      return res.status(400).json({ error: 'This couple sanctuary is already full (maximum 2 partners).' });
    }

    if (!targetCouple.members.some(m => m.id === user.id)) {
      user.coupleId = targetCouple.id;
      user.role = 'partner';
      targetCouple.members.push(user);
      targetCouple.updatedAt = new Date().toISOString();
      saveDatabase(db);
      broadcastToCouple(targetCouple.id, 'couple_linked', { couple: targetCouple, partner: user });
    }

    res.json({ couple: targetCouple, user });
  });

  app.get('/api/couples/:id', (req, res) => {
    const { id } = req.params;
    const couple = db.couples.find(c => c.id === id);
    if (!couple) return res.status(404).json({ error: 'Couple not found' });
    couple.members = db.users.filter(u => u.coupleId === couple.id);
    res.json({ couple });
  });

  app.put('/api/couples/:id', (req, res) => {
    const { id } = req.params;
    const { relationshipStartDate } = req.body;
    const couple = db.couples.find(c => c.id === id);
    if (!couple) return res.status(404).json({ error: 'Couple not found' });

    if (relationshipStartDate) couple.relationshipStartDate = relationshipStartDate;
    couple.updatedAt = new Date().toISOString();
    saveDatabase(db);
    broadcastToCouple(couple.id, 'couple_updated', { couple });
    res.json({ couple });
  });

  // --- LOVE NUDGE ---
  app.post('/api/couples/nudge', (req, res) => {
    const { coupleId, senderId, senderName, text } = req.body;
    if (!coupleId) return res.status(400).json({ error: 'coupleId is required' });
    const couple = db.couples.find(c => c.id === coupleId);
    if (!couple) return res.status(404).json({ error: 'Couple not found' });

    const user = db.users.find(u => u.id === senderId);
    const name = senderName || user?.displayName || 'Your partner';
    const nudgeText = text || 'is sending you a warm loving embrace ❤️';

    broadcastToCouple(coupleId, 'user_nudge', {
      senderId,
      senderName: name,
      text: nudgeText,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, senderName: name, text: nudgeText });
  });

  // --- CHAT MESSAGES ---
  app.get('/api/chat/messages', (req, res) => {
    const { coupleId } = req.query;
    if (!coupleId) return res.status(400).json({ error: 'coupleId is required' });
    const coupleMessages = db.messages.filter(m => m.coupleId === coupleId);
    res.json(coupleMessages);
  });

  app.post('/api/chat/messages', (req, res) => {
    const { coupleId, senderId, senderName, senderAvatar, text, mediaUrl, mediaType, replyToId, replyToText } = req.body;
    if (!coupleId || !senderId || (!text && !mediaUrl)) {
      return res.status(400).json({ error: 'coupleId, senderId and message text or media required' });
    }

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      coupleId,
      senderId,
      senderName: senderName || 'Partner',
      senderAvatar,
      text: text || '',
      mediaUrl,
      mediaType,
      replyToId,
      replyToText,
      reactions: {},
      isRead: false,
      createdAt: new Date().toISOString()
    };

    db.messages.push(newMessage);
    saveDatabase(db);

    broadcastToCouple(coupleId, 'chat_message', newMessage);
    res.json(newMessage);
  });

  app.post('/api/chat/messages/react', (req, res) => {
    const { messageId, userId, emoji } = req.body;
    const msg = db.messages.find(m => m.id === messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const existingIdx = msg.reactions[emoji].indexOf(userId);
    if (existingIdx >= 0) {
      msg.reactions[emoji].splice(existingIdx, 1);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(userId);
    }
    msg.updatedAt = new Date().toISOString();
    saveDatabase(db);

    broadcastToCouple(msg.coupleId, 'chat_reaction', msg);
    res.json(msg);
  });

  app.delete('/api/chat/messages/:id', (req, res) => {
    const { id } = req.params;
    const index = db.messages.findIndex(m => m.id === id);
    if (index === -1) return res.status(404).json({ error: 'Message not found' });

    const [deleted] = db.messages.splice(index, 1);
    saveDatabase(db);
    broadcastToCouple(deleted.coupleId, 'chat_deleted', { id });
    res.json({ success: true, id });
  });

  app.post('/api/chat/typing', (req, res) => {
    const { coupleId, userId, isTyping } = req.body;
    broadcastToCouple(coupleId, 'chat_typing', { userId, isTyping });
    res.json({ success: true });
  });

  // --- LIBRARY & READING PROGRESS ---
  app.get('/api/books', (req, res) => {
    const { coupleId } = req.query;
    if (!coupleId) return res.json(db.books);
    const coupleBooks = db.books.filter(b => b.coupleId === coupleId);
    res.json(coupleBooks);
  });

  app.post('/api/books', (req, res) => {
    const { coupleId, title, author, coverUrl, description, category, totalPages, content, uploadedBy, uploaderName } = req.body;
    if (!coupleId || !title || !author) {
      return res.status(400).json({ error: 'coupleId, title, and author are required' });
    }

    const newBook: Book = {
      id: `book-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      coupleId,
      title,
      author,
      coverUrl: coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
      description: description || '',
      category: category || 'Literature',
      totalPages: totalPages || (Array.isArray(content) ? content.length : 1),
      content: Array.isArray(content) ? content : (content ? [content] : ['Chapter 1\n\nWelcome to your shared book.']),
      uploadedBy: uploadedBy || 'user',
      uploaderName: uploaderName || 'Partner',
      createdAt: new Date().toISOString()
    };

    db.books.push(newBook);
    saveDatabase(db);
    broadcastToCouple(coupleId, 'book_added', newBook);
    res.json(newBook);
  });

  app.get('/api/books/progress', (req, res) => {
    const { bookId, userId } = req.query;
    if (bookId && userId) {
      const prog = db.readingProgress.find(p => p.bookId === bookId && p.userId === userId);
      return res.json(prog || null);
    }
    if (userId) {
      return res.json(db.readingProgress.filter(p => p.userId === userId));
    }
    res.json(db.readingProgress);
  });

  app.post('/api/books/progress', (req, res) => {
    const { bookId, userId, currentPage, totalPages, readingTimeMinutes } = req.body;
    if (!bookId || !userId) return res.status(400).json({ error: 'bookId and userId are required' });

    let prog = db.readingProgress.find(p => p.bookId === bookId && p.userId === userId);
    const pages = totalPages || 1;
    const current = Math.min(pages, Math.max(1, currentPage || 1));
    const percentage = Math.round((current / pages) * 100);
    const isFinished = current >= pages;

    if (prog) {
      prog.currentPage = current;
      prog.percentage = percentage;
      prog.isFinished = isFinished;
      if (readingTimeMinutes) prog.readingTimeMinutes += readingTimeMinutes;
      prog.lastReadAt = new Date().toISOString();
    } else {
      prog = {
        bookId,
        userId,
        currentPage: current,
        percentage,
        readingTimeMinutes: readingTimeMinutes || 5,
        isFinished,
        lastReadAt: new Date().toISOString()
      };
      db.readingProgress.push(prog);
    }

    saveDatabase(db);

    const book = db.books.find(b => b.id === bookId);
    if (book) {
      broadcastToCouple(book.coupleId, 'reading_progress_updated', prog);
    }
    res.json(prog);
  });

  app.get('/api/books/bookmarks', (req, res) => {
    const { bookId, coupleId } = req.query;
    if (bookId) {
      return res.json(db.bookmarks.filter(b => b.bookId === bookId));
    }
    res.json(db.bookmarks);
  });

  app.post('/api/books/bookmarks', (req, res) => {
    const { bookId, userId, userName, pageNumber, chapterTitle, note, isShared } = req.body;
    if (!bookId || !userId || pageNumber === undefined) {
      return res.status(400).json({ error: 'bookId, userId, and pageNumber are required' });
    }

    const newBookmark: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      bookId,
      userId,
      userName: userName || 'Partner',
      pageNumber,
      chapterTitle: chapterTitle || `Page ${pageNumber}`,
      note: note || '',
      isShared: isShared !== false,
      createdAt: new Date().toISOString()
    };

    db.bookmarks.push(newBookmark);
    saveDatabase(db);

    const book = db.books.find(b => b.id === bookId);
    if (book) {
      broadcastToCouple(book.coupleId, 'bookmark_added', newBookmark);
    }
    res.json(newBookmark);
  });

  app.delete('/api/books/bookmarks/:id', (req, res) => {
    const { id } = req.params;
    const idx = db.bookmarks.findIndex(b => b.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Bookmark not found' });
    db.bookmarks.splice(idx, 1);
    saveDatabase(db);
    res.json({ success: true, id });
  });

  // --- MEMORIES / PHOTOS ---
  app.get('/api/photos', (req, res) => {
    const { coupleId } = req.query;
    if (!coupleId) return res.json(db.photos);
    const couplePhotos = db.photos.filter(p => p.coupleId === coupleId);
    res.json(couplePhotos);
  });

  app.post('/api/photos', (req, res) => {
    const { coupleId, uploaderId, uploaderName, imageUrl, thumbnailUrl, caption, albumId, albumName, memoryDate } = req.body;
    if (!coupleId || !imageUrl) return res.status(400).json({ error: 'coupleId and imageUrl are required' });

    const newPhoto: PhotoMemory = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      coupleId,
      uploaderId: uploaderId || 'user',
      uploaderName: uploaderName || 'Partner',
      imageUrl,
      thumbnailUrl: thumbnailUrl || imageUrl,
      caption: caption || '',
      albumId: albumId || 'general',
      albumName: albumName || 'General',
      memoryDate: memoryDate || new Date().toISOString().split('T')[0],
      isFavorite: false,
      reactions: {},
      comments: [],
      createdAt: new Date().toISOString()
    };

    db.photos.unshift(newPhoto);
    saveDatabase(db);
    broadcastToCouple(coupleId, 'photo_added', newPhoto);
    res.json(newPhoto);
  });

  app.post('/api/photos/react', (req, res) => {
    const { photoId, userId, emoji } = req.body;
    const photo = db.photos.find(p => p.id === photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    if (!photo.reactions) photo.reactions = {};
    if (!photo.reactions[emoji]) photo.reactions[emoji] = [];

    const idx = photo.reactions[emoji].indexOf(userId);
    if (idx >= 0) {
      photo.reactions[emoji].splice(idx, 1);
      if (photo.reactions[emoji].length === 0) delete photo.reactions[emoji];
    } else {
      photo.reactions[emoji].push(userId);
    }
    saveDatabase(db);
    broadcastToCouple(photo.coupleId, 'photo_reacted', photo);
    res.json(photo);
  });

  app.post('/api/photos/comment', (req, res) => {
    const { photoId, userId, userName, userAvatar, text } = req.body;
    const photo = db.photos.find(p => p.id === photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      userName: userName || 'Partner',
      userAvatar,
      text,
      createdAt: new Date().toISOString()
    };

    photo.comments.push(comment);
    saveDatabase(db);
    broadcastToCouple(photo.coupleId, 'photo_commented', { photoId, comment });
    res.json(photo);
  });

  app.get('/api/photos/albums', (req, res) => {
    const { coupleId } = req.query;
    if (!coupleId) return res.json(db.albums);
    const coupleAlbums = db.albums.filter(a => a.coupleId === coupleId);
    res.json(coupleAlbums);
  });

  app.post('/api/photos/albums', (req, res) => {
    const { coupleId, name, description, coverUrl } = req.body;
    if (!coupleId || !name) return res.status(400).json({ error: 'coupleId and name required' });

    const newAlbum: PhotoAlbum = {
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      coupleId,
      name,
      description: description || '',
      coverUrl,
      photoCount: 0,
      createdAt: new Date().toISOString()
    };

    db.albums.push(newAlbum);
    saveDatabase(db);
    broadcastToCouple(coupleId, 'album_added', newAlbum);
    res.json(newAlbum);
  });

  app.delete('/api/photos/:id', (req, res) => {
    const { id } = req.params;
    const index = db.photos.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Photo not found' });
    const photo = db.photos[index];
    db.photos.splice(index, 1);
    saveDatabase(db);
    broadcastToCouple(photo.coupleId, 'photo_deleted', { photoId: id, id });
    res.json({ success: true, id });
  });

  // --- CYCLE & FLO TRACKER ---
  app.get('/api/cycle/settings', (req, res) => {
    const { userId } = req.query;
    const settings = db.cycleSettings.find(s => s.userId === userId);
    res.json(settings || {
      userId: userId as string,
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '',
      partnerSharingLevel: 'summary',
      sharedSymptoms: ['cramps', 'fatigue', 'headache'],
      showSupportCards: true
    });
  });

  app.put('/api/cycle/settings', (req, res) => {
    const { userId, cycleLengthDays, periodLengthDays, lastPeriodStartDate, partnerSharingLevel, sharedSymptoms, showSupportCards } = req.body;
    let settings = db.cycleSettings.find(s => s.userId === userId);
    if (settings) {
      if (cycleLengthDays !== undefined) settings.cycleLengthDays = cycleLengthDays;
      if (periodLengthDays !== undefined) settings.periodLengthDays = periodLengthDays;
      if (lastPeriodStartDate !== undefined) settings.lastPeriodStartDate = lastPeriodStartDate;
      if (partnerSharingLevel !== undefined) settings.partnerSharingLevel = partnerSharingLevel;
      if (sharedSymptoms !== undefined) settings.sharedSymptoms = sharedSymptoms;
      if (showSupportCards !== undefined) settings.showSupportCards = showSupportCards;
    } else {
      settings = {
        userId,
        cycleLengthDays: cycleLengthDays || 28,
        periodLengthDays: periodLengthDays || 5,
        lastPeriodStartDate: lastPeriodStartDate || '',
        partnerSharingLevel: partnerSharingLevel || 'summary',
        sharedSymptoms: sharedSymptoms || ['cramps', 'fatigue', 'headache'],
        showSupportCards: showSupportCards !== false
      };
      db.cycleSettings.push(settings);
    }
    saveDatabase(db);

    const user = db.users.find(u => u.id === userId);
    if (user && user.coupleId) {
      const summary = computePartnerCycleSummary(settings, db.cycleLogs.filter(l => l.userId === userId));
      broadcastToCouple(user.coupleId, 'cycle_updated', { summary, settings });
    }
    res.json(settings);
  });

  app.get('/api/cycle/logs', (req, res) => {
    const { userId } = req.query;
    const userLogs = db.cycleLogs.filter(l => l.userId === userId);
    res.json(userLogs);
  });

  app.post('/api/cycle/logs', (req, res) => {
    const { userId, date, isPeriodStart, isPeriodEnd, flowIntensity, symptoms, moods, energyLevel, sleepHours, cravings, notes } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });

    let log = db.cycleLogs.find(l => l.userId === userId && l.date === date);
    if (log) {
      if (isPeriodStart !== undefined) log.isPeriodStart = isPeriodStart;
      if (isPeriodEnd !== undefined) log.isPeriodEnd = isPeriodEnd;
      if (flowIntensity !== undefined) log.flowIntensity = flowIntensity;
      if (symptoms !== undefined) log.symptoms = symptoms;
      if (moods !== undefined) log.moods = moods;
      if (energyLevel !== undefined) log.energyLevel = energyLevel;
      if (sleepHours !== undefined) log.sleepHours = sleepHours;
      if (cravings !== undefined) log.cravings = cravings;
      if (notes !== undefined) log.notes = notes;
    } else {
      log = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId,
        date,
        isPeriodStart: !!isPeriodStart,
        isPeriodEnd: !!isPeriodEnd,
        flowIntensity: flowIntensity || 'none',
        symptoms: symptoms || [],
        moods: moods || [],
        energyLevel: energyLevel || 3,
        sleepHours: sleepHours || 8,
        cravings: cravings || [],
        notes: notes || '',
        createdAt: new Date().toISOString()
      };
      db.cycleLogs.push(log);
    }

    if (isPeriodStart) {
      let settings = db.cycleSettings.find(s => s.userId === userId);
      if (settings) settings.lastPeriodStartDate = date;
      else {
        db.cycleSettings.push({
          userId,
          cycleLengthDays: 28,
          periodLengthDays: 5,
          lastPeriodStartDate: date,
          partnerSharingLevel: 'summary',
          sharedSymptoms: ['cramps', 'fatigue', 'headache'],
          showSupportCards: true
        });
      }
    }

    saveDatabase(db);

    const user = db.users.find(u => u.id === userId);
    if (user && user.coupleId) {
      const settings = db.cycleSettings.find(s => s.userId === userId);
      const summary = computePartnerCycleSummary(settings, db.cycleLogs.filter(l => l.userId === userId));
      broadcastToCouple(user.coupleId, 'cycle_updated', { summary, log });
    }
    res.json(log);
  });

  app.get('/api/cycle/partner-summary', (req, res) => {
    const { coupleId, userId } = req.query;
    const partner = db.users.find(u => u.coupleId === coupleId && u.id !== userId);
    if (!partner) return res.json(null);

    const partnerSettings = db.cycleSettings.find(s => s.userId === partner.id);
    if (!partnerSettings || partnerSettings.partnerSharingLevel === 'private' || !partnerSettings.lastPeriodStartDate) {
      return res.json(null);
    }

    const partnerLogs = db.cycleLogs.filter(l => l.userId === partner.id);
    const summary = computePartnerCycleSummary(partnerSettings, partnerLogs);
    res.json(summary);
  });

  // --- GAME PROMPTS & REAL SESSIONS ---
  app.get('/api/games/prompts', (req, res) => {
    const { gameType, category } = req.query;
    let prompts = db.gamePrompts.filter(p => p.active);
    if (gameType) {
      prompts = prompts.filter(p => p.gameType === gameType);
    }
    if (category && category !== 'All' && category !== 'all') {
      prompts = prompts.filter(p => p.category.toLowerCase() === (category as string).toLowerCase());
    }
    res.json(prompts);
  });

  app.post('/api/games/prompts', (req, res) => {
    const { gameType, category, prompt, extraData, difficulty } = req.body;
    if (!gameType || !prompt) return res.status(400).json({ error: 'gameType and prompt are required' });

    const newPrompt: GamePrompt = {
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      gameType,
      category: category || 'Romantic',
      prompt,
      extraData: extraData || {},
      difficulty: difficulty || 'all',
      active: true,
      createdAt: new Date().toISOString()
    };

    db.gamePrompts.push(newPrompt);
    saveDatabase(db);
    res.json(newPrompt);
  });

  app.get('/api/games/sessions', (req, res) => {
    const { coupleId, status, gameType } = req.query;
    let sessions = db.gameSessions;
    if (coupleId) {
      sessions = sessions.filter(g => g.coupleId === coupleId);
    }
    if (status) {
      sessions = sessions.filter(g => g.status === status);
    }
    if (gameType) {
      sessions = sessions.filter(g => g.gameType === gameType);
    }
    res.json(sessions);
  });

  app.get('/api/games/sessions/active', (req, res) => {
    const { coupleId } = req.query;
    if (!coupleId) return res.json([]);
    const active = db.gameSessions.filter(g => g.coupleId === coupleId && g.status === 'in_progress');
    res.json(active);
  });

  app.get('/api/games/sessions/:id', (req, res) => {
    const { id } = req.params;
    const session = db.gameSessions.find(g => g.id === id);
    if (!session) return res.status(404).json({ error: 'Game session not found' });
    res.json(session);
  });

  app.post('/api/games/sessions', (req, res) => {
    const {
      coupleId,
      gameType,
      player1Id,
      player1Name,
      player2Id,
      player2Name,
      status,
      currentTurnUserId,
      state,
      winnerUserId,
      score1,
      score2,
      createOrFindActive
    } = req.body;

    if (!coupleId || !gameType || !player1Id) {
      return res.status(400).json({ error: 'coupleId, gameType, and player1Id are required' });
    }

    // If caller wants to reuse an existing in-progress match for this game type
    if (createOrFindActive) {
      const existing = db.gameSessions.find(
        g => g.coupleId === coupleId && g.gameType === gameType && g.status === 'in_progress'
      );
      if (existing) {
        return res.json(existing);
      }
    }

    const newSession: GameSession = {
      id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      coupleId,
      gameType,
      status: status || 'in_progress',
      currentTurnUserId: currentTurnUserId || player1Id,
      player1Id,
      player1Name: player1Name || 'Partner 1',
      player2Id,
      player2Name: player2Name || 'Partner 2',
      score1: score1 || 0,
      score2: score2 || 0,
      winnerUserId,
      state: state || {},
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    db.gameSessions.unshift(newSession);
    saveDatabase(db);
    broadcastToCouple(coupleId, 'game_created', newSession);
    res.json(newSession);
  });

  // Fetch moves for a specific game session
  app.get('/api/games/sessions/:id/moves', (req, res) => {
    const { id } = req.params;
    const moves = (db.gameMoves || [])
      .filter(m => m.sessionId === id)
      .sort((a, b) => a.moveNumber - b.moveNumber);
    res.json(moves);
  });

  // Record a turn-by-turn move persisted to game_moves and game_sessions
  app.post('/api/games/sessions/:id/moves', (req, res) => {
    const { id } = req.params;
    const {
      coupleId,
      playerId,
      playerName,
      moveNumber,
      moveData,
      boardState,
      nextTurnUserId,
      isFinished,
      winnerUserId,
      score1,
      score2
    } = req.body;

    const session = db.gameSessions.find(g => g.id === id);
    if (!session) return res.status(404).json({ error: 'Game session not found' });

    const newMove: GameMove = {
      id: `move-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId: id,
      coupleId: coupleId || session.coupleId,
      playerId: playerId || session.player1Id,
      playerName: playerName || 'Player',
      moveNumber: moveNumber || (db.gameMoves ? db.gameMoves.filter(m => m.sessionId === id).length + 1 : 1),
      moveData: moveData || {},
      boardState: boardState,
      createdAt: new Date().toISOString()
    };

    if (!db.gameMoves) db.gameMoves = [];
    db.gameMoves.push(newMove);

    // Update the game session
    session.state = {
      ...session.state,
      board: boardState !== undefined ? boardState : session.state.board,
      lastMove: moveData
    };
    if (nextTurnUserId) session.currentTurnUserId = nextTurnUserId;
    if (score1 !== undefined) session.score1 = score1;
    if (score2 !== undefined) session.score2 = score2;

    if (isFinished) {
      session.status = 'completed';
      session.winnerUserId = winnerUserId;
    }
    session.updatedAt = new Date().toISOString();

    saveDatabase(db);

    const eventPayload = {
      sessionId: id,
      move: newMove,
      session,
      nextTurnUserId: session.currentTurnUserId,
      boardState,
      isFinished,
      winnerUserId
    };

    broadcastToCouple(session.coupleId, 'game_turn_move', eventPayload);
    broadcastToCouple(session.coupleId, 'game_updated', session);

    res.json({ move: newMove, session });
  });

  app.post('/api/games/:id/move', (req, res) => {
    const { id } = req.params;
    const { move, nextTurnUserId, updatedState, isFinished, winnerUserId, score1, score2 } = req.body;
    const session = db.gameSessions.find(g => g.id === id);
    if (!session) return res.status(404).json({ error: 'Game session not found' });

    session.state = { ...session.state, ...updatedState, lastMove: move };
    if (nextTurnUserId) session.currentTurnUserId = nextTurnUserId;
    if (score1 !== undefined) session.score1 = score1;
    if (score2 !== undefined) session.score2 = score2;

    if (isFinished) {
      session.status = 'completed';
      session.winnerUserId = winnerUserId;
    }
    session.updatedAt = new Date().toISOString();

    saveDatabase(db);
    broadcastToCouple(session.coupleId, 'game_updated', session);
    res.json(session);
  });

  app.patch('/api/games/sessions/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const session = db.gameSessions.find(g => g.id === id);
    if (!session) return res.status(404).json({ error: 'Game session not found' });
    session.status = status;
    session.updatedAt = new Date().toISOString();
    saveDatabase(db);
    broadcastToCouple(session.coupleId, 'game_updated', session);
    res.json(session);
  });

  // Calculate stats strictly from real database records (Section 4 & 15: No fake values!)
  app.get('/api/games/stats', (req, res) => {
    const { coupleId, userId } = req.query;
    const userGames = db.gameSessions.filter(g => (g.player1Id === userId || g.player2Id === userId) && g.status === 'completed');
    const wins = userGames.filter(g => g.winnerUserId === userId).length;
    const losses = userGames.filter(g => g.winnerUserId && g.winnerUserId !== 'draw' && g.winnerUserId !== userId).length;
    const draws = userGames.filter(g => g.winnerUserId === 'draw').length;

    // Calculate favorite game from real completed sessions
    const gameTypeCounts: Record<string, number> = {};
    userGames.forEach(g => {
      gameTypeCounts[g.gameType] = (gameTypeCounts[g.gameType] || 0) + 1;
    });
    let favoriteGame = 'None yet';
    let maxPlayed = 0;
    for (const [gt, count] of Object.entries(gameTypeCounts)) {
      if (count > maxPlayed) {
        maxPlayed = count;
        favoriteGame = gt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }

    // Real streak calculation
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    userGames.forEach(g => {
      if (g.winnerUserId === userId) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else if (g.winnerUserId && g.winnerUserId !== 'draw') {
        tempStreak = 0;
      }
    });
    currentStreak = tempStreak;

    const stats: GameStats = {
      gamesPlayed: userGames.length,
      wins,
      losses,
      draws,
      favoriteGame,
      currentStreak,
      bestStreak
    };

    const coupleGames = db.gameSessions.filter(g => g.coupleId === coupleId);
    const coupleObj = db.couples.find(c => c.id === coupleId);
    let relationshipDays = 0;
    if (coupleObj && coupleObj.relationshipStartDate) {
      const start = new Date(coupleObj.relationshipStartDate);
      const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      relationshipDays = Math.max(0, diff);
    }

    const coupleStats: CoupleStats = {
      totalGames: coupleGames.length,
      scribbleRounds: coupleGames.filter(g => g.gameType === 'scribble').length,
      wyrMatches: coupleGames.filter(g => g.gameType === 'would_you_rather').length,
      photosShared: db.photos.filter(p => p.coupleId === coupleId).length,
      messagesSent: db.messages.filter(m => m.coupleId === coupleId).length,
      booksFinished: db.readingProgress.filter(r => r.isFinished).length,
      relationshipDays,
      daysStreak: relationshipDays > 0 ? Math.min(relationshipDays, 1) : 0
    };

    res.json({ personal: stats, couple: coupleStats });
  });

  // --- NOTIFICATIONS & ACHIEVEMENTS ---
  app.get('/api/notifications', (req, res) => {
    const { userId } = req.query;
    const notifs = db.notifications.filter(n => n.userId === userId);
    res.json(notifs);
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const { userId } = req.body;
    db.notifications.forEach(n => {
      if (n.userId === userId) n.isRead = true;
    });
    saveDatabase(db);
    res.json({ success: true });
  });

  app.get('/api/achievements', (req, res) => {
    res.json(db.achievements);
  });

  // --- GEMINI AI DATE NIGHT GENERATOR ---
  let aiClient: GoogleGenAI | null = null;
  function getAIClient(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return aiClient;
  }

  app.post('/api/date-night/generate', async (req, res) => {
    const { vibe, budget, location, season, timeAvailable, customNote, partner1Name, partner2Name } = req.body;

    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getAIClient();

        const promptText = `Generate an intimate, deeply personalized date night itinerary for a couple.
Vibe: ${vibe || 'Cozy & Romantic'}
Budget: ${budget || 'Flexible'}
Location: ${location || 'At Home / Local'}
Season: ${season || 'Any'}
Time Available: ${timeAvailable || 'Evening (2-3 hours)'}
Notes: ${customNote || 'Focus on connection, warmth, and meaningful memories'}.

Return a JSON object adhering strictly to this schema:
{
  "title": "Short poetic title for the date",
  "category": "${vibe || 'Romantic'}",
  "tagline": "One evocative sentence capturing the mood",
  "estimatedTime": "e.g. 2 hours",
  "cost": "e.g. Free or $20",
  "location": "e.g. Living room or Local Park",
  "vibe": "${vibe || 'Cozy'}",
  "description": "2-3 sentences painting the setting and feeling",
  "steps": ["Step 1: Preparation", "Step 2: Activity", "Step 3: Wind down"],
  "conversationStarter": "One deep or playful question to ask during the date",
  "romanticTouch": "A special thoughtful gesture to surprise the partner",
  "playlistTheme": "A suggested musical vibe or acoustic playlist genre"
}`;

        const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
        let resultResponse = null;

        for (const modelName of candidateModels) {
          try {
            resultResponse = await ai.models.generateContent({
              model: modelName,
              contents: promptText,
              config: {
                responseMimeType: 'application/json',
                temperature: 0.8
              }
            });
            if (resultResponse?.text) break;
          } catch (modelErr: any) {
            // Silently handle quota / rate limit exhaustion and continue to next model or catalog
          }
        }

        if (resultResponse && resultResponse.text) {
          let cleanText = resultResponse.text.trim();
          if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          const parsed: DateNightIdea = JSON.parse(cleanText);
          return res.json(parsed);
        }
      } catch (err: any) {
        // Fallback to rich romantic date night engine
      }
    }

    // Dynamic catalog generator with extensive personalized romantic ideas
    const fallbackIdea = generateRomanticDateNight({
      vibe,
      budget,
      location,
      season,
      timeAvailable,
      customNote,
      partner1Name,
      partner2Name
    });
    return res.json(fallbackIdea);
  });

  // Vite middleware for development & Static file serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Space Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
