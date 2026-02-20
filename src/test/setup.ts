// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\setup.ts
import { vi } from "vitest";

// Stub mínimo de navigator.clipboard para user-event
if (!(globalThis as any).navigator) {
  (globalThis as any).navigator = {};
}

if (!(navigator as any).clipboard) {
  (navigator as any).clipboard = {
    writeText: vi.fn(async () => undefined),
    readText: vi.fn(async () => ""),
  };
}
