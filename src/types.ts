export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  dateOfBirth?: string;
  timezone: string;
  coupleId?: string;
  role?: 'creator' | 'partner';
  createdAt: string;
  updatedAt: string;
}

export interface Couple {
  id: string;
  inviteCode: string;
  inviteExpiresAt: string;
  relationshipStartDate: string; // ISO date string e.g. "2024-02-14"
  members: UserProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  coupleId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'voice' | 'sticker';
  replyToId?: string;
  replyToText?: string;
  reactions: { [emoji: string]: string[] }; // emoji -> array of userIds
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Book {
  id: string;
  coupleId: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  category: string;
  totalPages: number;
  content: string[]; // array of chapters or page content
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

export interface ReadingProgress {
  bookId: string;
  userId: string;
  currentPage: number;
  percentage: number;
  readingTimeMinutes: number;
  isFinished: boolean;
  lastReadAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  pageNumber: number;
  chapterTitle?: string;
  note: string;
  isShared: boolean;
  createdAt: string;
}

export interface PhotoMemory {
  id: string;
  coupleId: string;
  uploaderId: string;
  uploaderName: string;
  imageUrl: string;
  thumbnailUrl?: string;
  caption: string;
  albumId: string;
  albumName: string;
  memoryDate: string;
  isFavorite: boolean;
  reactions: { [emoji: string]: string[] };
  comments: PhotoComment[];
  createdAt: string;
}

export interface PhotoComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
}

export interface PhotoAlbum {
  id: string;
  coupleId: string;
  name: string;
  description: string;
  coverUrl?: string;
  photoCount: number;
  createdAt: string;
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface CycleLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  isPeriodStart?: boolean;
  isPeriodEnd?: boolean;
  flowIntensity?: 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
  symptoms: string[]; // e.g. ['cramps', 'headache', 'bloating', 'fatigue', 'backache']
  moods: string[]; // e.g. ['happy', 'calm', 'sensitive', 'anxious', 'irritable', 'loving']
  energyLevel: number; // 1 to 5
  sleepHours?: number;
  cravings: string[]; // e.g. ['chocolate', 'salty', 'sweet', 'carbs']
  notes: string;
  createdAt: string;
}

export interface CycleSettings {
  userId: string;
  cycleLengthDays: number; // default 28
  periodLengthDays: number; // default 5
  lastPeriodStartDate: string;
  partnerSharingLevel: 'private' | 'summary' | 'full';
  sharedSymptoms: string[]; // symptoms the user is comfortable sharing
  showSupportCards: boolean;
}

export interface CyclePartnerSummary {
  phase: CyclePhase;
  phaseDisplayName: string;
  cycleDay: number;
  nextPeriodEstimateDate: string;
  daysUntilNextPeriod: number;
  reportedMoods: string[];
  reportedSymptoms: string[];
  energyLevel: number;
  supportTips: string[];
  canViewFull: boolean;
}

export type GameType = 
  | 'scribble' 
  | 'truth_or_dare' 
  | 'never_have_i_ever' 
  | 'would_you_rather' 
  | 'memory_match' 
  | 'tic_tac_toe' 
  | 'connect_four' 
  | 'hangman' 
  | 'emoji_guess'
  | 'daily_reflection';

export interface GameSession {
  id: string;
  coupleId: string;
  gameType: GameType;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  currentTurnUserId?: string;
  player1Id: string;
  player1Name: string;
  player2Id?: string;
  player2Name?: string;
  score1: number;
  score2: number;
  winnerUserId?: string | 'draw';
  state: Record<string, any>;
  updatedAt: string;
  createdAt: string;
}

export interface GameMove {
  id: string;
  sessionId: string;
  coupleId: string;
  playerId: string;
  playerName: string;
  moveNumber: number;
  moveData: Record<string, any>;
  boardState?: Record<string, any> | any[];
  createdAt: string;
}

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  favoriteGame: string;
  currentStreak: number;
  bestStreak: number;
}

export interface CoupleStats {
  totalGames: number;
  scribbleRounds: number;
  wyrMatches: number;
  photosShared: number;
  messagesSent: number;
  booksFinished: number;
  relationshipDays: number;
  daysStreak: number;
}

export interface AppNotification {
  id: string;
  coupleId: string;
  userId: string;
  title: string;
  body: string;
  type: 'chat' | 'game' | 'book' | 'memory' | 'cycle' | 'anniversary' | 'achievement';
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'relationship' | 'games' | 'reading' | 'memories' | 'chat';
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

export interface DateNightIdea {
  title: string;
  category: string;
  tagline: string;
  estimatedTime: string;
  cost: string;
  location: string;
  vibe: string;
  description: string;
  steps: string[];
  conversationStarter: string;
  romanticTouch: string;
  playlistTheme?: string;
}

export interface GamePrompt {
  id: string;
  gameType: GameType;
  category: string;
  prompt: string;
  extraData?: Record<string, any>;
  difficulty?: 'easy' | 'medium' | 'hard' | 'all';
  active: boolean;
  createdAt: string;
}
