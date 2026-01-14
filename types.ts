
export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  PROFILE_SETUP = 'PROFILE_SETUP',
  MATCHING = 'MATCHING',
  MATCH_FOUND = 'MATCH_FOUND',
  LIVE_SESSION = 'LIVE_SESSION',
  FEEDBACK = 'FEEDBACK',
  MARKETPLACE = 'MARKETPLACE',
  COMMUNITY = 'COMMUNITY',
  LEADERBOARD = 'LEADERBOARD',
  INQUIRY = 'INQUIRY',
  HISTORY = 'HISTORY'
}

export interface PortfolioEntry {
  id: string;
  skill: string;
  partnerName: string;
  type: 'taught' | 'learned';
  date: string;
  summary: string;
  codeSnippet?: string;
}

export interface RoadmapStep {
  title: string;
  description: string;
  status: 'locked' | 'current' | 'completed';
}

export interface UserProfile {
  name: string;
  fullName: string;
  email: string;
  teaching: string[];
  learning: string[];
  bio: string;
  tokens: number;
  portfolio: PortfolioEntry[];
  githubUrl?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  birthday?: string;
  // New Gamification Fields
  level: number;
  xp: number;
  streak: number;
  roadmap?: RoadmapStep[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'partner' | 'system';
  name: string;
  text: string;
  timestamp: string;
}

export interface SharedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  uploader_name: string;
  created_at: string;
}
