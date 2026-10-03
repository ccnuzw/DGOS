// Beautiful App Icons for DGOS - Modern, Professional SVG Icons
import React from 'react';

// Base icon wrapper with gradient background
const IconWrapper: React.FC<{
  gradient: string;
  children: React.ReactNode;
  shadow?: string;
}> = ({ gradient, children, shadow = 'rgba(0,0,0,0.2)' }) => (
  <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={gradient} x1="0%" y1="0%" x2="100%" y2="100%">
        {children}
      </linearGradient>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.25"/>
      </filter>
    </defs>
    <rect width="58" height="58" rx="14" fill={`url(#${gradient})`} filter="url(#shadow)"/>
  </svg>
);

// Catalog Icon - Grid pattern
export function CatalogIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="catalog-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667EEA"/>
          <stop offset="100%" stopColor="#764BA2"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#catalog-gradient)"/>
      <rect x="14" y="14" width="12" height="12" rx="2" fill="white" fillOpacity="0.9"/>
      <rect x="32" y="14" width="12" height="12" rx="2" fill="white" fillOpacity="0.9"/>
      <rect x="14" y="32" width="12" height="12" rx="2" fill="white" fillOpacity="0.9"/>
      <rect x="32" y="32" width="12" height="12" rx="2" fill="white" fillOpacity="0.9"/>
    </svg>
  );
}

// Assistant Icon - Sparkle/AI symbol
export function AssistantIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="assistant-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B95"/>
          <stop offset="100%" stopColor="#B06AB3"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#assistant-gradient)"/>
      <path d="M29 12L31 22L41 24L31 26L29 36L27 26L17 24L27 22L29 12Z" fill="white" fillOpacity="0.95"/>
      <circle cx="21" cy="38" r="2" fill="white" fillOpacity="0.7"/>
      <circle cx="37" cy="38" r="2" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

// Tasks Icon - Checklist
export function TasksIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tasks-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4FACFE"/>
          <stop offset="100%" stopColor="#00F2FE"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#tasks-gradient)"/>
      <rect x="16" y="18" width="26" height="3" rx="1.5" fill="white" fillOpacity="0.9"/>
      <rect x="16" y="27" width="26" height="3" rx="1.5" fill="white" fillOpacity="0.9"/>
      <rect x="16" y="36" width="18" height="3" rx="1.5" fill="white" fillOpacity="0.9"/>
      <circle cx="12" cy="19.5" r="2.5" fill="white" fillOpacity="0.8"/>
      <circle cx="12" cy="28.5" r="2.5" fill="white" fillOpacity="0.8"/>
      <circle cx="12" cy="37.5" r="2.5" fill="white" fillOpacity="0.8"/>
    </svg>
  );
}

// Settings Icon - Gear
export function SettingsIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="settings-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A8A8A8"/>
          <stop offset="100%" stopColor="#6C6C6C"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#settings-gradient)"/>
      <circle cx="29" cy="29" r="6" fill="none" stroke="white" strokeWidth="2.5" strokeOpacity="0.9"/>
      <path d="M29 14v6M29 38v6M44 29h-6M20 29h-6M38.5 38.5l-4.2-4.2M23.7 23.7l-4.2-4.2M38.5 19.5l-4.2 4.2M23.7 34.3l-4.2 4.2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.9"/>
    </svg>
  );
}

// Providers Icon - Cloud/Connection
export function ProvidersIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="providers-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FA709A"/>
          <stop offset="100%" stopColor="#FEE140"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#providers-gradient)"/>
      <path d="M16 32c0-3 2-5 5-5 0-4 3-7 7-7s7 3 7 7c3 0 5 2 5 5s-2 5-5 5H21c-3 0-5-2-5-5z" fill="white" fillOpacity="0.95"/>
      <circle cx="23" cy="28" r="1.5" fill="white" fillOpacity="0.7"/>
      <circle cx="29" cy="26" r="1.5" fill="white" fillOpacity="0.7"/>
      <circle cx="35" cy="28" r="1.5" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

// Models Icon - Layers
export function ModelsIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="models-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667EEA"/>
          <stop offset="100%" stopColor="#764BA2"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#models-gradient)"/>
      <rect x="16" y="20" width="26" height="6" rx="2" fill="white" fillOpacity="0.9"/>
      <rect x="18" y="28" width="22" height="5" rx="1.5" fill="white" fillOpacity="0.75"/>
      <rect x="20" y="35" width="18" height="4" rx="1.5" fill="white" fillOpacity="0.6"/>
    </svg>
  );
}

// Skills Icon - Puzzle piece
export function SkillsIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skills-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FD5E53"/>
          <stop offset="100%" stopColor="#FC9842"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#skills-gradient)"/>
      <path d="M18 18h10v10h-2a3 3 0 100 6h2v6h-10v-10h2a3 3 0 100-6h-2v-6z" fill="white" fillOpacity="0.95"/>
      <path d="M32 18h8v8h-8a3 3 0 110-6v-2z" fill="white" fillOpacity="0.85"/>
    </svg>
  );
}

// MCP Icon - Connected nodes
export function MCPIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mcp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ECDC4"/>
          <stop offset="100%" stopColor="#44A08D"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#mcp-gradient)"/>
      <circle cx="29" cy="29" r="4" fill="white" fillOpacity="0.95"/>
      <circle cx="20" cy="20" r="3" fill="white" fillOpacity="0.85"/>
      <circle cx="38" cy="20" r="3" fill="white" fillOpacity="0.85"/>
      <circle cx="20" cy="38" r="3" fill="white" fillOpacity="0.85"/>
      <circle cx="38" cy="38" r="3" fill="white" fillOpacity="0.85"/>
      <line x1="23" y1="22" x2="26" y2="27" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <line x1="35" y1="22" x2="32" y2="27" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <line x1="23" y1="36" x2="26" y2="31" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <line x1="35" y1="36" x2="32" y2="31" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
    </svg>
  );
}

// Developer Icon - Code brackets
export function DeveloperIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="developer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#11998E"/>
          <stop offset="100%" stopColor="#38EF7D"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#developer-gradient)"/>
      <path d="M22 20l-8 9 8 9M36 20l8 9-8 9" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.95"/>
      <line x1="32" y1="18" x2="26" y2="40" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.85"/>
    </svg>
  );
}

// System Info Icon
export function SystemIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="system-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667EEA"/>
          <stop offset="100%" stopColor="#764BA2"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#system-gradient)"/>
      <circle cx="29" cy="29" r="12" stroke="white" strokeWidth="2.5" strokeOpacity="0.9" fill="none"/>
      <circle cx="29" cy="29" r="2.5" fill="white" fillOpacity="0.95"/>
      <line x1="29" y1="17" x2="29" y2="22" stroke="white" strokeWidth="2" strokeOpacity="0.8"/>
      <line x1="29" y1="36" x2="29" y2="41" stroke="white" strokeWidth="2" strokeOpacity="0.8"/>
      <line x1="17" y1="29" x2="22" y2="29" stroke="white" strokeWidth="2" strokeOpacity="0.8"/>
      <line x1="36" y1="29" x2="41" y2="29" stroke="white" strokeWidth="2" strokeOpacity="0.8"/>
    </svg>
  );
}

// Download/Folder Icon
export function DownloadsIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="downloads-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4FACFE"/>
          <stop offset="100%" stopColor="#00F2FE"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#downloads-gradient)"/>
      <path d="M16 24h10l4-4h12v18H16V24z" fill="white" fillOpacity="0.9"/>
      <path d="M29 28v8m0 0l-3-3m3 3l3-3" stroke="#4FACFE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Trash Icon
export function TrashIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trash-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0E0E0"/>
          <stop offset="100%" stopColor="#BDBDBD"/>
        </linearGradient>
      </defs>
      <rect width="58" height="58" rx="14" fill="url(#trash-gradient)"/>
      <rect x="18" y="24" width="22" height="18" rx="2" fill="white" fillOpacity="0.95"/>
      <rect x="16" y="20" width="26" height="3" rx="1.5" fill="white" fillOpacity="0.9"/>
      <rect x="24" y="17" width="10" height="3" rx="1.5" fill="white" fillOpacity="0.8"/>
      <line x1="26" y1="28" x2="26" y2="38" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
      <line x1="32" y1="28" x2="32" y2="38" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
    </svg>
  );
}
