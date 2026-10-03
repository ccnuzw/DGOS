// Professional macOS-style app icons for DGOS
// High-quality SVG icons with gradients and shadows
import React from 'react';

export const CatalogIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="catalog-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <filter id="catalog-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#catalog-grad)" filter="url(#catalog-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear1)" fillOpacity="0.3"/>
    <path d="M14 14h6v6h-6zM22 14h6v6h-6zM30 14h6v6h-6zM14 22h6v6h-6zM22 22h6v6h-6zM30 22h6v6h-6zM14 30h6v6h-6zM22 30h6v6h-6zM30 30h6v6h-6z"
          fill="white" opacity="0.9" />
    <defs>
      <linearGradient id="_Linear1" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const AssistantIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="assistant-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <filter id="assistant-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#assistant-grad)" filter="url(#assistant-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear2)" fillOpacity="0.3"/>
    <path d="M24 10l3 9h9l-7 6 3 9-8-6-8 6 3-9-7-6h9z" fill="white" opacity="0.95" />
    <defs>
      <linearGradient id="_Linear2" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const TasksIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tasks-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <filter id="tasks-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#tasks-grad)" filter="url(#tasks-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear3)" fillOpacity="0.3"/>
    <path d="M12 14h4v2h-4zM18 14h18v2H18zM12 22h4v2h-4zM18 22h18v2H18zM12 30h4v2h-4zM18 30h18v2H18z"
          fill="white" opacity="0.9" />
    <circle cx="14" cy="15" r="1" fill="white" />
    <circle cx="14" cy="23" r="1" fill="white" />
    <circle cx="14" cy="31" r="1" fill="white" />
    <defs>
      <linearGradient id="_Linear3" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const SettingsIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="settings-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
      <filter id="settings-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#settings-grad)" filter="url(#settings-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear4)" fillOpacity="0.3"/>
    <circle cx="24" cy="24" r="5" fill="none" stroke="white" strokeWidth="2" opacity="0.9" />
    <path d="M24 11v4M24 33v4M11 24h4M33 24h4M16.5 16.5l2.8 2.8M28.7 28.7l2.8 2.8M16.5 31.5l2.8-2.8M28.7 19.3l2.8-2.8"
          stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    <defs>
      <linearGradient id="_Linear4" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const ProvidersIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="providers-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#DB2777" />
      </linearGradient>
      <filter id="providers-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#providers-grad)" filter="url(#providers-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear5)" fillOpacity="0.3"/>
    <path d="M14 16h20v4H14zM14 22h20v4H14zM14 28h20v4H14z" fill="white" opacity="0.2" />
    <rect x="16" y="17" width="3" height="2" rx="1" fill="white" opacity="0.9" />
    <rect x="16" y="23" width="3" height="2" rx="1" fill="white" opacity="0.9" />
    <rect x="16" y="29" width="3" height="2" rx="1" fill="white" opacity="0.9" />
    <circle cx="28" cy="18" r="1.5" fill="white" opacity="0.9" />
    <circle cx="28" cy="24" r="1.5" fill="white" opacity="0.9" />
    <circle cx="28" cy="30" r="1.5" fill="white" opacity="0.9" />
    <defs>
      <linearGradient id="_Linear5" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const ModelsIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="models-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#0891B2" />
      </linearGradient>
      <filter id="models-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#models-grad)" filter="url(#models-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear6)" fillOpacity="0.3"/>
    <path d="M24 12l8 8-8 8-8-8z" fill="white" opacity="0.9" />
    <path d="M24 20l5 5-5 5-5-5z" fill="white" opacity="0.6" />
    <defs>
      <linearGradient id="_Linear6" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const SkillsIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skills-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
      <filter id="skills-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#skills-grad)" filter="url(#skills-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear7)" fillOpacity="0.3"/>
    <path d="M18 14h-4v8h4v-2h4v-4h-4zM30 14h4v8h-4v-2h-4v-4h4zM18 26h-4v8h4v-2h4v-4h-4zM30 26h4v8h-4v-2h-4v-4h4z"
          fill="white" opacity="0.9" />
    <defs>
      <linearGradient id="_Linear7" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const MCPIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mcp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
      <filter id="mcp-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#mcp-grad)" filter="url(#mcp-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear8)" fillOpacity="0.3"/>
    <circle cx="14" cy="24" r="3" fill="white" opacity="0.9" />
    <circle cx="24" cy="24" r="3" fill="white" opacity="0.9" />
    <circle cx="34" cy="24" r="3" fill="white" opacity="0.9" />
    <path d="M17 24h4M27 24h4" stroke="white" strokeWidth="2" opacity="0.9" />
    <defs>
      <linearGradient id="_Linear8" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

export const DeveloperIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="developer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#0D9488" />
      </linearGradient>
      <filter id="developer-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#developer-grad)" filter="url(#developer-shadow)" />
    <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#_Linear9)" fillOpacity="0.3"/>
    <path d="M18 18l-6 6 6 6M30 18l6 6-6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    <path d="M26 16l-4 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    <defs>
      <linearGradient id="_Linear9" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="rotate(135 24 24)">
        <stop offset="0" stopColor="white" stopOpacity="0.3"/>
        <stop offset="1" stopColor="white" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);
