import React, { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppWindow, Command, LayoutGrid, Settings, Sparkles, Cpu, Wrench, Shield, Activity, KeyRound, Blocks, Workflow, Code2, Info, Boxes, Palette } from 'lucide-react';
import { routes, type RouteKey } from '@dgos/design-tokens';
import { webHost } from '@dgos/host-adapter-web';

// Export macOS components
export * from './macos';
export { MacOSShell } from './macos';
export { MacOSSystemBar } from './macos/system-bar';
export { MacOSDock } from './macos/dock';
export { MacOSWindow } from './macos/window';
export { MacOSLaunchpad } from './macos/launchpad';
export { WindowManager, useWindowManager } from './macos/window-manager';

const icons={desktop:AppWindow,catalog:LayoutGrid,settings:Settings,system:Info,providers:Cpu,models:Boxes,protocols:Workflow,skills:Blocks,mcp:Workflow,assistant:Sparkles,tasks:Activity,developer:Code2,keys:KeyRound,governance:Shield,usage:Wrench,designSystem:Palette};
export const navGroups:RouteKey[][]=[['desktop','catalog','tasks','assistant'],['settings','providers','models','skills','mcp'],['developer','protocols','keys','governance','usage']];
export function useRoute(){const get=()=>Object.entries(routes).find(([,v])=>v===window.location.pathname)?.[0] as RouteKey||'desktop';const [route,setRoute]=useState<RouteKey>(get);useEffect(()=>{const fn=()=>setRoute(get());window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[]);return route}
export function Shell({route,labels,children,actions}:PropsWithChildren<{route:RouteKey;labels:Record<string,string>;actions?:React.ReactNode}>){
  const [palette,setPalette]=useState(false);
  const opener=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setPalette(value=>!value)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
  useEffect(()=>{if(!palette)return;const previous=document.activeElement as HTMLElement|null;const focusFrame=requestAnimationFrame(()=>dialog.current?.querySelector('button')?.focus());const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setPalette(false);return}if(event.key!=='Tab')return;const buttons=[...(dialog.current?.querySelectorAll('button')||[])];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1)?.focus()}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0]?.focus()}};document.addEventListener('keydown',key);return()=>{cancelAnimationFrame(focusFrame);document.removeEventListener('keydown',key);(opener.current||previous)?.focus()}},[palette]);
  return <div className="dgos-shell"><aside className="dgos-side"><div className="dgos-brand"><span className="brand-mark">D</span><strong>DGOS</strong></div><nav aria-label={labels.navigation}>{navGroups.map((group,i)=><div className="nav-group" key={i}>{group.map(key=>{const Icon=icons[key];return <a key={key} href={routes[key]} aria-current={route===key?'page':undefined} onClick={e=>{e.preventDefault();webHost.open(routes[key])}}><Icon size={17} aria-hidden="true"/><span>{labels[key]}</span></a>})}</div>)}</nav><button ref={opener} className="command-button" onClick={()=>setPalette(true)}><Command size={16}/><span>{labels.command}</span><kbd>⌘ K</kbd></button></aside><div className="dgos-main"><header className="dgos-top"><div><small>DGOS / {labels[route]}</small><h1>{labels[route]}</h1></div><div className="top-actions">{actions}</div></header><main id="content" className="dgos-content">{children}</main></div>{palette&&<div className="palette-backdrop" onClick={()=>setPalette(false)}><div ref={dialog} role="dialog" aria-modal="true" aria-label={labels.command} className="palette" onClick={e=>e.stopPropagation()}><h2>{labels.command}</h2>{navGroups.flat().map(key=><button key={key} onClick={()=>{webHost.open(routes[key]);setPalette(false)}}>{labels[key]}</button>)}</div></div>}</div>;
}
