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
    cta: { label: 'Learn about MITNA', href: '/about/mitna' },
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

/** Inline hyperlink in a staff bio (URLs aligned with https://mitsailing.com/who-we-are/). */
export type StaffBioLink = { readonly label: string; readonly href: string };

/** One paragraph: plain text, or alternating text spans and links. */
export type StaffBioParagraph = string | readonly (string | StaffBioLink)[];

export type StaffMember = {
  slug: string;
  name: string;
  role: string;
  /** Short excerpt for the About page staff grid. */
  bio?: string;
  /** Full biography paragraphs for the staff profile page. */
  fullBio: StaffBioParagraph[];
  imageSrc?: string;
  imageAlt?: string;
  /** Contact address for mailto links on staff profile pages (seed data; replace in production). */
  email: string;
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
    fullBio: [
      'Matt Lindblad is the Cucchiaro Family Sailing Master for MIT Sailing.',
    ],
    email: 'matt.lindblad@example.com',
  },
  {
    slug: 'stewart-craig',
    name: 'Stewart Craig',
    role: 'Dockmaster',
    bio: 'Dockmaster for the MIT Sailing Pavilion.',
    fullBio: ['Stewart Craig is the Dockmaster for the MIT Sailing Pavilion.'],
    email: 'stewart.craig@example.com',
  },
  {
    slug: 'hannah-agate',
    name: 'Hannah Agate',
    role: 'Education Coordinator',
    bio: 'Coordinates instructional programs and outdoor education at the Pavilion. She brings experience from youth sailing instruction, wilderness trip leadership, and a semester with Northwest Outward Bound focused on facilitation and group dynamics.',
    imageSrc:
      'https://mitsailing.com/wp-content/uploads/494820664_465819853260957_2300588491250977308_n-edited.jpg',
    imageAlt: 'Hannah Agate, Education Coordinator at MIT Sailing',
    fullBio: [
      'I was first introduced the MIT Sailing Pavilion in 2018 when I joined as an instructor for the Charles River Sailing Academy, directed by varsity coach Mike Kalin. The community here was instantly apparent – so many people were here everyday to enjoy the river, to relax and to learn. I definitely wanted to be a part of it.',
      'Before moving to Cambridge, I had been raised in the Finger Lakes region of central New York, with the great fortune of having the crystal clear (and frigid!) shoreside of Skaneateles Lake nearby. I have fond memories of spending long afternoons alternating between swimming around for fossils, downwind landing the Sunfish (sorry Dad), and napping on the wood dock.',
      'I started falling in love with outdoor education during my college years. My first season of sailing instruction was during a youth camp in Vermont. We would swim out to the moorings to get to the boats and I admittedly spent a few late evenings studying points of sail and sailing jargon. I was also organizing and facilitating extended wilderness group trips, and spent many memorable days co-leading backcountry trips for groups of young women in the mountains and lakes of Maine and the Adirondacks.',
      'I also had the opportunity to spend a semester training with Northwest Outward Bound with a focus on outdoor education. My peers and I completed a curriculum rich in outdoor program facilitation, flexible lesson planning, and group dynamic management in some pretty wild conditions, all while living outdoors and backpacking for the duration of the semester.',
      'The recreational sailing program at MIT embodies everything I feel passionate about. The potential for personal growth in a new environment, alongside new friends or on our own, seems to bring out an ever-changing best version of ourselves. We can choose to tackle a tricky challenge, or choose to spend time relaxing in the flow, so that we can be the best version of ourselves in other aspects of our life.',
      'My current favorite Cambridge hobbies include: long walks on the Esplanade, loitering at Moonlight sails, and finding new places to eat soup dumplings.',
    ],
    email: 'hannah.agate@example.com',
  },
  {
    slug: 'dan-tucker',
    name: 'Dan Tucker',
    role: 'Weekend Dockmaster',
    bio: 'Supports fleet care, instruction, and member skill-building on weekends. His background spans racing, adaptive sailing and rigging, marine industry work, and teaching the Intermediate Sailing class to help sailors grow after their first rating.',
    imageSrc:
      'https://mitsailing.com/wp-content/uploads/2024/02/DCT-Headshot-1024x942.jpg',
    imageAlt: 'Dan Tucker, Weekend Dockmaster at MIT Sailing',
    fullBio: [
      [
        'I’ve been sailing since age 2, taught by my father, who taught himself to sail as a teenager in City Island, NY. “Sailing a canoe looked easier than paddling a canoe,” he said. Growing up day sailing on Long Island Sound with my Dad and knocking around on a ',
        {
          label: 'Sunfish',
          href: 'https://en.wikipedia.org/wiki/Sunfish_(sailboat)',
        },
        ', I got used to light & shifty winds, much like the Charles River. We would cruise to the Cape & Islands and Downeast Maine, with a modicum of racing thrown in on those club cruises. When I went to Northeastern University (B.S. Business ‘89), I confidently went to a Sailing Club meeting, down to ',
        {
          label: 'Community Boating',
          href: 'https://www.community-boating.org/',
        },
        '. I promptly t-boned an MIT Tech dinghy, putting a huge hole in the Tech. I was too embarrassed ever to return. Now, here I am, caring for the MIT fleets and repairing any such mishaps! Karma has a LONG memory…',
      ],
      [
        'After college, I volunteered to teach sailing at ',
        {
          label: 'Courageous Sailing Center',
          href: 'https://courageoussailing.org/',
        },
        ' in Charlestown. I started racing competitively there and soon expanded to racing ',
        { label: 'J/24s', href: 'https://j24usa.com/' },
        ', then ',
        { label: 'Viper 640', href: 'http://viper640.org/' },
        's, and then added big-boat buoy & distance racing. My Dad & I had taught my wife to sail along the way. A couple of years after she broke her back and became a wheelchair-using paraplegic, she realized that she missed competitive sailboat racing and got involved with a Paralympic Sailing campaign trying to get to the Athens Games. I used my racing experience as a coach for the team, developed adaptive equipment and rigging, and did a LOT of rigging and boat repair for 3 campaigns, as well as fundraising. Through the Beijing Games, I continued coaching and developing adaptive systems, and I rigged the team’s boat from a bare hull. That campaign culminated in a gold medal win. After that, I joined the marine industry, running Americas & Caribbean operations for a sailboat propeller manufacturer, then joined ',
        { label: 'Rondar Raceboats', href: 'http://rondarboats.com/' },
        ' marketing, selling, and supporting ',
        { label: 'Viper 640', href: 'http://viper640.org/' },
        ' & ',
        { label: 'Sonar', href: 'http://sonar.org/' },
        ' class associations and some collegiate dinghies in the Americas. That’s how I met Fran Charles, the previous MIT Sailing Master, who brought me to MIT Sailing after the pandemic.',
      ],
      [
        'I love boat repair, maintenance, and developing ways to keep our fleets easier to use and more reliable for our recreational and racing sailors. Rebuilding 30 Tech dinghy floors over the winter of 2023-24 was both a blast and a grind (Thank you, Hannah!!). As soon as we opened April 2023, my first season, I realized that we do an amazing job getting new sailors on the river, competent and confident. There was an obvious gap after that. And MIT folks are thirsty to learn. So I started teaching the ',
        {
          label: 'Intermediate Sailing',
          href: 'https://mitsailing.com/?page_id=77',
        },
        ' class, which was a missing link to further developing the skills and confidence of our new sailors. This has been an absolute joy for me! I didn’t realize how much I missed teaching, coaching, and developing new sailor’s skills until I dove into it again. It’s challenging, rewarding, and FUN to teach intelligent MITNA members who learn so quickly!',
      ],
    ],
    email: 'dan.tucker@example.com',
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
