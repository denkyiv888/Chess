export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export type Square = string; // e.g. 'a1', 'h8'
export type BoardState = (Piece | null)[][]; // 8x8 grid: white top/bottom representation

export interface ChessMove {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece | null;
  promotion?: PieceType;
  notation: string; // e.g. "Nf3", "e4", "O-O"
  fenBefore: string;
  fenAfter: string;
  timestamp: string;
}

export type GameStatus = 'white_to_move' | 'black_to_move' | 'white_won' | 'black_won' | 'draw_stalemate' | 'draw_repetition' | 'draw_agreement' | 'aborted';

export type AILevel = 'Degree3' | 'Degree2' | 'Degree1' | 'CM' | 'FM' | 'IM' | 'GM';

export const AI_LEVEL_DETAILS: Record<AILevel, { name: string; rating: number; depth: number; description: string }> = {
  Degree3: { name: '3rd Degree Scholar', rating: 600, depth: 1, description: 'Easiest level. Makes random or basic development moves.' },
  Degree2: { name: '2nd Degree Club Player', rating: 1000, depth: 2, description: 'Casual opponent. Understands material value but blunders occasionally.' },
  Degree1: { name: '1st Degree Expert', rating: 1400, depth: 3, description: 'Solid club player. Defends well and capitalizes on mistakes.' },
  CM: { name: 'Candidate Master (CM)', rating: 1800, depth: 4, description: 'Strategic master. Controls the center, looks 4 moves ahead.' },
  FM: { name: 'FIDE Master (FM)', rating: 2100, depth: 5, description: 'Tough, professional match-up utilizing positional themes.' },
  IM: { name: 'International Master (IM)', rating: 2400, depth: 6, description: 'Near flawless. Extremely sharp tactician.' },
  GM: { name: 'Grandmaster (GM)', rating: 2700, depth: 7, description: 'World-class opponent. Uses positional dominance and tactical brilliance.' },
};

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  rating: number; // starts at 1200
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  createdAt: string;
}

export interface ChessGame {
  id: string;
  whitePlayer: UserProfile | { id: string; username: string; rating: number };
  blackPlayer: UserProfile | { id: string; username: string; rating: number } | { id: string; username: string; rating: number; isAI: boolean; level: AILevel };
  status: GameStatus;
  moves: ChessMove[];
  fen: string;
  createdAt: string;
  updatedAt: string;
  isCustomAI: boolean;
  aiLevel?: AILevel;
  drawOfferBy?: string | null;
  drawOfferMoveCount?: number | null;
  durationMs?: number | null;
  outcomeReason?: string; // e.g. "by Resignation", "by Agreement", "by Checkmate", "by Abort"
}

export interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'completed';
  participants: UserProfile[];
  rounds: number;
  winner?: string;
  createdAt: string;
}
