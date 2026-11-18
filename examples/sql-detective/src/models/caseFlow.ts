export type CaseSelectionMode = "teacher" | "system" | "student";

export type CaseDistributionMode = "individual" | "class";

export type CaseProgressionMode = "single" | "sequence";

export interface CaseSelectionConfig {
  mode: CaseSelectionMode;
  caseId?: number;
  caseIds?: number[];
  distribution?: CaseDistributionMode;
}

export interface CaseFlowStep {
  id: string;
  difficulty: "facil" | "medio" | "dificil";
  selection: CaseSelectionConfig;
}

export interface CaseFlowConfig {
  progression: CaseProgressionMode;
  allowReplaySameCase: boolean;
  steps: CaseFlowStep[];
}
