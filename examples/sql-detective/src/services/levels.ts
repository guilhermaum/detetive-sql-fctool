import api from "../api/config";
import type Level from "../models/level";
import type { LevelCheckResponse } from "./game-sessions";

type ApiLevel = {
  id: number | string;
  case_id: number;
  number: number;
  tips: string | string[];
  problems: string | string[];
  template: Record<string, unknown>;
  helps?: {
    help_table?: string;
    help_column?: string;
    help_operation?: string;
  } | null;
};

function toLines(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function toLevel(item: ApiLevel): Level {
  const help: NonNullable<ApiLevel["helps"]> = item.helps ?? {};
  return {
    id: String(item.id),
    case_id: Number(item.case_id),
    number: Number(item.number),
    tips: toLines(item.tips),
    problems: toLines(item.problems),
    template: item.template ?? {},
    helps: [
      { id: 1, title: "Quais tabelas devo usar na consulta?", tip: help.help_table ?? "" },
      { id: 2, title: "Quais colunas devo usar na consulta?", tip: help.help_column ?? "" },
      { id: 3, title: "Quais operadores devo usar na consulta?", tip: help.help_operation ?? "" },
    ],
  };
}

async function findLevel(id: string): Promise<Level> {
  const { data } = await api.get<ApiLevel>(`/levels/${encodeURIComponent(id)}`);
  return toLevel(data);
}

async function checkAnswers(gameSessionId: number, id: string, answers: string[], score: number): Promise<boolean> {
  const path = `/game-sessions/${encodeURIComponent(gameSessionId)}/levels/${encodeURIComponent(id)}/check`;
  const { data } = await api.post<LevelCheckResponse>(path, { answers, score });
  return data.check;
}

export { checkAnswers, findLevel };
