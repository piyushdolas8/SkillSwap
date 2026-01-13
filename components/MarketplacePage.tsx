
import React, { useState } from 'react';
import { AppView } from '../types';

interface Props {
  onNavigate: (view: AppView) => void;
  onStartMatch: () => void;
}

const LISTINGS = [
  { id: 1, name: 'David Kim', skill: 'Advanced Python', price: 1, rating: 4.9, swaps: 124, category: 'Tech' },
  { id: 2, name: 'Elena Rossi', skill: 'Digital Marketing', price: 1, rating: 4.8, swaps: 89, category: 'Business' },
  { id: 3, name: 'Marcus Chen', skill: 'Blender 3D', price: 2, rating: 5.0, swaps: 45, category: 'Design' },
  { id: 4, name: 'Sofia Garcia', skill: 'Spanish Fluency', price: 1, rating: 4.7, swaps: 212, category: 'Languages' },
  { id: 5, name: 'Jordan Lee', skill: 'React Native', price: 2, rating: 4.9, swaps: 67, category: 'Tech' },
  { id: 6, name: 'Amara Okafor', skill: 'UI Animation', price: 1, rating: 4.8, swaps: 34, category: 'Design' },
];

const MarketplacePage: React.FC<Props> = ({ onNavigate, onStartMatch }) => {
  const [filter, setFilter] = useState('All');

  const filteredListings = filter === 'All' ? LISTINGS : LISTINGS.filter(l => l.category === filter);

  return (
    <div className="min-h-screen bg-background-dark pt-24 px-6 md:px-12 pb-20">
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-background-dark/80 backdrop-blur-md left-0">
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
            <button onClick={() => onNavigate(AppView.MARKETPLACE)} className="text-sm font-bold text-white border-b-2 border-primary pb-1">Marketplace</button>
            <button onClick={() => onNavigate(AppView.COMMUNITY)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Community</button>
            <button onClick={() => onNavigate(AppView.LEADERBOARD)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Leaderboard</button>
          </nav>
          <div>
            <button onClick={() => onNavigate(AppView.AUTH)} className="bg-primary text-white text-xs font-bold px-5 py-2 rounded-lg">Get Started</button>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto">
        <div className="mb-12">
          <h1 className="text-white text-5xl font-black mb-4 tracking-tight">SKILL MARKETPLACE</h1>
          <p className="text-slate-400 text-lg max-w-2xl font-medium">Browse thousands of peer-to-peer expertises. Trade your tokens for instant mastery.</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-12">
          {['All', 'Tech', 'Design', 'Business', 'Languages'].map(cat => (
            <button 
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${filter === cat ? 'bg-primary border-primary text-white' : 'border-white/10 text-slate-500 hover:border-white/30'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map(listing => (
            <div key={listing.id} className="bg-card-dark border border-border-dark rounded-3xl p-6 hover:border-primary/50 transition-all group flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="size-14 bg-white/5 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined !text-3xl">{listing.category === 'Tech' ? 'code' : listing.category === 'Design' ? 'brush' : listing.category === 'Business' ? 'trending_up' : 'language'}</span>
                </div>
                <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="text-primary font-black text-xs">{listing.price} ST</span>
                </div>
              </div>
              
              <h3 className="text-white text-xl font-bold mb-1">{listing.skill}</h3>
              <p className="text-slate-500 text-sm font-medium mb-4">by {listing.name}</p>
              
              <div className="mt-auto space-y-4">
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <div className="flex items-center gap-1 text-yellow-500">
                    <span className="material-symbols-outlined !text-[14px]">star</span>
                    {listing.rating}
                  </div>
                  <div>{listing.swaps} Swaps</div>
                </div>
                <button 
                  onClick={onStartMatch}
                  className="w-full bg-white/5 border border-white/5 py-3 rounded-xl text-white text-xs font-black uppercase tracking-widest group-hover:bg-primary group-hover:border-primary transition-all"
                >
                  Request Swap
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="mt-20 pt-16 border-t border-white/5 text-center flex flex-col items-center">
         <p className="text-slate-400 text-sm mb-6 max-w-xl">
            The future of peer-to-peer expert validation and knowledge exchange. Earn as you teach, learn as you spend.
         </p>
         <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">
            © 2026 SkillSwap Inc. Made by Piyush Dolas. Peer-Verified Excellence.
         </p>
      </footer>
    </div>
  );
};

export default MarketplacePage;
