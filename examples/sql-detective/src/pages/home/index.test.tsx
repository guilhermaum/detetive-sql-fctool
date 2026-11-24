import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Home from "./index";

const mocks = vi.hoisted(() => ({
  useGame: vi.fn(),
  useSong: vi.fn(),
  findResumableGameSession: vi.fn(),
  getConfiguredDifficulty: vi.fn(),
  getConfiguredSessionContinuity: vi.fn(),
  getFctoolIdentity: vi.fn(),
  startGame: vi.fn(),
  savePlayerName: vi.fn(),
  playSong: vi.fn(),
}));

vi.mock("../../context/game", () => ({ useGame: mocks.useGame }));
vi.mock("../../context/song", () => ({ useSong: mocks.useSong }));
vi.mock("../../services/game-sessions", () => ({
  findResumableGameSession: mocks.findResumableGameSession,
}));
vi.mock("../../services/fctool", () => ({
  getConfiguredDifficulty: mocks.getConfiguredDifficulty,
  getConfiguredSessionContinuity: mocks.getConfiguredSessionContinuity,
  getFctoolIdentity: mocks.getFctoolIdentity,
}));

const identity = {
  scriptId: "script-ana",
  cardId: "card-ana",
  sessionId: "session-ana",
  playerId: "student-ana",
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cases" element={<LocationProbe />} />
        <Route path="/level" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Home com continuidade de sessão", () => {
  beforeEach(() => {
    mocks.useGame.mockReturnValue({
      playerName: "",
      savePlayerName: mocks.savePlayerName,
      startGame: mocks.startGame,
    });
    mocks.useSong.mockReturnValue({ playSong: mocks.playSong });
    mocks.getConfiguredDifficulty.mockReturnValue("facil");
    mocks.getConfiguredSessionContinuity.mockReturnValue(false);
    mocks.getFctoolIdentity.mockReturnValue(identity);
    mocks.findResumableGameSession.mockResolvedValue(null);
    mocks.startGame.mockResolvedValue(false);
  });

  it("retoma a sessão do aluno/card e não pede o nome novamente", async () => {
    const resumableSession = {
      session: { case_id: 8, id: 99, current_level_id: 81 },
      progress: [{ level_id: 81, status: "in_progress", score: 84 }],
      used_hints: [1],
      used_hint_count: 1,
    };
    mocks.getConfiguredSessionContinuity.mockReturnValue(true);
    mocks.findResumableGameSession.mockResolvedValue(resumableSession);
    renderHome();

    await waitFor(() => expect(mocks.findResumableGameSession).toHaveBeenCalledWith(
      identity.cardId,
      identity.playerId,
    ));
    expect(mocks.startGame).toHaveBeenCalledWith("8", resumableSession, identity);
    expect(screen.getByTestId("location")).toHaveTextContent("/level");
    expect(screen.queryByRole("textbox", { name: "Digite seu nome" })).not.toBeInTheDocument();
  });

  it("sem continuidade pede o nome e inicia na dificuldade configurada", async () => {
    const user = userEvent.setup();
    renderHome();

    const nameField = screen.getByRole("textbox", { name: "Digite seu nome" });
    await user.type(nameField, " Ana ");
    await user.click(screen.getByRole("button", { name: /Iniciar/ }));

    expect(mocks.findResumableGameSession).not.toHaveBeenCalled();
    expect(mocks.savePlayerName).toHaveBeenCalledWith("Ana");
    expect(mocks.playSong).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/cases?difficulty=facil");
  });
});
