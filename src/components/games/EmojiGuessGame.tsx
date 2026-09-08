import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GamePrompt, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Send, Check, Plus, Wifi } from 'lucide-react';
import confetti from 'canvas-confetti';

interface EmojiGuessGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

export const EmojiGuessGame: React.FC<EmojiGuessGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [prompts, setPrompts] = useState<GamePrompt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [index, setIndex] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [isSolved, setIsSolved] = useState(false);
  const [solvedBy, setSolvedBy] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customEmojis, setCustomEmojis] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [customHint, setCustomHint] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // 1. Load prompts
  const loadPuzzles = useCallback(async () => {
    try {
      const data = await ApiService.getGamePrompts('emoji_guess');
      setPrompts(data);
    } catch (err) {
      console.error('Failed to load emoji puzzles:', err);
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
      await loadPuzzles();

      let session: GameSession;
      if (initialSessionId) {
        const allSessions = await ApiService.getGameSessions(couple.id);
        session =
          allSessions.find(s => s.id === initialSessionId) ||
          (await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'emoji_guess',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'emoji_guess',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName
        });
      }

      setSessionId(session.id);
      setActiveSession(session);

      const pIdx = session.state?.puzzleIndex ?? 0;
      setIndex(pIdx);
      setScore(session.score1 || 0);

      // Load moves
      const moves = await ApiService.getGameMoves(session.id);
      const solvedMove = moves.find(m => m.moveData?.puzzleIndex === pIdx && m.moveData?.solved);
      if (solvedMove) {
        setIsSolved(true);
        setSolvedBy(solvedMove.playerName);
      }
    } catch (err) {
      console.error('Failed to init EmojiGuess session:', err);
    } finally {
      setLoading(false);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId, loadPuzzles]);

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
          if (move?.moveData?.puzzleIndex === index && move.moveData.solved) {
            setIsSolved(true);
            setSolvedBy(move.playerName);
            if (data.score1 !== undefined) setScore(data.score1);
          }
        }
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
        if (data.state?.puzzleIndex !== undefined && data.state.puzzleIndex !== index) {
          setIndex(data.state.puzzleIndex);
          setIsSolved(false);
          setSolvedBy(null);
          setGuessInput('');
          setShowHint(false);
        }
        if (data.score1 !== undefined) setScore(data.score1);
      }
    });

    return cleanup;
  }, [couple?.id, sessionId, index]);

  const currentPuzzle = prompts.length > 0 ? prompts[index % prompts.length] : null;
  const emojis = currentPuzzle?.extraData?.emojis || '🎬 🚢 ❄️ 💔 🚪';
  const answer = currentPuzzle?.extraData?.answer || currentPuzzle?.prompt || 'Titanic';
  const category = currentPuzzle?.category || 'Movie & Pop Culture';
  const hint = currentPuzzle?.extraData?.hint || 'Classic love story';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || isSolved) return;

    if (guessInput.trim().toLowerCase() === answer.toLowerCase()) {
      setIsSolved(true);
      setSolvedBy(currentUser.displayName);
      const newScore = score + 10;
      setScore(newScore);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

      if (couple?.id && sessionId) {
        try {
          await ApiService.recordGameMove({
            sessionId,
            coupleId: couple.id,
            playerId: currentUser.id,
            playerName: currentUser.displayName,
            moveData: {
              puzzleIndex: index,
              guess: guessInput.trim(),
              solved: true,
              answer
            },
            score1: newScore,
            isFinished: false
          });
        } catch (err) {
          console.error('Error saving emoji guess move:', err);
        }
      }
    }
  };

  const handleNext = async () => {
    const nextIdx = index + 1;
    setIndex(nextIdx);
    setGuessInput('');
    setIsSolved(false);
    setSolvedBy(null);
    setShowHint(false);

    if (couple?.id && sessionId) {
      try {
        await ApiService.makeGameMove(sessionId, {
          userId: currentUser.id,
          updatedState: {
            puzzleIndex: nextIdx
          }
        });
      } catch (err) {
        console.error('Failed to advance emoji puzzle:', err);
      }
    }
  };

  const handleAddCustomPuzzle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmojis.trim() || !customAnswer.trim()) return;

    try {
      const newPrompt = await ApiService.createGamePrompt({
        gameType: 'emoji_guess',
        category: 'Partner Secret Emoji',
        prompt: customAnswer.trim(),
        extraData: {
          emojis: customEmojis.trim(),
          answer: customAnswer.trim(),
          hint: customHint.trim() || 'A couple inside joke or favorite thing'
        }
      });
      setPrompts(prev => [...prev, newPrompt]);
      setCustomEmojis('');
      setCustomAnswer('');
      setCustomHint('');
      setShowAddCustom(false);
      setIndex(prompts.length);
      setIsSolved(false);
    } catch (err) {
      console.error('Failed to create custom emoji puzzle:', err);
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

        <div className="text-center">
          <span className="text-[10px] uppercase font-bold text-stone-400">Total Score</span>
          <p className="text-xs font-bold text-rose-600">{score} Points</p>
        </div>

        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
          Puzzle {index + 1}
        </span>
      </div>

      {/* Realtime Status */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Supabase Realtime Synced</span>
        </div>
        <div>
          {isSolved ? (
            <span className="text-emerald-700 font-bold">Solved by {solvedBy || 'Partner'}!</span>
          ) : (
            <span>Both can guess live!</span>
          )}
        </div>
      </div>

      {/* Puzzle Card */}
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

        <div className="py-6">
          <p className="text-4xl sm:text-5xl tracking-widest leading-relaxed">
            {emojis}
          </p>
        </div>

        {isSolved ? (
          <div className="space-y-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in zoom-in-95">
            <p className="text-base font-serif font-bold text-emerald-900">
              🎉 Correct! The answer was "{answer}"!
            </p>
            <p className="text-xs text-emerald-700">Solved by {solvedBy} (+10 points)</p>
            <button
              onClick={handleNext}
              className="py-2 px-6 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 shadow-xs cursor-pointer"
            >
              Next Emoji Puzzle →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
            <input
              type="text"
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              placeholder="Type your guess here..."
              className="flex-1 text-sm p-3 rounded-2xl bg-white border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Guess</span>
            </button>
          </form>
        )}
      </div>

      {/* Add Custom Puzzle */}
      <div className="text-center pt-2">
        {!showAddCustom ? (
          <button
            onClick={() => setShowAddCustom(true)}
            className="text-xs text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create a secret emoji riddle for your partner</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustomPuzzle} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 text-left">
            <h4 className="text-xs font-bold text-stone-700">Add New Emoji Puzzle</h4>
            <input
              type="text"
              value={customEmojis}
              onChange={e => setCustomEmojis(e.target.value)}
              placeholder="Emojis (e.g. 🍕 🍷 🗼 🌹)"
              className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <input
              type="text"
              value={customAnswer}
              onChange={e => setCustomAnswer(e.target.value)}
              placeholder="Correct Answer (e.g. Paris Date Night)"
              className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <input
              type="text"
              value={customHint}
              onChange={e => setCustomHint(e.target.value)}
              placeholder="Hint (optional)"
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
                Save Puzzle
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
