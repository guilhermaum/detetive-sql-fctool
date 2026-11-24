import "./style.css";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useGame } from "../../context/game";
import { findCasesByDifficulty } from "../../services/games";
import { getConfiguredGameConfiguration } from "../../services/fctool";
import type { GameDifficulty } from "../../models/gameConfiguration";
import logo from "../../assets/detetive-sql.svg";
import illustration from "../../assets/end.svg";
import IconNext from "../../components/Icons/IconNext";

const apiDifficulties: Record<GameDifficulty, string> = {
  facil: "easy",
  medio: "medium",
  dificil: "hard",
};

const difficultyLabels: Record<GameDifficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

const difficultyOrder: GameDifficulty[] = ["facil", "medio", "dificil"];

async function findNextDifficultyWithCases(
  difficulty: GameDifficulty,
): Promise<GameDifficulty | null> {
  try {
    const currentIndex = difficultyOrder.indexOf(difficulty);
    for (const nextDifficulty of difficultyOrder.slice(currentIndex + 1)) {
      const cases = await findCasesByDifficulty(apiDifficulties[nextDifficulty]);
      if (cases.length > 0) return nextDifficulty;
    }
  } catch (error) {
    console.error("Não foi possível localizar a próxima dificuldade.", error);
  }
  return null;
}

export default function Finish() {
  const {
    isGameWon,
    gameCompleted,
    playerName,
    finalScore,
    rankingEnabled,
    currentDifficulty,
    completedCaseIds,
    canAdvanceCases,
    advanceToNextCase,
    finishActivity,
    allowReplaySameCase,
    resetGame,
  } = useGame();
  const navigate = useNavigate();
  const configuration = getConfiguredGameConfiguration();
  const [hasNextCase, setHasNextCase] = useState(false);
  const [hasUnplayedCase, setHasUnplayedCase] = useState(false);
  const [nextDifficulty, setNextDifficulty] = useState<GameDifficulty | null>(null);
  const [checkingCases, setCheckingCases] = useState(false);
  const [activityEnded, setActivityEnded] = useState(false);

  useEffect(() => {
    if (!canAdvanceCases || !currentDifficulty) return;
    const selectedDifficulty = currentDifficulty;
    let active = true;
    setCheckingCases(true);
    setHasNextCase(false);
    setHasUnplayedCase(false);
    setNextDifficulty(null);

    async function checkNextOptions() {
      try {
        const cases = await findCasesByDifficulty(apiDifficulties[selectedDifficulty]);
        const hasUnplayedCase = cases.some(
          (item) => !completedCaseIds.includes(Number(item.id)),
        );
        if (!active) return;
        setHasUnplayedCase(hasUnplayedCase);
        setHasNextCase(
          hasUnplayedCase || configuration.allowReplaySameCase,
        );
        if (!hasUnplayedCase) {
          const next = await findNextDifficultyWithCases(selectedDifficulty);
          if (active) setNextDifficulty(next);
        }
      } catch (error) {
        console.error("Não foi possível verificar os casos seguintes.", error);
      } finally {
        if (active) setCheckingCases(false);
      }
    }

    void checkNextOptions();
    return () => {
      active = false;
    };
  }, [
    canAdvanceCases,
    completedCaseIds,
    configuration.allowReplaySameCase,
    currentDifficulty,
  ]);

  if (!isGameWon || !gameCompleted) return <Navigate to="/" replace />;

  function handleNextCase() {
    if (!currentDifficulty) return;
    advanceToNextCase(currentDifficulty);
    navigate(`/cases?difficulty=${currentDifficulty}`, { replace: true });
  }

  function handleNextDifficulty() {
    if (!nextDifficulty) return;
    advanceToNextCase(nextDifficulty);
    navigate(`/cases?difficulty=${nextDifficulty}`, { replace: true });
  }

  function handleFinishActivity() {
    finishActivity();
    setActivityEnded(true);
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
        {playerName}, parabéns! Você concluiu o caso e conquistou {finalScore} pontos.
      </p>

      {canAdvanceCases && !activityEnded && (
        <>
          {checkingCases && <p>Verificando casos disponíveis...</p>}
          {!checkingCases && hasNextCase && (
            <button
              type="button"
              className="control btn large"
              onClick={handleNextCase}
            >
              {!hasUnplayedCase && configuration.allowReplaySameCase
                ? configuration.selection === "student"
                  ? "Escolher outro caso"
                  : "Sortear outro caso"
                : "Próximo caso"}
              <IconNext />
            </button>
          )}
          {!checkingCases && !hasUnplayedCase && nextDifficulty && (
            <p>
              Você concluiu todos os casos desta dificuldade. A próxima é {" "}
              {difficultyLabels[nextDifficulty]}.
            </p>
          )}
          {!checkingCases && nextDifficulty && !hasUnplayedCase && (
            <button
              type="button"
              className="control btn large"
              onClick={handleNextDifficulty}
            >
              Próxima dificuldade
              <IconNext />
            </button>
          )}
          <button
            type="button"
            className="control btn large"
            onClick={handleFinishActivity}
            disabled={activityEnded}
          >
            Encerrar atividade
            <IconNext />
          </button>
        </>
      )}

      {activityEnded && <p role="status">Atividade encerrada.</p>}

      {rankingEnabled && (
        <button
          type="button"
          className="control btn large"
          onClick={() => navigate("/ranking")}
        >
          Ver ranking
          <IconNext />
        </button>
      )}

      {allowReplaySameCase && !canAdvanceCases && (
        <button
          type="button"
          className="control btn large"
          onClick={() => {
            resetGame();
            navigate("/", { replace: true });
          }}
        >
          Jogar novamente
          <IconNext />
        </button>
      )}
    </main>
  );
}
