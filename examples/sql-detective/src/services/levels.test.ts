import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../api/config", () => ({
  default: {
    get: apiMocks.get,
    post: apiMocks.post,
  },
}));

import { checkAnswers, findLevel } from "./levels";

describe("serviço de níveis", () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
  });

  it("converte dicas, problemas e ajudas do formato da API para o formato do jogo", async () => {
    apiMocks.get.mockResolvedValue({
      data: {
        id: 8,
        case_id: "3",
        number: "2",
        tips: "Primeira pista\n\nSegunda pista",
        problems: ["Encontrar a testemunha"],
        template: { nome: "Ana" },
        helps: {
          help_table: "pessoas",
          help_column: "nome, cidade",
          help_operation: "LIKE",
        },
      },
    });

    await expect(findLevel("8/1")).resolves.toEqual({
      id: "8",
      case_id: 3,
      number: 2,
      tips: ["Primeira pista", "Segunda pista"],
      problems: ["Encontrar a testemunha"],
      template: { nome: "Ana" },
      helps: [
        { id: 1, title: "Quais tabelas devo usar na consulta?", tip: "pessoas" },
        { id: 2, title: "Quais colunas devo usar na consulta?", tip: "nome, cidade" },
        { id: 3, title: "Quais operadores devo usar na consulta?", tip: "LIKE" },
      ],
    });
    expect(apiMocks.get).toHaveBeenCalledWith("/levels/8%2F1");
  });

  it("envia respostas e pontuação ao endpoint de validação", async () => {
    apiMocks.post.mockResolvedValue({ data: { check: true } });

    await expect(checkAnswers(31, "level 4", ["Ana"], 87)).resolves.toBe(true);
    expect(apiMocks.post).toHaveBeenCalledWith(
      "/game-sessions/31/levels/level%204/check",
      { answers: ["Ana"], score: 87 },
    );
  });
});
