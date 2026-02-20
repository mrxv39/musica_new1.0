/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\StrategyPage.import.ui.more.test.tsx
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StrategyPage from "../pages/StrategyPage";

// ---- Mocks ----
const importGlobalJsonText = vi.fn(async (_text: string) => {});

vi.mock("../pages/strategy/useStrategyPage", () => {
  return {
    useStrategyPage: () => ({
      error: null,
      isLoading: false,

      subs: [],
      selectedId: null,
      setSelectedId: vi.fn(),
      editorValue: {} as any,
      setEditorValue: vi.fn(),
      orRanges: [],
      setOrRanges: vi.fn(),

      createNew: vi.fn(),
      duplicateSelected: vi.fn(),
      saveSelected: vi.fn(),
      copyPayloadJson: vi.fn(),
      exportGlobalJson: vi.fn(),
      importGlobalJsonText,
    }),
  };
});

vi.mock("../pages/strategy/components/StrategyHeader", () => {
  return {
    default: (props: any) => (
      <div>
        <button type="button" onClick={() => props.onImportClick()}>
          Import
        </button>
      </div>
    ),
  };
});

vi.mock("../strategy/components/StrategyEditor", () => {
  return { default: () => <div data-testid="editor" /> };
});
vi.mock("../pages/strategy/components/StrategySidebar", () => {
  return { default: () => <div data-testid="sidebar" /> };
});
vi.mock("../pages/strategy/components/StrategyPreview", () => {
  return { default: () => <div data-testid="preview" /> };
});

beforeEach(() => {
  importGlobalJsonText.mockClear();
});

describe("StrategyPage import flow", () => {
  it("clicking Import triggers hidden file input click (covers importClick)", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    render(<StrategyPage />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("file input onChange: no file => returns; file => calls importGlobalJsonText and clears input value", async () => {
    render(<StrategyPage />);

    const input = document.querySelector('input[type="file"][accept="application/json"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Caso 1: sin file => no llama
    fireEvent.change(input, { target: { files: [] } });
    expect(importGlobalJsonText).not.toHaveBeenCalled();

    // Caso 2: con file
    const file = new File(['{"ok":true}'], "global.json", { type: "application/json" });

    // En inputs file, value solo puede ser "" programáticamente.
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(importGlobalJsonText).toHaveBeenCalledTimes(1));
    expect(importGlobalJsonText).toHaveBeenCalledWith('{"ok":true}');
    expect(input.value).toBe("");
  });
});
