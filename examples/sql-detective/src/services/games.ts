import api from "../api/config";
import type Game from "../models/game";
import type { CaseSummary } from "../models/game";

type ApiCase = {
  id: number | string;
  name: string;
  description: string;
  difficulty: string;
  level_count: number;
  database_image_url?: string | null;
};

type ApiLevelSummary = {
  id: number | string;
  number: number;
};

type ApiCasesResponse =
  | ApiCase[]
  | { cases?: ApiCase[]; data?: ApiCase[]; result?: ApiCase[] };

type CaseSelection = {
  case_id: number;
  shared_case_id?: number;
  fallback_used?: boolean;
  fallback_reason?: "already_played_in_another_card" | "already_played_in_script";
};

function toCaseSummary(item: ApiCase): CaseSummary {
  return {
    id: String(item.id),
    name: item.name,
    description: item.description,
    difficulty: item.difficulty,
    levelCount: Number(item.level_count),
  };
}

async function findCases(): Promise<CaseSummary[]> {
  const { data } = await api.get<ApiCasesResponse>("/cases");
  const items = Array.isArray(data)
    ? data
    : (data.cases ?? data.data ?? data.result ?? []);

  return items.map(toCaseSummary);
}

async function findCasesByDifficulty(
  difficulty: string,
): Promise<CaseSummary[]> {
  const cases = await findCases();
  return cases.filter(
    (item) => item.difficulty.toLowerCase() === difficulty.toLowerCase(),
  );
}

async function selectCaseForPlayer(input: {
  scriptId: string;
  cardId: string;
  sessionId: string;
  playerId: string;
  difficulty: string;
  caseDistribution: "aleatorio" | "mesmo";
  selectionIndex: number;
  allowReplaySameCase: boolean;
}): Promise<CaseSelection> {
  const path = `/cards/${encodeURIComponent(input.cardId)}/cases/select`;
  const { data } = await api.post<CaseSelection>(path, {
    script_id: input.scriptId,
    session_id: input.sessionId,
    player_id: input.playerId,
    difficulty: input.difficulty,
    case_distribution: input.caseDistribution,
    selection_index: input.selectionIndex,
    allow_replay_same_case: input.allowReplaySameCase ? "sim" : "nao",
  });
  return data;
}

async function findGame(id: string): Promise<Game> {
  const [{ data: item }, { data: levels }] = await Promise.all([
    api.get<ApiCase>(`/cases/${encodeURIComponent(id)}`),
    api.get<ApiLevelSummary[]>(`/cases/${encodeURIComponent(id)}/levels`),
  ]);

  return {
    ...toCaseSummary(item),
    databaseImageUrl: item.database_image_url
      ? new URL(
          item.database_image_url,
          api.defaults.baseURL ?? window.location.href,
        ).toString()
      : null,
    levels: [...levels]
      .sort((left, right) => left.number - right.number)
      .map((level) => String(level.id)),
    last: levels.length,
  };
}

export { findCases, findCasesByDifficulty, findGame, selectCaseForPlayer };
