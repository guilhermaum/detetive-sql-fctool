import "./style.css";
import { useEffect, useState } from "react";
import { useGame } from "../../context/game";
import { Navigate } from "react-router-dom";

import Load from "../../components/Load";
import ModalCorrect from "../../components/Modal/Correct";

import IconMenu from "../../components/Icons/IconMenu";
import IconClose from "../../components/Icons/IconClose";
import IconHelp from "../../components/Icons/IconHelp";
import IconCoin from "../../components/Icons/IconCoin";
import logo from "../../assets/detetive-sql.svg";
import SqlQuery from "./SqlQuery";
import FormCheck from "./FormCheck";
import { formatDifficulty } from "../../models/difficulty";

export default () => {
  const [showCorrect, setShowCorrect] = useState(false);
  const [openMenu, setOpenMenu] = useState<boolean>(false);
  const [helper, setHelper] = useState<boolean>(true);
  const [pendingHintId, setPendingHintId] = useState<number | null>(null);

  const {
    level,
    caseInfo,
    scoreGame,
    lastLevel,
    isGameOver,
    isGameWon,
    gameCompleted,
    usedHintIds: usedHints,
    remainingHelps,
    applyHelp,
    nextGameLevel,
    gameStarted,
  } = useGame();

  function toggleOpenMenu() {
    setOpenMenu((open) => !open);
  }

  function handleCorrectResult() {
    setShowCorrect(true);
  }

  function handleNextLevel() {
    setShowCorrect(false);
    nextGameLevel();
  }

  async function handleClickHelp(hintId: number) {
    if (usedHints.includes(hintId) || pendingHintId !== null) return;
    setPendingHintId(hintId);
    try {
      await applyHelp(hintId);
    } catch (error) {
      console.error("Nao foi possivel registrar o uso da dica.", error);
    } finally {
      setPendingHintId(null);
    }
  }

  useEffect(() => {
    setHelper(() => remainingHelps > 0);
  }, [remainingHelps]);

  if (!gameStarted) return <Navigate to="/" />;
  if (isGameWon && gameCompleted) return <Navigate to="/finish" replace />;
  if (isGameOver) return <Navigate to="/end" />;
  if (!level) return <Load />;

  return (
    <div className="level">
      <button className="menu" onClick={toggleOpenMenu}>
        {openMenu ? <IconClose /> : <IconMenu />}
      </button>

      <aside className={openMenu ? "side open" : "side"}>
        <div>
          <h2>
            Etapa {level?.number}/{lastLevel}
          </h2>
          {caseInfo && (
            <p className="difficulty-level">
              Dificuldade: <strong>{formatDifficulty(caseInfo.difficulty)}</strong>
            </p>
          )}
          <h3 className="score">
            <IconCoin />
            {scoreGame}
          </h3>
        </div>

        <div>
          <h3>Preciso de ajuda</h3>
          <span>
            {helper
              ? `Restam ${remainingHelps} ajudas.`
              : "Não restam mais ajudas."}
          </span>
          <ul className="helps">
            {level?.helps.map(({ id, title, tip }) => {
              return (
                <li key={id}>
                  <button
                    onClick={() => void handleClickHelp(id)}
                    className={usedHints.includes(id) ? "tip active" : "tip"}
                    disabled={
                      !helper ||
                      usedHints.includes(id) ||
                      pendingHintId !== null
                    }
                  >
                    <IconHelp />
                    <span className="title">{title}</span>
                    <span className="tip-text">{tip}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <main className="main">
        <div className="central">
          <img src={logo} alt="Detetive SQL" className="logo" />
        </div>

        {level?.tips.map((tip: string, idx: number) => (
          <p key={idx}>{tip}</p>
        ))}

        <br />
        <p>
          <strong>Investigue:</strong> Realize consultas no banco de dados para
          encontrar as pistas.
        </p>

        <SqlQuery />

        <br />
        {level?.problems.map((problem: string, idx: number) => (
          <p key={idx}>{problem}</p>
        ))}

        <p>
          <strong>Desafio:</strong> Informe os valores esperados das colunas
          para validar o caso.
        </p>

        <FormCheck template={level.template} correct={handleCorrectResult} />
      </main>

      {(showCorrect || isGameWon) && <ModalCorrect action={handleNextLevel} />}
    </div>
  );
};
