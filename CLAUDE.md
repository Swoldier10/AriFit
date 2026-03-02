# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AriFit is a React Native fitness app with two user types (Trainer / Client). Built with Expo SDK 54, Expo Router 6, TypeScript, and Supabase for auth and database.

## Commands

- `npx expo start` — Start dev server
- `npx expo start --ios` / `--android` — Launch on simulator/emulator
- `npx tsc --noEmit` — Type-check (no test runner configured yet)
- `npx expo lint` — ESLint

## Architecture

**Auth flow:** `SessionProvider` (React Context) wraps the app and manages Supabase session state. `Stack.Protected` in the root layout declaratively gates routes — authenticated users see `(app)/`, unauthenticated users see `sign-in`/`sign-up`.

**Key files:**
- `lib/supabase.ts` — Supabase client with expo-sqlite KV store for session persistence + AppState auto-refresh
- `lib/auth-context.tsx` — `SessionProvider` + `useAuth()` hook (session, signIn, signUp, signOut)
- `constants/theme.ts` — Single source of truth for all design tokens (colors, fontSize, spacing, borderRadius). Import directly: `import { theme } from '@/constants/theme'`
- `app/_layout.tsx` — Root layout: wraps in SessionProvider, splits routes via Stack.Protected guards

**Sign-up** passes `userType` ('trainer' | 'client') via `options.data.user_type` metadata, which a Supabase DB trigger should copy into the `profiles` table.

## Conventions

- Path alias `@/*` maps to project root (configured in tsconfig.json)
- All styling uses `theme` constants — no hardcoded colors/spacing
- Environment variables prefixed with `EXPO_PUBLIC_` (loaded automatically by Expo)
- `.env` is git-ignored; `.env.example` is committed as a template
- New Architecture and React Compiler are enabled in app.json
- Typed routes enabled (`typedRoutes: true`)
