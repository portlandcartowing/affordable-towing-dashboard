// ---------------------------------------------------------------------------
// Load board integration layer — STRUCTURE ONLY.
//
// This file defines the shape of the load-board posting workflow so the UI
// and database can be built against a stable contract. Real providers
// (Central Dispatch, uShip, etc.) plug in as adapters that implement the
// LoadBoardAdapter interface. No third-party APIs are called yet.
// ---------------------------------------------------------------------------

import type { DispatchPost, Job, LoadBoardProvider } from "./types";

export interface LoadBoardPostInput {
  job: Job;
  price_offered: number;
  driver_pay: number;
  notes?: string;
}

export interface LoadBoardAdapter {
  provider: LoadBoardProvider;
  label: string;

  /** Push a job to the provider and return a DispatchPost record. */
  post(input: LoadBoardPostInput): Promise<DispatchPost>;

  /** Remove / withdraw a posting. */
  withdraw(post: DispatchPost): Promise<DispatchPost>;

  /** Refresh status from the provider (accepted, expired, etc). */
  sync(post: DispatchPost): Promise<DispatchPost>;
}

// ---------------------------------------------------------------------------
// Adapters registry — populated as real integrations land.
// ---------------------------------------------------------------------------

const adapters = new Map<LoadBoardProvider, LoadBoardAdapter>();

export function registerAdapter(adapter: LoadBoardAdapter) {
  adapters.set(adapter.provider, adapter);
}

export function getAdapter(provider: LoadBoardProvider): LoadBoardAdapter | null {
  return adapters.get(provider) ?? null;
}

export function listAdapters(): LoadBoardAdapter[] {
  return Array.from(adapters.values());
}

// ---------------------------------------------------------------------------
// Stub adapter — lets the UI render before real providers exist.
// ---------------------------------------------------------------------------

export const stubCentralDispatchAdapter: LoadBoardAdapter = {
  provider: "central_dispatch",
  label: "Central Dispatch",
  async post() {
    throw new Error("Central Dispatch integration not implemented yet");
  },
  async withdraw(post) {
    return post;
  },
  async sync(post) {
    return post;
  },
};

export const AVAILABLE_PROVIDERS: { value: LoadBoardProvider; label: string }[] = [
  { value: "central_dispatch", label: "Central Dispatch" },
  { value: "uship", label: "uShip" },
  { value: "internal", label: "Internal Driver Pool" },
  { value: "other", label: "Other" },
];
