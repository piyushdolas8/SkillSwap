import React, { useState, useCallback, useEffect } from 'react';
import { AppView, UserProfile } from './types';
import { supabase } from './services/supabaseClient';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
import MatchingPage from './components/MatchingPage';
import MatchFoundPage from './components/MatchFoundPage';
import LiveSession from './components/LiveSession';
import FeedbackPage from './components/FeedbackPage';
import MarketplacePage from './components/MarketplacePage';
import CommunityPage from './components/CommunityPage';
import LeaderboardPage from './components/LeaderboardPage';
import InquiryPage from './components/InquiryPage';

const DEMO_STORAGE_KEY = 'skillswap_demo_profile';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(DEMO_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    
    return {
      name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0
    };
  });

  const navigate = useCallback((view: AppView) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!profileData) {
        navigate(AppView.PROFILE_SETUP);
        return;
      }

      const { data: skillsData } = await supabase.from('skills').select('skill_name, type').eq('user_id', userId);

      setUserProfile({
        name: profileData.name || '',
        fullName: profileData.full_name || '',
        email: profileData.email || '',
        bio: profileData.bio || '',
        tokens: profileData.tokens || 0,
        level: profileData.level || 1,
        xp: profileData.xp || 0,
        streak: profileData.streak || 0,
        teaching: skillsData?.filter(s => s.type === 'teaching').map(s => s.skill_name) || [],
        learning: skillsData?.filter(s => s.type === 'learning').map(s => s.skill_name) || [],
        portfolio: []
      });

      // If we are currently on the AUTH view, move to LANDING
      setCurrentView(prev => prev === AppView.AUTH ? AppView.LANDING : prev);

    } catch (e) { 
      console.warn("Profile fetch deferred or failed"); 
      // If profile doesn't exist, they might need setup
      navigate(AppView.PROFILE_SETUP);
    }
  };

  const handleDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsInitialLoading(false);
    
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    let mockUser: UserProfile;
    
    if (saved) {
      mockUser = JSON.parse(saved);
    } else {
      mockUser = {
        name: 'Demo Expert',
        fullName: 'Demo Account',
        email: 'guest@skillswap.io',
        teaching: ['React', 'TypeScript'],
        learning: ['Python'],
        bio: 'Guest expert testing the system.',
        tokens: 10,
        portfolio: [],
        level: 1, xp: 120, streak: 3
      };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(mockUser));
    }
    setUserProfile(mockUser);
    setSession({ user: { id: 'demo-id' } });
    navigate(AppView.LANDING);
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const initApp = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (mounted) {
          if (existingSession) {
            setSession(existingSession);
            await fetchProfile(existingSession.user.id);
          }
          setIsInitialLoading(false);
        }
      } catch (err) {
        console.warn("Auth initialization failed");
        if (mounted) setIsInitialLoading(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (mounted) {
        setSession(newSession);
        if (newSession) {
          await fetchProfile(newSession.user.id);
        } else {
          // User logged out
          setCurrentView(AppView.LANDING);
          setUserProfile({
            name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0
          });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleMatchFound = (partner: UserProfile, matchId: string) => {
    setPartnerProfile(partner);
    setCurrentMatchId(matchId);
    navigate(AppView.MATCH_FOUND);
  };

  const handlePurchaseTokens = async (amount: number) => {
    const newTokens = userProfile.tokens + amount;
    if (isDemoMode) {
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    }
    try {
      await supabase.from('profiles').update({ tokens: newTokens }).eq('id', session?.user?.id);
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    } catch (e) { return false; }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080910]">
        <div className="loader-ring mb-4"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Establishing Peer Network...</p>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case AppView.LANDING:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={() => navigate(session ? AppView.MATCHING : AppView.AUTH)} onPurchase={handlePurchaseTokens} />;
      case AppView.AUTH:
        return <AuthPage onBack={() => navigate(AppView.LANDING)} onDemoMode={handleDemoMode} />; 
      case AppView.PROFILE_SETUP:
        return <ProfileSetup userProfile={userProfile} setUserProfile={setUserProfile} onComplete={() => navigate(AppView.LANDING)} />;
      case AppView.MATCHING:
        return <MatchingPage onMatchFound={handleMatchFound} />;
      case AppView.MATCH_FOUND:
        return <MatchFoundPage partner={partnerProfile} onJoin={() => navigate(AppView.LIVE_SESSION)} />;
      case AppView.LIVE_SESSION:
        return <LiveSession matchId={currentMatchId} partner={partnerProfile} skill={userProfile.learning[0] || 'Python'} onEnd={() => navigate(AppView.FEEDBACK)} />;
      case AppView.FEEDBACK:
        return <FeedbackPage userProfile={userProfile} setUserProfile={setUserProfile} onFinish={() => navigate(AppView.LANDING)} />;
      case AppView.MARKETPLACE:
        return <MarketplacePage onNavigate={navigate} onStartMatch={() => navigate(session ? AppView.MATCHING : AppView.AUTH)} />;
      case AppView.COMMUNITY:
        return <CommunityPage onNavigate={navigate} />;
      case AppView.LEADERBOARD:
        return <LeaderboardPage onNavigate={navigate} />;
      case AppView.INQUIRY:
        return <InquiryPage onBack={() => navigate(AppView.LANDING)} />;
      default:
        return <LandingPage onNavigate={navigate} onStart={() => navigate(AppView.MATCHING)} userProfile={session ? userProfile : undefined} onPurchase={handlePurchaseTokens} />;
    }
  };

  return <div className="min-h-screen bg-background-dark text-white bg-mesh">{renderCurrentView()}</div>;
};

export default App;