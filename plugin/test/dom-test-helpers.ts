import { act } from "react";
import { expect } from "vitest";

/**
 * 模拟用户在受控 input 里打字：React 19 需要原生 value setter + input 事件，
 * 直接改 input.value 不会触发 onChange。两个 DOM seam 的测试共用这一处。
 */
export async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  expect(typeof setter).toBe("function");
  await act(async () => {
    setter!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
