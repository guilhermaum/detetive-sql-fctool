import "./style.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  findCasesByDifficulty,
  selectCaseForPlayer,
} from "../../services/games";
import { findResumableGameSession } from "../../services/game-sessions";
import { useGame } from "../../context/game";
import Load from "../../components/Load";
import logo from "../../assets/detetive-sql.svg";
import {
  getConfiguredCaseFlow,
  getConfiguredSessionContinuity,
  getFctoolIdentity,
  emitFctoolEvent,
} from "../../services/fctool";
import type { CaseSummary } from "../../models/game";

const apiDifficulties: Record<string, string> = {
  facil: "easy",
  medio: "medium",
  dificil: "hard",
};

const difficultyLabels: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export default function Cases() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [availableCases, setAvailableCases] = useState<CaseSummary[]>([]);
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const { startGame, currentStepIndex, completedCaseIds } = useGame();
  const navigate = useNavigate();
  const alreadyStarted = useRef(false);

  const flow = getConfiguredCaseFlow();
  const step = flow.steps[currentStepIndex] ??
    flow.steps[0] ?? {
      id: "step-1",
      difficulty: "medio" as const,
      selection: {
        mode: "system" as const,
        distribution: "individual" as const,
      },
    };

  useEffect(() => {
    if (alreadyStarted.current) return;
    alreadyStarted.current = true;

    async function prepareStep() {
      try {
        const identity = getFctoolIdentity() ?? {
          cardId: "",
          playerId: "",
        };

        // A continuidade tem prioridade: uma partida em andamento deve ser retomada
        // antes de aplicar novamente a regra de seleção da etapa.
        const resumableSession = getConfiguredSessionContinuity()
          ? await findResumableGameSession(identity.cardId, identity.playerId)
          : null;

        if (resumableSession) {
          await startGame(
            String(resumableSession.session.case_id),
            resumableSession,
            identity,
          );
          navigate("/level", { replace: true });
          return;
        }

        if (!step) {
          throw new Error("Nenhuma etapa foi configurada para esta atividade.");
        }

        if (step.selection.mode === "student") {
          const cases = await findCasesByDifficulty(
            apiDifficulties[step.difficulty],
          );
          const selectableCases = flow.allowReplaySameCase
            ? cases
            : cases.filter(
                (item) => !completedCaseIds.includes(Number(item.id)),
              );
          setAvailableCases(selectableCases);
          if (selectableCases.length === 0) {
            throw new Error(
              `Não existem casos disponíveis com dificuldade ${difficultyLabels[step.difficulty]}.`,
            );
          }
          setLoading(false);
          return;
        }

        let selectedCaseId: string;

        if (step.selection.mode === "teacher") {
          if (!step.selection.caseId) {
            throw new Error(
              `O professor não informou o ID do caso na etapa ${currentStepIndex + 1}.`,
            );
          }
          selectedCaseId = String(step.selection.caseId);
        } else {
          // O endpoint já utilizado pela API realiza o sorteio e persiste
          // a distribuição por aluno ou por turma.
          const distribution =
            step.selection.distribution === "class" ? "mesmo" : "aleatorio";

          selectedCaseId = await selectCaseForPlayer(
            identity.cardId,
            identity.playerId,
            apiDifficulties[step.difficulty],
            distribution,
          );
        }

        emitFctoolEvent("case_selected", {
          case_id: Number(selectedCaseId),
          selection_mode: step.selection.mode,
          step_id: step.id,
          step_index: currentStepIndex,
          difficulty: step.difficulty,
        });
        await startGame(selectedCaseId, undefined, identity);
        navigate("/level", { replace: true });
      } catch (cause) {
        console.error(cause);
        const responseMessage = (
          cause as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;

        setError(
          responseMessage ??
            (cause instanceof Error
              ? cause.message
              : "Não foi possível carregar os casos."),
        );
        setLoading(false);
      }
    }

    void prepareStep();
  }, [
    completedCaseIds,
    currentStepIndex,
    flow.allowReplaySameCase,
    navigate,
    startGame,
    step,
  ]);

  async function handleChooseCase(selectedCaseId: string) {
    if (startingCaseId) return;
    setStartingCaseId(selectedCaseId);
    setError("");

    try {
      const identity = getFctoolIdentity() ?? {
        cardId: "",
        playerId: "",
      };
      emitFctoolEvent("case_selected", {
        case_id: Number(selectedCaseId),
        selection_mode: "student",
        step_id: step.id,
        step_index: currentStepIndex,
        difficulty: step.difficulty,
      });
      await startGame(selectedCaseId, undefined, identity);
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

  if (loading) return <Load />;

  return (
    <main className="cases container">
      <img src={logo} alt="Detetive SQL" className="logo" />

      <h1>Escolha um caso para investigar</h1>
      <p>
        Etapa {currentStepIndex + 1} de {flow.steps.length} · Dificuldade:{" "}
        {difficultyLabels[step.difficulty]}
      </p>

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

      {error && (
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
