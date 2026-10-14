import {useEffect,useRef,type ReactNode} from 'react';
export function PageFrame({title,description,children}:{title:string;description:string;children:ReactNode}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[title]);
  return <main id="top" className="page-frame"><header className="page-heading"><p className="eyebrow">GAPWITNESS / SEPOLIA TESTNET</p>
    <h1 ref={heading} tabIndex={-1}>{title}</h1><p>{description}</p></header>{children}</main>;
}
