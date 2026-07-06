export type CashCloseDraft = {
  closingCountedCash: string;
  closingCountedCard: string;
  closingCountedTransfer: string;
  closingNotes: string;
  updatedAt: string;
};

const draftKey = (sessionId: string) => `pos-cash-close-draft:${sessionId}`;

export function readCashCloseDraft(sessionId: string): CashCloseDraft | null {
  if (typeof window === 'undefined' || !sessionId) return null;

  try {
    const raw = sessionStorage.getItem(draftKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CashCloseDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCashCloseDraft(
  sessionId: string,
  draft: Omit<CashCloseDraft, 'updatedAt'>
) {
  if (typeof window === 'undefined' || !sessionId) return;

  const hasContent =
    draft.closingCountedCash.trim() ||
    draft.closingCountedCard.trim() ||
    draft.closingCountedTransfer.trim() ||
    draft.closingNotes.trim();

  if (!hasContent) {
    sessionStorage.removeItem(draftKey(sessionId));
    return;
  }

  sessionStorage.setItem(
    draftKey(sessionId),
    JSON.stringify({
      ...draft,
      updatedAt: new Date().toISOString(),
    } satisfies CashCloseDraft)
  );
}

export function clearCashCloseDraft(sessionId: string) {
  if (typeof window === 'undefined' || !sessionId) return;
  sessionStorage.removeItem(draftKey(sessionId));
}
