---
project_name: 'writeteam'
user_name: 'Elij'
date: '2026-03-01'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 98
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Framework
- **Next.js** 16.1.6 (App Router, `src/proxy.ts` replaces deprecated middleware)
- **React** 19.2.3
- **TypeScript** ^5 (strict mode enabled)

### UI Layer
- **Tailwind CSS** v4 (with `@tailwindcss/postcss`, `tw-animate-css`, `@tailwindcss/typography`)
- **shadcn/ui** ^3.8.5 (new-york style, components in `src/components/ui/`)
- **Radix UI** ^1.4.3 (via `radix-ui` unified package)
- **Lucide React** ^0.575.0 (icons)
- **next-themes** ^0.4.6 (dark/light mode)

### Editor
- **TipTap** ^3.20.0 (StarterKit, CharacterCount, Highlight, Typography, Placeholder, BubbleMenu)

### Database & Auth
- **@supabase/supabase-js** ^2.97.0
- **@supabase/ssr** ^0.8.0 (server/client cookie-based auth)
