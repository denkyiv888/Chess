import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, BrainCircuit, Users, LogOut, ChevronRight, Activity, Moon, Sun } from 'lucide-react';
import { UserProfile, ChessGame, GameStatus, AILevel } from './types';

// Components
import RegistrationForm from './components/RegistrationForm';
import ChessBoard from './components/ChessBoard';
import Dashboard from './components/Dashboard';
import TournamentRoom from './components/TournamentRoom';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'lobby' | 'board' | 'analytics'>('lobby');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeGames, setActiveGames] = useState<ChessGame[]>([]);
  const [tournamentsList, setTournamentsList] = useState<any[]>([]);
  const [activeGame, setActiveGame] = useState<ChessGame | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Load user session from LocalStorage and sync with server-side in-memory store
  useEffect(() => {
    const savedUser = localStorage.getItem('chess_user_session_ive');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        // Synchronize state with the server in case of hot-server reboots
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u.username, email: u.email })
        })
          .then(res => res.ok ? res.json() : Promise.reject())
          .then(serverUser => {
            setUser(serverUser);
            localStorage.setItem('chess_user_session_ive', JSON.stringify(serverUser));
          })
          .catch(() => {
            // Fallback to active local copy if offline or registration failed
            setUser(u);
          });
      } catch (e) {
        localStorage.removeItem('chess_user_session_ive');
      }
    }
  }, []);

  // Fetch initial global lists
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        const [usersRes, gamesRes, toursRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/games'),
          fetch('/api/tournaments')
        ]);
        
        if (usersRes.ok) setAllUsers(await usersRes.json());
        if (gamesRes.ok) setActiveGames(await gamesRes.json());
        if (toursRes.ok) setTournamentsList(await toursRes.json());
      } catch (e) {
        console.error('Lobby REST sync failure:', e);
      }
    };

    fetchData();

    // Subscribe to real-time Lobby Events via Server-Sent Events (SSE)
    const eventSource = new EventSource('/api/stream?path=/api/lobby');
    
    eventSource.onmessage = (event) => {
      try {
        const d = JSON.parse(event.data);
        if (d.type === 'lobby_created') {
          setActiveGames(prev => {
            if (prev.some(g => g.id === d.game.id)) return prev;
            return [d.game, ...prev];
          });
        } else if (d.type === 'lobby_updated') {
          setActiveGames(prev => prev.map(g => g.id === d.game.id ? d.game : g));
          // If the updated game matches our active game, sync it!
          if (activeGame && activeGame.id === d.game.id) {
            setActiveGame(d.game);
          }
        } else if (d.type === 'leaderboard') {
          // Re-fetch ratings
          fetch('/api/users').then(res => res.json()).then(data => setAllUsers(data));
        } else if (d.type === 'tournament_updated') {
          setTournamentsList(prev => prev.map(t => t.id === d.tour.id ? d.tour : t));
        }
      } catch (err) {
        console.error('SSE Payload parsing failure:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user, activeGame?.id]);

  // Handle active game's real-time action listener (subscribes specifically to game/:id)
  useEffect(() => {
    if (!activeGame) return;

    const gameSse = new EventSource(`/api/stream?path=/api/game/${activeGame.id}`);
    
    gameSse.onmessage = (event) => {
      try {
        const d = JSON.parse(event.data);
        if (['player_joined', 'move_made', 'game_aborted', 'player_resigned', 'draw_offered', 'draw_accepted', 'draw_declined'].includes(d.type)) {
          setActiveGame(d.game);
          // Also sync in general lists
          setActiveGames(prev => prev.map(g => g.id === d.game.id ? d.game : g));
        }
      } catch (err) {
        console.error('Game specific SSE sync failure:', err);
      }
    };

    // Robust backup polling to bypass SSE packet drop or iframe socket limit limits
    const isTerminal = activeGame.status === 'white_won' || activeGame.status === 'black_won' || activeGame.status.startsWith('draw_') || activeGame.status === 'aborted';
    let pollInterval: any;
    if (!isTerminal) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/games/${activeGame.id}`);
          if (res.ok) {
            const latest = await res.json();
            if (latest.moves.length !== activeGame.moves.length || latest.status !== activeGame.status) {
              setActiveGame(latest);
              setActiveGames(prev => prev.map(g => g.id === latest.id ? latest : g));
            }
          }
        } catch (e) {
          console.error('Active game sync backpoll failure:', e);
        }
      }, 2000);
    }

    return () => {
      gameSse.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeGame?.id, activeGame?.moves?.length, activeGame?.status]);

  // Handle register success
  const handleRegister = (newUser: UserProfile) => {
    setUser(newUser);
    localStorage.setItem('chess_user_session_ive', JSON.stringify(newUser));
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('chess_user_session_ive');
    setUser(null);
    setActiveGame(null);
    setActiveTab('lobby');
  };

  // Launch computerized AI match
  const handleLaunchAIGame = async (level: AILevel, side: 'white' | 'black') => {
    if (!user) return;
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user.id,
          isCustomAI: true,
          aiLevel: level,
          side: side
        })
      });

      if (!response.ok) throw new Error('Could not create game.');
      
      const game: ChessGame = await response.json();
      setActiveGame(game);
      setActiveTab('board');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Match launch error');
    }
  };

  // Launch live lobby match
  const handleLaunchLobbyGame = async (side: 'white' | 'black') => {
    if (!user) return;
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user.id,
          isCustomAI: false,
          side: side
        })
      });

      if (!response.ok) throw new Error('Could not provision lobby match.');

      const game: ChessGame = await response.json();
      setActiveGame(game);
      setActiveTab('board');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Lobby launch error');
    }
  };

  // Join public open game
  const handleJoinGame = async (gameId: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) throw new Error('Match full or inactive.');

      const game: ChessGame = await response.json();
      setActiveGame(game);
      setActiveTab('board');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Lobby join error');
    }
  };

  // Post Chess Move
  const handlePostMove = async (from: string, to: string) => {
    if (!user || !activeGame) return;
    try {
      const response = await fetch(`/api/games/${activeGame.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          playerId: user.id
        })
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.error || 'Illegal transaction.');
      }

      const game: ChessGame = await response.json();
      setActiveGame(game);
    } catch (err) {
      console.error('Post move failure:', err);
    }
  };

  // Register in local tournament round brackets
  const handleJoinTournament = async (tourId: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/tournaments/${tourId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        const tour = await response.json();
        setTournamentsList(prev => prev.map(t => t.id === tourId ? tour : t));
      }
    } catch (err) {
      console.error('Error joining tournament:', err);
    }
  };

  // Select historical game to analyze on the board
  const handleReviewGame = (game: ChessGame) => {
    setActiveGame(game);
    setActiveTab('board');
  };

  if (!user) {
    return <RegistrationForm onRegister={handleRegister} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between">
      
      <div>
        {/* Header bar */}
        <header className="glass-panel sticky top-0 z-50 mb-6 border-b border-white/40 select-none">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
            
            {/* Logo elements */}
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 bg-[#1D1D1F] font-display font-medium text-lg leading-none cursor-pointer hover:opacity-85 text-white flex items-center justify-center rounded-lg shadow-sm">
                ♞
              </span>
              <span className="font-display text-lg font-light tracking-tight text-[#1D1D1F]">
                Chess <span className="font-semibold select-none font-sans text-xs bg-[#0071E3] text-white px-2.5 py-0.5 rounded-full ml-1 lowercase">minimal</span>
              </span>
            </div>

          {/* Minimalist interactive tabs */}
          <nav className="flex items-center gap-1.5" id="navigation_pills_group">
            <button
              onClick={() => setActiveTab('lobby')}
              id="tab_lobby_btn"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all uppercase ${
                activeTab === 'lobby' 
                  ? 'bg-[#1D1D1F] text-white shadow-sm' 
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/50'
              }`}
            >
              Lobby Rooms
            </button>
            
            {activeGame && (
              <button
                onClick={() => setActiveTab('board')}
                id="tab_board_btn"
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all uppercase flex items-center gap-1 ${
                  activeTab === 'board' 
                    ? 'bg-[#1D1D1F] text-white shadow-sm' 
                    : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/50'
                }`}
              >
                Board Screen
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('analytics')}
              id="tab_analytics_btn"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all uppercase ${
                activeTab === 'analytics' 
                  ? 'bg-[#1D1D1F] text-white shadow-sm' 
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/50'
              }`}
            >
              Aesthetic Stats
            </button>
          </nav>

          {/* User widget */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-[11px] font-semibold text-[#1D1D1F] leading-none">
                {user.username}
              </span>
              <span className="text-[10px] text-[#86868B] font-mono font-medium">
                {user.rating} Elo
              </span>
            </div>

            <button
              onClick={handleLogout}
              id="nav_logout_btn"
              title="Logout Profile"
              className="p-2 text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/60 rounded-xl transition-all border border-transparent hover:border-[#D2D2D7]/45"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main viewport Container */}
      <main className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'lobby' && (
              <TournamentRoom
                user={user}
                activeGames={activeGames}
                tournamentsList={tournamentsList}
                onLaunchAIGame={handleLaunchAIGame}
                onLaunchLobbyGame={handleLaunchLobbyGame}
                onJoinGame={handleJoinGame}
                onJoinTournament={handleJoinTournament}
              />
            )}

            {activeTab === 'board' && activeGame && (
              <ChessBoard
                game={activeGame}
                userId={user.id}
                onPostMove={handlePostMove}
                onResetGame={() => {
                  setActiveGame(null);
                  setActiveTab('lobby');
                }}
              />
            )}

            {activeTab === 'analytics' && (
              <Dashboard
                user={user}
                allUsers={allUsers}
                completedGames={activeGames}
                onReviewGame={handleReviewGame}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>

      {/* Jony Ive Minimalist Status Footer */}
      <footer className="w-full mt-12 py-5 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between text-[10px] text-[#86868B] border-t border-[#D2D2D7]/30 bg-white/30 backdrop-blur-sm select-none">
        <div className="flex gap-6 mb-2 sm:mb-0">
          <span>Real-time Multiplayer Status: <span className="text-emerald-500 font-bold uppercase tracking-wider">Online</span></span>
          <span>Global Ranking: #{[...allUsers].sort((a,b) => b.rating - a.rating).findIndex(u => u.id === user.id) + 1 || 1}</span>
        </div>
        <div className="flex gap-4">
          <span>Clean Minimalism Theme v2.0</span>
          <span>Apple Design Guidelines</span>
        </div>
      </footer>

    </div>
  );
}
