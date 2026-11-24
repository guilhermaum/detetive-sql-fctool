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
  getConfiguredGameConfiguration,
  getConfiguredRankingEnabled,
  getConfiguredSessionContinuity,
  getFctoolIdentity,
  reportFctoolScore,
  resumeFctoolGame,
} from "../services/fctool";
import { startFctoolGame } from "../services/fctool";
import type { GameDifficulty } from "../models/gameConfiguration";

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
  currentCaseIndex: number;
  currentDifficulty: GameDifficulty | null;
  canAdvanceCases: boolean;
  completedCaseIds: number[];
  allowReplaySameCase: boolean;

  startGame: (
    gameId: string,
    resumableSession: ResumableGameSession | undefined,
    identity: {
      scriptId: string;
      cardId: string;
      sessionId: string;
      playerId: string;
    },
    difficulty?: GameDifficulty,
  ) => Promise<boolean>;
  savePlayerName: (name: string) => void;
  resetGame: () => void;
  nextGameLevel: () => void;
  advanceToNextCase: (difficulty?: GameDifficulty) => void;
  finishActivity: () => void;
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
  const activityProgressStorageKey = fctoolIdentity
    ? `sql-detective:progress:${fctoolIdentity.cardId}:${fctoolIdentity.playerId}`
    : null;

  function readSavedProgress(): {
    caseIndex: number;
    completedCaseIds: number[];
    difficulty: GameDifficulty | null;
  } {
    if (!activityProgressStorageKey || !getConfiguredSessionContinuity()) {
      return { caseIndex: 0, completedCaseIds: [], difficulty: null };
    }

    try {
      const raw = localStorage.getItem(activityProgressStorageKey);
      if (!raw) return { caseIndex: 0, completedCaseIds: [], difficulty: null };
      const parsed = JSON.parse(raw) as {
        caseIndex?: unknown;
        completedCaseIds?: unknown;
        difficulty?: unknown;
      };
      return {
        caseIndex:
          typeof parsed.caseIndex === "number" &&
          Number.isInteger(parsed.caseIndex) &&
          parsed.caseIndex >= 0
            ? parsed.caseIndex
            : 0,
        completedCaseIds: Array.isArray(parsed.completedCaseIds)
          ? parsed.completedCaseIds.filter(
              (id): id is number =>
                typeof id === "number" && Number.isInteger(id),
            )
          : [],
        difficulty:
          parsed.difficulty === "facil" ||
          parsed.difficulty === "medio" ||
          parsed.difficulty === "dificil"
            ? parsed.difficulty
            : null,
      };
    } catch {
      return { caseIndex: 0, completedCaseIds: [], difficulty: null };
    }
  }

  const saveProgress = useCallback(
    (
      caseIndex: number,
      completedIds: number[],
      difficulty: GameDifficulty | null,
    ): void => {
      if (!activityProgressStorageKey) return;
      try {
        localStorage.setItem(
          activityProgressStorageKey,
          JSON.stringify({ caseIndex, completedCaseIds: completedIds, difficulty }),
        );
      } catch {
        // A progressão continua funcionando durante a sessão atual.
      }
    },
    [activityProgressStorageKey],
  );

  const [gameStarted, setGameStarted] = useState(false);

  const [level, setLevel] = useState<Level | null>(null);

  const [databaseImageUrl, setDatabaseImageUrl] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);

  const [cardId, setCardId] = useState<string | null>(null);

  const [caseId, setCaseId] = useState<number | null>(null);

  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);

  const [completedCaseIds, setCompletedCaseIds] = useState<number[]>(
    () => readSavedProgress().completedCaseIds,
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

  const [currentCaseIndex, setCurrentCaseIndex] = useState(
    () => readSavedProgress().caseIndex,
  );

  const [caseConfiguration] = useState(() => getConfiguredGameConfiguration());
  const [currentDifficulty, setCurrentDifficulty] = useState<GameDifficulty | null>(
    () => readSavedProgress().difficulty ?? caseConfiguration.difficulty,
  );
  const allowReplaySameCase = caseConfiguration.allowReplaySameCase;
  const canAdvanceCases = caseConfiguration.progression === "sequence";

  const [scoreGame, setScoreGame] = useState(INITIAL_SCORE);

  const [remainingHelps, setRemainingHelps] = useState(INITIAL_HELPS);

  const [usedHintIds, setUsedHintIds] = useState<number[]>([]);

  const [isGameWon, setGameWon] = useState(false);

  const [isGameOver, setGameOver] = useState(false);

  const completionRequested = useRef<number | null>(null);
  const activityCompleted = useRef(false);
  const startedLevelEvents = useRef<Set<string>>(new Set());
  const scoreGameRef = useRef(scoreGame);

  async function startGame(
    gameId: string,
    resumableSession: ResumableGameSession | undefined,
    identity: {
      scriptId: string;
      cardId: string;
      sessionId: string;
      playerId: string;
    },
    selectedDifficulty?: GameDifficulty,
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
    activityCompleted.current = false;
    startedLevelEvents.current.clear();

    const game = await findGame(
      String(resumableSession?.session.case_id ?? gameId),
    );
    const expectedDifficulty = selectedDifficulty ?? (
      resumableSession ? null : currentDifficulty ?? caseConfiguration.difficulty
    );
    const apiDifficultyValues: Record<GameDifficulty, string> = {
      facil: "easy",
      medio: "medium",
      dificil: "hard",
    };
    if (
      !resumableSession &&
      expectedDifficulty &&
      game.difficulty.toLowerCase() !== expectedDifficulty &&
      game.difficulty.toLowerCase() !== apiDifficultyValues[expectedDifficulty]
    ) {
      throw new Error(
        `O caso ${game.name} não corresponde à dificuldade ${expectedDifficulty} selecionada.`,
      );
    }
    const gameDifficulty = expectedDifficulty ?? (
      game.difficulty.toLowerCase() === "easy" || game.difficulty.toLowerCase() === "facil"
        ? "facil"
        : game.difficulty.toLowerCase() === "hard" || game.difficulty.toLowerCase() === "dificil"
          ? "dificil"
          : "medio"
    );
    setCurrentDifficulty(gameDifficulty);

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
        script_id: identity.scriptId,
        session_id: identity.sessionId,
      }));
    if (!resumableSession) {
      saveProgress(currentCaseIndex, completedCaseIds, gameDifficulty);
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
      script_id: identity.scriptId,
      card_id: identity.cardId,
      session_id: identity.sessionId,
      level_counts: game.levels.length,
      player_name: selectedPlayerName,
      difficulty: gameDifficulty,
      case_index: currentCaseIndex,
    };
    const caseStartedData = {
      case_id: Number(game.id),
      level_counts: game.levels.length,
      difficulty: gameDifficulty,
      case_index: currentCaseIndex,
    };
    if (!resumableSession) {
      if (currentCaseIndex === 0) {
        startFctoolGame(caseData);
      }
      emitFctoolEvent("case_started", caseStartedData);
    } else {
      resumeFctoolGame(caseData);
    }
    reportFctoolScore(resumableSession ? resumedScore : INITIAL_SCORE, INITIAL_SCORE);

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
    if (activityProgressStorageKey) {
      try {
        localStorage.removeItem(activityProgressStorageKey);
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
    setCurrentCaseIndex(0);
    setCurrentDifficulty(caseConfiguration.difficulty);
    activityCompleted.current = false;
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

  function advanceToNextCase(nextDifficulty = currentDifficulty ?? undefined): void {
    if (!canAdvanceCases || !nextDifficulty) return;

    const nextCaseIndex = currentCaseIndex + 1;
    emitFctoolEvent("progression_advanced", {
      previous_difficulty: currentDifficulty ?? nextDifficulty,
      next_difficulty: nextDifficulty,
      case_index: nextCaseIndex,
    });

    setCurrentCaseIndex(nextCaseIndex);
    setCurrentDifficulty(nextDifficulty);
    saveProgress(nextCaseIndex, completedCaseIds, nextDifficulty);
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

  function finishActivity(): void {
    if (activityCompleted.current) return;
    activityCompleted.current = true;
    completeFctoolGame(finalScore ?? scoreGame, INITIAL_SCORE, {
      ...(caseId !== null ? { case_id: caseId } : {}),
      ...(currentDifficulty ? { difficulty: currentDifficulty } : {}),
      completed_cases: completedCaseIds.length,
    });
    if (activityProgressStorageKey) {
      try {
        localStorage.removeItem(activityProgressStorageKey);
      } catch {
        // A limpeza local não impede o encerramento da atividade.
      }
    }
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
    reportFctoolScore(nextScore, INITIAL_SCORE);
  }

  async function applyHelp(hintId: number): Promise<void> {
    if (!sessionId || !level?.id) {
      throw new Error("A sessao ou o nivel atual nao foi inicializado.");
    }

    if (remainingHelps <= 0) return;
    const nextScore = Math.max(scoreGame - 2, 0);
    await useGameSessionHint(sessionId, level.id, hintId, nextScore);
    scoreGameRef.current = nextScore;
    setRemainingHelps((value) => value - 1);
    setUsedHintIds((ids) => (ids.includes(hintId) ? ids : [...ids, hintId]));
    setScoreGame(nextScore);
    reportFctoolScore(nextScore, INITIAL_SCORE);

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
          if (activityProgressStorageKey) {
            if (canAdvanceCases) {
              saveProgress(currentCaseIndex, updatedCompletedCaseIds, currentDifficulty);
            } else {
              try {
                localStorage.removeItem(activityProgressStorageKey);
              } catch {
                // A limpeza local não impede a conclusão da atividade.
              }
            }
          }
          emitFctoolEvent("case_completed", {
            case_id: completedCaseId,
            score: completedSession.score,
            difficulty: currentDifficulty,
            case_index: currentCaseIndex,
          });

          if (!canAdvanceCases) {
            activityCompleted.current = true;
            completeFctoolGame(completedSession.score, INITIAL_SCORE, {
              case_id: completedCaseId,
              completed_cases: updatedCompletedCaseIds.length,
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
    canAdvanceCases,
    caseId,
    completedCaseIds,
    completionRetryCount,
    currentCaseIndex,
    currentDifficulty,
    gameStarted,
    goals,
    activityProgressStorageKey,
    saveProgress,
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
        currentCaseIndex,
        currentDifficulty,
        canAdvanceCases,
        completedCaseIds,
        allowReplaySameCase,

        startGame,
        savePlayerName,
        resetGame,
        nextGameLevel,
        advanceToNextCase,
        finishActivity,
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
