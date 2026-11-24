export type GameDifficulty = "facil" | "medio" | "dificil";

export type CaseSelectionMode = "student" | "individual" | "class";

export type CaseProgressionMode = "single" | "sequence";

export interface GameConfiguration {
  progression: CaseProgressionMode;
  difficulty: GameDifficulty | null;
  selection: CaseSelectionMode;
  allowReplaySameCase: boolean;
}
