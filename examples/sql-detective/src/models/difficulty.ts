const difficultyLabels: Record<string, string> = {
  facil: "Fácil",
  easy: "Fácil",
  medio: "Médio",
  medium: "Médio",
  dificil: "Difícil",
  hard: "Difícil",
};

/**
 * Converte a dificuldade (formato do FCTool ou da API) em um rótulo
 * em português para exibição.
 */
export function formatDifficulty(value: string | null | undefined): string {
  if (!value) return "";
  return difficultyLabels[value.toLowerCase()] ?? value;
}
