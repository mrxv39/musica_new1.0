import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import HandsPage from "../pages/HandsPage";

describe("UI Import XML", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();

    localStorage.setItem(
      "dbPath",
      "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db"
    );
  });

  it("click Import XML calls invoke() with non-empty folder + hero + dbPath", async () => {
    invokeMock.mockResolvedValue("ok");

    render(<HandsPage />);

    const modeSelect = screen.getByRole("combobox", { name: /modo/i });
    fireEvent.change(modeSelect, { target: { value: "REAL" } });

    const btn = await screen.findByRole("button", { name: /import xml/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(invokeMock.mock.calls.some((c) => c[0] === "import_champion_xml")).toBe(true);
    });

    const importCall = invokeMock.mock.calls.find((c) => c[0] === "import_champion_xml");
    expect(importCall).toBeTruthy();

    const payload = (importCall?.[1] as Record<string, unknown>) ?? {};

    const dbPath = payload.dbPath ?? payload.db_path ?? payload.db ?? "";
    expect(String(dbPath)).toMatch(/poker_boss\.db$/i);

    const folder =
      payload.xmlFolder ??
      payload.xmlDir ??
      payload.folder ??
      payload.xml_dir ??
      payload.xml_dir_path ??
      "";
    expect(String(folder).trim().length).toBeGreaterThan(0);

    const hero = payload.hero ?? payload.heroName ?? "";
    expect(String(hero).trim().length).toBeGreaterThan(0);
  });
});
