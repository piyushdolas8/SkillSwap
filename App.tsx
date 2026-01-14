import React, { useState, useCallback, useEffect } from 'react';
import { AppView, UserProfile, PortfolioEntry } from './types';
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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProfileFetching, setIsProfileFetching] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0, avatarUrl: ''
  });

  const navigate = useCallback((view: AppView) => {
    console.log(`[Navigation] Moving to ${view}`);
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  const fetchProfile = async (userId: string) => {
    if (isProfileFetching) return;
    setIsProfileFetching(true);
    try {
      // 1. Fetch Profile Base
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError || !profileData) {
        console.warn("No profile found for user, likely needs setup.");
        // If we're on landing and logged in without a profile, we should stay here but show setup if they click start
        return;
      }

      // 2. Fetch Skills
      const { data: skillsData } = await supabase
        .from('skills')
        .select('skill_name, type')
        .eq('user_id', userId);

      // 3. Fetch Portfolio
      const { data: portfolioData } = await supabase
        .from('portfolio')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const mappedPortfolio: PortfolioEntry[] = (portfolioData || []).map(item => ({
        id: item.id,
        skill: item.skill,
        partnerName: item.partner_name,
        type: item.type as 'taught' | 'learned',
        date: new Date(item.created_at).toLocaleDateString(),
        summary: item.summary
      }));

      const fetchedProfile: UserProfile = {
        name: profileData.name || '',
        fullName: profileData.full_name || '',
        email: profileData.email || '',
        bio: profileData.bio || '',
        tokens: profileData.tokens || 0,
        level: profileData.level || 1,
        xp: profileData.xp || 0,
        streak: profileData.streak || 0,
        avatarUrl: profileData.avatar_url || '',
        teaching: skillsData?.filter(s => s.type === 'teaching').map(s => s.skill_name) || [],
        learning: skillsData?.filter(s => s.type === 'learning').map(s => s.skill_name) || [],
        portfolio: mappedPortfolio
      };

      setUserProfile(fetchedProfile);
    } catch (e) { 
      console.warn("Profile fetch error:", e);
    } finally {
      setIsProfileFetching(false);
    }
  };

  const handleStartAction = useCallback(() => {
    console.log("[Action] Start SkillSwap Clicked");
    
    if (!session && !isDemoMode) {
      console.log("[Action] Redirecting to Auth (No Session)");
      navigate(AppView.AUTH);
      return;
    }

    // Check if profile is complete (needs at least one teach and one learn skill)
    const isProfileIncomplete = userProfile.teaching.length === 0 || userProfile.learning.length === 0;
    
    if (isProfileIncomplete) {
      console.log("[Action] Redirecting to Profile Setup (Incomplete Profile)");
      navigate(AppView.PROFILE_SETUP);
    } else {
      console.log("[Action] Redirecting to Matching Engine");
      navigate(AppView.MATCHING);
    }
  }, [session, isDemoMode, userProfile, navigate]);

  const handleDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsInitialLoading(false);
    
    const mockUser: UserProfile = {
      name: 'Guest Expert',
      fullName: 'Demo Account',
      email: 'guest@skillswap.io',
      teaching: ['React', 'TypeScript'],
      learning: ['Python'],
      bio: 'Guest expert testing the system.',
      tokens: 10,
      portfolio: [],
      level: 1, xp: 120, streak: 3,
      avatarUrl: ''
    };
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
          setSession(existingSession);
          if (existingSession) {
            await fetchProfile(existingSession.user.id);
          }
          setIsInitialLoading(false);
        }
      } catch (err) {
        if (mounted) setIsInitialLoading(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      console.log(`[Auth Event] ${event}`);
      setSession(newSession);
      
      if (newSession) {
        await fetchProfile(newSession.user.id);
        // Automatic redirection from Auth screen on successful login
        if (currentView === AppView.AUTH) {
          navigate(AppView.LANDING);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsDemoMode(false);
        setUserProfile({ name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0, avatarUrl: '' });
        navigate(AppView.LANDING);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [currentView, navigate]);

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
      const { error } = await supabase.from('profiles').update({ tokens: newTokens }).eq('id', session?.user?.id);
      if (error) throw error;
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    } catch (e) { return false; }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080910]">
        <div className="loader-ring mb-4"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Establishing Peer Connection...</p>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case AppView.LANDING:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={handleStartAction} onPurchase={handlePurchaseTokens} />;
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
        return <MarketplacePage onNavigate={navigate} onStartMatch={handleStartAction} />;
      case AppView.COMMUNITY:
        return <CommunityPage onNavigate={navigate} />;
      case AppView.LEADERBOARD:
        return <LeaderboardPage onNavigate={navigate} />;
      case AppView.INQUIRY:
        return <InquiryPage onBack={() => navigate(AppView.LANDING)} />;
      default:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={handleStartAction} onPurchase={handlePurchaseTokens} />;
    }
  };

  return <div className="min-h-screen bg-background-dark text-white bg-mesh">{renderCurrentView()}</div>;
};

export default App;