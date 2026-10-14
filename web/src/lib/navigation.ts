import type { MouseEvent } from "react";

export type Page = 'home' | 'inspect' | 'review' | 'evidence' | 'publish' | 'verify' | 'datasets' | 'pilot' | 'status' | 'lab' | 'not-found';
export type Navigate = (view: Page, section?: string) => void;
export const PAGE_PATHS = { home: '/', inspect: '/inspect', review: '/review', evidence: '/evidence', publish: '/publish', verify: '/verify', datasets:'/datasets',pilot:'/pilot',status:'/status',lab: '/inspect', 'not-found': '/404' };

export function readPage(url: URL): Page {
  if (url.pathname === '/' && url.searchParams.get('view') === 'lab') return 'lab';
  const path = url.pathname.replace(/\/$/, '') || '/';
  return (Object.keys(PAGE_PATHS) as Page[]).find(page => page !== 'lab' && PAGE_PATHS[page] === path) ?? 'not-found';
}

export function navigateLink(event: MouseEvent<HTMLAnchorElement>, navigate: Navigate, view: Page, section?: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(view, section);
}

