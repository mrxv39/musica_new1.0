import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HandsToolbarObs from "../pages/hands/HandsToolbarObs";

describe("HandsToolbarObs", () => {
  const baseProps = {
    canLoad: true,
    busy: false,
    onRunBatch: vi.fn(),
    workersRunning: false,
    onToggleWorkers: vi.fn(),
    stackEfRangeText: "",
    onChangeStackEfRangeText: vi.fn(),
    betRangeText: "",
    onChangeBetRangeText: vi.fn(),
    rangeListText: "",
    onChangeRangeListText: vi.fn(),
    linkFilter: "all" as const,
    onChangeLinkFilter: vi.fn(),
    onClearFilters: vi.fn(),
  };

  it("renders the Enlace select with all expected options", () => {
    render(<HandsToolbarObs {...baseProps} />);

    const select = screen.getByRole("combobox");
    const allOption = screen.getByRole("option", { name: "Todas" }) as HTMLOptionElement;
    const linkedOption = screen.getByRole("option", { name: "Enlazadas" }) as HTMLOptionElement;
    const unlinkedOption = screen.getByRole("option", { name: "No enlazadas" }) as HTMLOptionElement;

    expect(select).toBeTruthy();
    expect(allOption.value).toBe("all");
    expect(linkedOption.value).toBe("linked");
    expect(unlinkedOption.value).toBe("unlinked");
  });

  it("calls onChangeLinkFilter with linked when the user changes the select", () => {
    const onChangeLinkFilter = vi.fn();

    render(<HandsToolbarObs {...baseProps} onChangeLinkFilter={onChangeLinkFilter} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "linked" } });

    expect(onChangeLinkFilter).toHaveBeenCalledTimes(1);
    expect(onChangeLinkFilter).toHaveBeenCalledWith("linked");
  });
});
