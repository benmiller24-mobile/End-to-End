/**
 * Tenant package manifest — CONFIGURATION, not code.
 * ===================================================
 * Each entry is a plain-data tenant package (what tools/ingest-spec-book.mjs
 * emits). Onboarding a new manufacturer = drop its package JSON in this
 * directory and list it here. Nothing else changes anywhere in the app:
 * the registry builds the catalog interface, the UI picker, order forms,
 * pricing lookups and evals all derive from the package data.
 */

export const TENANT_PACKAGES = [];
