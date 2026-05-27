import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, ShieldAlert, Cpu, Gamepad2, Sparkles, PlusCircle } from 'lucide-react';
import { UserProfile, ChessGame, AILevel, AI_LEVEL_DETAILS } from '../types';

interface TournamentRoomProps {
  user: UserProfile;
  activeGames: ChessGame[];
  tournamentsList: any[];
  onLaunchAIGame: (level: AILevel, side: 'white' | 'black') => void;
  onLaunchLobbyGame: (side: 'white' | 'black') => void;
  onJoinGame: (gameId: string) => void;
  onJoinTournament: (tourId: string) => void;
}

export default function TournamentRoom({
  user,
  activeGames,
  tournamentsList,
  onLaunchAIGame,
  onLaunchLobbyGame,
  onJoinGame,
  onJoinTournament,
}: TournamentRoomProps) {
  const [selectedAILevel, setSelectedAILevel] = useState<AILevel>('Degree1');
  const [selectedAISide, setSelectedAISide] = useState<'white' | 'black'>('white');
  const [selectedLobbySide, setSelectedLobbySide] = useState<'white' | 'black'>('white');

  // Filter open matches
  const openMatches = activeGames.filter(g => (!g.whitePlayer || !g.blackPlayer) && !g.isCustomAI);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-8" id="tournament_lobby_view">
      
      {/* 2-Column layout: Launchers and active lobbies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Launcher Columns (left, 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* AIOpponent Configurator */}
          <div className="glass-panel p-6 rounded-3xl" id="ai_launch_spec">
            <div className="flex items-center gap-2.5 mb-4">
              <Cpu className="w-5 h-5 text-zinc-700" />
              <h3 className="font-display text-xl font-light tracking-tight text-zinc-950">
                Play With Computer
              </h3>
            </div>

            <p className="text-xs text-zinc-500 font-light mb-5">
              Engage with our custom algorithmic chess solver. Adjust the tactical capability matching standard ranking categories.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              onLaunchAIGame(selectedAILevel, selectedAISide);
            }} className="space-y-5">
              
              {/* Level options list */}
              <div>
                <label className="block text-zinc-450 text-[10px] uppercase font-semibold tracking-wide mb-2.5">
                  Choose Level Rank
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(AI_LEVEL_DETAILS) as AILevel[]).map((lvl) => {
                    const info = AI_LEVEL_DETAILS[lvl];
                    const isSelected = selectedAILevel === lvl;
                    return (
                      <button
                        type="button"
                        key={lvl}
                        id={`ai_lvl_btn_${lvl}`}
                        onClick={() => setSelectedAILevel(lvl)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                          isSelected 
                            ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-md scale-[1.02]' 
                            : 'bg-white/45 border-[#D2D2D7]/40 hover:bg-white/80 hover:border-zinc-300 text-zinc-800'
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wider font-mono opacity-80 block">
                          Rating {info.rating}
                        </span>
                        <span className="text-xs font-semibold leading-tight font-display truncate w-full">
                          {info.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2.5 px-3 py-2 bg-white/50 border border-[#D2D2D7]/30 rounded-xl text-[11px] text-[#86868B] leading-tight">
                  💡 <b>{AI_LEVEL_DETAILS[selectedAILevel].name}:</b> {AI_LEVEL_DETAILS[selectedAILevel].description} (Alpha-Beta minimax solver).
                </div>
              </div>

              {/* Side Choice */}
              <div>
                <label className="block text-[#86868B] text-[10px] uppercase font-semibold tracking-wide mb-2.5">
                  Play As Color
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="side_white_btn"
                    onClick={() => setSelectedAISide('white')}
                    className={`py-3 rounded-xl border flex items-center justify-center font-medium gap-2 text-sm transition-all ${
                      selectedAISide === 'white'
                        ? 'bg-white text-zinc-900 border-[#D2D2D7] shadow-sm font-semibold'
                        : 'bg-zinc-100 text-zinc-500 border-transparent hover:bg-zinc-150'
                    }`}
                  >
                    <span className="text-xl">♘</span> White Setup
                  </button>
                  <button
                    type="button"
                    id="side_black_btn"
                    onClick={() => setSelectedAISide('black')}
                    className={`py-3 rounded-xl border flex items-center justify-center font-medium gap-2 text-sm transition-all ${
                      selectedAISide === 'black'
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm'
                        : 'bg-zinc-100 text-zinc-500 border-transparent hover:bg-zinc-150'
                    }`}
                  >
                    <span className="text-xl">♞</span> Black Setup
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                id="launch_ai_btn"
                className="w-full py-4 rounded-2xl bg-[#1D1D1F] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center gap-1.5"
              >
                Launch Single Match vs Bot
              </motion.button>

            </form>
          </div>

          {/* Create Matchmaking Room */}
          <div className="glass-panel p-6 rounded-3xl" id="matchmaking_lobby_spec">
            <div className="flex items-center gap-2.5 mb-4">
              <Gamepad2 className="w-5 h-5 text-zinc-700" />
              <h3 className="font-display text-xl font-light tracking-tight text-zinc-950">
                Create Online Multiplayer Arena
              </h3>
            </div>

            <p className="text-xs text-zinc-500 font-light mb-4">
              Provision a lobby game room. Other active browser clients or spectators looking at the server will register changes instantly over real-time events.
            </p>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setSelectedLobbySide('white')}
                id="lobby_side_white_btn"
                className={`flex-1 py-2.5 rounded-xl text-xs border text-center transition-all ${
                  selectedLobbySide === 'white' ? 'bg-white text-[#1D1D1F] border-[#D2D2D7] font-semibold shadow-sm' : 'bg-white/40 text-[#86868B] border-[#D2D2D7]/20 hover:bg-white/80'
                }`}
              >
                White
              </button>
              <button
                onClick={() => setSelectedLobbySide('black')}
                id="lobby_side_black_btn"
                className={`flex-1 py-2.5 rounded-xl text-xs border text-center transition-all ${
                  selectedLobbySide === 'black' ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] font-semibold shadow-sm' : 'bg-white/40 text-[#86868B] border-[#D2D2D7]/20 hover:bg-white/80'
                }`}
              >
                Black
              </button>
            </div>

            <button
              onClick={() => onLaunchLobbyGame(selectedLobbySide)}
              id="launch_lobby_btn"
              className="w-full py-3.5 rounded-2xl border border-[#D2D2D7]/60 hover:border-[#86868B] bg-white/50 hover:bg-white text-zinc-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-[#0071E3]" />
              Create Public Room Inside Lobby
            </button>
          </div>

        </div>

        {/* Lobbies Panel (right, 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active online matches list */}
          <div className="glass-panel p-6 rounded-3xl" id="online_lobbies_list">
            <div className="flex items-center justify-between mb-4 border-b border-[#D2D2D7]/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#86868B]" />
                <h3 className="font-display text-lg font-light tracking-tight text-zinc-950">
                  Open Lobbies
                </h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono font-medium px-2.5 py-1 rounded-full border border-emerald-150 animate-pulse uppercase tracking-wider">
                Live Online
              </span>
            </div>

            {openMatches.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-[#86868B] font-light leading-normal">
                  No active opponent matching requests on the board. Click <b className="text-zinc-650">Create Public Room</b> to spawn a chess room.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 overflow-y-auto max-h-[300px] pr-1">
                {openMatches.map((g) => {
                  const host = g.whitePlayer || g.blackPlayer;
                  const hostColor = g.whitePlayer ? 'White' : 'Black';

                  return (
                    <div key={g.id} className="p-4 bg-white/40 border border-[#D2D2D7]/40 rounded-2xl flex items-center justify-between hover:bg-white/80 transition-all">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-800">
                            {host?.username || 'Chess Master'}
                          </span>
                          <span className="text-[9px] bg-zinc-100 text-zinc-500 font-mono px-1 rounded">
                            {host?.rating || 1200}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#86868B] font-mono block mt-0.5">
                          Playing as {hostColor}
                        </span>
                      </div>

                      <button
                        onClick={() => onJoinGame(g.id)}
                        id={`join_lobby_${g.id}`}
                        className="px-4 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0071E3]/90 text-white font-medium text-xs shadow-sm transition-colors"
                      >
                        Join and Play
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Live Tournaments brackets */}
          <div className="glass-panel p-6 rounded-3xl" id="tournaments_ladder_list">
            <div className="flex items-center gap-2 mb-4 border-b border-[#D2D2D7]/20 pb-2.5">
              <Trophy className="w-5 h-5 text-[#86868B]" />
              <h3 className="font-display text-lg font-light tracking-tight text-zinc-950">
                Tournaments Ladder
              </h3>
            </div>

            <p className="text-xs text-[#86868B] font-light mb-4 leading-normal">
              Join round-robin competitions against advanced artificial intelligence and masters. Earn special bracket points!
            </p>

            {tournamentsList.map((tour) => {
              const isJoined = tour.participants.some((p: any) => p.id === user.id);

              return (
                <div key={tour.id} className="p-4 bg-white/40 border border-[#D2D2D7]/40 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900">{tour.name}</span>
                    <span className="text-[10px] bg-zinc-100 text-[#86868B] font-mono px-2 py-0.5 rounded-full capitalize">
                      {tour.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#86868B]">
                    <div className="flex items-center gap-1.5">
                      <span>Participants:</span>
                      <div className="flex -space-x-1 overflow-hidden">
                        {tour.participants.map((p: any, idx: number) => (
                          <div 
                            key={p.id} 
                            style={{ zIndex: 10 - idx }}
                            className="inline-block w-4.5 h-4.5 rounded-full bg-zinc-300 border border-white flex items-center justify-center text-[8px] font-bold text-zinc-700"
                            title={p.username}
                          >
                            {(p.username?.[0] || 'X').toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onJoinTournament(tour.id)}
                    disabled={isJoined}
                    id={`join_tour_btn_${tour.id}`}
                    className={`w-full py-2.5 rounded-2xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      isJoined
                        ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                        : 'bg-[#0071E3] text-white border-[#0071E3] hover:opacity-90 shadow-sm'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white/80" />
                    {isJoined ? 'Registered in Brackets' : 'Register for Tournament'}
                  </button>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
