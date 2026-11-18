import api from "../api/config";

export type RankedPlayer = {
  id: number;
  player_id: string;
  player_name: string | null;
  score: number;
  finished_at: string | null;
};

type ApiRankedPlayer = {
  id: number;
  player_name?: string | null;
  player_id?: string | null;
  score: number;
  finished_at: string | null;
};

async function findRanking(cardId: string, caseId: number): Promise<RankedPlayer[]> {
  const path = `/game-sessions/card/${encodeURIComponent(cardId)}/ranking`;
  const { data } = await api.get<ApiRankedPlayer[]>(path, {
    params: { case_id: caseId },
  });

  return data.map((player) => ({
    id: Number(player.id),
    player_id: player.player_id ?? "",
    player_name: player.player_name ?? null,
    score: Number(player.score) || 0,
    finished_at: player.finished_at ?? null,
  }));
}

export { findRanking };
