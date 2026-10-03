// DGOS UI Component Library - Core Components
import React, { type ButtonHTMLAttributes, type HTMLAttributes, type PropsWithChildren } from 'react';

// Import accessibility styles
import './accessibility.css';

export function Button({variant='default',busy=false,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'default'|'primary'|'danger';busy?:boolean}){return <button {...props} disabled={busy||props.disabled} className={`dgos-button ${variant} ${props.className||''}`}>{busy?'…':children}</button>}
export function Panel({children,...props}:PropsWithChildren<HTMLAttributes<HTMLElement>>){return <section {...props} className={`dgos-panel ${props.className||''}`}>{children}</section>}
export function Status({value}:{value:string}){return <span className={`dgos-status ${/failed|denied|error|unavailable/.test(value)?'bad':/success|ready|enabled|active/.test(value)?'good':'neutral'}`}>{value}</span>}
export function Alert({children,kind='error'}:PropsWithChildren<{kind?:'error'|'info'}>){return <div role={kind==='error'?'alert':'status'} className={`dgos-alert ${kind}`}>{children}</div>}
export function Empty({children}:PropsWithChildren){return <p className="dgos-empty">{children}</p>}

// Export extended components
export * from './components.js';

// Export focus management and accessibility utilities
export * from './focus-management';

// Export new UX enhancement components
export * from './toast';
export * from './keyboard';
export * from './progress';
export * from './forms';

// Export icon components
export * from './icons';

// Export data display & layout components
export * from './data-table';
export * from './tree';
export * from './split-pane';
export * from './enhanced-tabs';
export * from './enhanced-breadcrumbs';
export * from './empty-state';
export * from './error-state';

// Export macOS core visual components
export * from './macos-window';
export * from './macos-traffic-lights';
export * from './macos-dock';
export * from './macos-system-bar';
