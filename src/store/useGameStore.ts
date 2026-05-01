import { create } from 'zustand';
import { RoomData } from '../types';

interface GameStore {
  // Firebase auth
  uid: string | null;

  // Room
  roomId: string | null;
  roomData: RoomData | null;

  // My identity
  myTeamId: string | null;
  isHost: boolean;
  isSpectator: boolean;
  myName: string;

  // UI
  screen: 'landing' | 'lobby' | 'auction' | 'scoreboard';
  showTeamDrawer: boolean;
  viewingTeamId: string | null;
  soundEnabled: boolean;
  loading: boolean;
  error: string | null;

  // Setters
  setUid:          (uid: string | null)      => void;
  setRoomId:       (id: string | null)       => void;
  setRoomData:     (d: RoomData | null)      => void;
  setMyTeamId:     (id: string | null)       => void;
  setIsHost:       (v: boolean)              => void;
  setIsSpectator:  (v: boolean)              => void;
  setMyName:       (n: string)               => void;
  setScreen:       (s: GameStore['screen'])  => void;
  setShowTeamDrawer:(v: boolean)             => void;
  setViewingTeamId:(id: string | null)       => void;
  setSoundEnabled: (v: boolean)              => void;
  setLoading:      (v: boolean)              => void;
  setError:        (e: string | null)        => void;
  reset:           ()                        => void;
}

const defaults = {
  uid: null,
  roomId: null,
  roomData: null,
  myTeamId: null,
  isHost: false,
  isSpectator: false,
  myName: '',
  screen: 'landing' as const,
  showTeamDrawer: false,
  viewingTeamId: null,
  soundEnabled: true,
  loading: false,
  error: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...defaults,
  setUid:          (uid)         => set({ uid }),
  setRoomId:       (roomId)      => set({ roomId }),
  setRoomData:     (roomData)    => set({ roomData }),
  setMyTeamId:     (myTeamId)    => set({ myTeamId }),
  setIsHost:       (isHost)      => set({ isHost }),
  setIsSpectator:  (isSpectator) => set({ isSpectator }),
  setMyName:       (myName)      => set({ myName }),
  setScreen:       (screen)      => set({ screen }),
  setShowTeamDrawer:(showTeamDrawer) => set({ showTeamDrawer }),
  setViewingTeamId:(viewingTeamId)   => set({ viewingTeamId }),
  setSoundEnabled: (soundEnabled)    => set({ soundEnabled }),
  setLoading:      (loading)    => set({ loading }),
  setError:        (error)      => set({ error }),
  reset:           ()           => set(defaults),
}));
