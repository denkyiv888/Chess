import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Trophy, ShieldAlert, Cpu } from 'lucide-react';
import { UserProfile } from '../types';

interface RegistrationFormProps {
  onRegister: (user: UserProfile) => void;
}

export default function RegistrationForm({ onRegister }: RegistrationFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [skillLevel, setSkillLevel] = useState<number>(1200);
  const [loading, setLoading] = useState(false);
  const [errorError, setErrorError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      setErrorError('Please enter both username and email.');
      return;
    }

    setLoading(true);
    setErrorError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim() }),
      });

      if (!response.ok) {
        throw new Error('Registration failed. Please check network connection.');
      }

      const data: UserProfile = await response.json();
      // Apply skill level choice to registered/logged-in profile
      data.rating = skillLevel;
      
      onRegister(data);
    } catch (err) {
      setErrorError(err instanceof Error ? err.message : 'Server unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md glass-panel p-8 sm:p-10 rounded-3xl"
        id="registration_form_card"
      >
        <div className="flex flex-col items-center text-center mb-8">
          {/* Custom Styled Minimalist App Logo */}
          <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center text-white font-display text-4xl shadow-md mb-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-800 to-zinc-500 opacity-20"></div>
            ♞
          </div>
          <h2 className="font-display text-3xl font-light tracking-tight text-zinc-950 mb-2">
            Chess Platform
          </h2>
          <p className="text-zinc-500 text-sm font-light">
            Designed to reflect absolute minimalism and clarity.
          </p>
        </div>

        {errorError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 p-4 rounded-xl bg-red-50 border border-red-150 text-red-600 text-xs flex items-start gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{errorError}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-zinc-600 text-xs font-medium tracking-wide uppercase mb-2">
              Username
            </label>
            <input
              type="text"
              required
              id="reg_input_username"
              placeholder=""
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl apple-input text-zinc-800 placeholder-zinc-400 text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-600 text-xs font-medium tracking-wide uppercase mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              id="reg_input_email"
              placeholder=""
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl apple-input text-zinc-800 placeholder-zinc-400 text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-600 text-xs font-medium tracking-wide uppercase mb-3">
              Starting Rating
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                id="skill_beginner_btn"
                onClick={() => setSkillLevel(800)}
                className={`py-3.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  skillLevel === 800
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white/40 hover:bg-white/85 text-zinc-700 border-zinc-200'
                }`}
              >
                <Cpu className="w-4 h-4 mb-2.5 opacity-80" />
                <span className="text-xs font-semibold">800</span>
                <span className="text-[10px] opacity-70 font-light mt-0.5">Beginner</span>
              </button>

              <button
                type="button"
                id="skill_intermediate_btn"
                onClick={() => setSkillLevel(1200)}
                className={`py-3.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  skillLevel === 1200
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white/40 hover:bg-white/85 text-zinc-700 border-zinc-200'
                }`}
              >
                <Sparkles className="w-4 h-4 mb-2.5 opacity-80" />
                <span className="text-xs font-semibold">1200</span>
                <span className="text-[10px] opacity-70 font-light mt-0.5">Club Standard</span>
              </button>

              <button
                type="button"
                id="skill_masters_btn"
                onClick={() => setSkillLevel(1600)}
                className={`py-3.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  skillLevel === 1600
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white/40 hover:bg-white/85 text-zinc-700 border-zinc-200'
                }`}
              >
                <Trophy className="w-4 h-4 mb-2.5 opacity-80" />
                <span className="text-xs font-semibold">1600</span>
                <span className="text-[10px] opacity-70 font-light mt-0.5">Expert</span>
              </button>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            id="register_submit_btn"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-zinc-950 text-white font-medium text-sm hover:bg-zinc-805 transition-colors shadow-lg active:scale-95 disabled:bg-zinc-400 mt-2 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
            ) : (
              'Create Free Profile'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
