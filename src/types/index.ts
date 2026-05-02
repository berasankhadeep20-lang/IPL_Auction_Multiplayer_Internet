export type Role = 'BAT' | 'BOWL' | 'AR' | 'WK';
export type Nationality = 'Indian' | 'Overseas';
export type GamePhase = 'waiting' | 'auction' | 'break' | 'rapid' | 'finished';
export type AIStrategy = 'aggressive' | 'conservative' | 'balanced';
export type Form = 'Excellent' | 'Good' | 'Average' | 'Poor';
export type PoolName = 'BOWL_1' | 'BAT_1' | 'AR' | 'WK' | 'BOWL_2' | 'BAT_2' | 'RAPID';
export type Theme = 'dark' | 'light';

export interface PoolMeta { name: PoolName; label: string; start: number; end: number; }
export interface PlayerStats { matches: number; runs?: number; wickets?: number; average?: number; strikeRate?: number; economy?: number; }
export interface Player { id: string; name: string; role: Role; rating: number; basePrice: number; nationality: Nationality; stats: PlayerStats; form: Form; iplTeam?: string; }
export interface TeamInfo { id: string; name: string; shortName: string; primary: string; secondary: string; emoji: string; logo: string; }

export interface SoldEntry { playerId: string; teamId: string; price: number; }
export interface BidHistoryEntry { teamId: string; amount: number; ts: number; }

export interface TeamState {
  purse: number; soldPlayers: string; isAI: boolean;
  ownerUid: string | null; ownerName: string | null; aiStrategy: AIStrategy;


}

export interface ChatMessage { id: string; uid: string; name: string; text: string; ts: number; isReaction: boolean; }

export interface AuctionData {
  phase: GamePhase; queue: string; pools: string; currentPoolIdx: number; queueIndex: number;
  unsoldIds: string; soldLog: string; currentBid: number; currentBidderTeamId: string | null;
  biddingStartAt: number; timerEnd: number; poolBreakEnd: number;
  announcement: string; speechText: string; speechSeq: number;
  hammerTeamId: string | null; bidCount: number;
  bidHistory: string;       // JSON: BidHistoryEntry[] for current player
  lastSoldEntry: string;    // JSON: SoldEntry | null — for undo
}

export interface Participant { name: string; teamId: string | null; isSpectator: boolean; lastSeen: number; }
export interface RoomMeta { hostId: string; hostOnline: boolean; started: boolean; createdAt: number; }
export interface RoomData {
  meta: RoomMeta; participants: Record<string, Participant>;
  teams: Record<string, TeamState>; auction: AuctionData;
  chat: Record<string, ChatMessage>;
}

export interface ScoreEntry {
  teamId: string; teamInfo: TeamInfo; ownerName: string; squadScore: number;
  efficiency: number; totalScore: number; t20Score: number; purseLeft: number;
  players: { player: Player; price: number }[]; rank: number; isAI: boolean;
}

export const SQUAD_RULES = { maxPlayers:25, minPlayers:18, maxOverseas:8, minWK:2, minBAT:4, minBOWL:4, minAR:2, startingPurse:12000 };
