import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, AlertCircle, Info, RefreshCw, Trophy } from 'lucide-react';
import { BoardState, Piece, PieceColor, Square, ChessMove, GameStatus, AILevel, ChessGame, PieceType } from '../types';
import { BoardManager, parseSquare, toSquare } from '../utils/chessEngine';

interface ChessBoardProps {
  game: ChessGame;
  userId: string;
  onPostMove: (from: Square, to: Square, promotion?: PieceType) => void;
  onResetGame?: () => void;
}

// Convert unicode symbols for premium minimalist visual feel
const pieceSymbols: Record<PieceColor, Record<string, string>> = {
  w: { p: '♟\uFE0E', r: '♜\uFE0E', n: '♞\uFE0E', b: '♝\uFE0E', q: '♛\uFE0E', k: '♚\uFE0E' },
  b: { p: '♟\uFE0E', r: '♜\uFE0E', n: '♞\uFE0E', b: '♝\uFE0E', q: '♛\uFE0E', k: '♚\uFE0E' }
};

const PROMOTION_PIECES: { type: PieceType; name: string; symbol: string }[] = [
  { type: 'q', name: 'Queen', symbol: '♛\uFE0E' },
  { type: 'r', name: 'Rook', symbol: '♜\uFE0E' },
  { type: 'b', name: 'Bishop', symbol: '♝\uFE0E' },
  { type: 'n', name: 'Knight', symbol: '♞\uFE0E' }
];

interface PieceWithId extends Piece {
  id: string;
}

// Generates board state with persistent stable piece IDs to enable Framer Motion layoutId slide animations of chess pieces
function getBoardWithStableIds(moves: ChessMove[], activeIndex: number): (PieceWithId | null)[][] {
  const board: (PieceWithId | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  const backRow: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === 0) {
        const type = backRow[c];
        const id = `piece_b_${type}_${String.fromCharCode(97 + c)}${8 - r}`;
        board[r][c] = { type, color: 'b', id };
      } else if (r === 1) {
        const type: PieceType = 'p';
        const id = `piece_b_${type}_${String.fromCharCode(97 + c)}${8 - r}`;
        board[r][c] = { type, color: 'b', id };
      } else if (r === 6) {
        const type: PieceType = 'p';
        const id = `piece_w_${type}_${String.fromCharCode(97 + c)}${8 - r}`;
        board[r][c] = { type, color: 'w', id };
      } else if (r === 7) {
        const type = backRow[c];
        const id = `piece_w_${type}_${String.fromCharCode(97 + c)}${8 - r}`;
        board[r][c] = { type, color: 'w', id };
      }
    }
  }

  const limit = activeIndex === -1 ? moves.length : activeIndex + 1;
  for (let i = 0; i < limit; i++) {
    if (i >= moves.length) break;
    const m = moves[i];
    const { r: rFrom, c: cFrom } = parseSquare(m.from);
    const { r: rTo, c: cTo } = parseSquare(m.to);
    
    const movingPiece = board[rFrom][cFrom];
    if (!movingPiece) continue;

    if (movingPiece.type === 'p' && m.to === m.from[0] + (movingPiece.color === 'w' ? '6' : '3') && !board[rTo][cTo]) {
      const epDir = movingPiece.color === 'w' ? 1 : -1;
      board[rTo + epDir][cTo] = null;
    }

    board[rTo][cTo] = movingPiece;
    board[rFrom][cFrom] = null;

    if (movingPiece.type === 'k' && Math.abs(cTo - cFrom) === 2) {
      const rank = movingPiece.color === 'w' ? 7 : 0;
      if (cTo === 6) {
        const rook = board[rank][7];
        board[rank][5] = rook;
        board[rank][7] = null;
      } else if (cTo === 2) {
        const rook = board[rank][0];
        board[rank][3] = rook;
        board[rank][0] = null;
      }
    }

    if (m.promotion) {
      movingPiece.type = m.promotion;
    }
  }

  return board;
}

export default function ChessBoard({ game, userId, onPostMove, onResetGame }: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [activePlaybackIndex, setActivePlaybackIndex] = useState<number>(-1); // -1 means live FEN
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [showOutcomeOverlay, setShowOutcomeOverlay] = useState<boolean>(true);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

  // Re-generate board state on changes or playback rewind
  const currentFen = activePlaybackIndex === -1 
    ? game.fen 
    : (activePlaybackIndex < game.moves.length && activePlaybackIndex >= 0
        ? game.moves[activePlaybackIndex].fenAfter 
        : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  const manager = new BoardManager(currentFen);
  const board = manager.board;
  const currentTurn = manager.turn;
  const isPlaybackMode = activePlaybackIndex !== -1;

  // Track legal destination options for the selected piece
  const legalMovesForSelected = selectedSquare && !isPlaybackMode
    ? manager.getLegalMoves().filter(m => m.from === selectedSquare)
    : [];

  const isUserTurn = !isPlaybackMode && (
    (currentTurn === 'w' && game.whitePlayer?.id === userId) ||
    (currentTurn === 'b' && game.blackPlayer?.id === userId)
  );

  const isWhite = game.whitePlayer?.id === userId;
  const isBlack = game.blackPlayer?.id === userId;
  const isTerminal = game.status === 'white_won' || game.status === 'black_won' || game.status.startsWith('draw_') || game.status === 'aborted';

  const shouldRotate = isBlack;
  const boardRowIndices = shouldRotate ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const boardColIndices = shouldRotate ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  // Abort and draw restriction checks
  const movesMadeByPlayer = game.moves.filter((_, idx) => (idx % 2 === 0 && isWhite) || (idx % 2 === 1 && isBlack)).length;
  const canAbort = movesMadeByPlayer === 0 && !isTerminal;
  const drawSuggestedOnThisMove = game.drawOfferMoveCount !== undefined && game.drawOfferMoveCount !== null && game.drawOfferMoveCount === game.moves.length;

  // Toggle overlay on completion
  useEffect(() => {
    if (isTerminal) {
      setShowOutcomeOverlay(true);
    } else {
      setShowOutcomeOverlay(false);
    }
  }, [isTerminal]);

  // Suggest draw to counterpart
  const handleSuggestDraw = async () => {
    try {
      const res = await fetch(`/api/games/${game.id}/offer-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: userId })
      });
      if (!res.ok) {
        const details = await res.json();
        setUiError(details.error || 'Failed to suggest draw.');
        setTimeout(() => setUiError(null), 3000);
      } else {
        setUiMessage('Draw suggested!');
        setTimeout(() => setUiMessage(null), 3000);
      }
    } catch (e) {
      setUiError('Draw suggest action failed.');
      setTimeout(() => setUiError(null), 3000);
    }
  };

  // Resignation action
  const handleResign = async () => {
    if (!window.confirm('Are you sure you want to resign?')) return;
    try {
      const res = await fetch(`/api/games/${game.id}/resign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: userId })
      });
      if (!res.ok) {
        const details = await res.json();
        setUiError(details.error || 'Failed to resign.');
        setTimeout(() => setUiError(null), 3000);
      }
    } catch (e) {
      setUiError('Resign action failed.');
      setTimeout(() => setUiError(null), 3500);
    }
  };

  // Abort game trigger
  const handleAbort = async () => {
    try {
      const res = await fetch(`/api/games/${game.id}/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: userId })
      });
      if (!res.ok) {
        const details = await res.json();
        setUiError(details.error || 'Failed to abort.');
        setTimeout(() => setUiError(null), 3000);
      }
    } catch (e) {
      setUiError('Abort action failed.');
      setTimeout(() => setUiError(null), 3000);
    }
  };

  // Multi-player Draw decisioning
  const handleAcceptDraw = async () => {
    try {
      const res = await fetch(`/api/games/${game.id}/accept-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: userId })
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      setUiError('Failed to accept draw.');
      setTimeout(() => setUiError(null), 3000);
    }
  };

  const handleDeclineDraw = async () => {
    try {
      const res = await fetch(`/api/games/${game.id}/decline-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: userId })
      });
      if (!res.ok) throw new Error();
    } catch (e) {
      setUiError('Failed to decline draw.');
      setTimeout(() => setUiError(null), 3000);
    }
  };

  // Convert game duration safely
  const getGameDurationString = (): string => {
    const start = new Date(game.createdAt).getTime();
    const end = new Date(game.updatedAt).getTime();
    const diffMs = Math.max(0, end - start);
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Auto playback loop
  useEffect(() => {
    let timer: any;
    if (isAutoPlaying && isPlaybackMode) {
      timer = setInterval(() => {
        if (activePlaybackIndex < game.moves.length - 1) {
          setActivePlaybackIndex(prev => prev + 1);
        } else {
          setActivePlaybackIndex(-1);
          setIsAutoPlaying(false);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, isPlaybackMode, activePlaybackIndex, game.moves]);

  // Chess board interactions
  const handleSquareClick = (sq: Square) => {
    if (isPlaybackMode || game.status.startsWith('white_won') || game.status.startsWith('black_won') || game.status.startsWith('draw_')) {
      return;
    }

    const { r, c } = parseSquare(sq);
    const piece = board[r][c];

    if (selectedSquare === sq) {
      setSelectedSquare(null);
      return;
    }

    // Try executing move if destination clicked
    if (selectedSquare) {
      const isLegal = legalMovesForSelected.some(m => m.to === sq);
      if (isLegal) {
        const { r: rFrom, c: cFrom } = parseSquare(selectedSquare);
        const { r: rTo } = parseSquare(sq);
        const movingPiece = board[rFrom][cFrom];
        
        if (movingPiece && movingPiece.type === 'p' && (rTo === 0 || rTo === 7)) {
          setPromotionPending({ from: selectedSquare, to: sq });
        } else {
          onPostMove(selectedSquare, sq);
        }
        setSelectedSquare(null);
        return;
      }
    }

    // Select piece if it's the player's turn and matching color
    if (piece && piece.color === currentTurn) {
      if ((currentTurn === 'w' && game.whitePlayer?.id === userId) ||
          (currentTurn === 'b' && game.blackPlayer?.id === userId)) {
        setSelectedSquare(sq);
      }
    } else {
      setSelectedSquare(null);
    }
  };

  // Evaluate simple materials balance for live evaluation bar
  const getMaterialEvaluationValue = (): number => {
    const weights: Record<string, number> = { p: 1, n: 3, b: 3.25, r: 5, q: 9, k: 0 };
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell) {
          const mod = cell.color === 'w' ? 1 : -1;
          score += weights[cell.type] * mod;
        }
      }
    }
    // Convert to percentage centered on 50%
    const cappedScore = Math.max(-10, Math.min(10, score));
    return 50 + (cappedScore * 4); // 50 is center, max/min is 90% and 10%
  };

  const evalPercent = getMaterialEvaluationValue();

  // Extract captures
  const getCapturedPieces = (color: PieceColor): string[] => {
    const list: string[] = [];
    const counts = { p: 8, r: 2, n: 2, b: 2, q: 1 };
    const currentOnBoard = { p: 0, r: 0, n: 0, b: 0, q: 0 };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell && cell.color === color && cell.type !== 'k') {
          currentOnBoard[cell.type as keyof typeof currentOnBoard]++;
        }
      }
    }

    Object.keys(counts).forEach(key => {
      const missing = counts[key as keyof typeof counts] - currentOnBoard[key as keyof typeof currentOnBoard];
      if (missing > 0) {
        for (let i = 0; i < missing; i++) {
          list.push(pieceSymbols[color][key] || key.toUpperCase());
        }
      }
    });

    return list;
  };

  const capturedByWhite = getCapturedPieces('b');
  const capturedByBlack = getCapturedPieces('w');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto px-4" id="chess_view_grid">
      
      {/* Board Left/Center Panel (9 cols on large screens) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        
        {/* Black Player Banner */}
        <div className="flex items-center justify-between px-2 py-2 rounded-2xl bg-white/45 backdrop-blur-sm border border-white/30" id="black_player_badge">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display text-lg ${
              (game.blackPlayer as any)?.isAI ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-200 text-zinc-800'
            }`}>
              {(game.blackPlayer as any)?.isAI ? '🤖' : (game.blackPlayer?.username?.[0] || 'B').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tracking-tight text-zinc-900 leading-tight">
                  {game.blackPlayer?.username || 'Opponent Joining...'}
                </span>
                {(game.blackPlayer as any)?.isAI && (
                  <span className="text-[10px] bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded-md font-mono tracking-wider font-light">
                    AI: {(game.blackPlayer as any).level}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-zinc-500">
                Rating: {game.blackPlayer?.rating || 1200}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Captured and Turn Indicator */}
            <div className="flex gap-1 pr-2 max-w-[120px] overflow-hidden">
              {capturedByBlack.map((symbol, idx) => (
                <span key={idx} className="text-base text-zinc-650 opacity-80">{symbol}</span>
              ))}
            </div>
            {currentTurn === 'b' && !isPlaybackMode && (
              <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" title="Active selection turn"></div>
            )}
          </div>
        </div>

        {/* Board Main Canvas featuring Jony Ive evaluation layout */}
        <div className="relative flex gap-4 bg-white/30 backdrop-blur-md border border-white/50 p-4 sm:p-6 rounded-3xl shadow-xl overflow-hidden" id="interactive_chess_canvas">
          
          {/* Vertical Jony Ive Evaluation Bar */}
          <div className="w-2 sm:w-3.5 h-auto rounded-full bg-zinc-300 relative overflow-hidden self-stretch shrink-0 flex flex-col justify-between" title="Live Board Strength Balance">
            <motion.div 
              animate={{ height: `${100 - evalPercent}%` }}
              transition={{ type: "spring", stiffness: 40, damping: 15 }}
              className="bg-zinc-950 w-full"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[8px] font-mono font-medium mix-blend-difference text-white opacity-40">
              C
            </div>
          </div>

          {/* Chess grid frame */}
          <div className="grow relative aspect-square" id="board_cells_mesh">
            <div className="grid grid-cols-8 grid-rows-8 h-full rounded-2xl overflow-hidden border border-[#D2D2D7]/40 bg-[#E2E4E6] shadow-sm relative">
              {boardRowIndices.map((r, visualR) => 
                boardColIndices.map((c, visualC) => {
                  const piece = board[r][c];
                  const sq = toSquare(r, c);
                  const isLight = (r + c) % 2 === 0;
                  const isSelected = selectedSquare === sq;
                  const isLastMoveSrc = game.moves.length > 0 && game.moves[game.moves.length - 1].from === sq;
                  const isLastMoveDst = game.moves.length > 0 && game.moves[game.moves.length - 1].to === sq;
                  const isHighlightedOption = legalMovesForSelected.some(m => m.to === sq);
                  const isCheckSquare = piece && piece.type === 'k' && manager.isInCheck(piece.color);

                  return (
                    <div
                      key={sq}
                      onClick={() => handleSquareClick(sq)}
                      id={`cell_${sq}`}
                      className={`relative aspect-square flex items-center justify-center cursor-pointer transition-colors duration-150 select-none ${
                        isLight 
                          ? (isLastMoveSrc || isLastMoveDst) ? 'bg-blue-100/60' : 'bg-[#F0F1F2]' 
                          : (isLastMoveSrc || isLastMoveDst) ? 'bg-blue-200/50' : 'bg-[#E2E4E6]'
                      } ${isSelected ? 'ring-2 ring-[#0071E3] ring-offset-2 ring-offset-white shadow-md z-30' : ''}`}
                    >
                      {/* Grid index labels (coordinate files) rendered tiny (Apple margins) */}
                      {visualR === 7 && (
                        <span className="absolute bottom-1 right-1 text-[8px] font-mono text-[#86868B] font-medium uppercase">
                          {String.fromCharCode(97 + c)}
                        </span>
                      )}
                      {visualC === 0 && (
                        <span className="absolute top-1 left-1 text-[8px] font-mono text-[#86868B] font-medium">
                          {8 - r}
                        </span>
                      )}

                      {/* Standard Piece Glyphs */}
                      {piece && (
                        <motion.div
                          layoutId={`piece_${r}_${c}`}
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          className={`text-4xl sm:text-5xl md:text-6xl font-light select-none transform duration-150 z-10 flex items-center justify-center leading-none ${
                            piece.color === 'w' 
                              ? 'text-white drop-shadow-[0_3px_5px_rgba(0,0,0,0.25)] filter hover:scale-110' 
                              : 'text-[#1D1D1F] drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)] hover:scale-110'
                          }`}
                          style={piece.color === 'w' ? {
                            WebkitTextStroke: '1.5px #1D1D1F',
                            textStroke: '1.5px #1D1D1F',
                            paintOrder: 'stroke fill'
                          } : {
                            WebkitTextStroke: '0.8px #1D1D1F',
                            textStroke: '0.8px #1D1D1F',
                            paintOrder: 'stroke fill'
                          }}
                        >
                          {pieceSymbols[piece.color][piece.type]}
                        </motion.div>
                      )}

                      {/* Check Highlight glowing backdrop */}
                      {isCheckSquare && (
                        <div className="absolute inset-0 bg-red-500/20 animate-pulse border border-red-500 pointer-events-none rounded-none"></div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Elegant Outcome Overlay sheet matching Apple minimalist styles */}
            <AnimatePresence>
              {isTerminal && showOutcomeOverlay && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/70 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center select-none"
                  id="match_outcome_modal_overlay"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 15 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 15 }}
                    transition={{ type: "spring", stiffness: 220, damping: 25, mass: 0.8 }}
                    className="max-w-xs bg-white border border-[#D2D2D7]/50 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center text-3xl shadow-sm border border-white">
                      🏆
                    </div>

                    <div>
                      <h4 className="font-display text-xl font-light tracking-tight text-zinc-950 mb-1">
                        Game Over
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-semibold mb-3">
                        {game.outcomeReason || "by Checkmate"}
                      </p>

                      <p className="text-sm font-semibold text-zinc-800 leading-snug px-2">
                        {game.status === 'white_won' && `${game.whitePlayer?.username || 'White'} won the battle!`}
                        {game.status === 'black_won' && `${game.blackPlayer?.username || 'Black'} won the battle!`}
                        {game.status === 'draw_stalemate' && 'Draw match by Stalemate.'}
                        {game.status === 'draw_repetition' && 'Draw by Threefold Repetition.'}
                        {game.status === 'draw_agreement' && 'Draw settled by Mutual Agreement.'}
                        {game.status === 'aborted' && 'Match Aborted before play.'}
                      </p>
                    </div>

                    <div className="w-full border-t border-zinc-150 pt-3 flex flex-col gap-1 text-[11px]">
                      <div className="flex justify-between px-1 text-[#86868B] font-mono">
                        <span>Duration:</span>
                        <span className="font-semibold text-zinc-800">{getGameDurationString()}</span>
                      </div>
                      <div className="flex justify-between px-1 text-[#86868B] font-mono">
                        <span>Total Moves:</span>
                        <span className="font-semibold text-zinc-800">{game.moves.length} plies</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full mt-2">
                      <button
                        onClick={() => setShowOutcomeOverlay(false)}
                        className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-850 transition-all shadow-sm cursor-pointer"
                        id="dismiss_outcome_btn"
                      >
                        Review Chess Board
                      </button>
                      {onResetGame && (
                        <button
                          onClick={onResetGame}
                          className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 text-xs font-semibold transition-all cursor-pointer"
                          id="outcome_back_lobby_btn"
                        >
                          Return to Lobby
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Elegant Pawn Promotion Overlay */}
            <AnimatePresence>
              {promotionPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#F5F5F7]/85 backdrop-blur-md z-45 flex flex-col items-center justify-center p-6 text-center select-none"
                  id="pawn_promotion_overlay"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 15 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 15 }}
                    transition={{ type: "spring", stiffness: 220, damping: 25, mass: 0.8 }}
                    className="max-w-xs w-full bg-white border border-[#D2D2D7]/50 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#E8E8ED] flex items-center justify-center text-3xl shadow-sm border border-white">
                      👑
                    </div>

                    <div>
                      <h4 className="font-display text-lg font-medium tracking-tight text-zinc-950 mb-1">
                        Pawn Promotion
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-semibold">
                        Select promotion piece
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full my-1">
                      {PROMOTION_PIECES.map(({ type, name, symbol }) => {
                        const promoterColor = currentTurn;
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              onPostMove(promotionPending.from, promotionPending.to, type);
                              setPromotionPending(null);
                            }}
                            className="flex flex-col items-center justify-center p-3 rounded-2xl border border-zinc-150 bg-[#F5F5F7] hover:bg-[#E8E8ED] active:scale-95 transition-all text-center cursor-pointer group"
                          >
                            <span 
                              className={`text-4xl leading-none mb-1 select-none transition-transform group-hover:scale-110 ${
                                promoterColor === 'w' 
                                  ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]' 
                                  : 'text-[#1D1D1F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
                              }`}
                              style={promoterColor === 'w' ? {
                                WebkitTextStroke: '1.2px #1D1D1F',
                                textStroke: '1.2px #1D1D1F',
                                paintOrder: 'stroke fill'
                              } : {
                                WebkitTextStroke: '0.6px #1D1D1F',
                                textStroke: '0.6px #1D1D1F',
                                paintOrder: 'stroke fill'
                              }}
                            >
                              {symbol}
                            </span>
                            <span className="text-xs font-semibold text-zinc-700 font-sans group-hover:text-zinc-950">
                              {name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setPromotionPending(null)}
                      className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Cancel Move
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Playback Rewind Visual State Overlay Banner */}
            {isPlaybackMode && (
              <div className="absolute inset-0 bg-zinc-100/15 pointer-events-none flex items-center justify-center">
                <div className="px-5 py-2.5 rounded-full bg-zinc-950/80 backdrop-blur-md text-white border border-white/10 text-xs font-mono font-medium shadow-md">
                  Analyzing Move {activePlaybackIndex + 1} of {game.moves.length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* White Player Banner */}
        <div className="flex items-center justify-between px-2 py-2 rounded-2xl bg-white/45 backdrop-blur-sm border border-white/30" id="white_player_badge">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-zinc-900 border border-zinc-200 flex items-center justify-center font-display text-lg font-light shadow-sm">
              {(game.whitePlayer?.username?.[0] || 'W').toUpperCase()}
            </div>
            <div>
              <span className="block text-sm font-semibold tracking-tight text-zinc-900 leading-tight">
                {game.whitePlayer?.username || 'Awaiting Player...'} {game.whitePlayer?.id === userId && ' (You)'}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                Rating: {game.whitePlayer?.rating || 1200}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 pr-2 max-w-[120px] overflow-hidden">
              {capturedByWhite.map((symbol, idx) => (
                <span key={idx} className="text-base text-zinc-800 opacity-90">{symbol}</span>
              ))}
            </div>
            {currentTurn === 'w' && !isPlaybackMode && (
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 animate-pulse"></div>
            )}
          </div>
        </div>

      </div>

      {/* Analytics side-deck panel (4 columns on large screens) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Game State Diagnostics Panel */}
        <div className="glass-panel p-5 rounded-3xl" id="status_alert_glass">
          <h3 className="font-display text-lg font-light tracking-tight text-zinc-900 mb-2">
            Game Status
          </h3>
          
          <div className="py-2.5 flex flex-col gap-2">
            {game.drawOfferBy && game.drawOfferBy !== userId && !isTerminal && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl w-full text-blue-950 mb-2 flex flex-col gap-2 shadow-sm" id="draw_offer_action_banner">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-900">
                  <Info className="w-3.5 h-3.5" />
                  Draw Suggested
                </div>
                <p className="text-[11px] text-blue-850 leading-snug">
                  The opponent has suggested a draw. Settle the match by agreement?
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleAcceptDraw} 
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    id="draw_accept_btn"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={handleDeclineDraw} 
                    className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    id="draw_decline_btn"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {uiMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-[11px] font-mono leading-tight mb-1">
                {uiMessage}
              </div>
            )}

            {uiError && (
              <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-red-800 text-[11px] font-mono leading-tight mb-1">
                {uiError}
              </div>
            )}

            {!isTerminal && game.status.startsWith('white_to_move') && (
              <div className="text-xs font-medium text-zinc-700 bg-zinc-100 border border-zinc-250 px-3 py-1.5 rounded-xl w-full flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                White to make decision
              </div>
            )}
            {!isTerminal && game.status.startsWith('black_to_move') && (
              <div className="text-xs font-medium text-zinc-700 bg-zinc-100 border border-zinc-250 px-3 py-1.5 rounded-xl w-full flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                Black to make decision
              </div>
            )}
            {isTerminal && (
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl w-full text-zinc-900 shadow-sm relative">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Trophy className="w-4 h-4 text-zinc-800" />
                    Match Concluded
                  </div>
                  {!showOutcomeOverlay && (
                    <button
                      onClick={() => setShowOutcomeOverlay(true)}
                      className="text-[10px] font-mono text-[#0071E3] hover:underline font-semibold cursor-pointer"
                      id="status_show_cert_btn"
                    >
                      Show Certificate
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-650 leading-relaxed font-light">
                  {game.status === 'white_won' && `${game.whitePlayer?.username || 'White'} won the battle ${game.outcomeReason || ''}`}
                  {game.status === 'black_won' && `${game.blackPlayer?.username || 'Black'} won the battle ${game.outcomeReason || ''}`}
                  {game.status === 'draw_stalemate' && 'Draw settled by Stalemate.'}
                  {game.status === 'draw_repetition' && 'Draw settled by Threefold Repetition.'}
                  {game.status === 'draw_agreement' && 'Draw settled by Mutual Agreement.'}
                  {game.status === 'aborted' && 'Match aborted.'}
                </p>
              </div>
            )}
          </div>

          {/* Quick controls deck */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => {
                setActivePlaybackIndex(-1);
                setIsAutoPlaying(false);
              }}
              disabled={!isPlaybackMode}
              id="live_board_btn"
              className={`py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                !isPlaybackMode 
                  ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                  : 'bg-zinc-950 text-white border-zinc-950 hover:bg-zinc-850 cursor-pointer'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Active Live
            </button>

            {onResetGame && (
              <button
                onClick={onResetGame}
                id="reset_board_btn"
                className="py-2 rounded-xl text-xs font-medium border bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Match
              </button>
            )}
          </div>

          {/* Match Actions Deck (Only for active players during active gameplay) */}
          {!isTerminal && (isWhite || isBlack) && (
            <div className="border-t border-zinc-200/60 pt-4 mt-4 space-y-2 select-none" id="action_deck_group">
              <span className="block text-[#86868B] text-[10px] uppercase font-semibold tracking-wider">
                Match Actions
              </span>
              <div className="grid grid-cols-3 gap-2">
                {/* Abort Button matches Apple styling */}
                <button
                  onClick={handleAbort}
                  disabled={!canAbort}
                  id="action_abort_btn"
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    canAbort
                      ? 'bg-zinc-100 hover:bg-zinc-150 text-zinc-700 border-zinc-250 cursor-pointer'
                      : 'bg-zinc-50 text-zinc-300 border-zinc-200 cursor-not-allowed'
                  }`}
                  title={!canAbort ? "Abort is only available before making your first move." : "Abort game"}
                >
                  Abort
                </button>

                {/* Offer Draw Button */}
                <button
                  onClick={handleSuggestDraw}
                  disabled={drawSuggestedOnThisMove}
                  id="action_draw_btn"
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1 transition-all ${
                    drawSuggestedOnThisMove
                      ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                      : 'bg-zinc-100 hover:bg-zinc-150 text-zinc-700 border-zinc-250 cursor-pointer'
                  }`}
                  title={drawSuggestedOnThisMove ? "You can only suggest draw once per move." : "Offer draw"}
                >
                  {drawSuggestedOnThisMove ? 'Offered' : 'Offer Draw'}
                </button>

                {/* Resign Button */}
                <button
                  onClick={handleResign}
                  id="action_resign_btn"
                  className="py-2 px-1 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 transition-all cursor-pointer"
                  title="Resign of match"
                >
                  Resign
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Move History / Analysis Ledger Panel */}
        <div className="glass-panel p-5 rounded-3xl flex-1 flex flex-col max-h-[380px]" id="moves_ledger_panel">
          <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-2">
            <h3 className="font-display text-lg font-light tracking-tight text-zinc-900">
              Move Ledger 
            </h3>
            <span className="text-[10px] bg-zinc-100 text-zinc-500 font-mono px-2 py-0.5 rounded-full font-medium">
              Total plies: {game.moves.length}
            </span>
          </div>

          {/* List of moves (two per row) */}
          <div className="overflow-y-auto flex-1 pr-1" id="moves_scroll_area">
            {game.moves.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <ClockIcon className="w-6 h-6 text-zinc-300 mb-2" />
                <p className="text-xs text-zinc-400 font-light leading-normal">
                  No moves recorded. Develop standard chess arrays to evaluate matches.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {Array.from({ length: Math.ceil(game.moves.length / 2) }).map((_, index) => {
                  const whiteMoveIdx = index * 2;
                  const blackMoveIdx = index * 2 + 1;
                  const mWhite = game.moves[whiteMoveIdx];
                  const mBlack = game.moves[blackMoveIdx];

                  return (
                    <div 
                      key={index} 
                      className={`grid grid-cols-12 py-1.5 px-2 rounded-lg text-xs font-mono select-none ${
                        (activePlaybackIndex === whiteMoveIdx || activePlaybackIndex === blackMoveIdx)
                          ? 'bg-amber-50/70 border border-amber-200/50' 
                          : 'hover:bg-zinc-50 border border-transparent'
                      }`}
                    >
                      <span className="col-span-2 text-zinc-400 text-right pr-2">
                        {index + 1}.
                      </span>
                      
                      {/* White Move */}
                      <button
                        onClick={() => {
                          setActivePlaybackIndex(whiteMoveIdx);
                          setIsAutoPlaying(false);
                        }}
                        id={`move_ledger_white_${whiteMoveIdx}`}
                        className={`col-span-5 text-left font-medium rounded px-1 text-zinc-800 ${
                          activePlaybackIndex === whiteMoveIdx ? 'text-amber-800 bg-amber-200/40' : 'hover:bg-zinc-200/50'
                        }`}
                      >
                        {mWhite.notation}
                      </button>

                      {/* Black Move */}
                      {mBlack ? (
                        <button
                          onClick={() => {
                            setActivePlaybackIndex(blackMoveIdx);
                            setIsAutoPlaying(false);
                          }}
                          id={`move_ledger_black_${blackMoveIdx}`}
                          className={`col-span-5 text-left font-medium rounded px-1 text-zinc-800 ${
                            activePlaybackIndex === blackMoveIdx ? 'text-amber-800 bg-amber-200/40' : 'hover:bg-zinc-200/50'
                          }`}
                        >
                          {mBlack.notation}
                        </button>
                      ) : (
                        <span className="col-span-5"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Playback Control Deck */}
          {game.moves.length > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-100 pt-3 mt-3">
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setActivePlaybackIndex(0);
                  }}
                  id="playback_start_btn"
                  title="First piece positions"
                  className="p-1.5 text-zinc-650 hover:text-zinc-900 hover:bg-zinc-105 rounded-lg border border-transparent"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setActivePlaybackIndex(prev => prev > 0 ? prev - 1 : 0);
                  }}
                  id="playback_prev_btn"
                  className="p-1.5 text-zinc-650 hover:text-zinc-900 hover:bg-zinc-105 rounded-lg border border-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  if (activePlaybackIndex === -1) {
                    setActivePlaybackIndex(0);
                    setIsAutoPlaying(true);
                  } else {
                    setIsAutoPlaying(!isAutoPlaying);
                  }
                }}
                id="playback_play_btn"
                className="px-4 py-1.5 rounded-full bg-zinc-100 border border-zinc-250 text-zinc-700 hover:bg-zinc-150 transition-all text-xs font-medium flex items-center gap-1"
              >
                {isAutoPlaying ? <Pause className="w-3 h-3 shrink-0 text-amber-500 fill-amber-500" /> : <Play className="w-3 h-3 shrink-0" />}
                {isAutoPlaying ? 'Pause' : 'Autoplay'}
              </button>

              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setActivePlaybackIndex(prev => {
                      if (prev === -1 || prev >= game.moves.length - 1) return -1;
                      return prev + 1;
                    });
                  }}
                  id="playback_next_btn"
                  className="p-1.5 text-zinc-650 hover:text-zinc-900 hover:bg-zinc-105 rounded-lg border border-transparent"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setActivePlaybackIndex(-1);
                  }}
                  id="playback_end_btn"
                  title="Forward to live FEN"
                  className="p-1.5 text-zinc-650 hover:text-zinc-900 hover:bg-zinc-105 rounded-lg border border-transparent"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Minimalistic Chess decorative clock svg
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
