import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HandsTableHeader from "../pages/hands/HandsTableHeader";

describe("HandsTableHeader", () => {
  it("renders all column labels", () => {
    render(
      <table>
        <HandsTableHeader
          columns={[
            { id: "time", label: "Time", sortableKey: "time" as never },
            { id: "hand", label: "Hand", sortableKey: "hand" as never },
            { id: "img", label: "IMG" },
          ]}
        />
      </table>
    );

    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Hand")).toBeTruthy();
    expect(screen.getByText("IMG")).toBeTruthy();
  });

  it("calls onSort when sortable column is clicked", () => {
    const onSort = vi.fn();

    render(
      <table>
        <HandsTableHeader
          columns={[
            { id: "time", label: "Time", sortableKey: "time" as never },
            { id: "img", label: "IMG" },
          ]}
          onSort={onSort}
        />
      </table>
    );

    fireEvent.click(screen.getByText("Time"));
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith("time");
  });

  it("does not call onSort for non-sortable column", () => {
    const onSort = vi.fn();

    render(
      <table>
        <HandsTableHeader
          columns={[
            { id: "img", label: "IMG" },
          ]}
          onSort={onSort}
        />
      </table>
    );

    fireEvent.click(screen.getByText("IMG"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("shows active ascending arrow", () => {
    render(
      <table>
        <HandsTableHeader
          columns={[
            { id: "time", label: "Time", sortableKey: "time" as never },
          ]}
          sortKey={"time" as never}
          sortAsc={true}
          onSort={() => {}}
        />
      </table>
    );

    expect(screen.getByText("↑")).toBeTruthy();
  });

  it("shows active descending arrow", () => {
    render(
      <table>
        <HandsTableHeader
          columns={[
            { id: "time", label: "Time", sortableKey: "time" as never },
          ]}
          sortKey={"time" as never}
          sortAsc={false}
          onSort={() => {}}
        />
      </table>
    );

    expect(screen.getByText("↓")).toBeTruthy();
  });

  it("shows neutral arrow when sortable column is not active", () => {
    render(
      <table>
        <HandsTableHeader
          columns={[
            { id: "time", label: "Time", sortableKey: "time" as never },
            { id: "hand", label: "Hand", sortableKey: "hand" as never },
          ]}
          sortKey={"time" as never}
          sortAsc={true}
          onSort={() => {}}
        />
      </table>
    );

    expect(screen.getByText("↕")).toBeTruthy();
  });
});
