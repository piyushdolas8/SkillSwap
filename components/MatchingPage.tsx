
import React, { useEffect } from 'react';

interface Props {
  onMatchFound: () => void;
}

const MatchingPage: React.FC<Props> = ({ onMatchFound }) => {
  useEffect(() => {
    // Reduced from 4000ms to 1500ms for better perceived performance
    const timer = setTimeout(() => {
      onMatchFound();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onMatchFound]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0d33f2 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      
      <div className="layout-content-container flex flex-col max-w-[960px] w-full items-center justify-center relative z-10 px-6">
        <div className="mb-8 flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-2 rounded-full">
          <span className="material-symbols-outlined text-primary text-sm">code</span>
          <span className="text-primary font-bold text-sm tracking-widest uppercase">Matching AI Engine Active</span>
        </div>

        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-10">
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-[pulse_3s_linear_infinite]"></div>
          <div className="absolute inset-8 rounded-full border border-primary/20 animate-[pulse_2s_linear_infinite]"></div>
          
          <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(13,51,242,0.15)] border border-primary/50 overflow-hidden">
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-primary/40 flex items-center justify-center border border-primary/60">
              <span className="material-symbols-outlined text-white text-3xl md:text-5xl animate-bounce">search_insights</span>
            </div>
            <div className="absolute inset-0 border-t-2 border-primary/50 animate-spin"></div>
          </div>
        </div>

        <div className="text-center max-w-xl">
          <h1 className="text-white text-3xl md:text-5xl font-bold leading-tight pb-3">Finding your match...</h1>
          <p className="text-slate-400 text-base md:text-lg font-normal leading-normal pb-8">
            Scanning our global network of developers to find the perfect mentor for your specific needs.
          </p>
        </div>

        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xs text-primary animate-spin">sync</span>
            <span className="text-xs uppercase tracking-widest text-primary font-bold">Matching skills and timezone preferences</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchingPage;
