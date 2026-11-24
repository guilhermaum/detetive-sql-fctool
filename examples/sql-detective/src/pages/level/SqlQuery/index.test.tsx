import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SqlQuery from "./index";

const mocks = vi.hoisted(() => ({
  useGame: vi.fn(),
  executeLevelQuery: vi.fn(),
  emitFctoolEvent: vi.fn(),
}));

vi.mock("../../../context/game", () => ({ useGame: mocks.useGame }));
vi.mock("../../../services/game-sessions", () => ({ executeLevelQuery: mocks.executeLevelQuery }));
vi.mock("../../../services/fctool", () => ({ emitFctoolEvent: mocks.emitFctoolEvent }));

describe("SqlQuery", () => {
  beforeEach(() => {
    mocks.useGame.mockReturnValue({
      level: { id: "level-7" },
      sessionId: 23,
      databaseImageUrl: "https://example.test/schema.png",
    });
    mocks.executeLevelQuery.mockResolvedValue({
      result: [{ nome: "Ana", cidade: "Fortaleza" }],
      error: null,
    });
  });

  it("executa a consulta, mostra a tabela e limpa o formulário", async () => {
    const user = userEvent.setup();
    render(<SqlQuery />);
    const queryField = screen.getByPlaceholderText("SELECT * FROM relatorios_criminais LIMIT 1");
    await user.type(queryField, "SELECT nome, cidade FROM pessoas");
    await user.click(screen.getByRole("button", { name: "Executar" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "nome" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Fortaleza" })).toBeInTheDocument();
    expect(mocks.executeLevelQuery).toHaveBeenCalledWith(
      23,
      "level-7",
      "SELECT nome, cidade FROM pessoas",
    );
    expect(queryField).toHaveValue("");
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("sql_query_submitted", {
      query: "SELECT nome, cidade FROM pessoas",
      executed: true,
      error: "Sem erro de execução",
    });
  });

  it("exibe o erro da API e informa que a consulta não foi executada", async () => {
    const user = userEvent.setup();
    mocks.executeLevelQuery.mockRejectedValue({
      response: { data: { message: "Consulta inválida" } },
    });
    render(<SqlQuery />);
    await user.type(
      screen.getByPlaceholderText("SELECT * FROM relatorios_criminais LIMIT 1"),
      "DELETE FROM pessoas",
    );
    await user.click(screen.getByRole("button", { name: "Executar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Consulta inválida");
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("sql_query_submitted", {
      query: "DELETE FROM pessoas",
      executed: false,
      error: "Consulta inválida",
    });
  });

  it("abre e fecha o diagrama do banco quando há uma imagem configurada", async () => {
    const user = userEvent.setup();
    render(<SqlQuery />);
    await user.click(screen.getByRole("button", { name: "Esquema" }));

    const diagram = await screen.findByRole("img", {
      name: "Esquema do banco de dados deste caso",
    });
    expect(diagram).toHaveAttribute("src", "https://example.test/schema.png");

    const closeButton = diagram.closest(".bg-modal")?.querySelector("button");
    expect(closeButton).not.toBeNull();
    await user.click(closeButton!);
    await waitFor(() => expect(diagram).not.toBeInTheDocument());
  });
});
