import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Ranking from "./index";

const mocks = vi.hoisted(() => ({ useGame: vi.fn(), findRanking: vi.fn() }));

vi.mock("../../context/game", () => ({ useGame: mocks.useGame }));
vi.mock("../../services/players", () => ({ findRanking: mocks.findRanking }));

function renderRanking() {
  return render(
    <MemoryRouter initialEntries={["/ranking"]}>
      <Routes>
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/" element={<p data-testid="home">Início</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Ranking", () => {
  beforeEach(() => {
    mocks.useGame.mockReturnValue({
      cardId: "card-a",
      caseId: 7,
      caseInfo: { name: "Caso sete", difficulty: "medium" },
      rankingEnabled: true,
      gameCompleted: true,
    });
    mocks.findRanking.mockResolvedValue([
      { id: 1, player_id: "student-ana", player_name: "Ana", score: 95, finished_at: "2026-11-01" },
      { id: 2, player_id: "student-bruno", player_name: "Bruno", score: 88, finished_at: "2026-11-02" },
    ]);
  });

  it("carrega o ranking para o card e caso atuais", async () => {
    renderRanking();

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(mocks.findRanking).toHaveBeenCalledWith("card-a", 7);
    expect(screen.getByRole("cell", { name: "Ana" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "95" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Bruno" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "88" })).toBeInTheDocument();
  });

  it("não mostra a página quando o ranking está desabilitado", () => {
    mocks.useGame.mockReturnValue({
      ...mocks.useGame(),
      rankingEnabled: false,
    });
    renderRanking();

    expect(screen.getByTestId("home")).toHaveTextContent("Início");
    expect(mocks.findRanking).not.toHaveBeenCalled();
  });
});
