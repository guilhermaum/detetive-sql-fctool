type CaseSummary = {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  levelCount: number;
};

type Game = Omit<CaseSummary, "levelCount"> & {
  levels: string[];
  last: number;
  databaseImageUrl: string | null;
};

export type { CaseSummary };
export default Game;
