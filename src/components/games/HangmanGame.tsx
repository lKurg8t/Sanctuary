import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GamePrompt, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, AlertCircle, Plus, Smartphone, Wifi, Users } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HangmanGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX_MISTAKES = 6;

export const HangmanGame: React.FC<HangmanGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [prompts, setPrompts] = useState<GamePrompt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customWord, setCustomWord] = useState('');
  const [customHint, setCustomHint] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // 1. Load words
  const loadWords = useCallback(async () => {
    try {
      const data = await ApiService.getGamePrompts('hangman');
      setPrompts(data);
    } catch (err) {
      console.error('Failed to load hangman prompts:', err);
    }
  }, []);

  // 2. Initialize or fetch session
  const initGameSession = useCallback(async () => {
    if (!couple?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await loadWords();

      let session: GameSession;
      if (initialSessionId) {
        const allSessions = await ApiService.getGameSessions(couple.id);
        session =
          allSessions.find(s => s.id === initialSessionId) ||
          (await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'hangman',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'hangman',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName
        });
      }

      setSessionId(session.id);
      setActiveSession(session);

      const wIdx = session.state?.wordIndex ?? 0;
      setWordIndex(wIdx);

      // Load moves from Supabase game_moves table
      const moves = await ApiService.getGameMoves(session.id);
      const movesForWord = moves.filter(m => m.moveData?.wordIndex === wIdx);
      const letters = movesForWord.map(m => m.moveData?.letter).filter(Boolean);
      setGuessedLetters(letters);
    } catch (err) {
      console.error('Failed to init Hangman session:', err);
    } finally {
      setLoading(false);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId, loadWords]);

  useEffect(() => {
    initGameSession();
  }, [initGameSession]);

  // 3. Realtime subscription
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'game_turn_move') {
        const sId = data.sessionId || data.move?.sessionId;
        if (sId === sessionId) {
          const move = data.move;
          if (move?.moveData?.wordIndex === wordIndex && move.moveData?.letter) {
            setGuessedLetters(prev =>
              prev.includes(move.moveData.letter) ? prev : [...prev, move.moveData.letter]
            );
          }
        }
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
        if (data.state?.wordIndex !== undefined && data.state.wordIndex !== wordIndex) {
          setWordIndex(data.state.wordIndex);
          setGuessedLetters([]);
          setShowHint(false);
        }
      }
    });

    return cleanup;
  }, [couple?.id, sessionId, wordIndex]);

  const currentItem = prompts.length > 0 ? prompts[wordIndex % prompts.length] : null;
  const targetWord = (currentItem?.extraData?.word || currentItem?.prompt || 'SANCTUARY').toUpperCase();
  const category = currentItem?.category || 'Romance';
  const hint = currentItem?.extraData?.hint || 'Something special in your relationship';

  const mistakes = guessedLetters.filter(l => !targetWord.includes(l)).length;
  const isWon = targetWord.split('').every(l => guessedLetters.includes(l));
  const isLost = mistakes >= MAX_MISTAKES;

  const handleGuessLetter = async (letter: string) => {
    if (guessedLetters.includes(letter) || isWon || isLost) return;
    const next = [...guessedLetters, letter];
    setGuessedLetters(next);

    const won = targetWord.split('').every(l => next.includes(l));
    const lost = next.filter(l => !targetWord.includes(l)).length >= MAX_MISTAKES;

    if (won) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    if (couple?.id && sessionId) {
      try {
        await ApiService.recordGameMove({
          sessionId,
          coupleId: couple.id,
          playerId: currentUser.id,
          playerName: currentUser.displayName,
          moveData: {
            wordIndex,
            letter,
            isCorrect: targetWord.includes(letter)
          },
          boardState: {
            guessedLetters: next,
            mistakes: next.filter(l => !targetWord.includes(l)).length
          },
          score1: won ? (activeSession?.score1 || 0) + 1 : activeSession?.score1,
          isFinished: won || lost,
          winnerUserId: won ? currentUser.id : undefined
        });
      } catch (err) {
        console.error('Error saving hangman move:', err);
      }
    }
  };

  const handleNextWord = async () => {
    const nextIdx = wordIndex + 1;
    setWordIndex(nextIdx);
    setGuessedLetters([]);
    setShowHint(false);

    if (couple?.id && sessionId) {
      try {
        await ApiService.makeGameMove(sessionId, {
          userId: currentUser.id,
          updatedState: {
            wordIndex: nextIdx
          }
        });
      } catch (err) {
        console.error('Failed to advance hangman word:', err);
      }
    }
  };

  const handleAddCustomWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWord.trim()) return;

    try {
      const clean = customWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
      const newPrompt = await ApiService.createGamePrompt({
        gameType: 'hangman',
        category: 'Partner Secret Word',
        prompt: clean,
        extraData: { word: clean, hint: customHint.trim() || 'A personal memory' }
      });
      setPrompts(prev => [...prev, newPrompt]);
      setCustomWord('');
      setCustomHint('');
      setShowAddCustom(false);
      setWordIndex(prompts.length);
      setGuessedLetters([]);
    } catch (err) {
      console.error('Failed to add custom word:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <h3 className="font-serif font-bold text-sm text-stone-800">
          Cooperative Hangman
        </h3>

        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
          Word {wordIndex + 1}
        </span>
      </div>

      {/* Realtime Status */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Co-op Realtime Guesses</span>
        </div>
        <span className="text-rose-600 font-semibold">
          Mistakes: {mistakes} / {MAX_MISTAKES}
        </span>
      </div>

      {/* Word and Stage */}
      <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200 text-center space-y-6">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
            {category}
          </span>
          <button
            onClick={() => setShowHint(!showHint)}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800 underline cursor-pointer"
          >
            {showHint ? 'Hide Hint' : 'Show Hint'}
          </button>
        </div>

        {showHint && (
          <p className="text-xs font-serif italic text-stone-600 bg-white p-3 rounded-2xl border border-stone-200 max-w-sm mx-auto animate-in fade-in">
            💡 {hint}
          </p>
        )}

        {/* The Mystery Word Display */}
        <div className="flex flex-wrap justify-center gap-2 py-4">
          {targetWord.split('').map((letter, idx) => {
            const isGuessed = guessedLetters.includes(letter) || isLost;
            return (
              <span
                key={idx}
                className={`w-9 h-12 flex items-center justify-center font-mono font-bold text-xl rounded-xl border-2 transition-all ${
                  isGuessed
                    ? isLost && !guessedLetters.includes(letter)
                      ? 'bg-rose-100 border-rose-400 text-rose-700'
                      : 'bg-white border-stone-300 text-stone-900 shadow-xs'
                    : 'bg-stone-200/60 border-stone-300 text-transparent'
                }`}
              >
                {isGuessed ? letter : ''}
              </span>
            );
          })}
        </div>

        {/* Win / Loss State */}
        {(isWon || isLost) && (
          <div className="pt-2 animate-in zoom-in-95 space-y-3">
            <p className={`text-base font-serif font-bold ${isWon ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isWon ? '🎉 Wonderful teamwork! You solved the word!' : `💔 Out of guesses! The word was "${targetWord}".`}
            </p>
            <button
              onClick={handleNextWord}
              className="py-2.5 px-6 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 shadow-xs cursor-pointer"
            >
              Next Word Challenge →
            </button>
          </div>
        )}
      </div>

      {/* Keyboard Grid */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
          {ALPHABET.map(letter => {
            const isUsed = guessedLetters.includes(letter);
            const isCorrect = isUsed && targetWord.includes(letter);
            return (
              <button
                key={letter}
                onClick={() => handleGuessLetter(letter)}
                disabled={isUsed || isWon || isLost}
                className={`aspect-square rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  isUsed
                    ? isCorrect
                      ? 'bg-emerald-100 text-emerald-800 font-black'
                      : 'bg-stone-100 text-stone-300 cursor-not-allowed'
                    : 'bg-stone-50 hover:bg-stone-200 text-stone-800 border border-stone-200'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Custom Word */}
      <div className="text-center pt-2">
        {!showAddCustom ? (
          <button
            onClick={() => setShowAddCustom(true)}
            className="text-xs text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create a secret word for your partner to guess</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustomWord} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 text-left">
            <h4 className="text-xs font-bold text-stone-700">Add Secret Word</h4>
            <input
              type="text"
              value={customWord}
              onChange={e => setCustomWord(e.target.value)}
              placeholder="e.g. PARIS or MOONLIGHT"
              className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 uppercase"
            />
            <input
              type="text"
              value={customHint}
              onChange={e => setCustomHint(e.target.value)}
              placeholder="Optional hint: Where we had our best picnic..."
              className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="px-3 py-1.5 text-xs text-stone-600 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-xs cursor-pointer"
              >
                Save Word
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
