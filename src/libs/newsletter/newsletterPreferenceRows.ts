type NewsletterPreferenceList = {
  description: string | null;
  id: string;
  name: string;
};

type NewsletterPreferenceSubscription = {
  listId: string;
  status: 'subscribed' | 'unsubscribed';
};

type NewsletterPreferenceSubscriber = {
  subscriptions: readonly NewsletterPreferenceSubscription[];
} | null;

/**
 * Maps newsletter lists and subscriber subscriptions into preference rows.
 *
 * @param lists - Newsletter lists to display
 * @param subscriber - Subscriber with list subscriptions
 * @returns Preference rows with subscribed set from subscription status
 */
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
