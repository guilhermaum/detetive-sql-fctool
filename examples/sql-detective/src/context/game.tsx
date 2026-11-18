import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";

import { findGame } from "../services/games";
import { findLevel } from "../services/levels";
import {
  completeGameSession as completeApiGameSession,
  saveGameSessionLevelScore,
  startGameSession,
  useGameSessionHint,
  type ResumableGameSession,
} from "../services/game-sessions";
import {
  completeFctoolGame,
  emitFctoolEvent,
  getConfiguredCaseFlow,
  getConfiguredRankingEnabled,
  getConfiguredSessionContinuity,
  getFctoolIdentity,
  resumeFctoolGame,
} from "../services/fctool";
import { startFctoolGame } from "../services/fctool";

const INITIAL_SCORE = 100;
const INITIAL_HELPS = 10;

/**
 * O tipo da fase é obtido automaticamente a partir
 * do retorno da função findLevel().
 */
type Level = Awaited<ReturnType<typeof findLevel>>;

/**
 * Dados do caso em andamento, usados para exibição nas telas.
 */
interface CaseInfo {
  id: number;
  name: string;
  difficulty: string;
}

/**
 * Valores disponibilizados pelo GameContext.
 */
interface GameContextValue {
  level: Level | null;
  databaseImageUrl: string | null;
  sessionId: number | null;
  cardId: string | null;
  caseId: number | null;
  caseInfo: CaseInfo | null;
  playerName: string;
  rankingEnabled: boolean;
  scoreGame: number;
  finalScore: number | null;
  gameCompleted: boolean;
  completionError: string | null;
  remainingHelps: number;
  usedHintIds: number[];
  lastLevel: number;
  isGameWon: boolean;
  isGameOver: boolean;
  gameStarted: boolean;
  currentStepIndex: number;
  hasNextCase: boolean;
  completedCaseIds: number[];
  allowReplaySameCase: boolean;

  startGame: (
    gameId: string,
    resumableSession: ResumableGameSession | undefined,
    identity: {
      cardId: string;
      playerId: string;
    },
  ) => Promise<boolean>;
  savePlayerName: (name: string) => void;
  resetGame: () => void;
  nextGameLevel: () => void;
  advanceCaseStep: () => void;
  applySuccess: () => void;
  applyFault: () => Promise<void>;
  applyHelp: (hintId: number) => Promise<void>;
  retryGameCompletion: () => void;
}

/**
 * Props do Provider.
 */
interface GameProviderProps {
  children: ReactNode;
}

const GameContext = createContext<GameContextValue | null>(null);

const GameProvider = ({ children }: GameProviderProps) => {
  const fctoolIdentity = getFctoolIdentity();
  const flowProgressStorageKey = fctoolIdentity
    ? `sql-detective:case-flow:${fctoolIdentity.cardId}:${fctoolIdentity.playerId}`
    : null;

  function readSavedFlowProgress(): {
    stepIndex: number;
    completedCaseIds: number[];
  } {
    if (!flowProgressStorageKey || !getConfiguredSessionContinuity()) {
      return { stepIndex: 0, completedCaseIds: [] };
    }

    try {
      const raw = localStorage.getItem(flowProgressStorageKey);
      if (!raw) return { stepIndex: 0, completedCaseIds: [] };
      const parsed = JSON.parse(raw) as {
        stepIndex?: unknown;
        completedCaseIds?: unknown;
      };
      return {
        stepIndex:
          typeof parsed.stepIndex === "number" &&
          Number.isInteger(parsed.stepIndex) &&
          parsed.stepIndex >= 0
            ? parsed.stepIndex
            : 0,
        completedCaseIds: Array.isArray(parsed.completedCaseIds)
          ? parsed.completedCaseIds.filter(
              (id): id is number =>
                typeof id === "number" && Number.isInteger(id),
            )
          : [],
      };
    } catch {
      return { stepIndex: 0, completedCaseIds: [] };
    }
  }

  const saveFlowProgress = useCallback(
    (stepIndex: number, completedIds: number[]): void => {
      if (!flowProgressStorageKey) return;
      try {
        localStorage.setItem(
          flowProgressStorageKey,
          JSON.stringify({ stepIndex, completedCaseIds: completedIds }),
        );
      } catch {
        // A progressão continua funcionando durante a sessão atual.
      }
    },
    [flowProgressStorageKey],
  );

  const [gameStarted, setGameStarted] = useState(false);

  const [level, setLevel] = useState<Level | null>(null);

  const [databaseImageUrl, setDatabaseImageUrl] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);

  const [cardId, setCardId] = useState<string | null>(null);

  const [caseId, setCaseId] = useState<number | null>(null);

  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);

  const [completedCaseIds, setCompletedCaseIds] = useState<number[]>(
    () => readSavedFlowProgress().completedCaseIds,
  );

  const [playerName, setPlayerName] = useState("");

  const [rankingEnabled, setRankingEnabled] = useState(false);

  const [finalScore, setFinalScore] = useState<number | null>(null);

  const [completionError, setCompletionError] = useState<string | null>(null);

  const [completionRetryCount, setCompletionRetryCount] = useState(0);

  const [goals, setGoals] = useState(0);

  const [levelIds, setLevelIds] = useState<string[]>([]);

  const [lastLevel, setLastLevel] = useState(0);

  const [idxCurrentLevel, setIdxCurrentLevel] = useState(0);

  const [currentStepIndex, setCurrentStepIndex] = useState(
    () => readSavedFlowProgress().stepIndex,
  );

  const [caseFlow] = useState(() => getConfiguredCaseFlow());
  const allowReplaySameCase = caseFlow.allowReplaySameCase;
  const hasNextCase =
    caseFlow.progression === "sequence" &&
    currentStepIndex < caseFlow.steps.length - 1;

  const [scoreGame, setScoreGame] = useState(INITIAL_SCORE);

  const [remainingHelps, setRemainingHelps] = useState(INITIAL_HELPS);

  const [usedHintIds, setUsedHintIds] = useState<number[]>([]);

  const [isGameWon, setGameWon] = useState(false);

  const [isGameOver, setGameOver] = useState(false);

  const completionRequested = useRef<number | null>(null);
  const startedLevelEvents = useRef<Set<string>>(new Set());
  const scoreGameRef = useRef(scoreGame);

  async function startGame(
    gameId: string,
    resumableSession: ResumableGameSession | undefined,
    identity: { cardId: string; playerId: string },
  ): Promise<boolean> {
    setGameStarted(false);
    setLevel(null);
    setDatabaseImageUrl(null);
    setIdxCurrentLevel(0);
    setScoreGame(INITIAL_SCORE);
    setRemainingHelps(INITIAL_HELPS);
    setUsedHintIds([]);
    setGameWon(false);
    setGameOver(false);
    setSessionId(null);
    setCardId(null);
    setCaseId(null);
    setCaseInfo(null);
    setRankingEnabled(false);
    setFinalScore(null);
    setCompletionError(null);
    setCompletionRetryCount(0);
    completionRequested.current = null;
    startedLevelEvents.current.clear();

    const game = await findGame(
      String(resumableSession?.session.case_id ?? gameId),
    );
    const expectedDifficulty = caseFlow.steps[currentStepIndex]?.difficulty;
    const apiDifficultyByFlow: Record<string, string> = {
      facil: "easy",
      medio: "medium",
      dificil: "hard",
    };
    if (
      !resumableSession &&
      expectedDifficulty &&
      game.difficulty.toLowerCase() !== expectedDifficulty &&
      game.difficulty.toLowerCase() !== apiDifficultyByFlow[expectedDifficulty]
    ) {
      throw new Error(
        `O caso ${game.name} não corresponde à dificuldade ${expectedDifficulty} configurada para esta etapa.`,
      );
    }

    const firstLevelId = game.levels[0];
    if (!firstLevelId) {
      throw new Error("O caso selecionado nao possui niveis.");
    }

    const completedLevelIds = new Set(
      resumableSession?.progress
        .filter((entry) => entry.status === "completed")
        .map((entry) => entry.level_id) ?? [],
    );
    const levelIndex = resumableSession
      ? Math.max(
          0,
          game.levels.findIndex(
            (id) => Number(id) === resumableSession.session.current_level_id,
          ),
        )
      : 0;
    const selectedLevelId = game.levels[levelIndex] ?? firstLevelId;
    const currentLevel = await findLevel(selectedLevelId);
    const selectedPlayerName =
      playerName.trim() || resumableSession?.session.player_name?.trim() || "";
    if (!selectedPlayerName) {
      throw new Error("Informe seu nome antes de iniciar a partida.");
    }
    const session =
      resumableSession?.session ??
      (await startGameSession({
        case_id: Number(game.id),
        player_id: identity.playerId,
        player_name: selectedPlayerName,
        card_id: identity.cardId,
      }));
    if (!resumableSession) {
      saveFlowProgress(currentStepIndex, completedCaseIds);
    }

    const currentProgress = resumableSession?.progress.find(
      (entry) => entry.level_id === session.current_level_id,
    );
    const completedProgress =
      resumableSession?.progress.filter(
        (entry) => entry.status === "completed",
      ) ?? [];
    const lastCompletedProgress =
      completedProgress[completedProgress.length - 1];
    const resumedScore =
      currentProgress?.score ?? lastCompletedProgress?.score ?? INITIAL_SCORE;
    const resumedPlayerName = session.player_name?.trim() || selectedPlayerName;
    const resumedHints = resumableSession?.used_hints ?? [];

    setLevelIds(game.levels);
    setDatabaseImageUrl(game.databaseImageUrl);
    setLastLevel(game.last);
    setGoals(Math.max(game.levels.length - completedLevelIds.size, 0));
    setIdxCurrentLevel(levelIndex);
    setLevel(currentLevel);
    setSessionId(session.id);
    setCardId(identity.cardId);
    setCaseId(Number(game.id));
    setCaseInfo({
      id: Number(game.id),
      name: game.name,
      difficulty: game.difficulty,
    });
    setScoreGame(resumableSession ? resumedScore : INITIAL_SCORE);
    scoreGameRef.current = resumableSession ? resumedScore : INITIAL_SCORE;
    setRemainingHelps(
      Math.max(INITIAL_HELPS - (resumableSession?.used_hint_count ?? 0), 0),
    );
    setUsedHintIds(resumedHints);
    setPlayerName(resumedPlayerName);
    try {
      localStorage.setItem("sql-detective:player-name", resumedPlayerName);
    } catch {
      // O nome continua disponivel no estado da partida mesmo sem armazenamento local.
    }
    setRankingEnabled(getConfiguredRankingEnabled());
    setFinalScore(null);
    setCompletionError(null);
    setCompletionRetryCount(0);

    setGameStarted(true);

    const caseData = {
      case_id: Number(game.id),
      level_counts: game.levels.length,
      player_name: selectedPlayerName,
      difficulty: caseFlow.steps[currentStepIndex]?.difficulty,
      step_id: caseFlow.steps[currentStepIndex]?.id,
      step_index: currentStepIndex,
    };
    if (!resumableSession) {
      if (currentStepIndex === 0) {
        startFctoolGame(caseData);
      } else {
        emitFctoolEvent("case_started", caseData);
      }
    } else {
      resumeFctoolGame(caseData);
    }

    const firstStartedLevelKey = `${session.id}:${currentLevel.id}`;
    if (!startedLevelEvents.current.has(firstStartedLevelKey)) {
      startedLevelEvents.current.add(firstStartedLevelKey);
      emitFctoolEvent("level_started", {
        level_started: currentLevel.number,
        initial_score: resumableSession ? resumedScore : INITIAL_SCORE,
      });
    }

    return Boolean(resumableSession);
  }

  function resetGame(): void {
    setGameStarted(false);
    setLevel(null);
    setDatabaseImageUrl(null);
    setSessionId(null);
    setCardId(null);
    setCaseId(null);
    setCaseInfo(null);
    setCompletedCaseIds([]);
    if (flowProgressStorageKey) {
      try {
        localStorage.removeItem(flowProgressStorageKey);
      } catch {
        // A limpeza local não impede o reinício do jogo.
      }
    }
    setPlayerName("");
    setUsedHintIds([]);
    setRankingEnabled(false);
    setFinalScore(null);
    setCompletionError(null);
    setCompletionRetryCount(0);
    completionRequested.current = null;
    setGoals(0);
    setLevelIds([]);
    setLastLevel(0);
    setIdxCurrentLevel(0);
    setCurrentStepIndex(0);
    scoreGameRef.current = INITIAL_SCORE;
    setScoreGame(INITIAL_SCORE);
    setRemainingHelps(INITIAL_HELPS);
    setGameWon(false);
    setGameOver(false);
  }

  function nextGameLevel(): void {
    setUsedHintIds([]);
    setIdxCurrentLevel((index) => index + 1);
  }

  function advanceCaseStep(): void {
    if (!hasNextCase) return;

    const nextStepIndex = currentStepIndex + 1;
    emitFctoolEvent("progression_advanced", {
      previous_step: caseFlow.steps[currentStepIndex]?.id,
      next_step: caseFlow.steps[nextStepIndex]?.id,
      step_index: nextStepIndex,
    });

    setCurrentStepIndex(nextStepIndex);
    saveFlowProgress(nextStepIndex, completedCaseIds);
    setGameStarted(false);
    setLevel(null);
    setDatabaseImageUrl(null);
    setSessionId(null);
    setCaseId(null);
    setCaseInfo(null);
    setFinalScore(null);
    setCompletionError(null);
    setCompletionRetryCount(0);
    setGoals(0);
    setLevelIds([]);
    setLastLevel(0);
    setIdxCurrentLevel(0);
    setScoreGame(INITIAL_SCORE);
    scoreGameRef.current = INITIAL_SCORE;
    setRemainingHelps(INITIAL_HELPS);
    setUsedHintIds([]);
    setGameWon(false);
    setGameOver(false);
    completionRequested.current = null;
    startedLevelEvents.current.clear();
  }

  function savePlayerName(name: string): void {
    setPlayerName(name.trim());
  }

  function applySuccess(): void {
    setGoals((value) => value - 1);
  }

  async function applyFault(): Promise<void> {
    if (!sessionId || !level?.id) {
      throw new Error("A sessao ou o nivel atual nao foi inicializado.");
    }
    const nextScore = Math.max(scoreGame - 1, 0);
    await saveGameSessionLevelScore(sessionId, level.id, nextScore);
    scoreGameRef.current = nextScore;
    setScoreGame(nextScore);
  }

  async function applyHelp(hintId: number): Promise<void> {
    if (!sessionId || !level?.id) {
      throw new Error("A sessao ou o nivel atual nao foi inicializado.");
    }

    if (remainingHelps <= 0) return;
    const nextScore = Math.max(scoreGame - 2, 0);
    await useGameSessionHint(sessionId, level.id, hintId, nextScore);
    setRemainingHelps((value) => value - 1);
    setUsedHintIds((ids) => (ids.includes(hintId) ? ids : [...ids, hintId]));
    setScoreGame(nextScore);

    const selectedHint = level.helps.find((hint) => hint.id === hintId);
    emitFctoolEvent("hint_used", {
      hint_id: hintId,
      hint: selectedHint?.title ?? `Dica ${hintId}`,
      remaining_score: nextScore,
    });
  }

  function retryGameCompletion(): void {
    if (!sessionId) return;
    completionRequested.current = null;
    setCompletionError(null);
    setCompletionRetryCount((attempt) => attempt + 1);
  }

  /**
   * Carrega a próxima fase.
   */
  useEffect(() => {
    if (!gameStarted) return;

    const levelId = levelIds[idxCurrentLevel];

    if (!levelId) return;

    setLevel(null);

    findLevel(levelId)
      .then((loadedLevel) => {
        setLevel(loadedLevel);
        if (!sessionId) return;
        const eventKey = `${sessionId}:${loadedLevel.id}`;
        if (startedLevelEvents.current.has(eventKey)) return;

        startedLevelEvents.current.add(eventKey);
        emitFctoolEvent("level_started", {
          level_started: loadedLevel.number,
          initial_score: scoreGameRef.current,
        });
      })
      .catch((error) =>
        console.error("Não foi possível carregar a fase.", error),
      );
  }, [gameStarted, idxCurrentLevel, levelIds, sessionId]);

  /**
   * Verifica vitória.
   */
  useEffect(() => {
    if (gameStarted && goals === 0) {
      setGameWon(true);
    }
  }, [gameStarted, goals]);

  /**
   * Verifica game over por pontuação.
   */
  useEffect(() => {
    if (gameStarted && scoreGame === 0) {
      setGameOver(true);
    }
  }, [gameStarted, scoreGame]);

  /**
   * Envia pontuação para a FCTool.
   */
  /**
   * Informa conclusão à FCTool.
   */
  useEffect(() => {
    if (
      gameStarted &&
      goals === 0 &&
      sessionId &&
      completionRequested.current !== sessionId
    ) {
      completionRequested.current = sessionId;
      completeApiGameSession(sessionId)
        .then((completedSession) => {
          setFinalScore(completedSession.score);
          const completedCaseId = caseId ?? completedSession.case_id;
          const updatedCompletedCaseIds = completedCaseIds.includes(
            completedCaseId,
          )
            ? completedCaseIds
            : [...completedCaseIds, completedCaseId];
          setCompletedCaseIds(updatedCompletedCaseIds);
          if (flowProgressStorageKey) {
            if (hasNextCase) {
              saveFlowProgress(currentStepIndex + 1, updatedCompletedCaseIds);
            } else {
              try {
                localStorage.removeItem(flowProgressStorageKey);
              } catch {
                // A limpeza local não impede a conclusão da atividade.
              }
            }
          }
          emitFctoolEvent("case_completed", {
            case_id: completedCaseId,
            score: completedSession.score,
            step_id: caseFlow.steps[currentStepIndex]?.id,
            step_index: currentStepIndex,
          });

          if (!hasNextCase) {
            completeFctoolGame(completedSession.score, INITIAL_SCORE, {
              case_id: completedCaseId,
              completed_steps: currentStepIndex + 1,
            });
          }
        })
        .catch((error) => {
          completionRequested.current = null;
          setCompletionError(
            "Não foi possível salvar a pontuação final. Use o botão abaixo para reenviar.",
          );
          console.error("Nao foi possivel concluir a game-session.", error);
        });
    }
  }, [
    caseFlow.steps,
    caseId,
    completedCaseIds,
    completionRetryCount,
    currentStepIndex,
    gameStarted,
    goals,
    hasNextCase,
    flowProgressStorageKey,
    saveFlowProgress,
    lastLevel,
    sessionId,
  ]);

  return (
    <GameContext.Provider
      value={{
        level,
        databaseImageUrl,
        sessionId,
        cardId,
        caseId,
        caseInfo,
        playerName,
        rankingEnabled,
        scoreGame,
        finalScore,
        gameCompleted: finalScore !== null,
        completionError,
        remainingHelps,
        usedHintIds,
        lastLevel,
        isGameWon,
        isGameOver,
        gameStarted,
        currentStepIndex,
        hasNextCase,
        completedCaseIds,
        allowReplaySameCase,

        startGame,
        savePlayerName,
        resetGame,
        nextGameLevel,
        advanceCaseStep,
        applySuccess,
        applyFault,
        applyHelp,
        retryGameCompletion,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

const useGame = (): GameContextValue => {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error("useGame deve ser utilizado dentro de um GameProvider.");
  }

  return context;
};

export { GameProvider, useGame };
