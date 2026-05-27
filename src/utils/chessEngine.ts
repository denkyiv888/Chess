import { Piece, PieceType, PieceColor, Square, BoardState, ChessMove, GameStatus, AILevel } from '../types';

// Convert algebraic notation to grid indices (row, col)
export function parseSquare(sq: Square): { r: number; c: number } {
  const c = sq.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const r = 8 - parseInt(sq[1], 10); // '8' -> 0, '1' -> 7
  return { r, c };
}

// Convert grid indices to algebraic notation
export function toSquare(r: number, c: number): Square {
  const file = String.fromCharCode(97 + c);
  const rank = (8 - r).toString();
  return `${file}${rank}`;
}

// Helper: initial board setup FEN or default
export const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class BoardManager {
  board: BoardState = Array(8).fill(null).map(() => Array(8).fill(null));
  turn: PieceColor = 'w';
  castlingRights = { w: { k: true, q: true }, b: { k: true, q: true } };
  enPassantTarget: Square | null = null;
  halfmoveClock: number = 0;
  fullmoveNumber: number = 1;

  constructor(fen?: string, skipLoad = false) {
    if (!skipLoad) {
      this.loadFen(fen || INITIAL_FEN);
    }
  }

  loadFen(fen: string) {
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      let c = 0;
      const rowStr = rows[r];
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (/[1-8]/.test(char)) {
          c += parseInt(char, 10);
        } else {
          const color: PieceColor = char === char.toUpperCase() ? 'w' : 'b';
          const type: PieceType = char.toLowerCase() as PieceType;
          this.board[r][c] = { type, color };
          c++;
        }
      }
    }

    this.turn = parts[1] === 'w' ? 'w' : 'b';

    // Castling rights
    const castling = parts[2] || '-';
    this.castlingRights = {
      w: { k: castling.includes('K'), q: castling.includes('Q') },
      b: { k: castling.includes('k'), q: castling.includes('q') }
    };

    // En Passant
    const ep = parts[3] || '-';
    this.enPassantTarget = ep === '-' ? null : ep;
    
    this.halfmoveClock = parseInt(parts[4] || '0', 10);
    this.fullmoveNumber = parseInt(parts[5] || '1', 10);
  }

  generateFen(): string {
    const rows: string[] = [];
    for (let r = 0; r < 8; r++) {
      let rowStr = '';
      let emptyCount = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount.toString();
            emptyCount = 0;
          }
          const char = p.type;
          rowStr += p.color === 'w' ? char.toUpperCase() : char;
        }
      }
      if (emptyCount > 0) {
        rowStr += emptyCount.toString();
      }
      rows.push(rowStr);
    }

    const castlingParts: string[] = [];
    if (this.castlingRights.w.k) castlingParts.push('K');
    if (this.castlingRights.w.q) castlingParts.push('Q');
    if (this.castlingRights.b.k) castlingParts.push('k');
    if (this.castlingRights.b.q) castlingParts.push('q');
    const castling = castlingParts.join('') || '-';

    const ep = this.enPassantTarget || '-';

    return `${rows.join('/')} ${this.turn} ${castling} ${ep} ${this.halfmoveClock} ${this.fullmoveNumber}`;
  }

  clone(): BoardManager {
    const cloned = new BoardManager(undefined, true);
    cloned.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    cloned.turn = this.turn;
    cloned.castlingRights = {
      w: { ...this.castlingRights.w },
      b: { ...this.castlingRights.b }
    };
    cloned.enPassantTarget = this.enPassantTarget;
    cloned.halfmoveClock = this.halfmoveClock;
    cloned.fullmoveNumber = this.fullmoveNumber;
    return cloned;
  }

  // Generate pseudo-legal moves for a square without checking self-check:
  getPseudoMoves(sq: Square): { to: Square; notation: string }[] {
    const { r, c } = parseSquare(sq);
    const piece = this.board[r][c];
    if (!piece) return [];

    const moves: { to: Square; notation: string }[] = [];
    const color = piece.color;
    const opponent = color === 'w' ? 'b' : 'w';

    switch (piece.type) {
      case 'p': {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;

        // 1-step forward
        const targetR = r + dir;
        if (targetR >= 0 && targetR < 8 && !this.board[targetR][c]) {
          moves.push({ to: toSquare(targetR, c), notation: toSquare(targetR, c) });
          // 2-step forward from starting row
          const startR2 = r + 2 * dir;
          if (r === startRow && !this.board[startR2][c]) {
            moves.push({ to: toSquare(startR2, c), notation: toSquare(startR2, c) });
          }
        }

        // Diagonals capturing
        const diagCols = [c - 1, c + 1];
        for (const dc of diagCols) {
          if (dc >= 0 && dc < 8 && targetR >= 0 && targetR < 8) {
            const targetPiece = this.board[targetR][dc];
            if (targetPiece && targetPiece.color === opponent) {
              moves.push({ to: toSquare(targetR, dc), notation: `${String.fromCharCode(97 + c)}x${toSquare(targetR, dc)}` });
            } else if (this.enPassantTarget === toSquare(targetR, dc)) {
              moves.push({ to: toSquare(targetR, dc), notation: `${String.fromCharCode(97 + c)}x${toSquare(targetR, dc)} e.p.` });
            }
          }
        }
        break;
      }

      case 'n': {
        const knightJumps = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightJumps) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const dest = this.board[nr][nc];
            if (!dest || dest.color === opponent) {
              const cap = dest ? 'x' : '';
              moves.push({ to: toSquare(nr, nc), notation: `N${cap}${toSquare(nr, nc)}` });
            }
          }
        }
        break;
      }

      case 'b':
      case 'r':
      case 'q': {
        const dirs: [number, number][] = [];
        if (piece.type === 'r' || piece.type === 'q') {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }
        if (piece.type === 'b' || piece.type === 'q') {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }

        const prefix = piece.type.toUpperCase();

        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const dest = this.board[nr][nc];
            if (!dest) {
              moves.push({ to: toSquare(nr, nc), notation: `${prefix}${toSquare(nr, nc)}` });
            } else {
              if (dest.color === opponent) {
                moves.push({ to: toSquare(nr, nc), notation: `${prefix}x${toSquare(nr, nc)}` });
              }
              break; // Blocked
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }

      case 'k': {
        const kingDirs = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of kingDirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const dest = this.board[nr][nc];
            if (!dest || dest.color === opponent) {
              const cap = dest ? 'x' : '';
              moves.push({ to: toSquare(nr, nc), notation: `K${cap}${toSquare(nr, nc)}` });
            }
          }
        }

        // Castling
        const rights = this.castlingRights[color];
        const rank = color === 'w' ? 7 : 0;
        
        // Kingside
        if (rights.k && !this.board[rank][5] && !this.board[rank][6]) {
          moves.push({ to: toSquare(rank, 6), notation: 'O-O' });
        }
        // Queenside
        if (rights.q && !this.board[rank][1] && !this.board[rank][2] && !this.board[rank][3]) {
          moves.push({ to: toSquare(rank, 2), notation: 'O-O-O' });
        }
        break;
      }
    }

    return moves;
  }

  isSquareAttacked(sq: Square, attackerColor: PieceColor): boolean {
    const { r, c } = parseSquare(sq);

    // Look for knights
    const knightJumps = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightJumps) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = this.board[nr][nc];
        if (p && p.type === 'n' && p.color === attackerColor) return true;
      }
    }

    // Look for lines (rooks/queens)
    const cardDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of cardDirs) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = this.board[nr][nc];
        if (p) {
          if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
          break; // Blocked
        }
        nr += dr;
        nc += dc;
      }
    }

    // Look for diagonals (bishops/queens)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = this.board[nr][nc];
        if (p) {
          if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
          break; // Blocked
        }
        nr += dr;
        nc += dc;
      }
    }

    // Look for pawns
    const pDirection = attackerColor === 'w' ? 1 : -1; // Pawn attacking downwards or upwards
    const pawnRow = r + pDirection;
    if (pawnRow >= 0 && pawnRow < 8) {
      for (const dc of [c - 1, c + 1]) {
        if (dc >= 0 && dc < 8) {
          const p = this.board[pawnRow][dc];
          if (p && p.type === 'p' && p.color === attackerColor) return true;
        }
      }
    }

    // Look for King
    const kingDirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of kingDirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = this.board[nr][nc];
        if (p && p.type === 'k' && p.color === attackerColor) return true;
      }
    }

    return false;
  }

  isInCheck(color: PieceColor): boolean {
    // Find King
    let kingSq: Square = 'e1';
    let found = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          kingSq = toSquare(r, c);
          found = true;
          break;
        }
      }
      if (found) break;
    }

    return this.isSquareAttacked(kingSq, color === 'w' ? 'b' : 'w');
  }

  // Get ALL legal moves for current player
  getLegalMoves(): { from: Square; to: Square; notation: string }[] {
    const legal: { from: Square; to: Square; notation: string }[] = [];
    const color = this.turn;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          const sq = toSquare(r, c);
          const pseudo = this.getPseudoMoves(sq);
          for (const m of pseudo) {
            // Check castling legality: King cannot cross or land on attacked square
            if (m.notation === 'O-O') {
              const rank = color === 'w' ? 7 : 0;
              if (this.isInCheck(color) ||
                  this.isSquareAttacked(toSquare(rank, 5), color === 'w' ? 'b' : 'w') ||
                  this.isSquareAttacked(toSquare(rank, 6), color === 'w' ? 'b' : 'w')) {
                continue;
              }
            } else if (m.notation === 'O-O-O') {
              const rank = color === 'w' ? 7 : 0;
              if (this.isInCheck(color) ||
                  this.isSquareAttacked(toSquare(rank, 3), color === 'w' ? 'b' : 'w') ||
                  this.isSquareAttacked(toSquare(rank, 2), color === 'w' ? 'b' : 'w')) {
                continue;
              }
            }

            // Simulate move
            const cloned = this.clone();
            cloned.makeRawMove(sq, m.to);
            if (!cloned.isInCheck(color)) {
              legal.push({ from: sq, to: m.to, notation: m.notation });
            }
          }
        }
      }
    }

    return legal;
  }

  // Basic raw move execution for check validation
  makeRawMove(from: Square, to: Square) {
    const { r: r1, c: c1 } = parseSquare(from);
    const { r: r2, c: c2 } = parseSquare(to);
    const piece = this.board[r1][c1];

    if (!piece) return;

    // Handle En Passant Capture
    if (piece.type === 'p' && to === this.enPassantTarget) {
      const epDir = piece.color === 'w' ? 1 : -1;
      this.board[r2 + epDir][c2] = null;
    }

    this.board[r2][c2] = piece;
    this.board[r1][c1] = null;
  }

  // Highly optimized move emulator for minimax that skips heavy legal move re-checks
  makeMoveLight(from: Square, to: Square) {
    const { r: rFrom, c: cFrom } = parseSquare(from);
    const { r: rTo, c: cTo } = parseSquare(to);
    const piece = this.board[rFrom][cFrom];
    if (!piece) return;

    // En Passant Capture
    if (piece.type === 'p' && to === this.enPassantTarget) {
      const epDir = piece.color === 'w' ? 1 : -1;
      this.board[rTo + epDir][cTo] = null;
    }

    // Castling rook movement
    const color = piece.color;
    if (piece.type === 'k' && Math.abs(cTo - cFrom) === 2) {
      const rank = color === 'w' ? 7 : 0;
      if (cTo === 6) { // Kingside
        this.board[rank][5] = this.board[rank][7];
        this.board[rank][7] = null;
      } else if (cTo === 2) { // Queenside
        this.board[rank][3] = this.board[rank][0];
        this.board[rank][0] = null;
      }
    }

    // EP target setup
    if (piece.type === 'p' && Math.abs(rTo - rFrom) === 2) {
      const direction = color === 'w' ? 1 : -1;
      this.enPassantTarget = toSquare(rFrom - direction, cFrom);
    } else {
      this.enPassantTarget = null;
    }

    // Move piece on board
    let finalPiece = piece;
    if (piece.type === 'p' && (rTo === 0 || rTo === 7)) {
      finalPiece = { type: 'q', color };
    }
    this.board[rTo][cTo] = finalPiece;
    this.board[rFrom][cFrom] = null;

    // Disables castling on King/Rook move
    if (piece.type === 'k') {
      this.castlingRights[color] = { k: false, q: false };
    } else if (piece.type === 'r') {
      const rank = color === 'w' ? 7 : 0;
      if (rFrom === rank && cFrom === 0) this.castlingRights[color].q = false;
      if (rFrom === rank && cFrom === 7) this.castlingRights[color].k = false;
    }

    // Swaps turn
    this.turn = this.turn === 'w' ? 'b' : 'w';
  }

  // Perform full rule-abiding chess move
  makeMove(from: Square, to: Square): ChessMove | null {
    const legal = this.getLegalMoves();
    const action = legal.find(m => m.from === from && m.to === to);
    if (!action) return null;

    const { r: rFrom, c: cFrom } = parseSquare(from);
    const { r: rTo, c: cTo } = parseSquare(to);
    const piece = this.board[rFrom][cFrom]!;
    const captured = this.board[rTo][cTo];

    const fenBefore = this.generateFen();

    // Check en-passant capture
    let actualCaptured = captured;
    if (piece.type === 'p' && to === this.enPassantTarget) {
      const epDir = piece.color === 'w' ? 1 : -1;
      actualCaptured = this.board[rTo + epDir][cTo];
      this.board[rTo + epDir][cTo] = null;
    }

    // Capture or Pawn resets halfmove clock
    if (piece.type === 'p' || captured) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    // Rook or King move disables castling
    const color = piece.color;
    if (piece.type === 'k') {
      this.castlingRights[color] = { k: false, q: false };
    } else if (piece.type === 'r') {
      const rank = color === 'w' ? 7 : 0;
      if (rFrom === rank && cFrom === 0) this.castlingRights[color].q = false;
      if (rFrom === rank && cFrom === 7) this.castlingRights[color].k = false;
    }

    // Castling rook movement
    if (piece.type === 'k' && Math.abs(cTo - cFrom) === 2) {
      const rank = color === 'w' ? 7 : 0;
      if (cTo === 6) { // Kingside
        this.board[rank][5] = this.board[rank][7];
        this.board[rank][7] = null;
      } else if (cTo === 2) { // Queenside
        this.board[rank][3] = this.board[rank][0];
        this.board[rank][0] = null;
      }
    }

    // Handle EP target assignment
    if (piece.type === 'p' && Math.abs(rTo - rFrom) === 2) {
      const direction = color === 'w' ? 1 : -1;
      this.enPassantTarget = toSquare(rFrom - direction, cFrom);
    } else {
      this.enPassantTarget = null;
    }

    // Move piece
    let finalPiece = piece;
    let promo: PieceType | undefined;
    // Auto Queen promote
    if (piece.type === 'p' && (rTo === 0 || rTo === 7)) {
      finalPiece = { type: 'q', color };
      promo = 'q';
    }

    this.board[rTo][cTo] = finalPiece;
    this.board[rFrom][cFrom] = null;

    // Switch turn
    this.turn = this.turn === 'w' ? 'b' : 'w';

    if (this.turn === 'w') {
      this.fullmoveNumber++;
    }

    const fenAfter = this.generateFen();

    return {
      from,
      to,
      piece,
      captured: actualCaptured,
      promotion: promo,
      notation: action.notation,
      fenBefore,
      fenAfter,
      timestamp: new Date().toISOString()
    };
  }

  getGameStatus(): GameStatus {
    const moves = this.getLegalMoves();
    if (moves.length === 0) {
      if (this.isInCheck(this.turn)) {
        return this.turn === 'w' ? 'black_won' : 'white_won'; // checkmate!
      } else {
        return 'draw_stalemate';
      }
    }

    if (this.halfmoveClock >= 100) {
      return 'draw_repetition'; // fifty moves rule
    }

    return this.turn === 'w' ? 'white_to_move' : 'black_to_move';
  }
}

// -----------------------------------------------------------------
// CHESS ENGINE MINIMAX AI
// -----------------------------------------------------------------

// Evaluation constants
const PieceValues: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Heuristic positional maps to enforce active central pieces
const pawnTable = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const knightTable = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopTable = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const kingTable = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20]
];

// Evaluate standard utility of board (white - black)
function evaluateBoard(bm: BoardManager): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = bm.board[r][c];
      if (p) {
        let val = PieceValues[p.type];
        
        // Positional additions
        if (p.type === 'p') {
          val += (p.color === 'w' ? pawnTable[r][c] : pawnTable[7 - r][c]);
        } else if (p.type === 'n') {
          val += (p.color === 'w' ? knightTable[r][c] : knightTable[7 - r][c]);
        } else if (p.type === 'b') {
          val += (p.color === 'w' ? bishopTable[r][c] : bishopTable[7 - r][c]);
        } else if (p.type === 'k') {
          val += (p.color === 'w' ? kingTable[r][c] : kingTable[7 - r][c]);
        }

        if (p.color === 'w') {
          score += val;
        } else {
          score -= val;
        }
      }
    }
  }
  return score;
}

// Minimax algorithm with pruning and search deadline to prevent blocking event loop
function minimax(
  bm: BoardManager,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean,
  deadline: number
): { score: number; move: { from: Square; to: Square } | null } {
  if (depth === 0 || Date.now() > deadline) {
    return { score: evaluateBoard(bm), move: null };
  }

  const moves = bm.getLegalMoves();
  if (moves.length === 0) {
    if (bm.isInCheck(bm.turn)) {
      // Checkmate: penalty depends on depth to prefer faster mates or delay defeat
      return { score: bm.turn === 'w' ? -100000 - depth : 100000 + depth, move: null };
    }
    return { score: 0, move: null }; // Stalemate
  }

  // Sort moves slightly: captures first (to increase pruning speed)
  moves.sort((a, b) => {
    const { r: rA, c: cA } = parseSquare(a.to);
    const { r: rB, c: cB } = parseSquare(b.to);
    const pieceA = bm.board[rA][cA];
    const pieceB = bm.board[rB][cB];
    
    // Sort captures higher
    const isCapA = pieceA !== null ? 1 : 0;
    const isCapB = pieceB !== null ? 1 : 0;
    return isCapB - isCapA;
  });

  let bestMove: { from: Square; to: Square } | null = null;

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    for (const m of moves) {
      if (Date.now() > deadline) break;
      const cloned = bm.clone();
      cloned.makeMoveLight(m.from, m.to);
      const evaluation = minimax(cloned, depth - 1, alpha, beta, false, deadline).score;
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = { from: m.from, to: m.to };
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // Pruning
      }
    }
    if (!bestMove && moves.length > 0) {
      bestMove = { from: moves[0].from, to: moves[0].to };
    }
    return { score: maxEval === -Infinity ? evaluateBoard(bm) : maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      if (Date.now() > deadline) break;
      const cloned = bm.clone();
      cloned.makeMoveLight(m.from, m.to);
      const evaluation = minimax(cloned, depth - 1, alpha, beta, true, deadline).score;
      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = { from: m.from, to: m.to };
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // Pruning
      }
    }
    if (!bestMove && moves.length > 0) {
      bestMove = { from: moves[0].from, to: moves[0].to };
    }
    return { score: minEval === Infinity ? evaluateBoard(bm) : minEval, move: bestMove };
  }
}

// Request best chess move for active player
export function getBestMoveAI(fen: string, level: AILevel): { from: Square; to: Square } | null {
  const bm = new BoardManager(fen);
  const moves = bm.getLegalMoves();
  if (moves.length === 0) return null;

  const isWhite = bm.turn === 'w';
  const deadline = Date.now() + 800; // 800ms absolute computation budget

  // Determine target search depth and random blunder rates
  let targetDepth = 1;
  let blunderChance = 0;

  if (level === 'Degree3') {
    blunderChance = 0.6;
    targetDepth = 1;
  } else if (level === 'Degree2') {
    blunderChance = 0.3;
    targetDepth = 2;
  } else if (level === 'Degree1') {
    blunderChance = 0.1;
    targetDepth = 2;
  } else if (level === 'CM') {
    targetDepth = 3;
  } else if (level === 'FM') {
    targetDepth = 3;
  } else if (level === 'IM') {
    targetDepth = 3;
  } else { // GM
    targetDepth = moves.length > 18 ? 3 : 4;
  }

  // Check random blunder roll
  if (Math.random() < blunderChance) {
    const index = Math.floor(Math.random() * moves.length);
    return moves[index];
  }

  // Iterative Deepening to ensure we always have a move and do not time out with null
  let bestMove: { from: Square; to: Square } | null = null;
  for (let d = 1; d <= targetDepth; d++) {
    if (Date.now() > deadline) break;
    const res = minimax(bm, d, -Infinity, Infinity, isWhite, deadline);
    if (res.move) {
      bestMove = res.move;
    }
  }

  // Absolute fallback to a random legal move if even depth 1 failed
  if (!bestMove && moves.length > 0) {
    bestMove = moves[Math.floor(Math.random() * moves.length)];
  }

  return bestMove;
}
