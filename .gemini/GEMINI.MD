# CancerCare Coding Guidelines (GEMINI.MD)

This document serves as a guide for Gemini to maintain consistency across the CancerCare codebase. Always refer to this file when starting a task.

---

## 1. Project Overview
CancerCare is a multi-domain companion app for cancer patients.
- **Domains**: Health, Clinical Trials, Files/Records, AI Chat.
- **Core Philosophy**: Clinical, calm, trustworthy, and stable.

## 2. Technical Stack
- **Frontend**: React 18 (CRA-style with `react-app-rewired`).
- **Styles**: Tailwind CSS + **DesignTokens** (CSS-in-JS tokens).
- **Backend**: Firebase (Firestore, Auth, Storage).
- **Visuals**: Lucide-react (Icons), Recharts (Health trends), Lottie (Animations).
- **Domain Specifics**: CornerstoneJS for DICOM/medical imaging.

---

## 3. Design Principles (CRITICAL)
**Always adhere to [THEME_USAGE_RULES](file:///Users/joe/CancerCare/THEME_USAGE_RULES).**

- **Anchor-First**: The app frame (navigation, headers, backgrounds, primary buttons) must be **Anchor (Charcoal)**.
- **Module Accents**: Use module colors **only** in accent slots:
  - **Health (Blue)**: Medical primary.
  - **Trials (Green)**: Care green.
  - **Files (Teal)**: Medical secondary.
- **No Over-Theming**: Do not use module colors for primary buttons, input focus rings, or main page backgrounds.
- **Design Tokens**: Always use `DesignTokens` from `@design/designTokens` rather than raw Tailwind classes for semantic components.

---

## 4. Coding Standards

### Components & Lifecycle
- Use **Functional Components** with standard Hooks (`useState`, `useEffect`, `useMemo`).
- **Organization**: Extract large sections from main view files into standalone components (e.g., `src/components/tabs/health/sections/`).
- **Mobile-First**: Ensure all UI changes are responsive and touch-friendly (min 44px hit targets).

### Data & Services
- **Service Layer**: Keep Firestore logic in `src/firebase/services/`. Do not call Firestore APIs directly from components.
- **Activity Logging**: For significant user actions (add/update/delete), always:
  1. Call the relevant service (e.g., `medicationService`).
  2. Log the activity using `medicationActivityService` or equivalent.
  3. Add a summary to `journalNoteService` if it impacts the patient's record.

### State Management
- Use Context Providers for global state:
  - `AuthContext`: User authentication state.
  - `BannerContext`: Success/Error notifications (`showSuccess`, `showError`).

---

## 5. Gemini-Specific Instructions

1. **Research First**: Check KIs and existing files before proposing changes.
2. **Implementation Plans**: For complex tasks, create a plan and link to file paths in markdown format.
3. **Verify UI**: Use the browser tool to verify UI changes, especially centering and mobile responsiveness.
4. **Commits**: Use descriptive, multi-line commit messages with clear bullet points.
5. **Consistency**: If extending a feature (like adding a new frequency type), mirror the logic used in similar features (e.g., matching common medication scheduling patterns).

---
*Last updated: 2026-02-18 by Antigravity*
