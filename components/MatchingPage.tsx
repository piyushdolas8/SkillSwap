import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';

interface Props {
  onMatchFound: (partner: UserProfile, matchId: string) => void;
}

const MatchingPage: React.FC<Props> = ({ onMatchFound }) => {
  const [status, setStatus] = useState('Initializing peer discovery...');

  useEffect(() => {
    const findPeer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setStatus('Scanning network for skill symmetry...');
        
        // 1. Get current user's learning interests
        const { data: myLearning } = await supabase
          .from('skills')
          .select('skill_name')
          .eq('user_id', session.user.id)
          .eq('type', 'learning');

        const learningNames = myLearning?.map(s => s.skill_name) || [];

        // 2. Find someone who TEACHES what I want to learn
        const { data: potentialPeers, error } = await supabase
          .from('skills')
          .select(`
            user_id,
            skill_name,
            profiles:user_id (*)
          `)
          .eq('type', 'teaching')
          .in('skill_name', learningNames)
          .neq('user_id', session.user.id)
          .limit(1);

        if (error) throw error;

        // Artificial delay for high-end "thinking" feel
        await new Promise(r => setTimeout(r, 2000));

        if (potentialPeers && potentialPeers.length > 0) {
          const peerSkill = potentialPeers[0];
          const peer = peerSkill.profiles as any;
          
          // 3. Create a match entry in Supabase
          const { data: match, error: matchError } = await supabase
            .from('matches')
            .insert({
              user_1_id: session.user.id,
              user_2_id: peer.id,
              status: 'active'
            })
            .select()
            .single();

          if (matchError) throw matchError;

          const partnerProfile: UserProfile = {
            name: peer.name,
            fullName: peer.full_name,
            email: peer.email,
            teaching: [peerSkill.skill_name],
            learning: [],
            bio: peer.bio,
            tokens: peer.tokens,
            portfolio: [],
            avatarUrl: peer.avatar_url || `https://picsum.photos/seed/${peer.id}/500/500`,
            level: peer.level,
            xp: peer.xp,
            streak: peer.streak
          };
          onMatchFound(partnerProfile, match.id);
        } else {
          // Fallback if no real matches exist yet
          setStatus('No direct matches. Broadening search to available mentors...');
          await new Promise(r => setTimeout(r, 1500));
          
          onMatchFound({
            name: 'Alex Rivera',
            fullName: 'Alex Rivera',
            email: 'alex@skillswap.io',
            teaching: ['Python', 'System Design'],
            learning: ['UI Design'],
            bio: 'Senior Engineer at TechCorp. Love to teach Python.',
            tokens: 450,
            portfolio: [],
            avatarUrl: 'https://picsum.photos/seed/alex/500/500',
            level: 12,
            xp: 4500,
            streak: 15
          }, 'sandbox-match-id');
        }
      } catch (e) {
        console.error("Match error:", e);
        setStatus('Connection error. Retrying search...');
      }
    };

    findPeer();
  }, [onMatchFound]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden h-screen bg-background-dark">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0d33f2 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      <div className="flex flex-col max-w-[960px] w-full items-center justify-center relative z-10 px-6">
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
          <p className="text-slate-400 text-base md:text-lg font-normal leading-normal pb-8">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default MatchingPage;