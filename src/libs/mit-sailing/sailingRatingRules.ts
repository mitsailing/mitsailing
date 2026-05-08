export type SailingRatingRuleInput = {
  groupKey: string;
  sailingRatingId: string;
  displayOrder: number;
};

export type SailingRatingRuleGroup = {
  groupKey: string;
  ratings: { id: string; displayOrder: number }[];
};

export type SailingRatingGrantEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason: 'already_granted' | 'deprecated' | 'missing_prerequisites';
      missingRatingIds?: string[];
    };

export function groupSailingRatingRules(
  rules: readonly SailingRatingRuleInput[]
): SailingRatingRuleGroup[] {
  const groupOrder = new Map<string, number>();
  const grouped = new Map<string, SailingRatingRuleGroup>();

  for (const rule of rules) {
    if (!grouped.has(rule.groupKey)) {
      groupOrder.set(rule.groupKey, groupOrder.size);
      grouped.set(rule.groupKey, { groupKey: rule.groupKey, ratings: [] });
    }
    grouped.get(rule.groupKey)?.ratings.push({
      id: rule.sailingRatingId,
      displayOrder: rule.displayOrder,
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      ratings: group.ratings.toSorted(
        (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)
      ),
    }))
    .toSorted(
      (a, b) =>
        (groupOrder.get(a.groupKey) ?? 0) - (groupOrder.get(b.groupKey) ?? 0)
    );
}

export function listMissingRequiredRatingIds(
  rules: readonly SailingRatingRuleInput[],
  activeRatingIds: ReadonlySet<string>
): string[] {
  const missing: string[] = [];

  for (const group of groupSailingRatingRules(rules)) {
    const groupSatisfied = group.ratings.some((rating) =>
      activeRatingIds.has(rating.id)
    );
    if (!groupSatisfied) {
      missing.push(...group.ratings.map((rating) => rating.id));
    }
  }

  return missing;
}

export function evaluateSailingRatingGrantEligibility(props: {
  rules: readonly SailingRatingRuleInput[];
  activeRatingIds: ReadonlySet<string>;
  alreadyGranted: boolean;
  isDeprecated: boolean;
}): SailingRatingGrantEligibility {
  if (props.alreadyGranted) {
    return { eligible: false, reason: 'already_granted' };
  }
  if (props.isDeprecated) {
    return { eligible: false, reason: 'deprecated' };
  }

  const missingRatingIds = listMissingRequiredRatingIds(
    props.rules,
    props.activeRatingIds
  );

  if (missingRatingIds.length > 0) {
    return {
      eligible: false,
      reason: 'missing_prerequisites',
      missingRatingIds,
    };
  }

  return { eligible: true };
}
