/** Narrative and roster content adapted from https://mitsailing.com/mitna/ and related MITNA pages. */

export const mitnaPageTitle = 'MITNA';

export const mitnaPageSubtitle = 'The MIT Nautical Association';

export const mitnaIntroParagraphs: readonly string[] = [
  'The MIT Nautical Association (MITNA) is a student-run club established in 1936 and the largest club on campus. We bring together sailors at all skill levels—from experienced racers to first-time beginners—to learn, grow, and compete together on the Charles River.',
  'Student officers lead MITNA and work alongside full-time staff and volunteers to support nautical activities for education and recreation. We welcome MIT undergraduate and graduate students, alumni, faculty, staff, and their immediate families.',
];

/** Third intro paragraph: link “please contact us” in the page component. */
export const mitnaIntroContactLinkSegments = {
  before:
    'Whether you’re interested in learning to sail, racing competitively, or simply enjoying time on the water, MITNA has something for everyone. If you have questions about MITNA, our programs, or the Sailing Pavilion, ',
  linkLabel: 'please contact us',
  after: ' or stop by the Pavilion to learn more.',
} as const;

export const mitnaExecCommitteesIntro =
  'The following list shows all MITNA Executive Committees from the current year back to 2005-2006. Each committee includes the Commodore, Vice-Commodore, Treasurer, Secretary, Racing Committee Chair, Team Racing Chair, Team Captains, and Members at Large.';

export type MitnaExecRole = { readonly label: string; readonly value: string };

export type MitnaExecCommittee = {
  readonly season: string;
  readonly roles: readonly MitnaExecRole[];
};

export const mitnaExecutiveCommittees: readonly MitnaExecCommittee[] = [
  {
    season: '2021-2022',
    roles: [
      { label: 'Commodore', value: 'Grace Mao' },
      { label: 'Vice-Commodore', value: 'Sam Bruce' },
      { label: 'Secretary', value: 'Sam Karlson' },
      { label: 'Treasurer', value: 'Julius Heitkoetter' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Zach Shapiro' },
      {
        label: 'Team Captains',
        value: 'Dana Haig, Jeremy McCullough, Veronika Silkin, Elissa Ito',
      },
      {
        label: 'Members at Large',
        value: 'Paige Omura, Gavin West, Ali Alrayes, Emily Haig, David Larson',
      },
    ],
  },
  {
    season: '2020-2021',
    roles: [
      { label: 'Commodore', value: 'Emily Haig' },
      { label: 'Vice-Commodore', value: 'Julia Wyatt' },
      { label: 'Secretary', value: 'Raymond Huffman' },
      { label: 'Treasurer', value: 'Dana Haig' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Zach Shapiro' },
      {
        label: 'Team Captains',
        value:
          'Emily Haig, Jeremy McCullough, Elizabeth Obermaier, Dana Haig, Maile Jim, John Ped',
      },
      {
        label: 'Members at Large',
        value:
          'Trevor Long, Gavin West, Annie Hughes, Alpha Sanneh, Anton Mazurenko',
      },
    ],
  },
  {
    season: '2019-2020',
    roles: [
      { label: 'Commodore', value: 'Emily Haig' },
      { label: 'Vice-Commodore', value: 'Julia Wyatt' },
      { label: 'Secretary', value: 'Raymond Huffman' },
      { label: 'Treasurer', value: 'Dana Haig' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Zach Shapiro' },
      {
        label: 'Team Captains',
        value: 'Emily Haig, Stephen Duncan, Brooke McGoldrick, John Ped',
      },
      {
        label: 'Members at Large',
        value:
          'Trevor Long, Gavin West, Annie Hughes, Alpha Sanneh, Anton Mazurenko',
      },
    ],
  },
  {
    season: '2018-2019',
    roles: [
      { label: 'Commodore', value: 'Emily Haig' },
      { label: 'Vice-Commodore', value: 'Julia Wyatt' },
      { label: 'Secretary', value: 'Dana Haig' },
      { label: 'Treasurer', value: 'Isabelle Yen' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Zach Shapiro' },
      {
        label: 'Team Captains',
        value: 'Sarah Caso, Sameena Shaffeeullah, Annie Hughes, Stephen Duncan',
      },
      {
        label: 'Members at Large',
        value:
          'Lisa Sukharev-Chuyan, Gavin West, Ali ElSeddik, Alpha Sanneh, Raymond Huffman',
      },
    ],
  },
  {
    season: '2017-2018',
    roles: [
      { label: 'Commodore', value: 'Trevor Long' },
      { label: 'Vice-Commodore', value: 'Annie Hughes' },
      { label: 'Secretary', value: 'Emily Haig' },
      { label: 'Treasurer', value: 'Tiffany Xi' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'David Larson' },
      {
        label: 'Team Captains',
        value:
          'Greta Farrell, Sameena Shaffeeullah, Annie Hughes, James Peraire',
      },
      {
        label: 'Members at Large',
        value:
          'Alex Bost, Hanna Vincent, Eric Gibber, Alpha Sanneh, Nathan Volchko',
      },
    ],
  },
  {
    season: '2016-2017',
    roles: [
      { label: 'Commodore', value: 'Trevor Long' },
      { label: 'Vice-Commodore', value: 'Tobias Kaiser' },
      { label: 'Secretary', value: 'David Larson' },
      { label: 'Treasurer', value: 'Sameena Shaffeeullah' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Jeff Dusek' },
      {
        label: 'Team Captains',
        value: 'Greta Farrell, Jordan Ladd, Jorlyn LeGarrec, Paige Omura',
      },
      {
        label: 'Members at Large',
        value:
          'Bill Herrington, Hanna Vincent, Eric Gibber, Karen Wepsic, Stewart Craig',
      },
    ],
  },
  {
    season: '2015-2016',
    roles: [
      { label: 'Commodore', value: 'Alexander Bost' },
      { label: 'Vice-Commodore', value: 'Tobias Kaiser' },
      { label: 'Secretary', value: 'David Larson' },
      { label: 'Treasurer', value: 'Paresh Malalur' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Jeff Dusek' },
      {
        label: 'Team Captains',
        value: 'Paige Omura, David Larson, Libby Zhang, Jorlyn Le Garrec',
      },
      {
        label: 'Members at Large',
        value:
          'David Strubbe, Hanna Vincent, Eric Gibber, Karen Wepsic, Stewart Craig',
      },
    ],
  },
  {
    season: '2014-2015',
    roles: [
      { label: 'Commodore', value: 'Paresh Malalur' },
      { label: 'Vice-Commodore', value: 'Matthew Davis' },
      { label: 'Secretary', value: 'Scarlett Koller' },
      { label: 'Treasurer', value: 'Tobias Kaiser' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Jeff Dusek' },
      { label: 'Team Captains', value: '' },
      {
        label: 'Members at Large',
        value:
          'David Strubbe, Stephanie Muto, Hanna Vincent, Colleen Harber, David Larson',
      },
    ],
  },
  {
    season: '2013-2014',
    roles: [
      { label: 'Commodore', value: 'Paresh Malalur' },
      { label: 'Vice-Commodore', value: 'Chloe Lepert' },
      { label: 'Secretary', value: 'Scarlett Koller' },
      { label: 'Treasurer', value: 'Rachel Reed' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Jeff Dusek' },
      {
        label: 'Team Captains',
        value:
          'David Alfonso, Iris Xu, Samantha Albright, Laura Dunphy, Hanna Vincent',
      },
      {
        label: 'Members at Large',
        value:
          'Steven Bussolari, Stephanie Muto, Bill Herrington, Tim Shephard, David Strubbe',
      },
    ],
  },
  {
    season: '2012-2013',
    roles: [
      { label: 'Commodore', value: 'Hanna Vincent' },
      { label: 'Vice-Commodore', value: 'Paresh Malalur' },
      { label: 'Secretary', value: 'Keith Winstein' },
      { label: 'Treasurer', value: 'Chloe Lepert' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Racing Chair', value: 'Jeff Dusek' },
      {
        label: 'Team Captains',
        value:
          'Andrew Sommer, Kelden Pehr, Mark Van de Loo, Hanna Vincent, Iris Xu',
      },
      {
        label: 'Members at Large',
        value:
          'Stephanie Muto, Steven Bussolari, Nazar Lubchenko, David Strubbe, Tim Shepard',
      },
    ],
  },
  {
    season: '2011-2012',
    roles: [
      { label: 'Commodore', value: 'Jeff Dusek' },
      { label: 'Vice-Commodore', value: 'Hanna Vincent' },
      { label: 'Secretary', value: 'Keith Winstein' },
      { label: 'Treasurer', value: 'Josh Leighton' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      {
        label: 'Team Captains',
        value: 'Eamon Glackin, Stephanie Tong, Jacqueline Soegaard',
      },
      {
        label: 'Members at Large',
        value: 'Stephanie Muto, Tom Rose, Ken Sovie, Matthew Wall, Simon Watts',
      },
    ],
  },
  {
    season: '2010-2011',
    roles: [
      { label: 'Commodore', value: 'Jeff Dusek' },
      { label: 'Vice-Commodore', value: 'Tom Rose' },
      { label: 'Treasurer', value: 'Keith Winstein' },
      { label: 'Secretary', value: 'Paresh Malalur' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Captains', value: '' },
      {
        label: 'Members at Large',
        value: 'Stephanie Muto, Ken Sovie, Matthew Wall, Simon Watts',
      },
    ],
  },
  {
    season: '2009-2010',
    roles: [
      { label: 'Commodore', value: 'Thomas Rose' },
      { label: 'Vice-Commodore', value: 'Jeff Dusek' },
      { label: 'Treasurer', value: 'Joshua Gordonson' },
      { label: 'Secretary', value: 'Mai Luo' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      {
        label: 'Team Captains',
        value: 'Vicki Lee, Toan Tran-Phu, Jamie Curran, Rachel Licht',
      },
      {
        label: 'Members at Large',
        value:
          'Matthew Wall, Stephanie Muto, Keith Winstein, Paresh Malalur, Matthew Pagan',
      },
    ],
  },
  {
    season: '2008-2009',
    roles: [
      { label: 'Commodore', value: 'Olivier Koch' },
      { label: 'Vice-Commodore', value: 'Paresh Malalur' },
      { label: 'Treasurer', value: 'Federico Villalpando' },
      { label: 'Secretary', value: 'Gregory Marton' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Captains', value: 'Jack Field, Julie Arsenault' },
      {
        label: 'Members at Large',
        value:
          'Eric Gibber, Melitta King, Alvar Saenz-Otero, Samantha Jane Scolamiero, Matthew Wall',
      },
    ],
  },
  {
    season: '2007-2008',
    roles: [
      { label: 'Commodore', value: 'Daniel Myers' },
      { label: 'Vice-Commodore', value: 'Olivier Koch' },
      { label: 'Treasurer', value: 'Federico Villalpando' },
      { label: 'Secretary', value: 'Gregory Marton' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Captains', value: 'Jack Field, Libby Palmer' },
      {
        label: 'Members at Large',
        value:
          'Eric Gibber, Melitta King, Alvar Saenz-Otero, Samantha Jane Scolamiero, Matthew Wall',
      },
    ],
  },
  {
    season: '2006-2007',
    roles: [
      { label: 'Commodore', value: 'Iason Hatzakis' },
      { label: 'Vice-Commodore', value: 'Daniel Myers' },
      { label: 'Treasurer', value: 'Olivier Koch' },
      { label: 'Secretary', value: 'Gregory Marton' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Captains', value: 'Jack Field, Libby Palmer' },
      {
        label: 'Members at Large',
        value:
          'Dwight Brown, Emanuela Giacometti, Melitta King, Matthew Wall, Alvar Saenz-Otero',
      },
    ],
  },
  {
    season: '2005-2006',
    roles: [
      { label: 'Commodore', value: 'Patrick Lam' },
      { label: 'Vice-Commodore', value: 'Ben Zeskind' },
      { label: 'Treasurer', value: 'Olivier Koch' },
      { label: 'Secretary', value: 'Iason Chatzakis' },
      { label: 'Racing Committee Chair', value: 'John Pratt' },
      { label: 'Team Captains', value: 'Jack Field, Libby Palmer' },
      {
        label: 'Members at Large',
        value:
          'Dwight Brown, Emanuela Giacometti, Melitta King, Steve Bussolari, Eric Gibber',
      },
    ],
  },
];

export const mitnaHatchAwardIntro =
  'At the annual meeting of the Association, the membership shall have the opportunity to recognize individuals who have made significant, extraordinary, and exemplary contributions to the programs and activities of the Association and the M.I.T. Sailing Pavilion through voting to bestow the M.I.T. Nautical Association Service Award. The current membership, guided by the spirit and example of previous selections, may use any criterion it wishes, remembering that a) the award may be presented to any friend of M.I.T. sailing, b) the award is not intended to recognize members of the Executive Committee or Pavilion staff for the normal performance of their duties, c) the award need not be presented every year or limited to one person per year, d) the award shall be presented to an individual only once.';

export const mitnaHatchAwardNoteSegments = {
  before:
    'The following list shows the outstanding MITNA members who have been recipients of the “Hatch Brown” M.I.T. Nautical Association Service Award since 1964. The current Executive Committee is working hard to ensure this list is complete, but ',
  linkLabel: 'please contact us',
  after: ' if you find any omissions or mistakes.',
} as const;

export type MitnaHatchAwardYear = {
  readonly year: number;
  /** `null` means no award was given that year. */
  readonly recipients: readonly string[] | null;
};

export const mitnaHatchAwardYears: readonly MitnaHatchAwardYear[] = [
  { year: 2023, recipients: ['Anselmo Cassiano Alves', 'Zachary Berzolla'] },
  { year: 2022, recipients: ['Francis Charles'] },
  { year: 2021, recipients: ['Yichi Zhang'] },
  { year: 2020, recipients: null },
  { year: 2019, recipients: ['Joe Zambella', 'John Keck'] },
  { year: 2018, recipients: ['Bill Harrington', 'Gary Lifton', 'Mark Throop'] },
  { year: 2016, recipients: ['Scott Dynes'] },
  { year: 2015, recipients: null },
  { year: 2014, recipients: null },
  {
    year: 2013,
    recipients: ['Ted Young', 'Keith Winstein', 'Kenneth Sovie', 'Tim Shepard'],
  },
  { year: 2011, recipients: ['Patrick Joyce'] },
  { year: 2007, recipients: ['Alvar Saenz-Otero'] },
  { year: 2005, recipients: ['Karen Wepsic'] },
  { year: 2003, recipients: ['Melitta King'] },
  { year: 2002, recipients: ['Bashar Zeitoon'] },
  { year: 2000, recipients: ['Stephen Slivan'] },
  { year: 1999, recipients: ['Jon E. Lendon', 'Grant Harris'] },
  { year: 1998, recipients: ['John C. Pratt'] },
  { year: 1997, recipients: ['Susan M. Ostrowski'] },
  { year: 1996, recipients: ['Matthew B. Wall'] },
  { year: 1995, recipients: ['H. Hatch Brown'] },
  { year: 1994, recipients: ['Kyle Welch'] },
  { year: 1993, recipients: ['Dwight Brown'] },
  { year: 1992, recipients: ['Ellen Lee Pratt'] },
  { year: 1991, recipients: ['Corey Baker', 'Eric Gibber'] },
  { year: 1990, recipients: ['Sharon Flanagan'] },
  { year: 1989, recipients: ['Janet Garman'] },
  { year: 1988, recipients: ['John Alba'] },
  { year: 1987, recipients: ['Nick Makris'] },
  { year: 1986, recipients: ['Peter Stasiowski'] },
  { year: 1985, recipients: ['Steve Ellis', 'Marianne Mc Gonigal'] },
  { year: 1984, recipients: ['Marco Hanig', 'Jim Gottwald'] },
  { year: 1983, recipients: ['Peter Volante', 'Josko Catapovich'] },
  { year: 1982, recipients: ['Stu Nelson'] },
  { year: 1980, recipients: ['Sally Huested'] },
  { year: 1979, recipients: ['Robert Collier'] },
  { year: 1978, recipients: ['Don Fellows'] },
  { year: 1977, recipients: ['Maria Bozzuto', 'Kevin Sullivan'] },
  { year: 1976, recipients: ['Tom Hutchins'] },
  { year: 1975, recipients: ['George Warren Smith'] },
  { year: 1974, recipients: ['Henry Hall'] },
  { year: 1973, recipients: ['Bill Upthegrove'] },
  { year: 1972, recipients: ['Glenda Ganny'] },
  { year: 1971, recipients: ['Roy Lobdell'] },
  { year: 1970, recipients: ['Terry Cronburg'] },
  { year: 1969, recipients: ['Robert Hobbs'] },
  { year: 1968, recipients: ['Ned Lenson'] },
  { year: 1967, recipients: ['Ed Shaw'] },
  { year: 1966, recipients: ['George M.C. Dowell'] },
  { year: 1964, recipients: ['George Buck', 'Richard Pober'] },
];
