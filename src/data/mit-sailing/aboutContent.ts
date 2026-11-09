/** Copy and structure adapted from mitsailing.com mission, history, staff, volunteer, and dock-hours pages. */

export const EXTERNAL = {
  volunteer: 'https://mitsailing.com/support/volunteer-teach/',
  calendar: 'https://mitsailing.com/calendar/',
  mission: 'https://mitsailing.com/mission/',
  history: 'https://mitsailing.com/home/history/',
  dockHours: 'https://mitsailing.com/dock-hours/',
} as const;

export const missionIntro =
  'The MIT Sailing Pavilion exists to serve the entire MIT community by providing inclusive access to sailing and opportunities to develop lifelong nautical skills. We welcome participants of all ages, experience levels, abilities, and affiliations, and are committed to making sailing accessible, educational, and rewarding for everyone.';

export const missionBody: string[] = [
  'Sailing is uniquely aligned with the MIT spirit. It is both physically and intellectually demanding, cultivating fitness, focus, and precision of thought while teaching leadership, teamwork, responsibility, and perseverance. These qualities make sailing not only a sport, but a powerful environment for learning and personal growth.',
  'Because success in sailing depends as much on judgment and collaboration as on strength, it brings together people across generations and roles. The MIT Sailing Pavilion is a rare setting where undergraduate and graduate students, faculty, staff, alumni, and family members learn, sail, and compete alongside one another on equal footing in a welcoming and supportive community.',
  'The Pavilion advances its mission through instructional classes, recreational and competitive programs, and the MIT Nautical Association (MITNA)—the largest recreational club on campus.',
];

export const missionPillars: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}[] = [
  {
    title: 'Learn to Sail',
    body: 'Instructional classes provide a structured, welcoming path for new sailors and opportunities for experienced sailors to refine their skills.',
  },
  {
    title: 'Sail for recreation or competition',
    body: 'From casual sailing to organized racing and special events, the Pavilion offers programs that support a wide range of interests and experience levels.',
  },
  {
    title: 'Join the MIT Nautical Association (MITNA)',
    body: 'MITNA supports recreational sailing at the Pavilion and serves as the primary membership organization for the MIT sailing community.',
    cta: { label: 'Learn about MITNA', href: '/mitna' },
  },
  {
    title: 'Rent the Pavilion',
    body: 'The MIT Sailing Pavilion is also available for private rentals, including MIT departments, alumni events, and community groups. Renting the Pavilion is a great way to enjoy the waterfront, sail with friends, or host a team-building event.',
  },
];

export const membershipSummary = {
  title: 'Pricing and sailing cards',
  body: 'MIT students and MIT Recreation members get Normal included. Pavilion racing and Thursday team racing are paid cards for Charles River racing only.',
  cta: { label: 'See pricing', href: '/pricing' },
  options: [
    {
      title: 'Normal',
      body: 'Pavilion sailing, classes, ratings, Charles River racing, and Mashnee, the 48-foot Boston Harbor blue-water sailboat, when approved.',
    },
    {
      title: 'Pavilion racing',
      body: 'Charles River racing and race classes. No Mashnee.',
    },
    {
      title: 'Thursday team racing',
      body: 'Thursday night series only. Not MIT Sailing Team. No Mashnee.',
    },
  ],
} as const;

export const historyBlocks: { year?: string; text: string }[] = [
  {
    year: '1935',
    text: 'The MIT Sailing Pavilion, the first facility built specifically for college sailing, was constructed in 1935 and is recognized as the birthplace of modern collegiate sailing. While several colleges had sailing clubs in the late 1800s, these were primarily social organizations of private boat owners. MIT’s Pavilion marked a shift toward organized, competitive sailing and helped launch what would become the Inter-Collegiate Sailing Association.',
  },
  {
    text: 'The first ten Dinghy Championships of the newly formed Intercollegiate Yacht Racing Association were sailed on the Charles River using MIT’s fleet of cat-rigged, wooden Tech Dinghies—vessels designed specifically for collegiate competition.',
  },
  {
    text: 'To this day, MIT hosts more college regattas than any other site in the country, continuing its legacy as a central venue for collegiate sailing.',
  },
  {
    year: '1994',
    text: 'The Pavilion hosted the first annual Women’s Singlehanded Championship in Laser Radials, reflecting MIT’s long-standing commitment to competitive sailing and inclusivity.',
  },
  {
    text: 'Beyond intercollegiate competition, the Pavilion has long served the broader sailing community. MIT provides practice time and facilities for local colleges and high schools that do not have boats or sites of their own. Teams from Northeastern University, Winsor Academy, and other schools regularly practice and race from the Pavilion.',
  },
  {
    text: 'Today, the Pavilion continues to be a hub of activity—from instructional classes and recreational sailing to varsity racing and community events—connecting generations of sailors on the Charles River.',
  },
];

export type StaffMember = {
  slug: string;
  name: string;
  role: string;
  /** Short excerpt for the About page staff grid. */
  bio?: string;
  imageSrc?: string;
  imageAlt?: string;
};

export function staffProfilePath(slug: string): string {
  return `/about/${slug}`;
}

export function getStaffBySlug(slug: string): StaffMember | undefined {
  return staff.find((s) => s.slug === slug);
}

export const staff: StaffMember[] = [
  {
    slug: 'matt-lindblad',
    name: 'Matt Lindblad',
    role: 'Cucchiaro Family Sailing Master',
    bio: 'Cucchiaro Family Sailing Master for MIT Sailing.',
  },
  {
    slug: 'stewart-craig',
    name: 'Stewart Craig',
    role: 'Dockmaster',
    bio: 'Dockmaster for the MIT Sailing Pavilion.',
  },
  {
    slug: 'hannah-agate',
    name: 'Hannah Agate',
    role: 'Education Coordinator',
    bio: 'Coordinates instructional programs and outdoor education at the Pavilion. She brings experience from youth sailing instruction, wilderness trip leadership, and a semester with Northwest Outward Bound focused on facilitation and group dynamics.',
    imageSrc:
      'https://wp.mitsailing.com/wp-content/uploads/494820664_465819853260957_2300588491250977308_n-edited.jpg',
    imageAlt: 'Hannah Agate, Education Coordinator at MIT Sailing',
  },
  {
    slug: 'dan-tucker',
    name: 'Dan Tucker',
    role: 'Weekend Dockmaster',
    bio: 'Supports fleet care, instruction, and member skill-building on weekends. His background spans racing, adaptive sailing and rigging, marine industry work, and teaching the Intermediate Sailing class to help sailors grow after their first rating.',
    imageSrc:
      'https://wp.mitsailing.com/wp-content/uploads/2024/02/DCT-Headshot-1024x942.jpg',
    imageAlt: 'Dan Tucker, Weekend Dockmaster at MIT Sailing',
  },
];

export const volunteerIntro =
  'The MIT Sailing Pavilion relies on the generosity and energy of volunteers to keep our community thriving. Our mission is to provide all members of the MIT community—regardless of age, experience, or ability—with opportunities to sail and develop their nautical skills. No matter how much time you can give, your involvement makes a meaningful difference—and we welcome volunteers at all levels!';

export const volunteerSections: {
  title: string;
  body: string;
  bullets?: string[];
  footnote?: string;
}[] = [
  {
    title: 'Share your skills: teaching',
    body: 'Have you completed one of our Learn-to-Sail classes or have sailing experience you’d like to share? Teaching is a rewarding way to pass on your knowledge and help others gain confidence on the water. To explore becoming an instructor, contact Hannah or Eric.',
  },
  {
    title: 'Support intercollegiate racing',
    body: 'During the Spring and Fall seasons, MIT hosts intercollegiate regattas nearly every weekend. Volunteers are essential to making these events successful. Tasks may include:',
    bullets: [
      'Serving on the race committee',
      'Driving the motorboat to set or adjust courses',
      'Recording finishes or managing the starting sequence',
      'Scoring or other supporting roles',
    ],
    footnote:
      'No experience? No problem! You’ll be paired with an experienced volunteer who will guide you through the process.',
  },
  {
    title: 'Explore other opportunities',
    body: 'If you don’t see a role that matches your interests, reach out to the MITNA Executive Committee. They can help you find a way to get involved that fits your schedule and skills.',
  },
];

export const dockHours = {
  lead: 'MIT TAs have Office Hours; MITNA volunteers and dockstaff have Dock Hours! During dock hours, our volunteers and staff will generally be available to help improve your skills, and, if you’re ready, they’ll administer the Provisional Rating Test. You can ask dockstaff or approved volunteers for testing and coaching at any time. We’ll do our best to accommodate you.',
  disclaimer:
    'Scheduled Dock Hours are when we’re most likely to be available. Dock Hours are never 100% guaranteed, especially when the weather is “sporty,” or the Pav is busy. Thanks for your understanding!',
  helmsman:
    'For your Helmsman test, there are no scheduled dock hours. You’ll need to be here when the conditions are suitable—i.e., consistently over 18 knots of wind.',
};
