import "./style.css";
import { GameProvider } from "../../context/game";
import { SongProvider } from "../../context/song";
import { Outlet } from "react-router-dom";

export default () => {
  return (
      <SongProvider>
        <GameProvider>
        <div className="root">
          <Outlet />
        </div>
      </GameProvider >
    </SongProvider>
  );
}