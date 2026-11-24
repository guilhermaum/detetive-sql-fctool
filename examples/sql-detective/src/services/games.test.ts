import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../api/config", () => ({
  default: {
    get: apiMocks.get,
    post: apiMocks.post,
    defaults: { baseURL: "https://api.example.test" },
  },
}));

import { findCases, findCasesByDifficulty, findGame, selectCaseForPlayer } from "./games";

describe("serviço de casos", () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
  });

  it("normaliza os formatos de resposta aceitos para a lista de casos", async () => {
    apiMocks.get.mockResolvedValue({
      data: {
        cases: [
          { id: 9, name: "Caso nove", description: "Descoberta", difficulty: "easy", level_count: "2" },
        ],
      },
    });

    await expect(findCases()).resolves.toEqual([
      {
        id: "9",
        name: "Caso nove",
        description: "Descoberta",
        difficulty: "easy",
        levelCount: 2,
      },
    ]);
  });

  it("filtra casos por dificuldade sem diferenciar maiúsculas", async () => {
    apiMocks.get.mockResolvedValue({
      data: [
        { id: 1, name: "Fácil", description: "", difficulty: "easy", level_count: 1 },
        { id: 2, name: "Difícil", description: "", difficulty: "hard", level_count: 3 },
      ],
    });

    await expect(findCasesByDifficulty("HARD")).resolves.toMatchObject([
      { id: "2", difficulty: "hard" },
    ]);
  });

  it("ordena níveis e converte a URL da imagem do caso em absoluta", async () => {
    apiMocks.get
      .mockResolvedValueOnce({
        data: {
          id: 4,
          name: "Caso quatro",
          description: "Descrição",
          difficulty: "medium",
          level_count: 2,
          database_image_url: "/cases/4/database-image",
        },
      })
      .mockResolvedValueOnce({ data: [{ id: 42, number: 2 }, { id: 41, number: 1 }] });

    await expect(findGame("4")).resolves.toMatchObject({
      id: "4",
      levels: ["41", "42"],
      last: 2,
      databaseImageUrl: "https://api.example.test/cases/4/database-image",
    });
    expect(apiMocks.get).toHaveBeenNthCalledWith(1, "/cases/4");
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, "/cases/4/levels");
  });

  it("envia os dados de identidade e a opção de repetição ao selecionar um caso", async () => {
    apiMocks.post.mockResolvedValue({ data: { case_id: 12, fallback_used: false } });

    await expect(selectCaseForPlayer({
      scriptId: "roteiro/1",
      cardId: "card 1",
      sessionId: "sessão",
      playerId: "aluna 1",
      difficulty: "medium",
      caseDistribution: "mesmo",
      selectionIndex: 2,
      allowReplaySameCase: true,
    })).resolves.toEqual({ case_id: 12, fallback_used: false });

    expect(apiMocks.post).toHaveBeenCalledWith("/cards/card%201/cases/select", {
      script_id: "roteiro/1",
      session_id: "sessão",
      player_id: "aluna 1",
      difficulty: "medium",
      case_distribution: "mesmo",
      selection_index: 2,
      allow_replay_same_case: "sim",
    });
  });
});
