import "./style.css";
import { Navigate, useNavigate } from "react-router-dom";
import { useGame } from "../../context/game";
import logo from "../../assets/detetive-sql.svg";
import illustration from "../../assets/end.svg";
import IconNext from "../../components/Icons/IconNext";

export default function Finish() {
  const {
    isGameWon,
    gameCompleted,
    playerName,
    finalScore,
    rankingEnabled,
    hasNextCase,
    advanceCaseStep,
    allowReplaySameCase,
    resetGame,
  } = useGame();
  const navigate = useNavigate();

  if (!isGameWon || !gameCompleted) return <Navigate to="/" replace />;

  function handleNextCase() {
    advanceCaseStep();
    navigate("/cases", { replace: true });
  }

  return (
    <main className="finish">
      <img src={logo} alt="Detetive SQL" className="logo" />
      <img
        src={illustration}
        alt="Detetive comemorando o caso resolvido"
        className="draw"
      />
      <p className="description">
        {playerName}, parabéns! Você concluiu o caso e conquistou {finalScore}{" "}
        pontos.
      </p>

      {hasNextCase && (
        <button
          type="button"
          className="control btn large"
          onClick={handleNextCase}
        >
          Próximo caso
          <IconNext />
        </button>
      )}

      {rankingEnabled && (
        <button
          type="button"
          className="control btn large"
          onClick={() => navigate("/ranking")}
        >
          Ver Ranking
          <IconNext />
        </button>
      )}

      {allowReplaySameCase && (
        <button
          type="button"
          className="control btn large"
          onClick={() => {
            resetGame();
            navigate("/", { replace: true });
          }}
        >
          Jogar Novamente
          <IconNext />
        </button>
      )}
    </main>
  );
}
