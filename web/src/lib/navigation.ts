import type { MouseEvent } from "react";

export type Navigate = (view: "home" | "lab", section?: string) => void;

export function navigateLink(event: MouseEvent<HTMLAnchorElement>, navigate: Navigate, view: "home" | "lab", section?: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(view, section);
}

