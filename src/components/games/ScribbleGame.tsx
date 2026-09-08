import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UserProfile, Couple, GameSession } from '../../types';
import { ApiService } from '../../lib/api';
import { Palette, Eraser, RotateCcw, Send, Sparkles, Trophy, Clock, Check, ArrowLeft, Wifi, Plus, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ScribbleGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

const DEFAULT_SCRIBBLE_WORDS = [
  'Candlelight', 'Eiffel Tower', 'Engagement Ring', 'Campfire', 'Holding Hands',
  'Sunflower', 'Hot Air Balloon', 'Chocolate Box', 'Love Letter', 'Stargazing',
  'Coffee Mug', 'Sunset Cruise', 'Picnic Basket', 'Guitar', 'Ferris Wheel'
];

const COLORS = ['#1c1917', '#e11d48', '#ea580c', '#f59e0b', '#10b981', '#0284c7', '#7c3aed', '#ec4899'];

export const ScribbleGame: React.FC<ScribbleGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#e11d48');
  const [brushSize, setBrushSize] = useState(4);
  const [words, setWords] = useState<string[]>(DEFAULT_SCRIBBLE_WORDS);
  const [currentWord, setCurrentWord] = useState(DEFAULT_SCRIBBLE_WORDS[0]);
  const [guessInput, setGuessInput] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: string; text: string; isCorrect?: boolean }[]>([
    { sender: 'System', text: '🎨 Game started! One partner draws, the other guesses.' }
  ]);
  const [isArtist, setIsArtist] = useState(true);
  const [timeLeft, setTimeLeft] = useState(60);
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWordInput, setNewWordInput] = useState('');
  const [isSavingWord, setIsSavingWord] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load live scribble words from Supabase game_prompts
  const loadPrompts = useCallback(async () => {
    try {
      const prompts = await ApiService.getGamePrompts('scribble');
      if (prompts && prompts.length > 0) {
        const liveWords = prompts.map(p => p.prompt);
        setWords(liveWords);
        return liveWords;
      }
    } catch (err) {
      console.warn('Failed to load scribble prompts:', err);
    }
    return DEFAULT_SCRIBBLE_WORDS;
  }, []);

  // Initialize or fetch game session from Supabase
  const initGameSession = useCallback(async () => {
    if (!couple?.id) return;
    try {
      const liveWords = await loadPrompts();

      let session: GameSession;
      if (initialSessionId) {
        const allSessions = await ApiService.getGameSessions(couple.id);
        session =
          allSessions.find(s => s.id === initialSessionId) ||
          (await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'scribble',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName,
            currentTurnUserId: currentUser.id
          }));
      } else {
        session = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'scribble',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName,
          currentTurnUserId: currentUser.id
        });
      }

      setSessionId(session.id);
      setActiveSession(session);

      if (session.state?.word) {
        setCurrentWord(session.state.word);
      } else if (liveWords && liveWords.length > 0) {
        setCurrentWord(liveWords[0]);
      }

      if (session.currentTurnUserId) {
        setIsArtist(session.currentTurnUserId === currentUser.id);
      }

      // Load previous moves/guesses from game_moves
      const moves = await ApiService.getGameMoves(session.id);
      if (moves.length > 0) {
        const previousGuesses = moves.map(m => ({
          sender: m.playerName,
          text: m.moveData?.guess || '',
          isCorrect: m.moveData?.isCorrect || false
        })).filter(g => g.text);

        if (previousGuesses.length > 0) {
          setChatLog(prev => [...prev, ...previousGuesses]);
        }
      }
    } catch (err) {
      console.error('Failed to init Scribble session:', err);
    }
  }, [couple?.id, currentUser.id, currentUser.displayName, partner?.id, partner?.displayName, initialSessionId, loadPrompts]);

  useEffect(() => {
    initGameSession();
  }, [initGameSession]);

  // Realtime subscription for Scribble
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'game_draw' && data.senderId !== currentUser.id) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(data.fromX, data.fromY);
        ctx.lineTo(data.toX, data.toY);
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (event === 'game_draw_clear' && data.senderId !== currentUser.id) {
        clearCanvas(true);
      } else if (event === 'game_turn_move' && (data.sessionId === sessionId || data.move?.sessionId === sessionId)) {
        const move = data.move;
        if (move?.moveData?.guess && move.playerName !== currentUser.displayName) {
          setChatLog(prev => [
            ...prev,
            { sender: move.playerName, text: move.moveData.guess, isCorrect: move.moveData.isCorrect }
          ]);
          if (move.moveData.isCorrect) {
            setRoundWinner(move.playerName);
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        }
      } else if (event === 'game_guess' && data.sender !== currentUser.displayName) {
        setChatLog(prev => [...prev, { sender: data.sender, text: data.text, isCorrect: data.isCorrect }]);
        if (data.isCorrect) {
          setRoundWinner(data.sender);
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        }
      } else if (event === 'game_round_start') {
        clearCanvas(true);
        setCurrentWord(data.word);
        setIsArtist(data.artistId === currentUser.id);
        setTimeLeft(60);
        setRoundWinner(null);
        setChatLog(prev => [
          ...prev,
          {
            sender: 'System',
            text: `🔄 New Round! Artist is now ${data.artistId === currentUser.id ? 'You' : partner?.displayName || 'Partner'}.`
          }
        ]);
      }
    });

    return cleanup;
  }, [couple?.id, currentUser.id, partner?.displayName, sessionId]);

  // Timer countdown
  useEffect(() => {
    if (roundWinner || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setChatLog(log => [...log, { sender: 'System', text: `⏰ Time is up! The secret word was "${currentWord}".` }]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, roundWinner, currentWord]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isArtist) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;
    lastPosRef.current = { x, y };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isArtist) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;

    const prev = lastPosRef.current || { x, y };
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (couple?.id) {
      ApiService.broadcastCoupleEvent(couple.id, 'game_draw', {
        fromX: prev.x,
        fromY: prev.y,
        toX: x,
        toY: y,
        color: brushColor,
        size: brushSize,
        senderId: currentUser.id
      });
    }

    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const clearCanvas = (localOnly = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!localOnly && couple?.id) {
      ApiService.broadcastCoupleEvent(couple.id, 'game_draw_clear', {
        senderId: currentUser.id
      });
    }
  };

  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;

    const guess = guessInput.trim();
    const isCorrect = guess.toLowerCase() === currentWord.toLowerCase();

    setChatLog(prev => [
      ...prev,
      {
        sender: currentUser.displayName,
        text: guess,
        isCorrect
      }
    ]);

    // Persist guess into game_moves table in Supabase
    if (couple?.id && sessionId) {
      try {
        await ApiService.recordGameMove({
          sessionId,
          coupleId: couple.id,
          playerId: currentUser.id,
          playerName: currentUser.displayName,
          moveData: {
            guess,
            isCorrect,
            word: currentWord
          },
          isFinished: isCorrect,
          winnerUserId: isCorrect ? currentUser.id : undefined,
          score1: isCorrect ? (activeSession?.score1 || 0) + 1 : activeSession?.score1
        });
      } catch (err) {
        console.error('Error saving scribble move to Supabase:', err);
      }
    }

    if (couple?.id) {
      ApiService.broadcastCoupleEvent(couple.id, 'game_guess', {
        sender: currentUser.displayName,
        text: guess,
        isCorrect
      });
    }

    if (isCorrect) {
      setRoundWinner(currentUser.displayName);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    setGuessInput('');
  };

  const handleAddCustomWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWordInput.trim() || isSavingWord) return;
    setIsSavingWord(true);
    try {
      const trimmed = newWordInput.trim();
      const created = await ApiService.createGamePrompt({
        gameType: 'scribble',
        category: 'couples',
        prompt: trimmed
      });
      setWords(prev => [created.prompt, ...prev.filter(w => w !== created.prompt)]);
      setNewWordInput('');
      setShowAddWordModal(false);
      setChatLog(prev => [
        ...prev,
        { sender: 'System', text: `✨ New custom word added: "${created.prompt}"` }
      ]);
    } catch (err) {
      console.error('Failed to create custom scribble prompt in Supabase:', err);
    } finally {
      setIsSavingWord(false);
    }
  };

  const handleNextRound = async () => {
    clearCanvas();
    const wordPool = words.length > 0 ? words : DEFAULT_SCRIBBLE_WORDS;
    const nextWord = wordPool[Math.floor(Math.random() * wordPool.length)];
    const nextArtistId = !isArtist ? currentUser.id : partner?.id || currentUser.id;
    setCurrentWord(nextWord);
    setIsArtist(!isArtist);
    setTimeLeft(60);
    setRoundWinner(null);
    setChatLog(prev => [
      ...prev,
      { sender: 'System', text: `🔄 New Round! Artist switched.` }
    ]);

    if (couple?.id && sessionId) {
      await ApiService.makeGameMove(sessionId, {
        userId: currentUser.id,
        updatedState: { word: nextWord },
        nextTurnUserId: nextArtistId
      });
    }

    if (couple?.id) {
      ApiService.broadcastCoupleEvent(couple.id, 'game_round_start', {
        word: nextWord,
        artistId: nextArtistId
      });
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-200 text-xs font-bold text-amber-700">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeLeft}s</span>
          </div>

          <div className="text-xs font-semibold text-stone-700">
            {isArtist ? (
              <span className="text-rose-600 font-bold">🎨 You are Drawing: "{currentWord}"</span>
            ) : (
              <span className="text-stone-600">👀 Guess the Partner's Drawing!</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddWordModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold cursor-pointer border border-rose-200"
            title="Add Custom Word"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Word</span>
          </button>
          <button
            onClick={handleNextRound}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer shadow-xs"
          >
            Next Round
          </button>
        </div>
      </div>

      {/* Realtime status bar */}
      <div className="flex items-center justify-between px-2 text-xs font-medium text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Multiplayer Realtime Synchronized</span>
        </div>
        <span className="text-stone-400">
          Artist: {isArtist ? currentUser.displayName : partner?.displayName || 'Partner'}
        </span>
      </div>

      {/* Canvas Area */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="relative aspect-[4/3] w-full bg-stone-50 rounded-2xl overflow-hidden border border-stone-200 touch-none">
          <canvas
            ref={canvasRef}
            width={600}
            height={450}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full cursor-crosshair"
          />

          {roundWinner && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-2 animate-in zoom-in-95">
              <Trophy className="w-12 h-12 text-amber-300 animate-bounce" />
              <h3 className="text-xl font-bold font-serif">Word Guessed Correctly!</h3>
              <p className="text-xs text-stone-200">The secret word was <span className="font-bold text-amber-300 underline">"{currentWord}"</span></p>
              <button
                onClick={handleNextRound}
                className="mt-2 px-4 py-2 rounded-xl bg-white text-rose-600 font-bold text-xs shadow-md cursor-pointer"
              >
                Play Next Round
              </button>
            </div>
          )}
        </div>

        {/* Artist Drawing Tools */}
        {isArtist && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
            {/* Color Palette */}
            <div className="flex items-center gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setBrushColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    brushColor === c ? 'scale-125 border-rose-400' : 'border-white'
                  }`}
                />
              ))}
            </div>

            {/* Brush Size & Eraser */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBrushColor('#f8fafc')}
                className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                  brushColor === '#f8fafc' ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-stone-50 border-stone-200'
                }`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => clearCanvas(false)}
                className="p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-xs font-semibold cursor-pointer"
                title="Clear Canvas"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Guessing Chat Stream */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Live Guesses & Answers
        </h4>

        <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs">
          {chatLog.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded-xl ${
                msg.isCorrect
                  ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                  : msg.sender === 'System'
                  ? 'bg-stone-100 text-stone-500 italic'
                  : 'bg-stone-50 text-stone-700'
              }`}
            >
              <span className="font-semibold">{msg.sender}: </span>
              <span>{msg.text}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleGuessSubmit} className="flex gap-2">
          <input
            type="text"
            value={guessInput}
            onChange={e => setGuessInput(e.target.value)}
            placeholder="Type your guess here..."
            className="flex-1 px-3.5 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
          >
            Guess
          </button>
        </form>
      </div>

      {/* Add Custom Word Modal */}
      {showAddWordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-stone-200 shadow-xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 font-serif">Add Custom Drawing Word</h3>
              <button
                onClick={() => setShowAddWordModal(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Save a new secret word or inside joke to Supabase to challenge your partner!
            </p>
            <form onSubmit={handleAddCustomWord} className="space-y-3">
              <input
                type="text"
                value={newWordInput}
                onChange={e => setNewWordInput(e.target.value)}
                placeholder="e.g. Venice Gondola, Golden Retriever"
                className="w-full px-3.5 py-2 text-sm bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWordModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWordInput.trim() || isSavingWord}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingWord ? <span>Saving...</span> : <span>Save to Database</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
