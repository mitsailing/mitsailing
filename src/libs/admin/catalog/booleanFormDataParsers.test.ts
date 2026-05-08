import { describe, expect, it } from 'vitest';
import { rawClassCategoryFromFormData } from '@/libs/admin/catalog/classCategoriesSchemas';
import { rawDonationFundFromFormData } from '@/libs/admin/catalog/donationFundsSchemas';
import { rawEventCategoryFromFormData } from '@/libs/admin/catalog/eventCategoriesSchemas';
import { rawSailingClassFromFormData } from '@/libs/admin/catalog/sailingClassesSchemas';
import { rawSiteAlertFromFormData } from '@/libs/admin/catalog/siteAlertSchemas';

type BooleanParserCase = {
  label: string;
  field: string;
  fields: readonly (readonly [string, string])[];
  parser: (formData: FormData) => Record<string, unknown>;
};

const booleanParserCases: readonly BooleanParserCase[] = [
  {
    label: 'donation fund visibility',
    field: 'isVisible',
    fields: [
      ['fundId', 'fund-1'],
      ['name', 'Fund'],
      ['description', 'Support sailing'],
      ['url', 'https://giving.mit.edu/'],
    ],
    parser: rawDonationFundFromFormData,
  },
  {
    label: 'event category visibility',
    field: 'isVisible',
    fields: [['name', 'Racing']],
    parser: rawEventCategoryFromFormData,
  },
  {
    label: 'class category visibility',
    field: 'isVisible',
    fields: [
      ['slug', 'intro'],
      ['name', 'Introduction'],
    ],
    parser: rawClassCategoryFromFormData,
  },
  {
    label: 'sailing class visibility',
    field: 'isVisible',
    fields: [
      ['name', 'Intro Sailing'],
      ['slug', 'intro-sailing'],
      ['classCategoryId', 'cc-introduction'],
      ['level', 'beginner'],
      ['description', 'Learn the basics'],
    ],
    parser: rawSailingClassFromFormData,
  },
  {
    label: 'site alert publication',
    field: 'isPublished',
    fields: [
      ['body', 'Notice'],
      ['startDate', '2026-01-01'],
      ['lastDate', '2026-12-31'],
    ],
    parser: rawSiteAlertFromFormData,
  },
];

function formDataForScenario(props: {
  scenario: BooleanParserCase;
  checked: boolean;
}) {
  const formData = new FormData();
  for (const [key, value] of props.scenario.fields) {
    formData.set(key, value);
  }
  formData.append(props.scenario.field, 'false');
  if (props.checked) {
    formData.append(props.scenario.field, 'true');
  }
  return formData;
}

describe('admin catalog boolean FormData parsers', () => {
  for (const scenario of booleanParserCases) {
    describe(scenario.label, () => {
      it('admin keeps checked browser checkbox payloads', () => {
        const raw = scenario.parser(
          formDataForScenario({ scenario, checked: true })
        );

        expect(raw[scenario.field]).toBe(true);
      });

      it('admin clears unchecked hidden fallback payloads', () => {
        const raw = scenario.parser(
          formDataForScenario({ scenario, checked: false })
        );

        expect(raw[scenario.field]).toBe(false);
      });
    });
  }
});
