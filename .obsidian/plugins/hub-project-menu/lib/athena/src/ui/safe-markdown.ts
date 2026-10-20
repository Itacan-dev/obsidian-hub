// Deliberately render generated text as inert text. Native Markdown rendering
// runs other plugins' postprocessors and is not a safe assistant-output boundary.
export function renderMessage(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
export function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = parent.ownerDocument.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node); return node;
}
export function button(parent: HTMLElement, text: string, action: () => void): HTMLButtonElement {
  const node = el(parent, "button", "hub-athena-button", text); node.type = "button"; node.addEventListener("click", action); return node;
}
export function label(parent: HTMLElement, text: string): HTMLLabelElement { return el(parent, "label", "hub-athena-label", text); }
