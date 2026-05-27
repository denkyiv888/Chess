import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { UserProfile, ChessGame, GameStatus, ChessMove } from './src/types';
import { BoardManager, getBestMoveAI } from './src/utils/chessEngine';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database
const users: Record<string, UserProfile> = {};
const games: Record<string, ChessGame> = {};
const tournaments: Record<string, any> = {};

// Helper: Seed popular bot profiles to make the leaderboards and analytics look spectacular
const BOTS = [
  { id: 'bot_deg3', username: '3rd Degree Bot', rating: 600, email: 'bot3@chess.app' },
  { id: 'bot_deg2', username: '2nd Degree Bot', rating: 1000, email: 'bot2@chess.app' },
  { id: 'bot_deg1', username: 'Expert Bot', rating: 1400, email: 'bot1@chess.app' },
  { id: 'bot_cm', username: 'Candidate Master Bot', rating: 1800, email: 'botcm@chess.app' },
  { id: 'bot_fm', username: 'FIDE Master Bot', rating: 2100, email: 'botfm@chess.app' },
  { id: 'bot_im', username: 'International Master Bot', rating: 2400, email: 'botim@chess.app' },
  { id: 'bot_gm', username: 'Grandmaster Bot', rating: 2700, email: 'botgm@chess.app' },
];

function seedDatabase() {
  for (const bot of BOTS) {
    users[bot.id] = {
      id: bot.id,
      username: bot.username,
      email: bot.email,
      rating: bot.rating,
      gamesPlayed: 142,
      wins: Math.floor(142 * (bot.rating / 3000)),
      losses: Math.floor(142 * (1 - bot.rating / 3000)),
      draws: 142 - Math.floor(142 * (bot.rating / 3000)) - Math.floor(142 * (1 - bot.rating / 3000)),
      streak: 4,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // Seed sample global tournament
  tournaments['tour_world_class'] = {
    id: 'tour_world_class',
    name: 'Ive Minimal Classic 2026',
    status: 'active',
    participants: BOTS.slice(3).map(b => users[b.id]),
    rounds: 3,
    createdAt: new Date().toISOString()
  };
}
seedDatabase();

// SSE SSE Clients Management
let sseClients: { id: string; reqPath: string; res: any }[] = [];

function broadcastSSE(matchingPathPrefix: string, payload: any) {
  const dataString = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    if (client.reqPath.startsWith(matchingPathPrefix)) {
      try {
        client.res.write(dataString);
      } catch (e) {
        // failed write (inactive socket) - handled during unsubscribe
      }
    }
  });
}

// -----------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------

// Live Stream SSE hook
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now().toString();
  const reqPath = req.query.path as string || '/api/lobby';
  
  res.write('retry: 10000\n');
  res.write(`data: {"type": "connected", "id": "${clientId}"}\n\n`);

  sseClients.push({ id: clientId, reqPath, res });

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Authentication / Registration Form
app.post('/api/auth/register', (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    res.status(400).json({ error: 'Username and Email are required.' });
    return;
  }

  // Normalize email to match profiles
  const matchingKey = Object.keys(users).find(k => users[k].email.toLowerCase() === email.toLowerCase());
  if (matchingKey) {
    res.json(users[matchingKey]);
    return;
  }

  const id = 'user_' + Math.random().toString(36).substring(2, 9);
  const newUser: UserProfile = {
    id,
    username,
    email,
    rating: 1200,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    createdAt: new Date().toISOString()
  };

  users[id] = newUser;
  res.status(201).json(newUser);
});

// Fetch Leaderboard / Users
app.get('/api/users', (req, res) => {
  const sorted = Object.values(users).sort((a, b) => b.rating - a.rating);
  res.json(sorted);
});

// Fetch games list
app.get('/api/games', (req, res) => {
  res.json(Object.values(games).reverse());
});

// Fetch single game by ID
app.get('/api/games/:id', (req, res) => {
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }
  res.json(game);
});

// Create Chess game (vs Computer or Live Matchmaker Lobby)
app.post('/api/games', (req, res) => {
  const { creatorId, isCustomAI, aiLevel, side } = req.body;
  
  const creator = users[creatorId];
  if (!creator) {
    res.status(404).json({ error: 'User profile not found. Please register or sign in again.' });
    return;
  }

  const id = 'game_' + Math.random().toString(36).substring(2, 9);
  const isWhite = side === 'white' || (side === 'random' && Math.random() < 0.5);

  let whitePlayer: any = null;
  let blackPlayer: any = null;

  if (isCustomAI && aiLevel) {
    const lvlKey = aiLevel.toString().toLowerCase();
    let botId = '';
    if (lvlKey.includes('degree3') || lvlKey.includes('deg3') || lvlKey === 'degree3') botId = 'bot_deg3';
    else if (lvlKey.includes('degree2') || lvlKey.includes('deg2') || lvlKey === 'degree2') botId = 'bot_deg2';
    else if (lvlKey.includes('degree1') || lvlKey.includes('deg1') || lvlKey === 'degree1') botId = 'bot_deg1';
    else botId = `bot_${lvlKey}`;

    const aiDetails = BOTS.find(b => b.id === botId) || BOTS[0];
    const aiPlayer = {
      id: aiDetails.id,
      username: aiDetails.username,
      rating: aiDetails.rating,
      isAI: true,
      level: aiLevel
    };

    if (isWhite) {
      whitePlayer = creator;
      blackPlayer = aiPlayer;
    } else {
      whitePlayer = aiPlayer;
      blackPlayer = creator;
    }
  } else {
    if (isWhite) {
      whitePlayer = creator;
      blackPlayer = null;
    } else {
      whitePlayer = null;
      blackPlayer = creator;
    }
  }

  const newGame: ChessGame = {
    id,
    whitePlayer,
    blackPlayer,
    status: 'white_to_move',
    moves: [],
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustomAI: !!isCustomAI,
    aiLevel
  };

  // If AI is White, make the first move immediately
  if (newGame.isCustomAI && newGame.whitePlayer && ('isAI' in newGame.whitePlayer)) {
    const bm = new BoardManager(newGame.fen);
    const cpuMove = getBestMoveAI(newGame.fen, (newGame.whitePlayer as any).level);
    if (cpuMove) {
      const cpuExecutedMove = bm.makeMove(cpuMove.from, cpuMove.to);
      if (cpuExecutedMove) {
        newGame.moves.push(cpuExecutedMove);
        newGame.fen = bm.generateFen();
        newGame.status = bm.getGameStatus();
        newGame.updatedAt = new Date().toISOString();
      }
    }
  }

  games[id] = newGame;

  // Let clients know lobby updated
  broadcastSSE('/api/lobby', { type: 'lobby_created', game: newGame });

  res.status(201).json(newGame);
});

// Join Active Open Room
app.post('/api/games/:id/join', (req, res) => {
  const { userId } = req.body;
  const game = games[req.params.id];
  const user = users[userId];

  if (!game || !user) {
    res.status(404).json({ error: 'Game or user profile not found.' });
    return;
  }

  if (game.whitePlayer && game.whitePlayer.id === userId || game.blackPlayer && game.blackPlayer.id === userId) {
    res.json(game); // already joined
    return;
  }

  if (game.whitePlayer && game.blackPlayer) {
    res.status(400).json({ error: 'Match is already full.' });
    return;
  }

  if (!game.whitePlayer) {
    game.whitePlayer = user;
  } else {
    game.blackPlayer = user;
  }

  game.updatedAt = new Date().toISOString();
  broadcastSSE(`/api/game/${game.id}`, { type: 'player_joined', game });
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  res.json(game);
});

// Post Move Endpoint (supports local move posting + auto computer play)
app.post('/api/games/:id/move', (req, res) => {
  const { from, to, playerId, promotion } = req.body;
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }

  const bm = new BoardManager(game.fen);
  
  // Validate move locally via custom ChessEngine module
  const initialTurn = bm.turn;
  const currentTurnPlayer = initialTurn === 'w' ? game.whitePlayer : game.blackPlayer;
  
  if (currentTurnPlayer.id !== playerId) {
    res.status(400).json({ error: 'It is not your turn.' });
    return;
  }

  const executedMove = bm.makeMove(from, to, promotion);
  if (!executedMove) {
    res.status(400).json({ error: 'Illegal move transaction parsed.' });
    return;
  }

  // Update Game State
  game.moves.push(executedMove);
  game.fen = bm.generateFen();
  game.status = bm.getGameStatus();
  game.updatedAt = new Date().toISOString();

  // Check terminal state to distribute Elo rankings!
  if (game.status === 'white_won' || game.status === 'black_won' || game.status.startsWith('draw_')) {
    game.outcomeReason = game.status.startsWith('draw') ? 'by Draw rule' : 'by Checkmate';
    resolveEloRankings(game);
  }

  // Broadcast player move
  broadcastSSE(`/api/game/${game.id}`, { type: 'move_made', game });
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  // CPU opponent trigger side evaluation immediately inside process thread!
  if (game.isCustomAI && !game.status.startsWith('white_won') && !game.status.startsWith('black_won') && !game.status.startsWith('draw_') && game.status !== 'aborted') {
    const freshTurn = bm.turn;
    const cpuPlayer = freshTurn === 'w' ? game.whitePlayer : game.blackPlayer;

    if (cpuPlayer && ('isAI' in cpuPlayer)) {
      setTimeout(() => {
        try {
          const nextBm = new BoardManager(game.fen);
          let cpuMove = getBestMoveAI(game.fen, (cpuPlayer as any).level);
          
          // ROBUST BACKUP FALLBACK Strategy: If AI engine failed to solve, do a random legal move!
          if (!cpuMove) {
            console.warn(`[AI Engine] Solver returned null move for level ${(cpuPlayer as any).level}. Applying random legal fallback.`);
            const fallbackLegals = nextBm.getLegalMoves();
            if (fallbackLegals.length > 0) {
              cpuMove = fallbackLegals[Math.floor(Math.random() * fallbackLegals.length)];
            }
          }

          if (cpuMove) {
            const cpuExecutedMove = nextBm.makeMove(cpuMove.from, cpuMove.to);
            if (cpuExecutedMove) {
              game.moves.push(cpuExecutedMove);
              game.fen = nextBm.generateFen();
              game.status = nextBm.getGameStatus();
              game.updatedAt = new Date().toISOString();

              if (game.status === 'white_won' || game.status === 'black_won' || game.status.startsWith('draw_')) {
                game.outcomeReason = game.status.startsWith('draw') ? 'by Draw rule' : 'by Checkmate';
                resolveEloRankings(game);
              }

              broadcastSSE(`/api/game/${game.id}`, { type: 'move_made', game });
              broadcastSSE('/api/lobby', { type: 'lobby_updated', game });
            }
          }
        } catch (err) {
          console.error("[AI Engine Exception] Critical error occurred inside minimax thread:", err);
          // Failsafe execution to keep game alive and always respond!
          try {
            const nextBm = new BoardManager(game.fen);
            const fallbackLegals = nextBm.getLegalMoves();
            if (fallbackLegals.length > 0) {
              const cpuMove = fallbackLegals[Math.floor(Math.random() * fallbackLegals.length)];
              const cpuExecutedMove = nextBm.makeMove(cpuMove.from, cpuMove.to);
              if (cpuExecutedMove) {
                game.moves.push(cpuExecutedMove);
                game.fen = nextBm.generateFen();
                game.status = nextBm.getGameStatus();
                game.updatedAt = new Date().toISOString();
                if (game.status === 'white_won' || game.status === 'black_won' || game.status.startsWith('draw_')) {
                  game.outcomeReason = game.status.startsWith('draw') ? 'by Draw rule' : 'by Checkmate';
                  resolveEloRankings(game);
                }
                broadcastSSE(`/api/game/${game.id}`, { type: 'move_made', game });
                broadcastSSE('/api/lobby', { type: 'lobby_updated', game });
              }
            }
          } catch (criticalErr) {
            console.error("[AI Fatal Fault] Absolute recovery failed:", criticalErr);
          }
        }
      }, 500); // 500ms delay for ultra-fluid realism with Ive pacing
    }
  }

  res.json(game);
});

// Abort game endpoint - only before first move is made by the aborting player
app.post('/api/games/:id/abort', (req, res) => {
  const { playerId } = req.body;
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }

  const isWhite = game.whitePlayer?.id === playerId;
  const isBlack = game.blackPlayer?.id === playerId;

  if (!isWhite && !isBlack) {
    res.status(403).json({ error: 'You are not a player in this game.' });
    return;
  }

  const movesMadeByPlayer = game.moves.filter((_, idx) => (idx % 2 === 0 && isWhite) || (idx % 2 === 1 && isBlack)).length;
  if (movesMadeByPlayer > 0) {
    res.status(400).json({ error: 'You cannot abort after making your first move.' });
    return;
  }

  game.status = 'aborted';
  game.outcomeReason = 'by Abort';
  game.updatedAt = new Date().toISOString();

  broadcastSSE(`/api/game/${game.id}`, { type: 'game_aborted', game });
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  res.json(game);
});

// Resign game endpoint
app.post('/api/games/:id/resign', (req, res) => {
  const { playerId } = req.body;
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }

  const isWhite = game.whitePlayer?.id === playerId;
  const isBlack = game.blackPlayer?.id === playerId;

  if (!isWhite && !isBlack) {
    res.status(403).json({ error: 'You are not a player in this game.' });
    return;
  }

  if (isWhite) {
    game.status = 'black_won';
  } else {
    game.status = 'white_won';
  }

  game.outcomeReason = 'by Resignation';
  game.updatedAt = new Date().toISOString();

  resolveEloRankings(game);

  broadcastSSE(`/api/game/${game.id}`, { type: 'player_resigned', game });
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  res.json(game);
});

// Offer / Suggest Draw endpoint
app.post('/api/games/:id/offer-draw', (req, res) => {
  const { playerId } = req.body;
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }

  const isWhite = game.whitePlayer?.id === playerId;
  const isBlack = game.blackPlayer?.id === playerId;

  if (!isWhite && !isBlack) {
    res.status(403).json({ error: 'You are not a player in this game.' });
    return;
  }

  // Prevents offering draw more than once per move
  if (game.drawOfferMoveCount !== undefined && game.drawOfferMoveCount !== null && game.drawOfferMoveCount === game.moves.length) {
    res.status(400).json({ error: 'You can only suggest a draw once per move.' });
    return;
  }

  game.drawOfferBy = playerId;
  game.drawOfferMoveCount = game.moves.length;

  if (game.isCustomAI) {
    // Computer automatically decides on draw (evaluation within 1.5 pawns on move count >= 5)
    const bm = new BoardManager(game.fen);
    let whiteScore = 0;
    let blackScore = 0;
    const weights: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = bm.board[r][c];
        if (cell) {
          if (cell.color === 'w') whiteScore += weights[cell.type];
          else blackScore += weights[cell.type];
        }
      }
    }

    const materialDiff = Math.abs(whiteScore - blackScore);
    const isReasonable = materialDiff <= 2.5 && game.moves.length >= 6;

    if (isReasonable && Math.random() < 0.7) {
      game.status = 'draw_agreement';
      game.outcomeReason = 'by Agreement';
      game.drawOfferBy = null;
      resolveEloRankings(game);
      broadcastSSE(`/api/game/${game.id}`, { type: 'draw_accepted', game });
    } else {
      game.drawOfferBy = null;
      broadcastSSE(`/api/game/${game.id}`, { type: 'draw_declined', game, message: "Bot declined the draw offer. Continue playing!" });
    }
  } else {
    // Multiplayer offer: Broadcast to game room
    broadcastSSE(`/api/game/${game.id}`, { type: 'draw_offered', game });
  }

  game.updatedAt = new Date().toISOString();
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  res.json(game);
});

// Accept Draw endpoint
app.post('/api/games/:id/accept-draw', (req, res) => {
  const { playerId } = req.body;
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }

  if (!game.drawOfferBy) {
    res.status(400).json({ error: 'No active draw offer exists.' });
    return;
  }

  if (game.drawOfferBy === playerId) {
    res.status(400).json({ error: 'You cannot accept your own draw offer.' });
    return;
  }

  game.status = 'draw_agreement';
  game.outcomeReason = 'by Agreement';
  game.drawOfferBy = null;
  game.updatedAt = new Date().toISOString();

  resolveEloRankings(game);

  broadcastSSE(`/api/game/${game.id}`, { type: 'draw_accepted', game });
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  res.json(game);
});

// Decline Draw endpoint
app.post('/api/games/:id/decline-draw', (req, res) => {
  const { playerId } = req.body;
  const game = games[req.params.id];
  if (!game) {
    res.status(404).json({ error: 'Game not found.' });
    return;
  }

  if (!game.drawOfferBy) {
    res.status(400).json({ error: 'No active draw offer exists.' });
    return;
  }

  if (game.drawOfferBy === playerId) {
    res.status(400).json({ error: 'You cannot decline your own draw offer.' });
    return;
  }

  game.drawOfferBy = null;
  game.updatedAt = new Date().toISOString();

  broadcastSSE(`/api/game/${game.id}`, { type: 'draw_declined', game });
  broadcastSSE('/api/lobby', { type: 'lobby_updated', game });

  res.json(game);
});

// Elo Multipliers helper
function resolveEloRankings(game: ChessGame) {
  const white = users[game.whitePlayer.id];
  const black = users[game.blackPlayer.id];

  if (!white || !black) return; // don't rank if bot/guest missing

  // standard Elo calculation (K = 32)
  const kW = 32;
  const ratingW = white.rating;
  const ratingB = black.rating;

  const expectedW = 1 / (1 + Math.pow(10, (ratingB - ratingW) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingW - ratingB) / 400));

  let actualW = 0.5;
  let actualB = 0.5;

  if (game.status === 'white_won') {
    actualW = 1;
    actualB = 0;
    white.wins++;
    black.losses++;
    white.streak++;
    black.streak = 0;
  } else if (game.status === 'black_won') {
    actualW = 0;
    actualB = 1;
    white.losses++;
    black.wins++;
    black.streak++;
    white.streak = 0;
  } else {
    white.draws++;
    black.draws++;
    white.streak = 0;
    black.streak = 0;
  }

  white.rating = Math.round(ratingW + kW * (actualW - expectedW));
  black.rating = Math.round(ratingB + kW * (actualB - expectedB));

  white.gamesPlayed++;
  black.gamesPlayed++;

  // broadcast ranking leaderboard change
  broadcastSSE('/api/lobby', { type: 'leaderboard' });
}

// Tournaments operations
app.get('/api/tournaments', (req, res) => {
  res.json(Object.values(tournaments));
});

app.post('/api/tournaments/:id/join', (req, res) => {
  const { userId } = req.body;
  const tour = tournaments[req.params.id];
  const user = users[userId];

  if (!tour || !user) {
    res.status(404).json({ error: 'Tournament or user profile not found.' });
    return;
  }

  if (tour.participants.some((p: any) => p.id === userId)) {
    res.json(tour);
    return;
  }

  tour.participants.push(user);
  broadcastSSE('/api/lobby', { type: 'tournament_updated', tour });
  res.json(tour);
});

// -----------------------------------------------------------------
// VITE AND SERVING
// -----------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA Fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apple minimalist Chess Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
