import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { GameProvider, useGame } from "./game";

const mocks = vi.hoisted(() => ({
  findGame: vi.fn(),
  findLevel: vi.fn(),
  startGameSession: vi.fn(),
  saveGameSessionLevelScore: vi.fn(),
  useGameSessionHint: vi.fn(),
  completeGameSession: vi.fn(),
  completeFctoolGame: vi.fn(),
  emitFctoolEvent: vi.fn(),
  getConfiguredGameConfiguration: vi.fn(),
  getConfiguredRankingEnabled: vi.fn(),
  getConfiguredSessionContinuity: vi.fn(),
  getFctoolIdentity: vi.fn(),
  reportFctoolScore: vi.fn(),
  resumeFctoolGame: vi.fn(),
  startFctoolGame: vi.fn(),
}));

vi.mock("../services/games", () => ({ findGame: mocks.findGame }));
vi.mock("../services/levels", () => ({ findLevel: mocks.findLevel }));
vi.mock("../services/game-sessions", () => ({
  completeGameSession: mocks.completeGameSession,
  saveGameSessionLevelScore: mocks.saveGameSessionLevelScore,
  startGameSession: mocks.startGameSession,
  useGameSessionHint: mocks.useGameSessionHint,
}));
vi.mock("../services/fctool", () => ({
  completeFctoolGame: mocks.completeFctoolGame,
  emitFctoolEvent: mocks.emitFctoolEvent,
  getConfiguredGameConfiguration: mocks.getConfiguredGameConfiguration,
  getConfiguredRankingEnabled: mocks.getConfiguredRankingEnabled,
  getConfiguredSessionContinuity: mocks.getConfiguredSessionContinuity,
  getFctoolIdentity: mocks.getFctoolIdentity,
  reportFctoolScore: mocks.reportFctoolScore,
  resumeFctoolGame: mocks.resumeFctoolGame,
  startFctoolGame: mocks.startFctoolGame,
}));

const hostContexts = [
  {
    label: "aluna em roteiro e card A",
    scriptId: "script-geography",
    cardId: "card-a",
    sessionId: "session-ana-a",
    playerId: "student-ana",
  },
  {
    label: "aluno diferente no mesmo roteiro e card B",
    scriptId: "script-geography",
    cardId: "card-b",
    sessionId: "session-bruno-b",
    playerId: "student-bruno",
  },
  {
    label: "mesma aluna em outro roteiro e card C",
    scriptId: "script-history",
    cardId: "card-c",
    sessionId: "session-ana-c",
    playerId: "student-ana",
  },
];

type HostIdentity = (typeof hostContexts)[number];
type ResumeFixture = NonNullable<Parameters<ReturnType<typeof useGame>["startGame"]>[1]>;

const levelFixtures = {
  "101": {
    id: "101",
    case_id: 1,
    number: 1,
    tips: ["Primeira pista"],
    problems: ["Encontre a pessoa"],
    template: { nome: "Ana" },
    helps: [{ id: 1, title: "Tabela", tip: "pessoas" }],
  },
  "102": {
    id: "102",
    case_id: 1,
    number: 2,
    tips: ["Segunda pista"],
    problems: ["Encontre o endereço"],
    template: { cidade: "Fortaleza" },
    helps: [{ id: 1, title: "Tabela", tip: "enderecos" }],
  },
};

function GameStateProbe({ identity, resumableSession }: {
  identity: HostIdentity;
  resumableSession?: ResumeFixture;
}) {
  const game = useGame();
  const [startError, setStartError] = useState("");

  return (
    <div>
      <output data-testid="score">{game.scoreGame}</output>
      <output data-testid="remaining-helps">{game.remainingHelps}</output>
      <output data-testid="used-hints">{game.usedHintIds.join(",")}</output>
      <output data-testid="level">{game.level?.id ?? "carregando"}</output>
      <output data-testid="won">{String(game.isGameWon)}</output>
      <output data-testid="completed">{String(game.gameCompleted)}</output>
      <output data-testid="sequence">{String(game.canAdvanceCases)}</output>
      <output role="alert">{startError}</output>
      <button onClick={() => game.savePlayerName(" Ana ")}>Salvar nome</button>
      <button
        onClick={() => {
          void game.startGame("1", undefined, identity, "medio").catch((error: Error) => {
            setStartError(error.message);
          });
        }}
      >
        Iniciar partida
      </button>
      {resumableSession && (
        <button
          onClick={() => {
            void game.startGame("1", resumableSession, identity, "medio").catch((error: Error) => {
              setStartError(error.message);
            });
          }}
        >
          Retomar partida
        </button>
      )}
      <button onClick={() => void game.applyHelp(1)}>Usar dica</button>
      <button onClick={() => void game.applyFault()}>Errar resposta</button>
      <button onClick={game.applySuccess}>Acertar resposta</button>
      <button onClick={game.nextGameLevel}>Próximo nível</button>
    </div>
  );
}

describe("GameProvider", () => {
  beforeEach(() => {
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "sequence",
      difficulty: "medio",
      selection: "student",
      allowReplaySameCase: false,
    });
    mocks.getConfiguredRankingEnabled.mockReturnValue(false);
    mocks.getConfiguredSessionContinuity.mockReturnValue(false);
    mocks.getFctoolIdentity.mockReturnValue(null);
    mocks.findGame.mockResolvedValue({
      id: "1",
      name: "Caso de teste",
      description: "Dois níveis",
      difficulty: "medium",
      databaseImageUrl: null,
      levels: ["101", "102"],
      last: 2,
    });
    mocks.findLevel.mockImplementation(async (id: keyof typeof levelFixtures) => levelFixtures[id]);
    mocks.startGameSession.mockResolvedValue({
      id: 44,
      player_name: "Ana",
      case_id: 1,
      status: "in_progress",
      current_level_id: 101,
      score: 0,
      started_at: "2026-01-01T00:00:00.000Z",
      finished_at: null,
    });
    mocks.saveGameSessionLevelScore.mockResolvedValue(undefined);
    mocks.useGameSessionHint.mockResolvedValue(undefined);
    mocks.completeGameSession.mockResolvedValue({ case_id: 1, score: 97 });
  });

  it.each(hostContexts)("usa a identidade correta ao iniciar: $label", async (identity) => {
    const user = userEvent.setup();
    mocks.getFctoolIdentity.mockReturnValue(identity);
    render(
      <GameProvider>
        <GameStateProbe identity={identity} />
      </GameProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Salvar nome" }));
    await user.click(screen.getByRole("button", { name: "Iniciar partida" }));

    await waitFor(() => expect(screen.getByTestId("level")).toHaveTextContent("101"));
    expect(screen.getByTestId("score")).toHaveTextContent("100");
    expect(screen.getByTestId("sequence")).toHaveTextContent("true");
    expect(mocks.startGameSession).toHaveBeenCalledWith({
      case_id: 1,
      player_id: identity.playerId,
      player_name: "Ana",
      card_id: identity.cardId,
      script_id: identity.scriptId,
      session_id: identity.sessionId,
    });
    expect(mocks.startFctoolGame).toHaveBeenCalledWith(expect.objectContaining({
      case_id: 1,
      card_id: identity.cardId,
      script_id: identity.scriptId,
      session_id: identity.sessionId,
      player_name: "Ana",
    }));

    await user.click(screen.getByRole("button", { name: "Usar dica" }));
    await waitFor(() => expect(screen.getByTestId("score")).toHaveTextContent("98"));
    expect(screen.getByTestId("remaining-helps")).toHaveTextContent("9");
    expect(screen.getByTestId("used-hints")).toHaveTextContent("1");
    expect(mocks.useGameSessionHint).toHaveBeenCalledWith(44, "101", 1, 98);

    await user.click(screen.getByRole("button", { name: "Errar resposta" }));
    await waitFor(() => expect(screen.getByTestId("score")).toHaveTextContent("97"));
    expect(mocks.saveGameSessionLevelScore).toHaveBeenCalledWith(44, "101", 97);

    await user.click(screen.getByRole("button", { name: "Acertar resposta" }));
    await user.click(screen.getByRole("button", { name: "Próximo nível" }));
    await waitFor(() => expect(screen.getByTestId("level")).toHaveTextContent("102"));
    expect(screen.getByTestId("score")).toHaveTextContent("97");
    expect(screen.getByTestId("used-hints")).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Acertar resposta" }));
    await waitFor(() => expect(screen.getByTestId("completed")).toHaveTextContent("true"));
    expect(screen.getByTestId("won")).toHaveTextContent("true");
    expect(mocks.completeGameSession).toHaveBeenCalledWith(44);
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("case_completed", expect.objectContaining({
      case_id: 1,
      score: 97,
    }));
  });

  it("restaura nível, pontuação e dicas de uma sessão retomada", async () => {
    const user = userEvent.setup();
    const identity = hostContexts[0];
    const resumableSession: ResumeFixture = {
      session: {
        id: 77,
        card_id: identity.cardId,
        player_id: identity.playerId,
        player_name: "Ana",
        case_id: 1,
        status: "in_progress",
        current_level_id: 102,
        score: 0,
        started_at: "2026-11-01T00:00:00.000Z",
        finished_at: null,
      },
      progress: [
        {
          id: 1,
          game_session_id: 77,
          level_id: 101,
          status: "completed",
          score: 84,
          started_at: "2026-11-01T00:00:00.000Z",
          completed_at: "2026-11-01T00:01:00.000Z",
        },
        {
          id: 2,
          game_session_id: 77,
          level_id: 102,
          status: "in_progress",
          score: 84,
          started_at: "2026-11-01T00:01:00.000Z",
          completed_at: null,
        },
      ],
      used_hints: [2],
      used_hint_count: 2,
    };
    mocks.getFctoolIdentity.mockReturnValue(identity);
    mocks.getConfiguredSessionContinuity.mockReturnValue(true);
    render(
      <GameProvider>
        <GameStateProbe identity={identity} resumableSession={resumableSession} />
      </GameProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Retomar partida" }));

    await waitFor(() => expect(screen.getByTestId("level")).toHaveTextContent("102"));
    expect(screen.getByTestId("score")).toHaveTextContent("84");
    expect(screen.getByTestId("remaining-helps")).toHaveTextContent("8");
    expect(screen.getByTestId("used-hints")).toHaveTextContent("2");
    expect(mocks.startGameSession).not.toHaveBeenCalled();
    expect(mocks.resumeFctoolGame).toHaveBeenCalledWith(expect.objectContaining({
      case_id: 1,
      card_id: identity.cardId,
      script_id: identity.scriptId,
    }));
  });
});
