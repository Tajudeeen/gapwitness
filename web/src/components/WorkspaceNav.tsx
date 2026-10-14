import {navigateLink,PAGE_PATHS,type Page,type Navigate} from '../lib/navigation';
export function WorkspaceNav({page,navigate}:{page:Page;navigate:Navigate}) {
  return <header className="workspace-nav">
    <a className="workspace-brand" href="/" onClick={event=>navigateLink(event,navigate,'home')}><img src="/gapwitness-logo.svg" alt="" width="34" height="34"/>GapWitness</a>
    <nav aria-label="Workspace navigation">{(['inspect','review','evidence','publish','verify'] as Page[]).map(target=><a key={target}
      href={PAGE_PATHS[target]} aria-current={page===target || (page==='lab' && target==='inspect')?'page':undefined}
      onClick={event=>navigateLink(event,navigate,target)}>{target[0].toUpperCase()+target.slice(1)}</a>)}</nav>
    <span className="network-badge">Sepolia testnet</span>
    <nav className="workspace-secondary" aria-label="Evidence and operations navigation">{(['datasets','pilot','status'] as Page[]).map(target=><a key={target} href={PAGE_PATHS[target]}
      aria-current={page===target?'page':undefined} onClick={event=>navigateLink(event,navigate,target)}>{target==='datasets'?'Real datasets':target==='pilot'?'Reviewer pilot':'Service status'}</a>)}</nav>
  </header>;
}
