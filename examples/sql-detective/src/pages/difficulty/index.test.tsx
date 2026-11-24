import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Difficulty from "./index";

const mocks = vi.hoisted(() => ({ getConfiguredGameConfiguration: vi.fn() }));

vi.mock("../../services/fctool", () => ({
  getConfiguredGameConfiguration: mocks.getConfiguredGameConfiguration,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderDifficulty() {
  return render(
    <MemoryRouter initialEntries={["/difficulty"]}>
      <Routes>
        <Route path="/difficulty" element={<Difficulty />} />
        <Route path="/cases" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Difficulty", () => {
  it.each([
    ["facil", "facil"],
    ["medio", "medio"],
    ["dificil", "dificil"],
  ])("aplica a dificuldade configurada %s", async (difficulty, routeDifficulty) => {
    const user = userEvent.setup();
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "single",
      difficulty,
      selection: "student",
      allowReplaySameCase: false,
    });
    renderDifficulty();

    const choices = screen.getAllByRole("button").filter((button) =>
      button.classList.contains("choice-card"),
    );
    expect(choices).toHaveLength(1);
    await user.click(choices[0]);
    expect(screen.getByTestId("location")).toHaveTextContent(`/cases?difficulty=${routeDifficulty}`);
  });

  it("permite escolher entre as dificuldades quando não há uma definida", () => {
    mocks.getConfiguredGameConfiguration.mockReturnValue({
      progression: "single",
      difficulty: null,
      selection: "individual",
      allowReplaySameCase: false,
    });
    renderDifficulty();

    expect(screen.getAllByRole("button").filter((button) =>
      button.classList.contains("choice-card"),
    )).toHaveLength(3);
  });
});
