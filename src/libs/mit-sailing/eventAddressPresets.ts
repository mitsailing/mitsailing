import { EventAddressPreset } from '@/generated/prisma/enums';

export type EventAddressFields = {
  addressName: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
};

const pavilionAddress: EventAddressFields = {
  addressName: 'MIT Sailing Pavilion',
  addressLine1: '134 Memorial Drive',
  addressLine2: '',
  addressCity: 'Cambridge',
  addressState: 'MA',
  addressPostalCode: '02139',
  addressCountry: 'US',
};

const bluewaterAddress: EventAddressFields = {
  addressName: 'Boston Waterboat Marina',
  addressLine1: '66 Long Wharf',
  addressLine2: '',
  addressCity: 'Boston',
  addressState: 'MA',
  addressPostalCode: '02110',
  addressCountry: 'US',
};

export function eventAddressPresetFields(
  preset: EventAddressPreset
): EventAddressFields | null {
  if (preset === EventAddressPreset.pavilion) {
    return pavilionAddress;
  }
  if (preset === EventAddressPreset.bluewater) {
    return bluewaterAddress;
  }
  return null;
}
