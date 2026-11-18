type LevelHelp = {
  id: number;
  title: string;
  tip: string;
};

type Level = {
  id: string;
  case_id: number;
  number: number;
  tips: string[];
  problems: string[];
  template: Record<string, unknown>;
  helps: LevelHelp[];
};

export type { LevelHelp };
export default Level;
