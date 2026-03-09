import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RealHandModal from "../pages/hands/RealHandModal";

const invokeMock = vi.fn();
const convertFileSrcMock = vi.fn((p: string) => `asset://${p}`);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => convertFileSrcMock(p),
}));

describe("RealHandModal OCR linked image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa get_hand_obs_image y muestra la captura OCR enlazada cuando existe", async () => {
    const linkedPath =
      "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260309\\errors\\20260309_073129_307358__mesa_2.bmp";

    invokeMock.mockImplementation((cmd: unknown) => {
      if (cmd === "get_hand_obs_image") {
        return Promise.resolve(linkedPath);
      }
      return Promise.resolve(null);
    });

    render(
      <RealHandModal
        open={true}
        dbPath="C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db"
        hand={{
          gamecode: "12098328818",
          hero_cards: "C8 C2",
          startdate: "2026-03-09 07:28:57",
        } as any}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    const getImageCall = invokeMock.mock.calls.find(
      (c) => c[0] === "get_hand_obs_image"
    );
    expect(getImageCall).toBeTruthy();

    expect(getImageCall?.[1]).toEqual(
      expect.objectContaining({
        gamecode: "12098328818",
      })
    );

    expect(String((getImageCall?.[1] as any).dbPath || "")).toContain("poker_boss.db");

    await waitFor(() => {
      expect(convertFileSrcMock).toHaveBeenCalledWith(linkedPath);
    });

    expect(screen.getByText(/OCR capture relacionada/i)).toBeTruthy();
    expect(
      screen.queryByText(/No hay imagen OCR enlazada para esta mano/i)
    ).toBeNull();

    expect(
      screen.getByText(/20260309_073129_307358__mesa_2\.bmp/i)
    ).toBeTruthy();

    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain("asset://");
  });

  it("muestra mensaje vacío cuando get_hand_obs_image devuelve null", async () => {
    invokeMock.mockResolvedValue(null);

    render(
      <RealHandModal
        open={true}
        dbPath="C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db"
        hand={{
          gamecode: "12098328818",
          hero_cards: "C8 C2",
          startdate: "2026-03-09 07:28:57",
        } as any}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    const getImageCall = invokeMock.mock.calls.find(
      (c) => c[0] === "get_hand_obs_image"
    );
    expect(getImageCall).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getByText(/No hay imagen OCR enlazada para esta mano/i)
      ).toBeTruthy();
    });
  });
});
