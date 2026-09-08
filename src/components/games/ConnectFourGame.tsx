import React, { useState, useEffect } from 'react';
import { UserProfile, Couple, GameSession, GameMove } from '../../types';
import { ApiService } from '../../lib/api';
import { ArrowLeft, RefreshCw, Trophy, Heart, Sparkles, Wifi } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ConnectFourGameProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  initialSessionId?: string | null;
  onBackToHub: () => void;
}

const ROWS = 6;
const COLS = 7;
type Player = 1 | 2; // 1 = Rose/Current, 2 = Amber/Partner
type BoardState = (Player | null)[][];

export const ConnectFourGame: React.FC<ConnectFourGameProps> = ({
  currentUser,
  couple,
  partner,
  initialSessionId,
  onBackToHub
}) => {
  const [board, setBoard] = useState<BoardState>(
    Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [passAndPlay, setPassAndPlay] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Determine whose turn it is
  const isPlayer1 = !activeSession || activeSession.player1Id === currentUser.id;
  const currentTurnUserId = activeSession?.currentTurnUserId || (currentPlayer === 1 ? activeSession?.player1Id : activeSession?.player2Id) || currentUser.id;
  const isMyTurn = passAndPlay || !couple?.id || currentTurnUserId === currentUser.id;

  // Initialize or resume real game session from Supabase game_sessions and game_moves
  useEffect(() => {
    let isCancelled = false;

    async function initSession() {
      if (!couple?.id) {
        setIsLoadingSession(false);
        return;
      }

      setIsLoadingSession(true);
      try {
        let session: GameSession;
        if (initialSessionId) {
          const sessions = await ApiService.getGameSessions(couple.id);
          session = sessions.find(s => s.id === initialSessionId) || await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'connect_four',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName
          });
        } else {
          session = await ApiService.createOrGetActiveGameSession({
            coupleId: couple.id,
            gameType: 'connect_four',
            player1Id: currentUser.id,
            player1Name: currentUser.displayName,
            player2Id: partner?.id,
            player2Name: partner?.displayName,
            currentTurnUserId: currentUser.id
          });
        }

        if (isCancelled) return;

        setSessionId(session.id);
        setActiveSession(session);
        setScores({
          p1: session.score1 || 0,
          p2: session.score2 || 0
        });

        // Load moves from Supabase game_moves table
        const moves = await ApiService.getGameMoves(session.id);
        if (isCancelled) return;
        setMoveHistory(moves);

        // Reconstruct board from moves or saved session state
        if (session.state?.board && Array.isArray(session.state.board)) {
          setBoard(session.state.board);
          let discsCount = 0;
          session.state.board.forEach((r: (Player | null)[]) => {
            r.forEach(c => { if (c !== null) discsCount++; });
          });
          setCurrentPlayer(discsCount % 2 === 0 ? 1 : 2);
        } else if (moves.length > 0) {
          const reconstructed: BoardState = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
          moves.forEach(m => {
            if (m.moveData && typeof m.moveData.row === 'number' && typeof m.moveData.col === 'number') {
              reconstructed[m.moveData.row][m.moveData.col] = m.moveData.player as Player;
            }
          });
          setBoard(reconstructed);
          setCurrentPlayer(moves.length % 2 === 0 ? 1 : 2);
        }
      } catch (err) {
        console.error('Failed to initialize ConnectFour Supabase session:', err);
      } finally {
        if (!isCancelled) setIsLoadingSession(false);
      }
    }

    initSession();

    return () => {
      isCancelled = true;
    };
  }, [couple?.id, currentUser?.id, initialSessionId]);

  // Realtime subscription for Supabase game_moves, game_sessions, and broadcast events
  useEffect(() => {
    if (!couple?.id) return;

    const cleanup = ApiService.subscribeToCoupleUpdates(couple.id, (event, data) => {
      if (event === 'game_turn_move') {
        const targetSessionId = data.sessionId;
        if (sessionId && targetSessionId && targetSessionId !== sessionId) {
          return;
        }

        if (data.boardState && Array.isArray(data.boardState)) {
          setBoard(data.boardState);
        } else if (data.moveData && typeof data.moveData.row === 'number' && typeof data.moveData.col === 'number') {
          setBoard(prev => {
            const next = prev.map(r => [...r]);
            next[data.moveData.row][data.moveData.col] = data.moveData.player;
            return next;
          });
        }

        if (data.nextTurnUserId) {
          setActiveSession(prev => prev ? { ...prev, currentTurnUserId: data.nextTurnUserId } : null);
        }

        if (data.isFinished && data.winnerUserId) {
          if (data.winnerUserId === currentUser.id) {
            setWinner(1);
            setScores(s => ({ ...s, p1: s.p1 + 1 }));
          } else if (data.winnerUserId === partner?.id) {
            setWinner(2);
            setScores(s => ({ ...s, p2: s.p2 + 1 }));
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          } else if (data.winnerUserId === 'draw') {
            setWinner('draw');
          }
        }

        setCurrentPlayer(prev => (prev === 1 ? 2 : 1));
      } else if (event === 'game_reset' && data.gameType === 'connect_four' && data.senderId !== currentUser.id) {
        setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
        setCurrentPlayer(1);
        setWinner(null);
      } else if (event === 'game_updated' && data.id === sessionId) {
        setActiveSession(data);
      }
    });

    return cleanup;
  }, [couple?.id, currentUser.id, partner?.id, sessionId]);

  const checkWinner = (b: BoardState): Player | 'draw' | null => {
    // Check horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        const val = b[r][c];
        if (val && val === b[r][c+1] && val === b[r][c+2] && val === b[r][c+3]) return val;
      }
    }
    // Check vertical
    for (let r = 0; r < ROWS - 3; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = b[r][c];
        if (val && val === b[r+1][c] && val === b[r+2][c] && val === b[r+3][c]) return val;
      }
    }
    // Check diagonal down-right
    for (let r = 0; r < ROWS - 3; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        const val = b[r][c];
        if (val && val === b[r+1][c+1] && val === b[r+2][c+2] && val === b[r+3][c+3]) return val;
      }
    }
    // Check diagonal up-right
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        const val = b[r][c];
        if (val && val === b[r-1][c+1] && val === b[r-2][c+2] && val === b[r-3][c+3]) return val;
      }
    }
    // Check draw
    if (b.every(row => row.every(cell => cell !== null))) return 'draw';
    return null;
  };

  const handleDropDisc = async (col: number) => {
    if (winner) return;
    if (!isMyTurn) return;

    // Find the lowest available row in column
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === null) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return; // column full

    const newBoard = board.map(r => [...r]);
    newBoard[targetRow][col] = currentPlayer;
    setBoard(newBoard);

    const winResult = checkWinner(newBoard);
    let winnerId: string | undefined = undefined;
    let nextTurn: string | undefined = undefined;

    if (winResult) {
      setWinner(winResult);
      if (winResult === 1) {
        setScores(s => ({ ...s, p1: s.p1 + 1 }));
        winnerId = isPlayer1 ? currentUser.id : (partner?.id || currentUser.id);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } else if (winResult === 2) {
        setScores(s => ({ ...s, p2: s.p2 + 1 }));
        winnerId = isPlayer1 ? (partner?.id || 'partner') : currentUser.id;
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } else {
        winnerId = 'draw';
      }
    } else {
      nextTurn = partner?.id ? (currentTurnUserId === currentUser.id ? partner.id : currentUser.id) : currentUser.id;
      setActiveSession(prev => prev ? { ...prev, currentTurnUserId: nextTurn } : null);
      setCurrentPlayer(prev => (prev === 1 ? 2 : 1));
    }

    // Persist turn move to Supabase game_moves and update game_sessions
    if (couple?.id && sessionId) {
      try {
        await ApiService.recordGameMove({
          sessionId,
          coupleId: couple.id,
          playerId: currentUser.id,
          playerName: currentUser.displayName,
          moveNumber: moveHistory.length + 1,
          moveData: { row: targetRow, col, player: currentPlayer },
          boardState: newBoard,
          nextTurnUserId: nextTurn,
          isFinished: !!winResult,
          winnerUserId: winnerId,
          score1: winResult === 1 ? scores.p1 + 1 : scores.p1,
          score2: winResult === 2 ? scores.p2 + 1 : scores.p2
        });
      } catch (err) {
        console.error('Error saving connect four turn to Supabase:', err);
      }
    }
  };

  const resetGame = async () => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setCurrentPlayer(1);
    setWinner(null);

    if (couple?.id) {
      try {
        const fresh = await ApiService.createOrGetActiveGameSession({
          coupleId: couple.id,
          gameType: 'connect_four',
          player1Id: currentUser.id,
          player1Name: currentUser.displayName,
          player2Id: partner?.id,
          player2Name: partner?.displayName,
          currentTurnUserId: currentUser.id,
          forceNew: true
        });
        setSessionId(fresh.id);
        setActiveSession(fresh);
        setMoveHistory([]);

        ApiService.broadcastCoupleEvent(couple.id, 'game_reset', {
          gameType: 'connect_four',
          senderId: currentUser.id
        });
      } catch (e) {
        console.error('Error resetting connect four session:', e);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-stone-200 shadow-xs">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Game Hub</span>
        </button>

        <div className="text-center">
          <h3 className="font-serif font-bold text-sm text-stone-800 flex items-center justify-center gap-1.5">
            <span>Connect Four</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected to Supabase Realtime" />
          </h3>
          <span className="text-[10px] text-stone-400 font-medium">Synced via Supabase Realtime</span>
        </div>

        <button
          onClick={resetGame}
          className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer transition-colors"
          title="Restart Game"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Mode & Realtime Sync Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-stone-200 shadow-2xs text-xs">
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-stone-600 font-medium text-[11px]">
            {passAndPlay ? 'Pass & Play Mode' : 'Cross-Device Multiplayer'}
          </span>
        </div>
        <button
          onClick={() => setPassAndPlay(!passAndPlay)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
            passAndPlay
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          {passAndPlay ? 'Switch to Live Sync' : 'Play Same Phone'}
        </button>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-3xl border border-stone-200 shadow-xs text-center">
        <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100">
          <span className="text-[10px] uppercase font-bold text-rose-600 truncate block">
            {currentUser.displayName} (🔴)
          </span>
          <p className="text-lg font-bold text-rose-700">{scores.p1} Wins</p>
        </div>

        <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-100">
          <span className="text-[10px] uppercase font-bold text-amber-600 truncate block">
            {partner?.displayName || 'Partner'} (🟡)
          </span>
          <p className="text-lg font-bold text-amber-700">{scores.p2} Wins</p>
        </div>
      </div>

      {/* Turn & Status Banner */}
      <div className="text-center py-2 px-4 rounded-2xl bg-white border border-stone-200 shadow-2xs font-serif text-sm font-semibold">
        {winner ? (
          winner === 'draw' ? (
            <span className="text-stone-600">🤝 Board full! It's a draw!</span>
          ) : (
            <span className="text-rose-600 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                {winner === 1 ? currentUser.displayName : (partner?.displayName || 'Partner')} Connected 4!
              </span>
            </span>
          )
        ) : (
          <div className="flex items-center justify-center gap-2">
            {isMyTurn ? (
              <span className="text-emerald-600 flex items-center gap-1.5 font-sans text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                ✨ Your Turn - Drop a disc in any column
              </span>
            ) : (
              <span className="text-stone-500 flex items-center gap-1.5 font-sans text-xs font-medium bg-stone-50 px-3 py-1 rounded-full border border-stone-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for {partner?.displayName || 'Partner'} to drop...
              </span>
            )}
          </div>
        )}
      </div>

      {/* 7x6 Grid Board */}
      <div className="p-4 bg-blue-900 rounded-3xl shadow-xl border-4 border-blue-950 max-w-sm mx-auto relative">
        {isLoadingSession && (
          <div className="absolute inset-0 bg-blue-950/80 backdrop-blur-2xs rounded-3xl flex items-center justify-center z-20">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
              Syncing board with Supabase...
            </span>
          </div>
        )}

        {/* Drop Column Buttons */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {Array(COLS).fill(0).map((_, c) => (
            <button
              key={c}
              onClick={() => handleDropDisc(c)}
              disabled={!!winner || (!isMyTurn && !passAndPlay)}
              className="py-1 rounded-lg bg-blue-800 hover:bg-blue-700 text-blue-200 text-xs font-bold transition-colors disabled:opacity-30 cursor-pointer"
              title={`Drop in column ${c + 1}`}
            >
              ↓
            </button>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-2">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => handleDropDisc(c)}
                disabled={!!winner || (!isMyTurn && !passAndPlay)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all bg-blue-950 shadow-inner overflow-hidden cursor-pointer"
              >
                {cell === 1 && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-rose-500 border-2 border-rose-300 shadow-md animate-in zoom-in-50 duration-150 flex items-center justify-center text-xs">
                    ❤️
                  </div>
                )}
                {cell === 2 && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-400 border-2 border-amber-200 shadow-md animate-in zoom-in-50 duration-150 flex items-center justify-center text-xs">
                    ✨
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {winner && (
        <div className="text-center">
          <button
            onClick={resetGame}
            className="py-3 px-8 rounded-2xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 shadow-md cursor-pointer transition-all"
          >
            Play Another Round
          </button>
        </div>
      )}
    </div>
  );
};
