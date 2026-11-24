import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FormCheck from "./index";

const mocks = vi.hoisted(() => ({
  useGame: vi.fn(),
  useSong: vi.fn(),
  checkAnswers: vi.fn(),
  emitFctoolEvent: vi.fn(),
  applySuccess: vi.fn(),
  applyFault: vi.fn(),
  playHitSong: vi.fn(),
  playErrorSong: vi.fn(),
}));

vi.mock("../../../context/game", () => ({ useGame: mocks.useGame }));
vi.mock("../../../context/song", () => ({ useSong: mocks.useSong }));
vi.mock("../../../services/levels", () => ({ checkAnswers: mocks.checkAnswers }));
vi.mock("../../../services/fctool", () => ({ emitFctoolEvent: mocks.emitFctoolEvent }));

describe("FormCheck", () => {
  beforeEach(() => {
    mocks.useGame.mockReturnValue({
      level: { id: "level-12", number: 3 },
      sessionId: 45,
      scoreGame: 100,
      applySuccess: mocks.applySuccess,
      applyFault: mocks.applyFault,
    });
    mocks.useSong.mockReturnValue({
      playHitSong: mocks.playHitSong,
      playErrorSong: mocks.playErrorSong,
    });
    mocks.checkAnswers.mockResolvedValue(true);
    mocks.applyFault.mockResolvedValue(undefined);
  });

  it("não envia respostas vazias e valida os campos obrigatórios", async () => {
    const user = userEvent.setup();
    render(<FormCheck template={{ nome: "Gabriel Braga" }} correct={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(mocks.checkAnswers).not.toHaveBeenCalled();
  });

  it("mostra erro, aplica a penalidade e registra resposta incorreta", async () => {
    const user = userEvent.setup();
    const correct = vi.fn();
    mocks.checkAnswers.mockResolvedValue(false);
    render(<FormCheck template={{ nome: "Gabriel Braga" }} correct={correct} />);

    await user.type(
      screen.getByRole("textbox", { name: "Valor para a coluna nome" }),
      "Pessoa errada",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(/Os valores informados não correspondem/)).toBeInTheDocument();
    expect(mocks.checkAnswers).toHaveBeenCalledWith(45, "level-12", ["Pessoa errada"], 100);
    expect(mocks.playErrorSong).toHaveBeenCalledTimes(1);
    expect(mocks.applyFault).toHaveBeenCalledTimes(1);
    expect(correct).not.toHaveBeenCalled();
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("answer_submitted", {
      submitted_line: JSON.stringify(["Pessoa errada"]),
      success: false,
      level_number: 3,
    });
  });

  it("aceita a resposta correta, avança e emite os eventos de conclusão", async () => {
    const user = userEvent.setup();
    const correct = vi.fn();
    render(<FormCheck template={{ nome: "Gabriel Braga" }} correct={correct} />);

    await user.type(
      screen.getByRole("textbox", { name: "Valor para a coluna nome" }),
      "Gabriel Braga",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(correct).toHaveBeenCalledTimes(1));
    expect(mocks.checkAnswers).toHaveBeenCalledWith(45, "level-12", ["Gabriel Braga"], 100);
    expect(mocks.playHitSong).toHaveBeenCalledTimes(1);
    expect(mocks.applySuccess).toHaveBeenCalledTimes(1);
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("answer_submitted", {
      submitted_line: JSON.stringify(["Gabriel Braga"]),
      success: true,
      level_number: 3,
    });
    expect(mocks.emitFctoolEvent).toHaveBeenCalledWith("level_completed", {
      level_completed: 3,
      final_score: 100,
    });
  });
});
