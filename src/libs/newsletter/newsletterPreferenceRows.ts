type NewsletterPreferenceList = {
  description: string | null;
  id: string;
  name: string;
};

type NewsletterPreferenceSubscription = {
  listId: string;
  status: string;
};

type NewsletterPreferenceSubscriber = {
  subscriptions: readonly NewsletterPreferenceSubscription[];
} | null;

export function newsletterPreferenceRows(
  lists: readonly NewsletterPreferenceList[],
  subscriber: NewsletterPreferenceSubscriber
) {
  const subscriptions = new Map(
    (subscriber?.subscriptions ?? []).map((subscription) => [
      subscription.listId,
      subscription.status,
    ])
  );
  return lists.map((list) => ({
    description: list.description,
    id: list.id,
    name: list.name,
    subscribed: subscriptions.get(list.id) === 'subscribed',
  }));
}
