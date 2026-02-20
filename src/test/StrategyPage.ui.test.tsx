/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\StrategyPage.ui.test.tsx
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StrategyPage from "../pages/StrategyPage";

describe("StrategyPage UI", () => {
  it("renderiza sin crash y muestra el sidebar", () => {
    render(<StrategyPage />);
    expect(screen.getByText("Estrategia")).toBeTruthy();
    expect(screen.getByText("subestrategias")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
  });

  it("copy json existe en el sidebar", () => {
    render(<StrategyPage />);
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
  });

  it("al pulsar Guardar muestra feedback (éxito o error)", async () => {
    const user = userEvent.setup();
    render(<StrategyPage />);

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    // Feedback observable: puede ser éxito (Guardado...) o error (ERROR/boom/db save error)
    // Lo comprobamos en toda la pantalla, porque puede aparecer como toast o como status.
    const feedback = /guardado|error|boom|db save/i;

    // getAllByText lanza si no hay nada; así el test falla solo si NO hubo feedback.
    expect(screen.getAllByText(feedback).length).toBeGreaterThan(0);
  });
});
