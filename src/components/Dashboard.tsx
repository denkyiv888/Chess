import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Award, TrendingUp, History, PlayCircle, Star, Users, BrainCircuit } from 'lucide-react';
import { UserProfile, ChessGame, AI_LEVEL_DETAILS } from '../types';

interface DashboardProps {
  user: UserProfile;
  allUsers: UserProfile[];
  completedGames: ChessGame[];
  onReviewGame: (game: ChessGame) => void;
}

export default function Dashboard({ user, allUsers, completedGames, onReviewGame }: DashboardProps) {
  // Filter games involving current user
  const userPastMatches = completedGames.filter(g => 
    (g.whitePlayer?.id === user.id || g.blackPlayer?.id === user.id) &&
    (g.status === 'white_won' || g.status === 'black_won' || g.status.startsWith('draw_'))
  );

  // Compute stats
  const winRate = user.gamesPlayed > 0 
    ? Math.round((user.wins / user.gamesPlayed) * 100) 
    : 0;

  // Render a lovely, minimalist SVG rating historical progress charts (Jony Ive curves)
  // We'll generate a realistic rating path based on their matches or seed path if empty
  const getRatingPath = () => {
    const historicalPoints = [1200];
    let runningRating = 1200;
    
    // Calculate synthetic trajectory over historical matches for visual graphing
    userPastMatches.reverse().forEach(game => {
      const isWhite = game.whitePlayer?.id === user.id;
      const isWinner = (isWhite && game.status === 'white_won') || (!isWhite && game.status === 'black_won');
      const isLoser = (isWhite && game.status === 'black_won') || (!isWhite && game.status === 'white_won');
      
      if (isWinner) runningRating += 16;
      else if (isLoser) runningRating -= 16;
      // capped
      historicalPoints.push(runningRating);
    });

    // Fill points if too few to draw a nice curvaceous line
    while (historicalPoints.length < 6) {
      const last = historicalPoints[historicalPoints.length - 1];
      const offset = [8, -4, 12, -8, 16][historicalPoints.length % 5];
      historicalPoints.push(last + offset);
    }

    const minR = Math.min(...historicalPoints) - 50;
    const maxR = Math.max(...historicalPoints) + 50;
    const range = maxR - minR || 100;

    const width = 500;
    const height = 150;
    const pts = historicalPoints.map((r, idx) => {
      const x = (idx / (historicalPoints.length - 1)) * width;
      const y = height - ((r - minR) / range) * (height - 30) - 15;
      return { x, y, rating: r };
    });

    const dPath = pts.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      // cubic curves
      const prev = pts[i - 1];
      const cpX1 = prev.x + (p.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (p.x - prev.x) / 2;
      const cpY2 = p.y;
      return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }, '');

    return { pts, dPath, current: user.rating };
  };

  const chartData = getRatingPath();

  // Find users rank
  const globalPosition = [...allUsers]
    .sort((a,b) => b.rating - a.rating)
    .findIndex(u => u.id === user.id) + 1 || 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6" id="analytics_dashboard_panel">
      
      {/* Top Banner layout */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-zinc-500/5 to-transparent pointer-events-none"></div>
        <div>
          <span className="text-[10px] bg-black text-white px-2.5 py-1 rounded-full font-mono uppercase tracking-widest font-medium mb-1.5 inline-block">
            Member Since 2026
          </span>
          <h2 className="font-display text-3xl font-light tracking-tight text-zinc-950">
            Welcome back, {user.username}
          </h2>
          <p className="text-sm text-zinc-500 font-light mt-1">
            Analyzing past moves and ranking progression instantly in Jony Ive aesthetic.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="text-right">
            <span className="block text-xs uppercase tracking-wider text-zinc-400 font-medium">Global Rank</span>
            <span className="text-2xl font-light font-display text-zinc-900">#{globalPosition} <span className="text-xs text-zinc-500">of {allUsers.length}</span></span>
          </div>
          <div className="text-right border-l border-zinc-200 pl-4">
            <span className="block text-xs uppercase tracking-wider text-zinc-400 font-medium font-sans">Leaderboard Score</span>
            <span className="text-2xl font-light font-display text-zinc-900">{user.rating} <span className="text-xs text-zinc-500 font-mono">Elo</span></span>
          </div>
        </div>
      </div>

      {/* Grid: Win Rings and Line Progress Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Statistics Gauge (Card 1) */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-light tracking-tight text-zinc-900 mb-4 flex items-center gap-1.5">
              <Award className="w-5 h-5 text-zinc-700" />
              Win Distribution
            </h3>
            
            <div className="flex justify-center py-4 relative">
              {/* Radial Donut Ring */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="54" stroke="rgba(0,0,0,0.03)" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="64" 
                  cy="64" 
                  r="54" 
                  stroke="#0071E3" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={339.29}
                  strokeDashoffset={339.29 - (339.29 * (winRate / 100))}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Abs center value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-light font-display text-zinc-900">{winRate}%</span>
                <span className="text-[10px] text-[#86868B] uppercase tracking-widest">Rate</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center border-t border-zinc-100 pt-4 mt-2">
            <div>
              <span className="block text-xs text-zinc-450">Wins</span>
              <span className="text-base font-semibold text-zinc-800">{user.wins}</span>
            </div>
            <div>
              <span className="block text-xs text-zinc-450">Draws</span>
              <span className="text-base font-semibold text-zinc-800">{user.draws}</span>
            </div>
            <div>
              <span className="block text-xs text-zinc-450">Losses</span>
              <span className="text-base font-semibold text-zinc-800">{user.losses}</span>
            </div>
          </div>
        </div>

        {/* Rating Line Progression Chart (Card 2) */}
        <div className="glass-panel p-6 rounded-3xl md:col-span-2 flex flex-col justify-between" id="rating_analytics_chart">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-light tracking-tight text-zinc-900 flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-zinc-700" />
                Elo Trajectory Curve
              </h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                Active rating: {user.rating} Elo
              </span>
            </div>

            {/* Sparkline Canvas */}
            <div className="w-full relative py-2">
              <svg viewBox="0 0 500 150" className="w-full h-auto overflow-visible">
                {/* Reference Grid lines */}
                <line x1="0" y1="15" x2="500" y2="15" stroke="rgba(0,0,0,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(0,0,0,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="0" y1="135" x2="500" y2="135" stroke="rgba(0,0,0,0.03)" strokeWidth="1" strokeDasharray="3,3" />

                {/* Main trajectory path */}
                <path 
                  d={chartData.dPath} 
                  fill="none" 
                  stroke="#0071E3" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />

                {/* Glowing points highlighting rating positions */}
                {chartData.pts.map((p, idx) => (
                  <g key={idx}>
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="4" 
                      className="fill-white stroke-[#0071E3] stroke-2 cursor-pointer hover:r-5 transition-all" 
                    />
                    {idx === chartData.pts.length - 1 && (
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="10" 
                        className="fill-[#0071E3]/15 animate-ping pointer-events-none" 
                      />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mt-2">
            <span>Historical baseline</span>
            <span>Current Match Status</span>
          </div>
        </div>

      </div>

      {/* Grid: Mini Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="glass-panel p-4 rounded-2xl">
          <span className="block text-[10px] text-zinc-400 font-medium tracking-wide uppercase">Active Streak</span>
          <span className="block text-2xl font-light font-display text-zinc-900 mt-1">{user.streak} <span className="text-xs text-zinc-450">Win-streak</span></span>
        </div>

        <div className="glass-panel p-4 rounded-2xl">
          <span className="block text-[10px] text-zinc-400 font-medium tracking-wide uppercase">Total Games</span>
          <span className="block text-2xl font-light font-display text-zinc-900 mt-1">{user.gamesPlayed} <span className="text-xs text-zinc-450">Matches</span></span>
        </div>

        <div className="glass-panel p-4 rounded-2xl">
          <span className="block text-[10px] text-zinc-400 font-medium tracking-wide uppercase">Opposition defeated</span>
          <span className="block text-2xl font-light font-display text-zinc-900 mt-1">2100+ <span className="text-xs text-zinc-450">Highest Elo</span></span>
        </div>

        <div className="glass-panel p-4 rounded-2xl">
          <span className="block text-[10px] text-zinc-400 font-medium tracking-wide uppercase">Tactical AI Accuracy</span>
          <span className="block text-2xl font-light font-display text-zinc-900 mt-1">94.8% <span className="text-xs text-zinc-450">In-game</span></span>
        </div>

      </div>

      {/* Match History & Ledger section */}
      <div className="glass-panel p-6 rounded-3xl" id="dashboard_history_card">
        <h3 className="font-display text-xl font-light tracking-tight text-zinc-950 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-700" />
          Historic Completed Matches
        </h3>

        {userPastMatches.length === 0 ? (
          <div className="text-center py-12 bg-white/20 rounded-2xl border border-zinc-100 flex flex-col items-center justify-center">
            <Trophy className="w-10 h-10 text-zinc-300 mb-3" />
            <p className="text-sm font-semibold text-zinc-800">No complete match logs available.</p>
            <p className="text-xs text-zinc-400 font-light mt-1 max-w-sm">
              Launch matches against Bots or Online players from the Tournament Rooms to compile analysis dashboards.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 text-[10px] text-zinc-400 font-medium tracking-wide uppercase">
                  <th className="py-3 px-4">Match Date</th>
                  <th className="py-3 px-4">Opposing Player</th>
                  <th className="py-3 px-4">Match Outcome</th>
                  <th className="py-3 px-4">Total Moves</th>
                  <th className="py-3 px-4 text-right">Ive Deep Rewind</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {userPastMatches.map((match) => {
                  const isWhite = match.whitePlayer?.id === user.id;
                  const opponent = isWhite ? match.blackPlayer : match.whitePlayer;
                  
                  const isWinner = (isWhite && match.status === 'white_won') || (!isWhite && match.status === 'black_won');
                  const isLoser = (isWhite && match.status === 'black_won') || (!isWhite && match.status === 'white_won');
                  const isDraw = match.status.startsWith('draw_');

                  return (
                    <tr key={match.id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-zinc-400 text-xs">
                        {new Date(match.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-900">
                        <div className="flex items-center gap-1.5">
                          <span>{opponent?.username || 'Chess Expert'}</span>
                          {opponent && ('isAI' in opponent) && (
                            <span className="text-[9px] bg-zinc-800 text-zinc-200 px-1 rounded font-mono tracking-wider">Bot</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isWinner && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-150">
                            Victory
                          </span>
                        )}
                        {isLoser && (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-red-150">
                            Defeated
                          </span>
                        )}
                        {isDraw && (
                          <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-650 px-2 py-0.5 rounded-full text-[11px] font-medium border border-zinc-200">
                            Draw match
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500 font-medium">
                        {match.moves.length} moves
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onReviewGame(match)}
                          id={`review_match_${match.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-850 hover:shadow-sm font-medium transition-all text-xs"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
