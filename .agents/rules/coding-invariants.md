# Project Invariants & Coding Rules

## 1. React Rules of Hooks
- **No Hooks After Early Returns**: Always declare all React hooks (useState, useMemo, useEffect, useCallback, TanStack Router hooks) unconditionally at the top of the component before any conditional eturn statements (such as if (!data.enrolled) or if (!activeSubject)).
- **Stable Derived Objects**: Always wrap complex data transformations (like 
ew Map grouping or array sorting for subjects and subjectsMap) inside useMemo with explicit dependencies to avoid reference thrashing and TDZ (Temporal Dead Zone) errors.

## 2. Video Player & Security Invariants
- **Zero YouTube UI**: Keep custom HTML5 and YouTube players with 0% blur, 0% crop, and clean custom controls.
- **Dynamic Quality Matching**: Match actual video resolution (720p HD for 720p videos, with explicit HD badge).
- **No Copy Link**: Player control bar must never show copy link / share icons for paid classes.
- **Multi-layer Anti-Piracy**:
  - Keep keyboard inspection blockers (F12, Ctrl+Shift+I/J/C, Ctrl+U/S/P).
  - Keep right-click context menu blockers on player canvases.
  - Keep useDevToolsGuard with DevToolsSecurityOverlay blackout shield when DevTools is opened.
  - Keep DynamicWatermark with student Name, Phone, and User ID floating across the canvas.
- **Learning Progress**: Keep "Mark as Complete" buttons, completion state persistence in localStorage, and progress tracking across portal cards and theater modal.
- **Live Class Badge**: Keep shining live badges and chronological sequence sorting.

## 3. Fast Refresh & Module Cleanliness
- Component files (e.g. ideo-player.tsx) must only export React components to avoid breaking Vite React Fast Refresh HMR boundaries. All helper functions must remain module-private or in dedicated .ts library files.
