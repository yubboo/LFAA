/** Web 产品入口实现；apps/web 只负责把 DOM root 交给这里。 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App.tsx";

export class LfaaWebEntry {
  readonly #element: HTMLElement;
  #root: Root | null = null;

  constructor(element: HTMLElement) { this.#element = element; }

  run(): void {
    if (this.#root) return;
    this.#root = createRoot(this.#element);
    this.#root.render(<StrictMode><App /></StrictMode>);
  }

  dispose(): void {
    this.#root?.unmount();
    this.#root = null;
  }
}
