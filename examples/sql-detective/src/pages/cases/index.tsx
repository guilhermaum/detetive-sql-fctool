import "./style.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  findCasesByDifficulty,
  selectCaseForPlayer,
} from "../../services/games";
import { findResumableGameSession } from "../../services/game-sessions";
import { useGame } from "../../context/game";
import Load from "../../components/Load";
import logo from "../../assets/detetive-sql.svg";
import {
  emitFctoolEvent,
  getConfiguredGameConfiguration,
  getConfiguredSessionContinuity,
  getFctoolIdentity,
} from "../../services/fctool";
import type { CaseSummary } from "../../models/game";
import type { GameDifficulty } from "../../models/gameConfiguration";

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

function normalizeDifficulty(value: string | null): GameDifficulty | null {
  if (value === "facil" || value === "easy") return "facil";
  if (value === "medio" || value === "medium") return "medio";
  if (value === "dificil" || value === "hard") return "dificil";
  return null;
}

export default function Cases() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [availableCases, setAvailableCases] = useState<CaseSummary[]>([]);
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const [nextDifficulty, setNextDifficulty] = useState<GameDifficulty | null>(null);
  const {
    startGame,
    currentCaseIndex,
    currentDifficulty,
    completedCaseIds,
    advanceToNextCase,
    canAdvanceCases,
  } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configuration = getConfiguredGameConfiguration();
  const startGameRef = useRef(startGame);
  startGameRef.current = startGame;
  const difficulty =
    normalizeDifficulty(searchParams.get("difficulty")) ??
    currentDifficulty ??
    configuration.difficulty;
  const startedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!difficulty) {
      navigate("/difficulty", { replace: true });
      return;
    }
    const selectedDifficulty = difficulty;

    const key = `${selectedDifficulty}:${currentCaseIndex}:${completedCaseIds.join(",")}`;
    if (startedKey.current === key) return;
    startedKey.current = key;
    let active = true;
    setLoading(true);
    setError("");
    setNextDifficulty(null);

    async function prepareCase() {
      try {
        const identity = getFctoolIdentity() ?? {
          scriptId: "local-script-001",
          cardId: "local-card-001",
          sessionId: "local-session-001",
          playerId: "local-student-001",
        };

        // Retoma primeiro uma partida em andamento, quando a continuidade está ativa.
        const resumableSession = getConfiguredSessionContinuity()
          ? await findResumableGameSession(identity.cardId, identity.playerId)
          : null;

        if (!active) return;
        if (resumableSession) {
          await startGameRef.current(
            String(resumableSession.session.case_id),
            resumableSession,
            identity,
          );
          if (active) navigate("/level", { replace: true });
          return;
        }

        const cases = await findCasesByDifficulty(apiDifficulties[selectedDifficulty]);
        if (!active) return;
        if (configuration.selection === "student") {
          const selectableCases = configuration.allowReplaySameCase
            ? cases
            : cases.filter(
                (item) => !completedCaseIds.includes(Number(item.id)),
              );
          setAvailableCases(selectableCases);
          if (selectableCases.length === 0) {
            setError(
              `Você concluiu todos os casos de dificuldade ${difficultyLabels[selectedDifficulty]}.`,
            );
            if (canAdvanceCases) {
              const next = await findNextDifficultyWithCases(selectedDifficulty);
              if (active) setNextDifficulty(next);
            }
            if (!active) return;
          }
          setLoading(false);
          return;
        }

        const selectionIndex = cases.filter((item) =>
          completedCaseIds.includes(Number(item.id)),
        ).length;
        const selection = await selectCaseForPlayer({
          scriptId: identity.scriptId,
          cardId: identity.cardId,
          sessionId: identity.sessionId,
          playerId: identity.playerId,
          difficulty: apiDifficulties[selectedDifficulty],
          caseDistribution: configuration.selection === "class" ? "mesmo" : "aleatorio",
          selectionIndex,
          allowReplaySameCase: configuration.allowReplaySameCase,
        });
        if (!active) return;
        const selectedCaseId = String(selection.case_id);

        if (selection.fallback_used) {
          emitFctoolEvent(
            selection.fallback_reason === "already_played_in_another_card"
              ? "case_already_played_in_another_card"
              : "case_already_played_in_script",
            {
              ...(typeof selection.shared_case_id === "number" &&
              Number.isInteger(selection.shared_case_id) &&
              selection.shared_case_id > 0
                ? { shared_case_id: selection.shared_case_id }
                : {}),
              assigned_case_id: selection.case_id,
              difficulty: selectedDifficulty,
              case_index: currentCaseIndex,
            },
          );
        }

        emitFctoolEvent("case_selected", {
          case_id: Number(selectedCaseId),
          selection_mode: configuration.selection,
          case_index: currentCaseIndex,
          difficulty: selectedDifficulty,
        });
        await startGameRef.current(selectedCaseId, undefined, identity, selectedDifficulty);
        if (active) navigate("/level", { replace: true });
      } catch (cause) {
        if (!active) return;
        console.error(cause);
        const response = cause as {
          response?: { status?: number; data?: { message?: string } };
        };
        const responseMessage = response.response?.data?.message;

        setError(
          responseMessage ??
            (cause instanceof Error
              ? cause.message
              : "Não foi possível carregar os casos."),
        );
        if (canAdvanceCases && response.response?.status === 409) {
          const next = await findNextDifficultyWithCases(selectedDifficulty);
          if (active) setNextDifficulty(next);
        }
        if (active) setLoading(false);
      }
    }

    void prepareCase();
    return () => {
      active = false;
      if (startedKey.current === key) startedKey.current = null;
    };
  }, [
    canAdvanceCases,
    completedCaseIds,
    configuration.allowReplaySameCase,
    configuration.selection,
    currentCaseIndex,
    difficulty,
    navigate,
  ]);

  async function handleChooseCase(selectedCaseId: string) {
    if (startingCaseId || !difficulty) return;
    setStartingCaseId(selectedCaseId);
    setError("");

    try {
      const identity = getFctoolIdentity() ?? {
        scriptId: "local-script-001",
        cardId: "local-card-001",
        sessionId: "local-session-001",
        playerId: "local-student-001",
      };
      emitFctoolEvent("case_selected", {
        case_id: Number(selectedCaseId),
        selection_mode: "student",
        case_index: currentCaseIndex,
        difficulty,
      });
      await startGame(selectedCaseId, undefined, identity, difficulty);
      navigate("/level", { replace: true });
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar o caso escolhido.",
      );
      setStartingCaseId(null);
    }
  }

  function handleNextDifficulty() {
    if (!nextDifficulty) return;
    advanceToNextCase(nextDifficulty);
    navigate(`/cases?difficulty=${nextDifficulty}`, { replace: true });
  }

  if (loading) return <Load />;

  return (
    <main className="cases container">
      <img src={logo} alt="Detetive SQL" className="logo" />

      <h1>
        {configuration.selection === "student"
          ? "Escolha um caso para investigar"
          : "Carregando caso"}
      </h1>
      <p>Dificuldade: {difficulty ? difficultyLabels[difficulty] : ""}</p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="case-list">
        {availableCases.map((item) => (
          <button
            type="button"
            className="control btn case-card"
            key={item.id}
            onClick={() => void handleChooseCase(item.id)}
            disabled={startingCaseId !== null}
          >
            <span className="case-card-copy">
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </span>
            <span>
              {startingCaseId === item.id ? "Iniciando..." : "Investigar"}
            </span>
          </button>
        ))}
      </div>

      {nextDifficulty && (
        <button
          type="button"
          className="control btn"
          onClick={handleNextDifficulty}
        >
          Avançar para {difficultyLabels[nextDifficulty]}
        </button>
      )}

      {error && !nextDifficulty && (
        <button
          type="button"
          className="control btn"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      )}
    </main>
  );
}
