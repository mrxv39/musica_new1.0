import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const commonMock = vi.fn();
const obsMock = vi.fn();

vi.mock("../pages/hands/HandsToolbarCommon", () => ({
  default: (props: any) => {
    commonMock(props);
    return <div data-testid="hands-toolbar-common" />;
  },
}));

vi.mock("../pages/hands/HandsToolbarObs", () => ({
  default: (props: any) => {
    obsMock(props);
    return <div data-testid="hands-toolbar-obs" />;
  },
}));

import HandsToolbar from "../pages/hands/HandsToolbar";

describe("HandsToolbar", () => {
  const baseProps = {
    mode: "OBS" as const,
    onChangeMode: vi.fn(),
    canLoad: true,
    onRefresh: vi.fn(),
    auto: true,
    onToggleAuto: vi.fn(),
    status: "ok",
    busy: false,
    onReset: vi.fn(),
    onRunBatch: vi.fn(),
    workersRunning: false,
    onToggleWorkers: vi.fn(),
    stackEfRangeText: "20-40",
    onChangeStackEfRangeText: vi.fn(),
    betRangeText: "2-3",
    onChangeBetRangeText: vi.fn(),
    rangeListText: "AA,KK",
    onChangeRangeListText: vi.fn(),
    linkFilter: "all" as const,
    onChangeLinkFilter: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    commonMock.mockReset();
    obsMock.mockReset();
  });

  it("always renders HandsToolbarCommon", () => {
    render(<HandsToolbar {...baseProps} />);

    expect(screen.getByTestId("hands-toolbar-common")).toBeTruthy();
    expect(commonMock).toHaveBeenCalledTimes(1);
  });

  it("passes common props to HandsToolbarCommon", () => {
    render(<HandsToolbar {...baseProps} />);

    const props = commonMock.mock.calls[0][0];
    expect(props.mode).toBe("OBS");
    expect(props.canLoad).toBe(true);
    expect(props.auto).toBe(true);
    expect(props.status).toBe("ok");
    expect(props.isObs).toBe(true);
  });

  it("renders HandsToolbarObs in OBS mode", () => {
    render(<HandsToolbar {...baseProps} />);

    expect(screen.getByTestId("hands-toolbar-obs")).toBeTruthy();
    expect(obsMock).toHaveBeenCalledTimes(1);
  });

  it("passes OBS props to HandsToolbarObs", () => {
    render(<HandsToolbar {...baseProps} />);

    const props = obsMock.mock.calls[0][0];
    expect(props.canLoad).toBe(true);
    expect(props.busy).toBe(false);
    expect(props.workersRunning).toBe(false);
    expect(props.stackEfRangeText).toBe("20-40");
    expect(props.betRangeText).toBe("2-3");
    expect(props.rangeListText).toBe("AA,KK");
    expect(props.linkFilter).toBe("all");
  });

  it("does not render HandsToolbarObs in REAL mode", () => {
    render(<HandsToolbar {...baseProps} mode="REAL" />);

    expect(screen.queryByTestId("hands-toolbar-obs")).toBeNull();
    expect(obsMock).not.toHaveBeenCalled();

    const props = commonMock.mock.calls[0][0];
    expect(props.isObs).toBe(false);
  });
});
