import { FCToolGame } from "./fctool-sdk";
import type { GameConfiguration, GameDifficulty, CaseSelectionMode } from "../models/gameConfiguration";

let client: FCToolGame | null = null;

let configuration: Record<string, unknown> = {};

export async function initializeFctool(): Promise<Record<string, unknown>> {
  /*
   * Se estiver sendo executado diretamente no navegador,
   * não existe host FCTool.
   */
  const params = new URLSearchParams(window.location.search);

  const isFctool = params.has("fctool_origin") && window.parent !== window;

  if (!isFctool) {
    return {};
  }

  client = new FCToolGame({
    gameId: "sql-detective",
    gameVersion: "1.0.0",
  });

  const context = await client.initialize();

  configuration = context.configuration;
  console.log(configuration);

  const gameConfiguration = getConfiguredGameConfiguration();
  client.ready({
    appliedConfiguration: {
      progression: gameConfiguration.progression,
      difficulty: gameConfiguration.difficulty,
      caseSelection: gameConfiguration.selection,
      allowReplaySameCase: gameConfiguration.allowReplaySameCase
        ? "sim"
        : "nao",
      rankingEnabled: getConfiguredRankingEnabled() ? "sim" : "nao",
      sessionContinuity: getConfiguredSessionContinuity() ? "sim" : "nao",
    },
  });

  return configuration;
}

function normalizeDifficulty(value: unknown): GameDifficulty | null {
  if (value === "facil" || value === "easy") return "facil";
  if (value === "medio" || value === "medium") return "medio";
  if (value === "dificil" || value === "hard") return "dificil";
  return null;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === "sim";
}

function normalizeCaseSelection(): CaseSelectionMode {
  const selection = configuration.caseSelection;
  if (
    selection === "student" ||
    selection === "individual" ||
    selection === "class"
  ) {
    return selection;
  }
  if (configuration.selectionMode === "student") return "student";
  return configuration.caseDistribution === "class" ||
    configuration.caseDistribution === "mesmo"
    ? "class"
    : "individual";
}

export function getConfiguredGameConfiguration(): GameConfiguration {
  return {
    progression: configuration.progression === "sequence" ? "sequence" : "single",
    difficulty: normalizeDifficulty(configuration.difficulty),
    selection: normalizeCaseSelection(),
    allowReplaySameCase: normalizeBoolean(configuration.allowReplaySameCase),
  };
}

export function getFctoolIdentity(): {
  scriptId: string;
  cardId: string;
  sessionId: string;
  playerId: string;
} | null {
  const context = client?.getContext();

  if (!context) return null;

  return {
    scriptId: context.scriptId ?? context.cardId ?? context.sessionId,
    cardId: context.cardId ?? context.sessionId,
    sessionId: context.sessionId,
    playerId: context.studentId ?? "",
  };
}

export function getConfiguredDifficulty(): GameDifficulty | null {
  return normalizeDifficulty(configuration.difficulty);
}

export function getConfiguredCaseDistribution(): "aleatorio" | "mesmo" {
  return normalizeCaseSelection() === "class"
    ? "mesmo"
    : "aleatorio";
}

export function getConfiguredRankingEnabled(): boolean {
  const value = configuration.rankingEnabled;
  return value === "sim" || value === true;
}

export function getConfiguredSessionContinuity(): boolean {
  const value = configuration.sessionContinuity;
  return value === "sim" || value === true;
}

export function getConfiguredReplayEnabled(): boolean {
  return normalizeBoolean(configuration.allowReplaySameCase);
}

export function startFctoolGame(data: Record<string, unknown> = {}): void {
  client?.start({
    difficulty: getConfiguredDifficulty(),
    ...data,
  });
}

export function resumeFctoolGame(data: Record<string, unknown> = {}): void {
  client?.resume({
    difficulty: getConfiguredDifficulty(),
    ...data,
  });
}

export function reportFctoolScore(score: number, max = 100): void {
  client?.score(score, max);
}

export function completeFctoolGame(
  score: number,
  max_score?: number,
  data: Record<string, unknown> = {},
): void {
  reportFctoolScore(score, max_score);
  client?.complete({
    score,
    result: "success",
    ...data,
  });
}

export function emitFctoolEvent(
  name: string,
  data: Record<string, unknown> = {},
): void {
  client?.emit(name, data);
}
