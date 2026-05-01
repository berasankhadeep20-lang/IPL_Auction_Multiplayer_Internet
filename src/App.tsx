import { useGameStore } from './store/useGameStore';
import Landing       from './components/Landing';
import Lobby         from './components/Lobby';
import AuctionScreen from './components/AuctionScreen';
import PoolBreak     from './components/PoolBreak';
import Scoreboard    from './components/Scoreboard';

export default function App() {
  const screen = useGameStore(s => s.screen);
  return (
    <>
      {screen === 'landing'    && <Landing />}
      {screen === 'lobby'      && <Lobby />}
      {screen === 'auction'    && <AuctionScreen />}
      {screen === 'break'      && <PoolBreak />}
      {screen === 'scoreboard' && <Scoreboard />}
    </>
  );
}
