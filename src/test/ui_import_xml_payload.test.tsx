import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// IMPORTANT: mock Tauri invoke
const invokeMock = vi.fn(async () => "OK_MOCK");
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => invokeMock(...args),
}));

import HandsPage from "../pages/HandsPage";

function getLastInvoke() {
  const calls = invokeMock.mock.calls;
  if (!calls.length) return null;
  const last = calls[calls.length - 1];
  return { cmd: last[0], payload: last[1] };
}

describe("UI Import XML", () => {
  beforeEach(() => {
    invokeMock.mockClear();

    // Force REAL mode in UI
    localStorage.setItem("hands.mode", "REAL");
    localStorage.setItem("dbPath", "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db");
    localStorage.setItem("autoRefresh", "false");
  });

  it("click Import XML calls invoke() with non-empty folder + hero + dbPath", async () => {
    const user = userEvent.setup();
    render(<HandsPage />);

    const btn = await screen.findByRole("button", { name: /import xml/i });
    await user.click(btn);

    expect(invokeMock).toHaveBeenCalled();

    const last = getLastInvoke();
    expect(last).not.toBeNull();

    // We don't assume the exact command name because you may have import_xml_folder/import_and_link_real/etc.
    // But we DO require the payload to contain dbPath + folder + hero in some form.
    const payload = (last as any).payload || {};

    // dbPath key can be dbPath or db_path depending on your wiring
    const dbPath = payload.dbPath ?? payload.db_path ?? payload.db ?? "";
    expect(String(dbPath)).toMatch(/poker_boss\.db$/i);

    // folder key might be xmlFolder OR xmlDir OR folder depending on your current code
    const folder =
      payload.xmlFolder ?? payload.xml_dir ?? payload.xmlDir ?? payload.folder ?? payload.folderPath ?? "";

    // hero key might be hero OR heroName
    const hero = payload.hero ?? payload.heroName ?? payload.CHAMPION_HERO ?? "";

    // If this fails, vitest will show the payload so we can fix the exact key mismatch in 1 shot.
    expect(String(folder).trim().length).toBeGreaterThan(5);
    expect(String(hero).trim().length).toBeGreaterThan(0);
  });
});
