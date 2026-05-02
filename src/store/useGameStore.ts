import { create } from 'zustand';
import { RoomData, Theme } from '../types';

interface GameStore {
  uid: string | null; roomId: string | null; roomData: RoomData | null;
  myTeamId: string | null; isHost: boolean; isSpectator: boolean; myName: string;
  screen: 'landing' | 'lobby' | 'auction' | 'break' | 'scoreboard';
  showTeamDrawer: boolean; viewingTeamId: string | null;
  soundEnabled: boolean; loading: boolean; error: string | null;
  theme: Theme; showChat: boolean; showPredictor: boolean;
  setUid:(v:string|null)=>void; setRoomId:(v:string|null)=>void;
  setRoomData:(v:RoomData|null)=>void; setMyTeamId:(v:string|null)=>void;
  setIsHost:(v:boolean)=>void; setIsSpectator:(v:boolean)=>void; setMyName:(v:string)=>void;
  setScreen:(v:GameStore['screen'])=>void; setShowTeamDrawer:(v:boolean)=>void;
  setViewingTeamId:(v:string|null)=>void; setSoundEnabled:(v:boolean)=>void;
  setLoading:(v:boolean)=>void; setError:(v:string|null)=>void;
  setTheme:(v:Theme)=>void; setShowChat:(v:boolean)=>void; setShowPredictor:(v:boolean)=>void;
  reset:()=>void;
}
const D = {
  uid:null,roomId:null,roomData:null,myTeamId:null,isHost:false,isSpectator:false,myName:'',
  screen:'landing' as const,showTeamDrawer:false,viewingTeamId:null,
  soundEnabled:true,loading:false,error:null,theme:'dark' as Theme,showChat:false,showPredictor:false,
};
export const useGameStore = create<GameStore>(set=>({
  ...D,
  setUid:v=>set({uid:v}), setRoomId:v=>set({roomId:v}), setRoomData:v=>set({roomData:v}),
  setMyTeamId:v=>set({myTeamId:v}), setIsHost:v=>set({isHost:v}), setIsSpectator:v=>set({isSpectator:v}),
  setMyName:v=>set({myName:v}), setScreen:v=>set({screen:v}), setShowTeamDrawer:v=>set({showTeamDrawer:v}),
  setViewingTeamId:v=>set({viewingTeamId:v}), setSoundEnabled:v=>set({soundEnabled:v}),
  setLoading:v=>set({loading:v}), setError:v=>set({error:v}),
  setTheme:v=>{
    set({theme:v});
    document.documentElement.setAttribute('data-theme', v);
  },
  setShowChat:v=>set({showChat:v}), setShowPredictor:v=>set({showPredictor:v}),
  reset:()=>set(D),
}));
