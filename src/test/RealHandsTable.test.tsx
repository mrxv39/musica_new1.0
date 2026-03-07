import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const realHandModalMock = vi.fn();
const realHandsImageModalMock = vi.fn();
const realHandsTableBodyMock = vi.fn();
const realHandsTableSummaryMock = vi.fn();

vi.mock("../pages/hands/RealHandModal", () => ({
  default: (props: any) => {
    realHandModalMock(props);
    return <div data-testid="real-hand-modal" />;
  },
}));

vi.mock("../pages/hands/RealHandsImageModal", () => ({
  default: (props: any) => {
    realHandsImageModalMock(props);
    return <div data-testid="real-hands-image-modal" />;
  },
}));

vi.mock("../pages/hands/RealHandsTableBody", () => ({
  default: (props: any) => {
    realHandsTableBodyMock(props);
    return (
      <tbody>
        <tr>
          <td>
            <button onClick={() => props.onOpenHand(props.rows[0])}>Open hand</button>
            <button onClick={() => props.onOpenImage(props.rows[0])}>Open image</button>
            <button onClick={() => props.onOpenImage(props.rows[1])}>Open image empty</button>
          </td>
        </tr>
      </tbody>
    );
  },
}));

vi.mock("../pages/hands/RealHandsTableSummary", () => ({
  default: (props: any) => {
    realHandsTableSummaryMock(props);
    return <div data-testid="real-hands-summary" />;
  },
}));

import RealHandsTable from "../pages/hands/RealHandsTable";

describe("RealHandsTable", () => {
  const dbPath = "C:\\db\\poker_boss.db";

  const rows = [
    {
      id: 10,
      gamecode: "g1",
      startdate: "2026-03-07 10:00:00",
      sb: 0.5,
      bb: 1,
      hero_cards: "HA CK",
      flop: "",
      turn: "",
      river: "",
      room: "mesa 1",
      hero: "hero1",
      spot_png: "C:\\spots\\spot1.png",
    },
    {
      id: 11,
      gamecode: "g2",
      startdate: "2026-03-07 10:05:00",
      sb: 1,
      bb: 2,
      hero_cards: "DA SK",
      flop: "",
      turn: "",
      river: "",
      room: "mesa 2",
      hero: "hero2",
      spot_png: "",
    },
  ] as any[];

  beforeEach(() => {
    realHandModalMock.mockReset();
    realHandsImageModalMock.mockReset();
    realHandsTableBodyMock.mockReset();
    realHandsTableSummaryMock.mockReset();
  });

  it("renders table headers and summary", () => {
    render(<RealHandsTable rows={rows as any} dbPath={dbPath} />);

    expect(screen.getByText("Gamecode")).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByText("Blinds")).toBeTruthy();
    expect(screen.getByText("Hero cards")).toBeTruthy();
    expect(screen.getByText("Board")).toBeTruthy();
    expect(screen.getByText("Room/Hero")).toBeTruthy();
    expect(screen.getByTestId("real-hands-summary")).toBeTruthy();
  });

  it("passes rows and callbacks to RealHandsTableBody", () => {
    render(<RealHandsTable rows={rows as any} dbPath={dbPath} />);

    expect(realHandsTableBodyMock).toHaveBeenCalled();
    const props = realHandsTableBodyMock.mock.calls[0][0];
    expect(props.rows).toEqual(rows);
    expect(typeof props.getSpotPng).toBe("function");
    expect(typeof props.onOpenHand).toBe("function");
    expect(typeof props.onOpenImage).toBe("function");
  });

  it("opens RealHandModal with selected hand", () => {
    render(<RealHandsTable rows={rows as any} dbPath={dbPath} />);

    fireEvent.click(screen.getByRole("button", { name: "Open hand" }));

    const lastCall = realHandModalMock.mock.calls.at(-1)?.[0];
    expect(lastCall.open).toBe(true);
    expect(lastCall.dbPath).toBe(dbPath);
    expect(lastCall.hand).toEqual(rows[0]);
  });

  it("opens RealHandsImageModal when spot_png exists", () => {
    render(<RealHandsTable rows={rows as any} dbPath={dbPath} />);

    fireEvent.click(screen.getByRole("button", { name: "Open image" }));

    const lastCall = realHandsImageModalMock.mock.calls.at(-1)?.[0];
    expect(lastCall.open).toBe(true);
    expect(lastCall.imagePath).toBe("C:\\spots\\spot1.png");
    expect(String(lastCall.title)).toContain("id=10");
    expect(String(lastCall.title)).toContain("g1");
  });

  it("does not open RealHandsImageModal when spot_png is empty", () => {
    render(<RealHandsTable rows={rows as any} dbPath={dbPath} />);

    fireEvent.click(screen.getByRole("button", { name: "Open image empty" }));

    const lastCall = realHandsImageModalMock.mock.calls.at(-1)?.[0];
    expect(lastCall.open).toBe(false);
  });

  it("passes rowsCount and dbPath to summary", () => {
    render(<RealHandsTable rows={rows as any} dbPath={dbPath} />);

    const props = realHandsTableSummaryMock.mock.calls[0][0];
    expect(props.rowsCount).toBe(2);
    expect(props.dbPath).toBe(dbPath);
  });
});
