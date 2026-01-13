
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface Props {
  onBack: () => void;
  onDemoMode: () => void;
  isSupabaseDown?: boolean;
}

const AuthPage: React.FC<Props> = ({ onBack, onDemoMode, isSupabaseDown }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(
    isSupabaseDown ? { text: "Server unreachable. Please use Demo Mode to continue.", type: 'info' } : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseDown) {
      setMessage({ text: "The authentication server is currently unreachable. Please enter as a guest.", type: 'error' });
      return;
    }

    setIsAuthenticating(true);
    setMessage(null);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage({ text: "Recovery link sent! Check your inbox to reset your password.", type: 'success' });
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error("Please check your inbox and confirm your email.");
          }
          throw error;
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setMessage({ text: "Verification link sent! Check your email to confirm your account.", type: 'success' });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const isFetchError = err.name === 'TypeError' || err.message?.includes('Failed to fetch');
      setMessage({ 
        text: isFetchError ? "Could not reach the server. Check your connection or Supabase settings." : (err.message || "An unexpected error occurred."), 
        type: 'error' 
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col font-display">
      <header className="flex items-center justify-between border-b border-white/5 px-6 md:px-10 py-4 bg-background-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={onBack}>
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold tracking-tight">SkillSwap</h2>
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">close</span>
          Close
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 bg-mesh">
        <div className="w-full max-w-[480px] bg-[#161a2d] rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="pt-12 pb-6 px-10 text-center">
            <h1 className="text-white tracking-tighter text-4xl font-black mb-2 uppercase">
              {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Join the Network')}
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              {isForgotPassword ? 'Enter your email to receive a recovery link.' : (isLogin ? 'Level up your skills with peer experts.' : 'Trade what you know for what you need.')}
            </p>
          </div>

          {!isForgotPassword && (
            <div className="px-10 py-4">
              <div className="flex h-12 w-full items-center justify-center rounded-2xl bg-black/40 p-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setMessage(null); }}
                  className={`flex-1 h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setMessage(null); }}
                  className={`flex-1 h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-10 pb-6 space-y-5">
            {message && (
              <div className={`p-4 rounded-2xl text-xs font-bold text-center border animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : message.type === 'info' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                {message.text}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors !text-lg">mail</span>
                <input 
                  className="w-full rounded-2xl border border-white/5 bg-black/20 focus:border-primary focus:ring-1 focus:ring-primary h-14 pl-12 pr-4 text-white placeholder:text-slate-700 text-sm font-medium transition-all outline-none" 
                  placeholder="name@university.edu" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Password</label>
                  {isLogin && <button type="button" onClick={toggleForgotPassword} className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline">Forgot?</button>}
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors !text-lg">lock</span>
                  <input 
                    className="w-full rounded-2xl border border-white/5 bg-black/20 focus:border-primary focus:ring-1 focus:ring-primary h-14 pl-12 pr-4 text-white placeholder:text-slate-700 text-sm font-medium transition-all outline-none" 
                    placeholder="••••••••" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            )}

            <button 
              className="w-full flex items-center justify-center rounded-2xl h-14 bg-primary text-white text-sm font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all shadow-glow mt-4 disabled:opacity-50" 
              type="submit"
              disabled={isAuthenticating || !!isSupabaseDown}
            >
              {isAuthenticating ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (isForgotPassword ? 'Send Recovery Link' : (isLogin ? 'Authorize Access' : 'Create Expert ID'))}
            </button>

            {isForgotPassword && (
              <button 
                type="button" 
                onClick={toggleForgotPassword}
                className="w-full text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
              >
                Back to Login
              </button>
            )}
          </form>

          <div className="px-10 pb-10 text-center flex flex-col items-center gap-6">
            <div className="w-full flex items-center gap-4">
              <div className="h-px flex-1 bg-white/5"></div>
              <span className="text-[10px] text-slate-700 font-black uppercase">OR</span>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            
            <button 
              onClick={onDemoMode}
              className="w-full h-14 rounded-2xl border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-3 bg-white/5"
            >
              <span className="material-symbols-outlined !text-sm">rocket</span>
              Enter Demo Mode (No Server Needed)
            </button>

            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest leading-relaxed max-w-[300px]">
              If you see a "Failed to Fetch" error, please use Demo Mode. Secure identity is provided via local state when server is offline.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
