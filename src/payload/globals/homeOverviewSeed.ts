/**
 * Seed for the homepage overview global (hours, steps, events panel).
 *
 * @returns Default homepage overview global values
 */
export function homeOverviewGlobalSeedData() {
  return {
    title: 'Pavilion Hours',
    subtitle: 'Open 7 days a week · April 1 – November 15',
    hoursNote:
      'Sunset times and daily open hours follow the table. Team practices run on a separate schedule.',
    schedule: [
      { day: 'Monday', hours: '3:00 pm – Sunset' },
      { day: 'Tuesday', hours: 'Noon – Sunset' },
      { day: 'Wednesday', hours: 'Noon – Sunset' },
      { day: 'Thursday', hours: 'Noon – Sunset' },
      { day: 'Friday', hours: 'Noon – Sunset' },
      { day: 'Saturday', hours: 'Noon – Sunset' },
      { day: 'Sunday', hours: 'Noon – Sunset' },
    ],
    stepsTitle: 'How to get on the water',
    steps: [
      {
        title: 'Create your account',
        description:
          'MIT students and MIT Recreation members get Normal included, including Charles River racing. Others can compare paid racing cards before requesting a card.',
      },
      {
        title: 'Take a beginner class',
        description:
          'Sign up for Learn to Sail or Intro for Experienced Sailors.',
      },
      {
        title: 'Get your rating and sail',
        description:
          'Pass your skills test, receive your rating, and book boats anytime.',
      },
    ],
    eventsTitle: 'Upcoming Events',
    eventCount: 4,
    eventsEmptyText: 'No events scheduled in the next 7 days.',
    eventsCtaLabel: 'View all events',
    eventsCtaUrl: '/events',
  };
}

export type HomeOverviewGlobalSeed = ReturnType<
  typeof homeOverviewGlobalSeedData
>;
