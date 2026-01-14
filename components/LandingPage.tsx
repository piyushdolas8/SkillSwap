import React, { useState, useEffect } from 'react';
import { UserProfile, AppView } from '../types';
import { supabase } from '../services/supabaseClient';
import { getCareerAdvice } from '../services/geminiService';

interface Props {
  onStart: () => void;
  onNavigate: (view: AppView) => void;
  onPurchase: (amount: number) => Promise<boolean>;
  userProfile?: UserProfile;
}

const TOKEN_PACKS = [
  { id: 'spark', name: 'Spark Pack', tokens: 5, price: '$9.99', icon: 'bolt', color: 'text-blue-400', desc: 'Perfect for a single deep-dive session.' },
  { id: 'pro', name: 'Pro Bundle', tokens: 25, price: '$39.99', icon: 'star', color: 'text-primary', popular: true, desc: 'Best value for consistent weekly mastery.' },
  { id: 'vault', name: 'Mastery Vault', tokens: 100, price: '$129.99', icon: 'database', color: 'text-emerald-400', desc: 'The ultimate investment in your expertise.' },
];

const LandingPage: React.FC<Props> = ({ onStart, onNavigate, userProfile, onPurchase }) => {
  const isDashboard = !!userProfile;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState<string>("Analyzing your skill potential...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  
  // Payment Simulation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (userProfile && (userProfile.learning.length > 0 || userProfile.teaching.length > 0)) {
        setLoadingAdvice(true);
        const advice = await getCareerAdvice(userProfile.learning, userProfile.teaching);
        setCoachAdvice(advice);
        setLoadingAdvice(false);
      }
    };
    fetchAdvice();
  }, [userProfile?.learning, userProfile?.teaching]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleBuy = async (amount: number) => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 2000));
    const success = await onPurchase(amount);
    setIsProcessing(false);
    if (success) {
      setPurchaseSuccess(true);
      setTimeout(() => {
        setPurchaseSuccess(false);
        setShowTokenModal(false);
      }, 2500);
    }
  };

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-background-dark/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate(AppView.LANDING)}>
            <div className="text-primary">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-display">SkillSwap</span>
          </div>
          <nav className="hidden md:flex items-center gap-10">
            <button onClick={() => onNavigate(AppView.MARKETPLACE)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Marketplace</button>
            <button onClick={() => onNavigate(AppView.COMMUNITY)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Community</button>
            <button onClick={() => onNavigate(AppView.LEADERBOARD)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Leaderboard</button>
          </nav>
          <div className="flex items-center gap-4 relative">
            {userProfile ? (
              <>
                <div className="hidden sm:flex items-center gap-3 bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-full mr-2 cursor-pointer hover:bg-primary/20 transition-all" onClick={() => setShowTokenModal(true)}>
                   <span className="material-symbols-outlined text-primary text-sm">payments</span>
                   <span className="text-xs font-bold text-white tracking-tighter">{userProfile.tokens} ST</span>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="size-10 rounded-xl bg-card-dark border border-white/10 flex items-center justify-center hover:border-primary/50 transition-all overflow-hidden"
                  >
                    {userProfile.avatarUrl ? (
                      <img src={userProfile.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400">person</span>
                    )}
                  </button>
                  {showProfileMenu && (
                    <div className="absolute top-full right-0 mt-3 w-56 bg-[#161a2d] border border-white/5 rounded-2xl shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-top-2">
                      <button onClick={() => { onNavigate(AppView.PROFILE_SETUP); setShowProfileMenu(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">settings</span> Edit Profile
                      </button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-2 border-t border-white/5 mt-1">
                        <span className="material-symbols-outlined text-sm">logout</span> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button onClick={onStart} className="bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-lg shadow-glow hover:brightness-110 transition-all uppercase tracking-widest">
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Token Purchase Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-[#111218] rounded-[3rem] border border-white/5 shadow-[0_40px_100px_rgba(13,51,242,0.2)] overflow-hidden relative">
            <button onClick={() => !isProcessing && setShowTokenModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white z-20">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
               <div className="lg:col-span-2 bg-primary p-12 flex flex-col justify-center text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                  <span className="material-symbols-outlined !text-7xl mb-6 opacity-30">account_balance_wallet</span>
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-4">REFILL YOUR<br/>EXPERT CREDITS</h2>
                  <p className="text-white/80 font-medium text-sm leading-relaxed mb-8">SkillTokens (ST) power the decentralized knowledge exchange. Acquire credits to unlock top-tier peer mentors instantly.</p>
                  <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Current Balance</p>
                    <p className="text-2xl font-black">{userProfile?.tokens} ST</p>
                  </div>
               </div>
               <div className="lg:col-span-3 p-12 relative">
                  {purchaseSuccess ? (
                    <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                       <div className="size-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-glow mb-6">
                         <span className="material-symbols-outlined !text-5xl">check_circle</span>
                       </div>
                       <h3 className="text-white text-3xl font-black uppercase tracking-tighter mb-2">CREDITS MINTED</h3>
                       <p className="text-slate-500 font-medium">Your SkillToken balance has been updated successfully.</p>
                    </div>
                  ) : isProcessing ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                       <div className="relative size-32 mb-8">
                         <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                         <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                         <div className="absolute inset-4 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                           <div className="absolute top-0 left-0 w-full h-2 bg-primary animate-scan opacity-50"></div>
                           <span className="material-symbols-outlined text-primary !text-4xl">security</span>
                         </div>
                       </div>
                       <h3 className="text-white text-2xl font-black uppercase tracking-tighter mb-2">SECURE PROCESSING</h3>
                       <p className="text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">Authenticating Transaction on Network...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {TOKEN_PACKS.map(pack => (
                        <button 
                          key={pack.id} 
                          onClick={() => handleBuy(pack.tokens)}
                          className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-3xl hover:border-primary/40 hover:bg-white/10 transition-all group relative overflow-hidden text-left"
                        >
                          {pack.popular && <span className="absolute top-0 right-10 bg-primary text-white text-[8px] font-black px-3 py-1 rounded-b-lg uppercase tracking-widest">Most Popular</span>}
                          <div className="flex items-center gap-5">
                            <div className={`size-14 rounded-2xl bg-white/5 flex items-center justify-center ${pack.color} border border-white/5`}>
                              <span className="material-symbols-outlined !text-3xl">{pack.icon}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-white font-bold text-lg">{pack.name}</h4>
                                <span className="bg-white/10 text-slate-300 text-[10px] font-black px-2 py-0.5 rounded">{pack.tokens} ST</span>
                              </div>
                              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide mt-0.5">{pack.desc}</p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-white font-black text-xl">{pack.price}</p>
                             <p className="text-[10px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Select Pack</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 pt-24 pb-20">
        {isDashboard ? (
          <section className="mx-auto max-w-[1200px] px-6 py-12">
             <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">Level {userProfile.level || 1} Expert</span>
                    <span className="text-orange-500 text-[10px] font-black px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined !text-xs">local_fire_department</span>
                      {userProfile.streak || 1} Day Streak
                    </span>
                  </div>
                  <h1 className="text-white text-5xl font-black tracking-tighter uppercase">HI, {userProfile.name?.split(' ')[0]}</h1>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowTokenModal(true)} className="bg-white/5 border border-white/10 text-slate-400 font-black px-6 py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined !text-sm">add</span>
                    Buy More Tokens
                  </button>
                  <button onClick={onStart} className="bg-primary text-white font-black px-10 py-4 rounded-2xl shadow-glow hover:scale-105 transition-all uppercase tracking-widest text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined">auto_awesome</span>
                    Find Next Match
                  </button>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-12">
                   <h2 className="text-white text-2xl font-black flex items-center gap-3 uppercase tracking-tight">
                      <span className="material-symbols-outlined text-primary !text-3xl">verified_user</span>
                      Verified Skill Portfolio
                   </h2>
                   <div className="grid grid-cols-1 gap-4">
                      {userProfile.portfolio.length > 0 ? userProfile.portfolio.map(entry => (
                        <div key={entry.id} className="bg-card-dark border border-border-dark p-6 rounded-[2rem] flex gap-6 hover:border-primary/50 transition-all group">
                           <div className="size-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                              <span className="material-symbols-outlined !text-4xl">verified</span>
                           </div>
                           <div>
                              <div className="flex items-center gap-3 mb-2">
                                 <h3 className="text-xl font-bold text-white">{entry.skill} Mastery</h3>
                                 <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">Verified</span>
                              </div>
                              <p className="text-slate-400 text-sm mb-4 leading-relaxed">{entry.summary}</p>
                              <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                 <span>Partner: {entry.partnerName}</span>
                                 <span>{entry.date}</span>
                              </div>
                           </div>
                        </div>
                      )) : (
                        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[3rem]">
                           <span className="material-symbols-outlined text-slate-700 !text-6xl mb-4">history_edu</span>
                           <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No swaps verified yet</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="bg-primary shadow-glow p-10 rounded-[2.5rem] text-center text-white cursor-pointer hover:scale-[1.02] transition-all" onClick={() => setShowTokenModal(true)}>
                      <div className="material-symbols-outlined !text-6xl mb-4">account_balance_wallet</div>
                      <h3 className="text-5xl font-black mb-1">{userProfile.tokens} ST</h3>
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Skill Economy Credit</p>
                      <div className="mt-8 pt-8 border-t border-white/10">
                        <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                          <span>Next Level</span>
                          <span>{userProfile.xp || 0} / 500 XP</span>
                        </div>
                        <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white shadow-glow" style={{ width: `${((userProfile.xp || 0) / 500) * 100}%` }}></div>
                        </div>
                      </div>
                   </div>
                   
                   <div className="bg-[#111218] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                         <span className={`material-symbols-outlined !text-4xl text-primary ${loadingAdvice ? 'animate-spin' : ''}`}>psychology</span>
                      </div>
                      <h3 className="text-white font-bold mb-6 uppercase tracking-tighter flex items-center gap-2">
                        AI Career Coach
                      </h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className={`text-slate-300 text-xs italic leading-relaxed transition-opacity duration-500 ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
                            "{coachAdvice}"
                          </p>
                        </div>
                        <button 
                          onClick={async () => {
                            setLoadingAdvice(true);
                            const advice = await getCareerAdvice(userProfile.learning, userProfile.teaching);
                            setCoachAdvice(advice);
                            setLoadingAdvice(false);
                          }}
                          className="w-full text-primary text-[10px] font-black uppercase tracking-widest hover:underline disabled:opacity-50"
                          disabled={loadingAdvice}
                        >
                          {loadingAdvice ? 'Synthesizing...' : 'Refresh Advice'}
                        </button>
                      </div>
                   </div>
                </div>
             </div>
          </section>
        ) : (
          <section className="relative px-6 py-20 lg:py-32">
            <div className="mx-auto max-w-[1000px] text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Decentralized Peer Learning</span>
              </div>
              <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-7xl lg:text-8xl">
                Trade Skills. <br />
                Level Up. <span className="text-primary">Instantly.</span>
              </h1>
              <p className="mx-auto mt-8 max-w-[640px] text-lg text-slate-400 md:text-xl">
                The world's first decentralized skill economy for students. Master any craft by teaching what you know.
              </p>
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button onClick={onStart} className="w-full sm:w-auto min-w-[200px] bg-primary text-white text-lg font-bold px-8 py-4 rounded-xl shadow-glow hover:scale-105 transition-transform uppercase tracking-widest">
                  Start SkillSwap
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/5 bg-background-dark py-16 px-6">
        <div className="mx-auto max-w-[1200px] flex flex-col items-center text-center">
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.4em]">
            © 2026 SkillSwap Inc. Peer-Verified Excellence.
          </p>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;