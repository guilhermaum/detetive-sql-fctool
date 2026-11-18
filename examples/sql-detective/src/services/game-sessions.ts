import api from "../api/config";

export type StartGameSessionPayload = {
  case_id: number;
  card_id: string;
  player_id: string;
  player_name: string;
};

export type GameSession = {
  id: number;
  card_id: string | null;
  player_id: string;
  player_name: string | null;
  case_id: number;
  status: string;
  current_level_id: number | null;
  score: number;
  started_at: string;
  finished_at: string | null;
};

export type ResumableGameSession = {
  session: GameSession;
  progress: Array<{
    id: number;
    game_session_id: number;
    level_id: number;
    status: string;
    score: number;
    started_at: string;
    completed_at: string | null;
  }>;
  used_hints: number[];
  used_hint_count: number;
};

export type LevelQueryResponse = {
  result: Array<Record<string, unknown>>;
  error: string | null;
  score_added: number;
  session: GameSession;
};

export type LevelCheckResponse = {
  check: boolean;
  score_added?: number;
  progress?: {
    level_id: number;
    status: string;
    score: number;
  };
  session: GameSession;
};

async function startGameSession(payload: StartGameSessionPayload): Promise<GameSession> {
  const path = "/game-sessions";
  const { data } = await api.post<GameSession>(path, payload);
  return data;
}

async function findResumableGameSession(
  cardId: string,
  playerId: string,
): Promise<ResumableGameSession | null> {
  const path = "/game-sessions/resume";
  const { data } = await api.get<ResumableGameSession | null>(path, {
    params: {
      card_id: cardId,
      player_id: playerId,
    },
  });
  return data;
}

async function saveGameSessionLevelScore(
  gameSessionId: number,
  levelId: string,
  score: number,
): Promise<void> {
  const path = `/game-sessions/${encodeURIComponent(gameSessionId)}/levels/${encodeURIComponent(levelId)}/score`;
  await api.post(path, { score });
}

async function executeLevelQuery(
  gameSessionId: number,
  levelId: string,
  query: string,
): Promise<LevelQueryResponse> {
  const path = `/game-sessions/${encodeURIComponent(gameSessionId)}/levels/${encodeURIComponent(levelId)}/query`;
  const payload = { query };
  const { data } = await api.post<LevelQueryResponse>(path, payload);
  return data;
}

async function useGameSessionHint(gameSessionId: number, levelId: string, hintId: number, score: number): Promise<void> {
  const path = `/game-sessions/${encodeURIComponent(gameSessionId)}/levels/${encodeURIComponent(levelId)}/hints/${hintId}/use`;
  const payload = { score };
  await api.post(path, payload);
}

async function completeGameSession(gameSessionId: number): Promise<GameSession> {
  const path = `/game-sessions/${encodeURIComponent(gameSessionId)}/complete`;
  const payload = {};
  const { data } = await api.post<GameSession>(path, payload);
  return data;
}

export {
  completeGameSession,
  executeLevelQuery,
  findResumableGameSession,
  saveGameSessionLevelScore,
  startGameSession,
  useGameSessionHint,
};
