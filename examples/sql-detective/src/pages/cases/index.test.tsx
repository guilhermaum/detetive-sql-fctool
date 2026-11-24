import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Cases from "./index";

const mocks = vi.hoisted(() => ({
  useGame: vi.fn(),
  findCasesByDifficulty: vi.fn(),
  selectCaseForPlayer: vi.fn(),
  findResumableGameSession: vi.fn(),
  emitFctoolEvent: vi.fn(),
  getConfiguredGameConfiguration: vi.fn(),
  getConfiguredSessionContinuity: vi.fn(),
  getFctoolIdentity: vi.fn(),
  startGame: vi.fn(),
  advanceToNextCase: vi.fn(),
}));

vi.mock("../../context/game", () => ({ useGame: mocks.useGame }));
vi.mock("../../services/games", () => ({
  findCasesByDifficulty: mocks.findCasesByDifficulty,
  selectCaseForPlayer: mocks.selectCaseForPlayer,
}));
vi.mock("../../services/game-sessions", () => ({
  findResumableGameSession: mocks.findResumableGameSession,
}));
vi.mock("../../services/fctool", () => ({
  emitFctoolEvent: mocks.emitFctoolEvent,
  getConfiguredGameConfiguration: mocks.getConfiguredGameConfiguration,
  getConfiguredSessionContinuity: mocks.getConfiguredSessionContinuity,
  getFctoolIdentity: mocks.getFctoolIdentity,
}));

const identity = {
  scriptId: "script-ana",
  cardId: "card-ana",
  sessionId: "session-ana",
  playerId: "student-ana",
};

const availableCases = [
  { id: "1", name: "Caso 1", description: "Caso já concluído", difficulty: "medium", levelCount: 1 },
  { id: "2", name: "Caso 2", description: "Caso aberto", difficulty: "medium", levelCount: 1 },
  { id: "3", name: "Caso 3", description: "Caso sorteado", difficulty: "medium", levelCount: 1 },
];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderCases() {
  return render(
    <MemoryRouter initialEntries={["/cases?difficulty=medio"]}>
      <Routes>
        <Route path="/cases" element={<Cases />} />
        <Route path="/level" element={<LocationProbe />} />
        <Route path="/difficulty" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Cases com configurações da FCTool", () => {
  beforeEach(() => {
    mocks.useGame.mockReturnValue({
      startGame: mocks.startGame,
      currentCaseIndex: 1,
      currentDifficulty: "medio",
      completedCaseIds: [],
      advanceToNextCase: mocks.advanceToNextCase,
      canAdvanceCases: true,
    });
    mocks.findCasesByDifficulty.mockResolvedValue(availableCases);
    mocks.selectCaseForPlayer.mockResolvedValue({ case_id: 3 });
    mocks.findResumableGameSession.mockResolvedValue(null);
    mocks.getFctoolIdentity.mockReturnValue(identity);
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: false,
    });
    mocks.getConfiguredSessionContinuity.mockReturnValue(false);
    mocks.startGame.mockResolvedValue(false);
  });

  it("na escolha do aluno, esconde casos concluídos quando replay está desativado", async () => {
    const user = userEvent.setup();
    mocks.useGame.mockReturnValue({
      startGame: mocks.startGame,
      currentCaseIndex: 1,
      currentDifficulty: "medio",
      completedCaseIds: [1],
      advanceToNextCase: mocks.advanceToNextCase,
      canAdvanceCases: true,
    });
    renderCases();

    expect(await screen.findByRole("button", { name: /Caso 2/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Caso 1/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Caso 2/ }));

    await waitFor(() => expect(mocks.startGame).toHaveBeenCalledWith("2", undefined, identity, "medio"));
    expect(mocks.selectCaseForPlayer).not.toHaveBeenCalled();
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("case_selected", expect.objectContaining({
      case_id: 2,
      selection_mode: "student",
      difficulty: "medio",
      case_index: 1,
    }));
    expect(screen.getByTestId("location")).toHaveTextContent("/level");
  });

  it("mantém casos concluídos disponíveis quando replay está habilitado", async () => {
    mocks.useGame.mockReturnValue({
      startGame: mocks.startGame,
      currentCaseIndex: 1,
      currentDifficulty: "medio",
      completedCaseIds: [1],
      advanceToNextCase: mocks.advanceToNextCase,
      canAdvanceCases: true,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: true,
    });
    renderCases();

    expect(await screen.findByRole("button", { name: /Caso 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Caso 2/ })).toBeInTheDocument();
  });

  it.each([
    { selection: "individual", caseDistribution: "aleatorio" },
    { selection: "class", caseDistribution: "mesmo" },
  ])("faz a seleção $selection respeitando o contexto do card", async ({ selection, caseDistribution }) => {
    mocks.useGame.mockReturnValue({
      startGame: mocks.startGame,
      currentCaseIndex: 1,
      currentDifficulty: "medio",
      completedCaseIds: [1],
      advanceToNextCase: mocks.advanceToNextCase,
      canAdvanceCases: true,
    });
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection,
      allowReplaySameCase: false,
    });
    renderCases();

    await waitFor(() => expect(mocks.selectCaseForPlayer).toHaveBeenCalledWith({
      scriptId: identity.scriptId,
      cardId: identity.cardId,
      sessionId: identity.sessionId,
      playerId: identity.playerId,
      difficulty: "medium",
      caseDistribution,
      selectionIndex: 1,
      allowReplaySameCase: false,
    }));
    expect(mocks.startGame).toHaveBeenCalledWith("3", undefined, identity, "medio");
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("case_selected", expect.objectContaining({
      case_id: 3,
      selection_mode: selection,
      difficulty: "medio",
      case_index: 1,
    }));
    expect(screen.getByTestId("location")).toHaveTextContent("/level");
  });

  it("retoma a sessão existente quando continuidade está habilitada", async () => {
    const resumableSession = { session: { case_id: 8, id: 99 }, progress: [], used_hints: [], used_hint_count: 0 };
    mocks.getConfiguredSessionContinuity.mockReturnValue(true);
    mocks.findResumableGameSession.mockResolvedValue(resumableSession);
    renderCases();

    await waitFor(() => expect(mocks.findResumableGameSession).toHaveBeenCalledWith(
      identity.cardId,
      identity.playerId,
    ));
    expect(mocks.startGame).toHaveBeenCalledWith("8", resumableSession, identity);
    expect(mocks.findCasesByDifficulty).not.toHaveBeenCalled();
    expect(mocks.selectCaseForPlayer).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/level");
  });
});
