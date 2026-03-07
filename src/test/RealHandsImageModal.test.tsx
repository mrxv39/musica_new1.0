import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import RealHandsImageModal from "../pages/hands/RealHandsImageModal";

describe("RealHandsImageModal", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("returns null when open=false", () => {
    const { container } = render(
      <RealHandsImageModal
        open={false}
        title="Mi imagen"
        imagePath="C:\\img.png"
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("loads image base64 and renders img when invoke succeeds", async () => {
    invokeMock.mockResolvedValue("ZmFrZQ==");
    const imagePath = "C:\\img.png";

    render(
      <RealHandsImageModal
        open={true}
        title="Mi imagen"
        imagePath={imagePath}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/loading/i)).toBeTruthy();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("read_image_base64", {
        path: imagePath,
      });
    });

    const img = await screen.findByRole("img", { name: "Mi imagen" });
    expect(img.getAttribute("src")).toBe("data:image/png;base64,ZmFrZQ==");
  });

  it("shows error text when invoke fails", async () => {
    invokeMock.mockRejectedValue(new Error("boom image"));

    render(
      <RealHandsImageModal
        open={true}
        title="Mi imagen"
        imagePath="C:\\img.png"
        onClose={() => {}}
      />
    );

    expect(await screen.findByText("boom image")).toBeTruthy();
  });

  it("shows fallback text when imagePath is empty", () => {
    render(
      <RealHandsImageModal
        open={true}
        title="Sin path"
        imagePath=""
        onClose={() => {}}
      />
    );

    expect(screen.getByText("No image path.")).toBeTruthy();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();

    const { container } = render(
      <RealHandsImageModal
        open={true}
        title="Cerrar"
        imagePath=""
        onClose={onClose}
      />
    );

    const overlay = container.firstElementChild as HTMLElement;
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when inner panel is clicked", () => {
    const onClose = vi.fn();

    render(
      <RealHandsImageModal
        open={true}
        title="Panel"
        imagePath=""
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText("Panel"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();

    render(
      <RealHandsImageModal
        open={true}
        title="Cerrar botón"
        imagePath=""
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
