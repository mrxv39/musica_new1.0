/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\StrategyPage.ui.flow.situations_and_subs.test.tsx
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import StrategyPage from "../src/pages/StrategyPage";

// ---- Mock DB boundary (src/pages/strategy/db) ----
const dbInit = vi.fn(async () => {});
const dbLoadSubs = vi.fn(async (_globalName: string) => ({
  globals: {
    GLOBAL: {
      name: "GLOBAL",
      subs: [
        // Una sub de una situation A
        {
          id: "db_1",
          name: "18_20_fish_fish",
          payload: { situacion: "SITU_A", p1_stack_min: 18, p1_stack_max: 20, p2_tipo: "fish", p3_tipo: "fish", orRanges: {} },
          or_ranges: [],
        },
        // Otra sub de situation B (NO debe aparecer cuando seleccionamos SITU_A)
        {
          id: "db_2",
          name: "20_75_unknown_unknown",
          payload: { situacion: "SITU_B", p1_stack_min: 20, p1_stack_max: 75, p2_tipo: "unknown", p3_tipo: "unknown", orRanges: {} },
          or_ranges: [],
        },
      ],
    },
  },
}));

const dbListSituations = vi.fn(async () => [
  { id: 1, key: "SITU_A", created_at: "", updated_at: "" },
  { id: 2, key: "SITU_B", created_at: "", updated_at: "" },
]);

const dbUpsertSituation = vi.fn(async (_k: string) => 123);
const dbRenameSituationKey = vi.fn(async (_a: string, _b: string) => {});
const dbDeleteSituationKey = vi.fn(async (_k: string, _opts?: any) => ({ deleted: true, subCount: 0 }));

const dbSaveSub = vi.fn(async (_item: any) => ({ situationKey: "SITU_A", name: "18_20_fish_fish" }));
const dbDeleteSub = vi.fn(async (_id: string) => {});

// el barrel real exporta más cosas, pero con esto basta para StrategyPage/useStrategyPage
vi.mock("../pages/strategy/db", () => ({
  dbInit,
  dbLoadSubs,
  dbListSituations,
  dbUpsertSituation,
  dbUpsertSituationKey: dbUpsertSituation,
  dbRenameSituationKey,
  dbDeleteSituationKey,
  dbSaveSub,
  dbDeleteSub,
}));

// ---- Mock StrategyEditor: botones que llaman callbacks reales ----
vi.mock("../strategy/components/StrategyEditor", () => {
  return {
    default: (props: any) => {
      const {
        situationOptions,
        onCreateSituation,
        onRenameSituation,
        onDeleteSituation,
        onDeleteSituationForce,
        onChange,
        value,
      } = props;

      return (
        <div>
          <div data-testid="situ-options">{(situationOptions ?? []).join(",")}</div>
          <div data-testid="situ-current">{String(value?.situacion ?? "")}</div>

          <button onClick={() => onCreateSituation("SITU_A")} aria-label="ui-create-situ">
            create-situ-a
          </button>

          <button onClick={() => onRenameSituation("SITU_A", "SITU_A_RENAMED")} aria-label="ui-rename-situ">
            rename-situ-a
          </button>

          <button onClick={() => onDeleteSituation("SITU_A")} aria-label="ui-delete-situ">
            delete-situ-a
          </button>

          <button onClick={() => onDeleteSituationForce("SITU_A")} aria-label="ui-delete-situ-force">
            delete-situ-a-force
          </button>

          <button
            onClick={() => onChange({ ...(value ?? {}), p1_stack_min: 18, p1_stack_max: 20, p2_tipo: "fish", p3_tipo: "fish", situacion: "SITU_A" })}
            aria-label="ui-edit-payload"
          >
            edit-payload
          </button>
        </div>
      );
    },
  };
});

// ---- Mock StrategySidebar: expone subs que recibe y botones ----
vi.mock("../pages/strategy/components/StrategySidebar", () => {
  return {
    default: (props: any) => {
      const { subs, onNew, onSave, onDelete } = props;

      return (
        <div>
          <div data-testid="sidebar-subs">
            {(subs ?? []).map((s: any) => String(s?.name ?? s?.id)).join("|")}
          </div>

          <button onClick={() => onNew()} aria-label="ui-new-sub">
            new-sub
          </button>
          <button onClick={() => onSave()} aria-label="ui-save-sub">
            save-sub
          </button>
          <button onClick={() => onDelete("db_1")} aria-label="ui-delete-sub">
            delete-sub
          </button>
        </div>
      );
    },
  };
});

// Preview y OrRangesPanel no nos importan en este flow
vi.mock("../pages/strategy/components/StrategyPreview", () => ({ default: () => <div /> }));
vi.mock("../strategy/components/OrRangesPanel", () => ({ default: () => <div /> }));

describe("StrategyPage UI flow: situations + subs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("load -> filtra subs por selectedSituationKey (no mezcla situations)", async () => {
    render(<StrategyPage />);

    // carga inicial
    expect(dbInit).toHaveBeenCalled();
    expect(dbLoadSubs).toHaveBeenCalled();

    // Forzamos tick para que preload de situations se aplique
    await act(async () => {});

    const sidebar = await screen.findByTestId("sidebar-subs");

    // Debe aparecer solo la sub de SITU_A (porque el hook setea situacion a la primera situation)
    // y NO la de SITU_B
    expect(sidebar.textContent || "").toContain("18_20_fish_fish");
    expect(sidebar.textContent || "").not.toContain("20_75_unknown_unknown");
  });

  it("situations: create/rename/delete llaman a DB con key correcta (no 'key vacío')", async () => {
    render(<StrategyPage />);

    await act(async () => {});

    fireEvent.click(screen.getByLabelText("ui-create-situ"));
    expect(dbUpsertSituation).toHaveBeenCalledWith("SITU_A");

    fireEvent.click(screen.getByLabelText("ui-rename-situ"));
    expect(dbRenameSituationKey).toHaveBeenCalledWith("SITU_A", "SITU_A_RENAMED");

    fireEvent.click(screen.getByLabelText("ui-delete-situ"));
    expect(dbDeleteSituationKey).toHaveBeenCalledWith("SITU_A", expect.anything());
  });

  it("subs: edit -> save manual llama dbSaveSub; delete llama dbDeleteSub", async () => {
    render(<StrategyPage />);

    await act(async () => {});

    // simulamos edición (marca dirty + payload completo)
    fireEvent.click(screen.getByLabelText("ui-edit-payload"));

    // guardado manual
    fireEvent.click(screen.getByLabelText("ui-save-sub"));
    expect(dbSaveSub).toHaveBeenCalled();

    // borrado sub
    fireEvent.click(screen.getByLabelText("ui-delete-sub"));
    expect(dbDeleteSub).toHaveBeenCalledWith("db_1");
  });
});
