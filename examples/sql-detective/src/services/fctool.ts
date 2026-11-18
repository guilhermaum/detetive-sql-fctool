import { FCToolGame } from "./fctool-sdk";
import type { CaseFlowConfig } from "../models/caseFlow";

export type GameDifficulty = "facil" | "medio" | "dificil";

export type CaseDistribution = "aleatorio" | "mesmo";

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

  client.ready({
    appliedConfiguration: {
      caseFlow: getConfiguredCaseFlow(),
      rankingEnabled: getConfiguredRankingEnabled() ? "sim" : "nao",
      sessionContinuity: getConfiguredSessionContinuity() ? "sim" : "nao",
    },
  });

  return configuration;
}

type RawCaseFlowStep = {
  difficulty?: unknown;
  selectionMode?: unknown;
  caseId?: unknown;
  distribution?: unknown;
  id?: unknown;
};

function normalizeDifficulty(value: unknown): "facil" | "medio" | "dificil" {
  if (value === "facil" || value === "easy") return "facil";
  if (value === "dificil" || value === "hard") return "dificil";
  return "medio";
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === "sim";
}

/**
 * Converte os valores enviados pelo repeater do Manifest para o modelo
 * utilizado pelo jogo. O repeater envia um array de linhas com
 * selectionMode/caseId/distribution; o jogo trabalha com selection.mode.
 */
export function getConfiguredCaseFlow(): CaseFlowConfig {
  const rawSteps = configuration.caseFlow;
  const progression =
    configuration.progression === "sequence" ? "sequence" : "single";
  const allowReplaySameCase = normalizeBoolean(
    configuration.allowReplaySameCase,
  );

  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    // Permite executar o jogo fora do FCTool durante o desenvolvimento.
    return {
      progression: "single",
      allowReplaySameCase: true,
      steps: [
        {
          id: "step-1",
          difficulty: "medio",
          selection: {
            mode: "system",
            distribution: "individual",
          },
        },
      ],
    };
  }

  const steps = rawSteps.map(
    (item: unknown, index): CaseFlowConfig["steps"][number] => {
      if (!item || typeof item !== "object") {
        throw new Error(`A etapa ${index + 1} do caseFlow é inválida.`);
      }

      const raw = item as RawCaseFlowStep;
      const mode =
        raw.selectionMode === "teacher" ||
        raw.selectionMode === "student" ||
        raw.selectionMode === "system"
          ? raw.selectionMode
          : "teacher";

      const caseId = Number(raw.caseId);
      const distribution =
        raw.distribution === "class" ? "class" : "individual";

      if (mode === "teacher" && (!Number.isInteger(caseId) || caseId <= 0)) {
        throw new Error(
          `Informe um ID de caso válido na etapa ${index + 1}, pois a seleção está definida para o professor.`,
        );
      }

      return {
        id:
          typeof raw.id === "string" && raw.id.trim()
            ? raw.id
            : `step-${index + 1}`,
        difficulty: normalizeDifficulty(raw.difficulty),
        selection: {
          mode,
          ...(mode === "teacher" ? { caseId } : {}),
          ...(mode === "system" ? { distribution } : {}),
        },
      };
    },
  );

  const activeSteps = progression === "single" ? steps.slice(0, 1) : steps;

  if (!allowReplaySameCase) {
    const fixedCaseIds = activeSteps
      .filter((step) => step.selection.mode === "teacher")
      .map((step) => step.selection.caseId)
      .filter((id): id is number => typeof id === "number");
    if (new Set(fixedCaseIds).size !== fixedCaseIds.length) {
      throw new Error(
        "O mesmo caso foi configurado em mais de uma etapa, mas a repetição está desativada.",
      );
    }
  }

  return {
    progression,
    allowReplaySameCase,
    steps: activeSteps,
  };
}

export function getFctoolIdentity(): {
  cardId: string;
  playerId: string;
} | null {
  const context = client?.getContext();

  if (!context) return null;

  return {
    cardId: context.sessionId,
    playerId: context.studentId,
  };
}

export function getConfiguredDifficulty(): GameDifficulty | null {
  const value = configuration.difficulty;

  if (value === "facil" || value === "easy") {
    return "facil";
  }

  if (value === "medio" || value === "medium") {
    return "medio";
  }

  if (value === "dificil" || value === "hard") {
    return "dificil";
  }

  return null;
}

export function getConfiguredCaseDistribution(): CaseDistribution {
  return configuration.caseDistribution === "mesmo" ? "mesmo" : "aleatorio";
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
