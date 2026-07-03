import { assertWithinProjectBoundary } from "./path_guard.js";

export interface Cart {
  version: number;
  code: string[];
  gfx: number[][];
  flags: number[];
  map: number[][];
  sfx: unknown[];
  music: unknown[];
  label: number[][] | null;
}

export class CartRepo {
  async load(root: string, filePath: string): Promise<Cart> {
    await assertWithinProjectBoundary(root, filePath);
    throw new Error("Not implemented");
  }

  async save(root: string, filePath: string, _cart: Cart): Promise<void> {
    await assertWithinProjectBoundary(root, filePath);
    throw new Error("Not implemented");
  }
}
