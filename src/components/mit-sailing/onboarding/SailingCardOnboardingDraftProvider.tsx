'use client';

import { createContext, useContext, useRef } from 'react';
import type { SailingCardOnboardingFormValues } from '@/libs/mit-sailing/sailingCardOnboardingActions';

export type SailingCardOnboardingMemoryDraft = {
  readonly detailsUnlocked: boolean;
  readonly values: SailingCardOnboardingFormValues;
};

type SailingCardOnboardingDraftStore = {
  readonly getDraft: (
    draftKey: string | undefined
  ) => SailingCardOnboardingMemoryDraft | null;
  readonly saveDraft: (props: {
    readonly draft: SailingCardOnboardingMemoryDraft;
    readonly draftKey: string | undefined;
  }) => void;
};

const SailingCardOnboardingDraftContext =
  createContext<SailingCardOnboardingDraftStore | null>(null);

export function SailingCardOnboardingDraftProvider(props: {
  readonly children: React.ReactNode;
}) {
  const drafts = useRef(new Map<string, SailingCardOnboardingMemoryDraft>());
  const store = useRef<SailingCardOnboardingDraftStore | null>(null);

  store.current ??= {
    getDraft: (draftKey) => {
      if (draftKey === undefined) {
        return null;
      }
      return drafts.current.get(draftKey) ?? null;
    },
    saveDraft: (saveProps) => {
      if (saveProps.draftKey === undefined) {
        return;
      }
      drafts.current.set(saveProps.draftKey, saveProps.draft);
    },
  };

  return (
    <SailingCardOnboardingDraftContext.Provider value={store.current}>
      {props.children}
    </SailingCardOnboardingDraftContext.Provider>
  );
}

export function useSailingCardOnboardingDraftStore() {
  return useContext(SailingCardOnboardingDraftContext);
}
