import "./style.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSong } from "../../context/song";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../context/game";
import Load from "../../components/Load";
import { findResumableGameSession } from "../../services/game-sessions";
import {
  getConfiguredSessionContinuity,
  getFctoolIdentity,
} from "../../services/fctool";

import IconNext from "../../components/Icons/IconNext";
import logo from "../../assets/detetive-sql.svg";
import illustration from "../../assets/detective.svg";

// eslint-disable-next-line react-refresh/only-export-components
export default () => {
  const { playSong } = useSong();
  const { playerName, savePlayerName, startGame: startGameSession } = useGame();
  const [name, setName] = useState(playerName);
  const [checkingSession, setCheckingSession] = useState(
    getConfiguredSessionContinuity,
  );
  const navigate = useNavigate();
  const resumeCheckStarted = useRef(false);

  useEffect(() => {
    if (!checkingSession || resumeCheckStarted.current) return;
    resumeCheckStarted.current = true;

    async function resumeSavedGame() {
      try {
        const identity = getFctoolIdentity() ?? {
          cardId: "",
          playerId: "",
        };

        const resumableSession = await findResumableGameSession(
          identity.cardId,
          identity.playerId,
        );

        if (resumableSession) {
          await startGameSession(
            String(resumableSession.session.case_id),
            resumableSession,
            identity,
          );
          navigate("/level", { replace: true });
          return;
        }
      } catch (error) {
        console.error(
          "Nao foi possivel procurar uma sessao para continuar.",
          error,
        );
      }

      setCheckingSession(false);
    }

    void resumeSavedGame();
  }, [checkingSession, navigate, startGameSession]);

  function startGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    playSong();
    savePlayerName(trimmedName);
    navigate("/cases");
  }

  if (checkingSession) return <Load />;

  return (
    <div className="home">
      <img src={logo} alt="Detetive SQL" className="logo" />
      <img src={illustration} alt="Detetive" className="draw" />
      <form onSubmit={startGame}>
        <input
          className="control btn large name-input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Digite seu nome"
          aria-label="Digite seu nome"
          maxLength={60}
          autoComplete="off"
          required
        />
        <button className="control btn large" type="submit">
          Iniciar
          <IconNext />
        </button>
      </form>
    </div>
  );
};
