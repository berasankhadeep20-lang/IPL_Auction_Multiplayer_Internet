export type Role = 'BAT' | 'BOWL' | 'AR' | 'WK';
export type Nationality = 'Indian' | 'Overseas';
export type GamePhase = 'waiting' | 'auction' | 'rapid' | 'finished';
export type AIStrategy = 'aggressive' | 'conservative' | 'balanced';
export type Form = 'Excellent' | 'Good' | 'Average' | 'Poor';

export interface PlayerStats {
  matches: number;
  runs?: number;
  wickets?: number;
  average?: number;
  strikeRate?: number;
  economy?: number;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  rating: number;       // 60–98
  basePrice: number;    // in Lakhs (e.g., 200 = 2 Cr)
  nationality: Nationality;
  stats: PlayerStats;
  form: Form;
  iplTeam?: string;     // usual team nickname
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  primary: string;
  secondary: string;
  emoji: string;
  logo: string;
}

export interface SoldEntry {
  playerId: string;
  teamId: string;
  price: number; // in Lakhs
}

export interface TeamState {
  purse: number;        // remaining in Lakhs
  soldPlayers: string;  // JSON: SoldEntry[]
  isAI: boolean;
  ownerUid: string | null;
  ownerName: string | null;
  aiStrategy: AIStrategy;
}

export interface AuctionData {
  phase: GamePhase;
  queue: string;        // JSON: string[] player IDs
  queueIndex: number;
  unsoldIds: string;    // JSON: string[]
  soldLog: string;      // JSON: SoldEntry[]
  currentBid: number;   // in Lakhs
  currentBidderTeamId: string | null;
  timerEnd: number;     // Date.now() + duration
  announcement: string;
  hammerTeamId: string | null; // triggers sold animation
  bidCount: number;     // increments on each bid to trigger re-renders
}

export interface Participant {
  name: string;
  teamId: string | null;
  isSpectator: boolean;
  lastSeen: number;
}

export interface RoomMeta {
  hostId: string;
  hostOnline: boolean;
  started: boolean;
  createdAt: number;
}

export interface RoomData {
  meta: RoomMeta;
  participants: Record<string, Participant>;
  teams: Record<string, TeamState>;
  auction: AuctionData;
}

export interface ParsedTeamState {
  teamId: string;
  info: TeamInfo;
  purse: number;
  soldEntries: SoldEntry[];
  isAI: boolean;
  ownerUid: string | null;
  ownerName: string | null;
  aiStrategy: AIStrategy;
  playerCount: number;
  overseasCount: number;
}

export interface ScoreEntry {
  teamId: string;
  teamInfo: TeamInfo;
  ownerName: string;
  squadScore: number;
  efficiency: number;
  totalScore: number;
  purseLeft: number;
  players: { player: Player; price: number }[];
  rank: number;
  isAI: boolean;
}

export const SQUAD_RULES = {
  maxPlayers: 25,
  minPlayers: 18,
  maxOverseas: 8,
  minWK: 2,
  minBAT: 4,
  minBOWL: 4,
  minAR: 2,
  startingPurse: 12000, // 120 Cr in Lakhs
};
