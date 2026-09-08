import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GameSession } from '../types';
import { ApiService } from '../lib/api';
import {
  Gamepad2,
  Sparkles,
  Trophy,
  Heart,
  Flame,
  HelpCircle,
  Palette,
  Grid,
  Hash,
  Lightbulb,
  Compass,
  Award,
  Play,
  Clock,
  Wifi,
  RefreshCw,
  XCircle,
  History,
  CheckCircle2
} from 'lucide-react';
import { ScribbleGame } from './games/ScribbleGame';
import { TruthOrDareGame } from './games/TruthOrDareGame';
import { WouldYouRatherGame } from './games/WouldYouRatherGame';
import { NeverHaveIEverGame } from './games/NeverHaveIEverGame';
import { TicTacToeGame } from './games/TicTacToeGame';
import { ConnectFourGame } from './games/ConnectFourGame';
import { MemoryMatchGame } from './games/MemoryMatchGame';
import { HangmanGame } from './games/HangmanGame';
import { EmojiGuessGame } from './games/EmojiGuessGame';

interface GamesHubViewProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  onTrackGameStat?: (gameType: string, result: 'win' | 'loss' | 'played') => Promise<void>;
}

export type ActiveGameType =
  | 'scribble'
  | 'truth_or_dare'
  | 'would_you_rather'
  | 'never_have_i_ever'
  | 'tictactoe'
  | 'connect_four'
  | 'memory_match'
  | 'hangman'
  | 'emoji_guess'
  | null;

const GAME_CARDS: {
  id: ActiveGameType;
  dbType: string;
  title: string;
  category: string;
  description: string;
  badge: string;
  icon: string;
  players: string;
  color: string;
}[] = [
  {
    id: 'tictactoe',
    dbType: 'tic_tac_toe',
    title: 'Tic-Tac-Toe in Love',
    category: 'Classic',
    description: 'Romantic 3x3 grid game with persistent turns & real-time moves synced across devices.',
    badge: 'Realtime Sync',
    icon: '❌⭕',
    players: 'Turn Based',
    color: 'from-rose-500/10 to-pink-500/10 border-rose-200'
  },
  {
    id: 'connect_four',
    dbType: 'connect_four',
    title: 'Connect Four',
    category: 'Classic',
    description: 'Drop hearts and stars into the vertical grid. First to connect 4 wins the round!',
    badge: 'Realtime Sync',
    icon: '🔴🟡',
    players: 'Turn Based',
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-200'
  },
  {
    id: 'truth_or_dare',
    dbType: 'truth_or_dare',
    title: 'Truth or Dare: Sanctuary',
    category: 'Intimacy & Fun',
    description: 'Deep romantic questions and playful spicy dares with live turn passing.',
    badge: 'Turn Sync',
    icon: '🔥',
    players: 'Turn Based',
    color: 'from-amber-500/10 to-rose-500/10 border-amber-200'
  },
  {
    id: 'would_you_rather',
    dbType: 'would_you_rather',
    title: 'Would You Rather?',
    category: 'Compatibility',
    description: 'Compare romantic dilemmas live with secret answers revealed when both choose.',
    badge: 'Live Match',
    icon: '🤔',
    players: 'Multiplayer',
    color: 'from-pink-500/10 to-purple-500/10 border-pink-200'
  },
  {
    id: 'never_have_i_ever',
    dbType: 'never_have_i_ever',
    title: 'Never Have I Ever',
    category: 'Intimacy & Fun',
    description: 'Reveal cheeky secrets and confessions synced live across devices with round history.',
    badge: 'Confessions',
    icon: '🥂',
    players: 'Multiplayer',
    color: 'from-stone-500/10 to-amber-500/10 border-stone-200'
  },
  {
    id: 'memory_match',
    dbType: 'memory_match',
    title: 'Memory Match',
    category: 'Puzzle',
    description: 'Flip romantic memory tiles and find matching couple icons in fewest moves.',
    badge: 'Turn Based',
    icon: '🧩',
    players: '2P Co-op/Versus',
    color: 'from-emerald-500/10 to-teal-500/10 border-emerald-200'
  },
  {
    id: 'hangman',
    dbType: 'hangman',
    title: 'Couple Hangman',
    category: 'Word Puzzle',
    description: 'Cooperate in real time to guess secret couple words, nicknames, and date spots.',
    badge: 'Co-op Sync',
    icon: '💡',
    players: 'Co-op',
    color: 'from-sky-500/10 to-indigo-500/10 border-sky-200'
  },
  {
    id: 'emoji_guess',
    dbType: 'emoji_guess',
    title: 'Emoji Phrase Guess',
    category: 'Trivia',
    description: 'Decode romantic movies, song titles, and love phrases from emoji sequences.',
    badge: 'Live Quiz',
    icon: '🍿',
    players: 'Co-op / 2P',
    color: 'from-purple-500/10 to-rose-500/10 border-purple-200'
  },
  {
    id: 'scribble',
    dbType: 'scribble',
    title: 'Scribble & Guess',
    category: 'Creativity',
    description: 'Draw romantic prompts live on a collaborative canvas while your partner guesses.',
    badge: 'Live Canvas',
    icon: '🎨',
    players: 'Real-time 2P',
    color: 'from-purple-500/10 to-indigo-500/10 border-purple-200'
  }
];

function mapDbTypeToActiveGame(dbType: string): ActiveGameType {
  switch (dbType) {
    case 'tic_tac_toe':
      return 'tictactoe';
    case 'connect_four':
      return 'connect_four';
    case 'truth_or_dare':
      return 'truth_or_dare';
    case 'would_you_rather':
      return 'would_you_rather';
    case 'never_have_i_ever':
      return 'never_have_i_ever';
    case 'memory_match':
      return 'memory_match';
    case 'hangman':
      return 'hangman';
    case 'emoji_guess':
      return 'emoji_guess';
    case 'scribble':
      return 'scribble';
    default:
      return null;
  }
}

function getGameMetadata(dbType: string) {
  const card = GAME_CARDS.find(g => g.dbType === dbType || g.id === dbType);
  if (card) return { title: card.title, icon: card.icon };
  return { title: dbType.replace(/_/g, ' '), icon: '🎮' };
}

export const GamesHubView: React.FC<GamesHubViewProps> = ({
  currentUser,
  couple,
  partner,
  onTrackGameStat
}) => {
  const [activeGame, setActiveGame] = useState<ActiveGameType>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load real game sessions from Supabase game_sessions table
  const fetchSessions = useCallback(async () => {
    if (!couple?.id) return;
    setIsLoadingSessions(true);
    try {
      const sessions = await ApiService.getGameSessions(couple.id);
      setGameSessions(sessions);
    } catch (err) {
      console.error('Failed to load Supabase game sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [couple?.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Real-time listener for game sessions & moves
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (
        event === 'game_created' ||
        event === 'game_updated' ||
        event === 'game_turn_move' ||
        event === 'game_reset'
      ) {
        fetchSessions();
      }
    });

    return cleanup;
  }, [couple?.id, fetchSessions]);

  // Handle launching a game with optional existing session
  const handleLaunchGame = (gameId: ActiveGameType, sessionId?: string) => {
    setSelectedSessionId(sessionId || null);
    setActiveGame(gameId);
  };

  // Close or complete an active session
  const handleEndSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to end and archive this active game session?')) return;

    try {
      await ApiService.updateGameSessionStatus(sessionId, 'completed', couple?.id);
      await fetchSessions();
    } catch (err) {
      console.error('Failed to end game session:', err);
    }
  };

  // Render active game sub-view if selected
  if (activeGame === 'scribble') {
    return (
      <ScribbleGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'truth_or_dare') {
    return (
      <TruthOrDareGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'would_you_rather') {
    return (
      <WouldYouRatherGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'never_have_i_ever') {
    return (
      <NeverHaveIEverGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'tictactoe') {
    return (
      <TicTacToeGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'connect_four') {
    return (
      <ConnectFourGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'memory_match') {
    return (
      <MemoryMatchGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'hangman') {
    return (
      <HangmanGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }
  if (activeGame === 'emoji_guess') {
    return (
      <EmojiGuessGame
        currentUser={currentUser}
        couple={couple}
        partner={partner}
        initialSessionId={selectedSessionId}
        onBackToHub={() => {
          setActiveGame(null);
          setSelectedSessionId(null);
          fetchSessions();
        }}
      />
    );
  }

  const categories = ['All', 'Classic', 'Intimacy & Fun', 'Compatibility', 'Puzzle', 'Word Puzzle', 'Trivia', 'Creativity'];

  const filteredGames = GAME_CARDS.filter(g => {
    if (activeFilter === 'All') return true;
    return g.category === activeFilter;
  });

  // Calculate real metrics from Supabase game_sessions
  const totalCompleted = gameSessions.filter(s => s.status === 'completed');
  const userWins = totalCompleted.filter(s => s.winnerUserId === currentUser.id).length;
  const partnerWins = totalCompleted.filter(s => partner && s.winnerUserId === partner.id).length;
  const activeSessions = gameSessions.filter(s => s.status === 'in_progress' || s.status === 'active');

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* 1. HEADER & REAL SUPABASE METRICS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-600">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-stone-800 flex items-center gap-2">
              <span>Couple Games & Arcade</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Supabase Realtime Channel Connected" />
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Multiplayer games backed by Supabase tables: <code className="text-rose-600 font-mono text-[11px]">game_sessions</code> & <code className="text-rose-600 font-mono text-[11px]">game_moves</code>.
            </p>
          </div>
        </div>

        {/* Real Couple Game Stats Pill & Match History Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-2xl border border-stone-200 shadow-xs hover:bg-stone-50 text-xs font-semibold cursor-pointer text-stone-700"
          >
            <History className="w-3.5 h-3.5 text-stone-500" />
            <span>Match History ({totalCompleted.length})</span>
          </button>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-stone-200 shadow-xs text-xs font-semibold">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-stone-700">
              Score:{' '}
              <strong className="text-rose-600 font-bold">
                {userWins} - {partnerWins}
              </strong>
            </span>
            <button
              onClick={fetchSessions}
              className="p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              title="Refresh game sessions from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE / IN-PROGRESS SESSIONS (REAL SUPABASE 'game_sessions' TABLE) */}
      {activeSessions.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 p-4 rounded-3xl border border-rose-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-600" />
              <h3 className="font-serif font-bold text-sm text-stone-800">
                Active In-Progress Games
              </h3>
              <span className="text-[10px] bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                {activeSessions.length} Live
              </span>
            </div>
            <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Synced via Supabase Realtime
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeSessions.map(session => {
              const gameTypeMapped = mapDbTypeToActiveGame(session.gameType);
              const meta = getGameMetadata(session.gameType);
              const isMyTurn = session.currentTurnUserId === currentUser.id;

              return (
                <div
                  key={session.id}
                  className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-2xs flex items-center justify-between gap-3 hover:border-rose-300 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{meta.icon}</span>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-serif font-bold text-xs text-stone-800 truncate">
                        {meta.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {isMyTurn ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Your Turn
                          </span>
                        ) : (
                          <span className="text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md font-medium">
                            {partner?.displayName || 'Partner'}'s Turn
                          </span>
                        )}
                        {(session.score1 !== undefined || session.score2 !== undefined) && (
                          <span className="text-rose-600 font-bold">
                            {session.score1 ?? 0} : {session.score2 ?? 0}
                          </span>
                        )}
                        <span className="text-stone-400">
                          • {new Date(session.updatedAt || session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {gameTypeMapped && (
                      <button
                        onClick={() => handleLaunchGame(gameTypeMapped, session.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Resume</span>
                      </button>
                    )}
                    <button
                      onClick={e => handleEndSession(session.id, e)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                      title="Archive / End match"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. CATEGORY FILTERS */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === cat
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 4. GAMES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGames.map(game => {
          const matchingActiveSession = activeSessions.find(s => s.gameType === game.dbType);

          return (
            <div
              key={game.id}
              onClick={() => handleLaunchGame(game.id, matchingActiveSession?.id)}
              className={`p-5 rounded-3xl bg-gradient-to-br ${game.color} bg-white border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative`}
            >
              {matchingActiveSession && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>Resume</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl p-2 rounded-2xl bg-white shadow-xs group-hover:scale-110 transition-transform">
                    {game.icon}
                  </span>
                  {!matchingActiveSession && (
                    <span className="text-[10px] uppercase font-bold text-stone-600 bg-white/90 px-2.5 py-1 rounded-full border border-stone-200">
                      {game.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-base text-stone-800 group-hover:text-rose-600 transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/5 text-[11px] font-semibold text-stone-500">
                <span>{game.players}</span>
                <span className="text-rose-600 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                  {matchingActiveSession ? 'Resume Round →' : 'Play Now →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. MATCH HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-xl border border-stone-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-800">
                    Couple Match History
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    All completed matches loaded from Supabase <code className="text-rose-600 font-mono">game_sessions</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-100 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500">{currentUser.displayName}</span>
                <p className="text-base font-bold text-rose-600">{userWins} Wins</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500">{partner?.displayName || 'Partner'}</span>
                <p className="text-base font-bold text-amber-600">{partnerWins} Wins</p>
              </div>
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500">Total Rounds</span>
                <p className="text-base font-bold text-stone-700">{totalCompleted.length}</p>
              </div>
            </div>

            {/* Match list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {totalCompleted.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  No completed matches yet. Play a game to record your first head-to-head score!
                </div>
              ) : (
                totalCompleted.map(session => {
                  const meta = getGameMetadata(session.gameType);
                  const isUserWinner = session.winnerUserId === currentUser.id;
                  const isPartnerWinner = partner && session.winnerUserId === partner.id;
                  const isDraw = session.winnerUserId === 'draw';

                  return (
                    <div
                      key={session.id}
                      className="p-3 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{meta.icon}</span>
                        <div>
                          <p className="font-serif font-bold text-stone-800">{meta.title}</p>
                          <p className="text-[10px] text-stone-400">
                            {new Date(session.updatedAt || session.createdAt).toLocaleDateString()} at{' '}
                            {new Date(session.updatedAt || session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        {isDraw ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                            Draw
                          </span>
                        ) : isUserWinner ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            🏆 {currentUser.displayName} Won
                          </span>
                        ) : isPartnerWinner ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            🏆 {partner?.displayName} Won
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                            Completed
                          </span>
                        )}
                        {(session.score1 !== undefined || session.score2 !== undefined) && (
                          <p className="text-[11px] font-bold text-stone-600">
                            {session.score1 ?? 0} - {session.score2 ?? 0}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
