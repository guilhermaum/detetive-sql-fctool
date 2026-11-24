import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Finish from "./index";

const mocks = vi.hoisted(() => ({
  useGame: vi.fn(),
  findCasesByDifficulty: vi.fn(),
  getConfiguredGameConfiguration: vi.fn(),
  advanceToNextCase: vi.fn(),
  finishActivity: vi.fn(),
  resetGame: vi.fn(),
}));

vi.mock("../../context/game", () => ({ useGame: mocks.useGame }));
vi.mock("../../services/games", () => ({ findCasesByDifficulty: mocks.findCasesByDifficulty }));
vi.mock("../../services/fctool", () => ({
  getConfiguredGameConfiguration: mocks.getConfiguredGameConfiguration,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderFinish() {
  return render(
    <MemoryRouter initialEntries={["/finish"]}>
      <Routes>
        <Route path="/finish" element={<Finish />} />
        <Route path="/cases" element={<LocationProbe />} />
        <Route path="/ranking" element={<LocationProbe />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Finish com configurações da FCTool", () => {
  beforeEach(() => {
    mocks.useGame.mockReturnValue({
      isGameWon: true,
      gameCompleted: true,
      playerName: "Ana",
      finalScore: 92,
      rankingEnabled: false,
      currentDifficulty: "medio",
      completedCaseIds: [1],
      canAdvanceCases: false,
      advanceToNextCase: mocks.advanceToNextCase,
      finishActivity: mocks.finishActivity,
      allowReplaySameCase: false,
      resetGame: mocks.resetGame,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "single",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: false,
    });
    mocks.findCasesByDifficulty.mockResolvedValue([]);
  });

  it("no modo single não oferece avanço entre casos", () => {
    renderFinish();

    expect(screen.queryByRole("button", { name: /Próximo caso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Próxima dificuldade/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Encerrar atividade/ })).not.toBeInTheDocument();
  });

  it("no modo sequence permite avançar para outro caso ainda não concluído", async () => {
    const user = userEvent.setup();
    mocks.useGame.mockReturnValue({
      ...mocks.useGame(),
      canAdvanceCases: true,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: false,
    });
    mocks.findCasesByDifficulty.mockResolvedValue([
      { id: "1", name: "Caso concluído", description: "", difficulty: "medium", levelCount: 1 },
      { id: "2", name: "Próximo caso", description: "", difficulty: "medium", levelCount: 1 },
    ]);
    renderFinish();

    await user.click(await screen.findByRole("button", { name: /Próximo caso/ }));
    expect(mocks.advanceToNextCase).toHaveBeenCalledWith("medio");
    expect(screen.getByTestId("location")).toHaveTextContent("/cases?difficulty=medio");
  });

  it("oferece a próxima dificuldade quando todos os casos atuais foram concluídos", async () => {
    const user = userEvent.setup();
    mocks.useGame.mockReturnValue({
      ...mocks.useGame(),
      completedCaseIds: [1, 2],
      canAdvanceCases: true,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: false,
    });
    mocks.findCasesByDifficulty.mockImplementation(async (difficulty: string) =>
      difficulty === "medium"
        ? [
            { id: "1", name: "Caso 1", description: "", difficulty: "medium", levelCount: 1 },
            { id: "2", name: "Caso 2", description: "", difficulty: "medium", levelCount: 1 },
          ]
        : [{ id: "3", name: "Caso difícil", description: "", difficulty: "hard", levelCount: 1 }],
    );
    renderFinish();

    await user.click(await screen.findByRole("button", { name: /Próxima dificuldade/ }));
    expect(mocks.advanceToNextCase).toHaveBeenCalledWith("dificil");
    expect(screen.getByTestId("location")).toHaveTextContent("/cases?difficulty=dificil");
  });

  it("permite sortear novamente na sequência quando replay está habilitado", async () => {
    const user = userEvent.setup();
    mocks.useGame.mockReturnValue({
      ...mocks.useGame(),
      canAdvanceCases: true,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "individual",
      allowReplaySameCase: true,
    });
    mocks.findCasesByDifficulty.mockResolvedValue([
      { id: "1", name: "Caso concluído", description: "", difficulty: "medium", levelCount: 1 },
    ]);
    renderFinish();

    await user.click(await screen.findByRole("button", { name: /Sortear outro caso/ }));
    expect(mocks.advanceToNextCase).toHaveBeenCalledWith("medio");
    expect(screen.getByTestId("location")).toHaveTextContent("/cases?difficulty=medio");
  });

  it("exibe acesso ao ranking e replay quando habilitados no modo single", async () => {
    const user = userEvent.setup();
    mocks.useGame.mockReturnValue({
      ...mocks.useGame(),
      rankingEnabled: true,
      allowReplaySameCase: true,
    });
    renderFinish();

    expect(screen.getByRole("button", { name: /Jogar novamente/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ver ranking/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/ranking");
  });

  it("encerra a atividade explicitamente em sequência", async () => {
    const user = userEvent.setup();
    mocks.useGame.mockReturnValue({
      ...mocks.useGame(),
      canAdvanceCases: true,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: false,
    });
    mocks.findCasesByDifficulty.mockResolvedValue([
      { id: "2", name: "Caso aberto", description: "", difficulty: "medium", levelCount: 1 },
    ]);
    renderFinish();

    await user.click(screen.getByRole("button", { name: /Encerrar atividade/ }));
    expect(mocks.finishActivity).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Atividade encerrada");
  });
});
