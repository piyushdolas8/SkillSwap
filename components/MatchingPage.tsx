
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';

interface Props {
  onMatchFound: (partner: UserProfile, matchId: string) => void;
}

const MatchingPage: React.FC<Props> = ({ onMatchFound }) => {
  const [status, setStatus] = useState('Initializing peer discovery...');
  const timeoutRef = useRef<number | null>(null);

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

        // 2. Try Stage 1: Perfect Match (Someone teaches what I learn)
        const { data: stage1Peers } = await supabase
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

        let matchPartnerData: any = null;
        let matchSkill: string = 'General Expertise';

        if (stage1Peers && stage1Peers.length > 0) {
          matchPartnerData = stage1Peers[0].profiles;
          matchSkill = stage1Peers[0].skill_name;
        } else {
          // 3. Stage 2: Peer Discovery (Find any other active real user)
          setStatus('Broadening search to active peer nodes...');
          const { data: anyPeer } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', session.user.id)
            .order('last_active_at', { ascending: false })
            .limit(1)
            .single();

          if (anyPeer) {
            matchPartnerData = anyPeer;
            // Fetch one of their teaching skills for context
            const { data: peerSkills } = await supabase
              .from('skills')
              .select('skill_name')
              .eq('user_id', anyPeer.id)
              .eq('type', 'teaching')
              .limit(1);
            matchSkill = peerSkills?.[0]?.skill_name || 'Expertise';
          }
        }

        // Delay for better UX feel
        await new Promise(r => setTimeout(r, 2000));

        if (matchPartnerData) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          const { data: match, error: matchError } = await supabase
            .from('matches')
            .insert({
              user_1_id: session.user.id,
              user_2_id: matchPartnerData.id,
              status: 'active'
            })
            .select()
            .single();

          if (matchError) throw matchError;

          const partnerProfile: UserProfile = {
            name: matchPartnerData.name || 'Anonymous Peer',
            fullName: matchPartnerData.full_name || 'Anonymous Peer',
            email: matchPartnerData.email || '',
            teaching: [matchSkill],
            learning: [],
            bio: matchPartnerData.bio || 'Professional peer educator.',
            tokens: matchPartnerData.tokens || 0,
            portfolio: [],
            avatarUrl: matchPartnerData.avatar_url || `https://picsum.photos/seed/${matchPartnerData.id}/500/500`,
            level: matchPartnerData.level || 1,
            xp: matchPartnerData.xp || 0,
            streak: matchPartnerData.streak || 0
          };
          onMatchFound(partnerProfile, match.id);
        } else {
          // Final Fallback: Only if the database is literally empty
          setStatus('Connecting to system sandbox...');
          handleMockFallback();
        }
      } catch (e) {
        console.error("Match discovery failure:", e);
        handleMockFallback();
      }
    };

    const handleMockFallback = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onMatchFound({
        name: 'System Mentor',
        fullName: 'SkillSwap AI Sandbox',
        email: 'bot@skillswap.io',
        teaching: ['Python', 'System Design'],
        learning: ['UI Design'],
        bio: 'Automated sandbox mentor for system testing.',
        tokens: 999,
        portfolio: [],
        avatarUrl: 'https://picsum.photos/seed/system/500/500',
        level: 99,
        xp: 9999,
        streak: 365
      }, 'sandbox-' + Date.now());
    };

    findPeer();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [onMatchFound]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden h-screen bg-background-dark">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0d33f2 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      <div className="flex flex-col max-w-[960px] w-full items-center justify-center relative z-10 px-6">
        <div className="mb-8 flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-2 rounded-full">
          <span className="material-symbols-outlined text-primary text-sm">hub</span>
          <span className="text-primary font-black text-[10px] tracking-[0.3em] uppercase">Stage 2 Discovery Protocol Active</span>
        </div>
        <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-10">
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-[pulse_3s_linear_infinite]"></div>
          <div className="absolute inset-8 rounded-full border border-primary/20 animate-[pulse_2s_linear_infinite]"></div>
          <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(13,51,242,0.15)] border border-primary/50 overflow-hidden">
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-primary/40 flex items-center justify-center border border-primary/60">
              <span className="material-symbols-outlined text-white text-3xl md:text-5xl animate-bounce">radar</span>
            </div>
            <div className="absolute inset-0 border-t-2 border-primary/50 animate-spin"></div>
          </div>
        </div>
        <div className="text-center max-w-xl">
          <h1 className="text-white text-3xl md:text-5xl font-black leading-tight pb-3 uppercase tracking-tighter italic">Locating Peers</h1>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.4em] animate-pulse">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default MatchingPage;
