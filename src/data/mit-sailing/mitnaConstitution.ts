/** Plain-text source: https://mitsailing.com/mitna-constitution/ */

export type MitnaConstitutionArticle = {
  readonly title: string;
  readonly sections: readonly {
    readonly heading?: string;
    readonly paragraphs: readonly string[];
  }[];
};

export const mitnaConstitutionArticles: readonly MitnaConstitutionArticle[] = [
  {
    title: 'ARTICLE I NAME',
    sections: [
      {
        paragraphs: [
          'The name of this organization shall be the Massachusetts Institute of Technology Nautical Association.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE II PURPOSE',
    sections: [
      {
        paragraphs: [
          'The purpose of the Association shall be to encourage and promote nautical activities in the interest of education and recreation.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE III MEMBERSHIP',
    sections: [
      {
        paragraphs: [
          'Membership in the Association shall be open to M.I.T. undergraduate and graduate students, alumni, faculty, staff, and members of their immediate families. Anyone eligible becomes a member of the Association upon payment of the fee specified by the Athletic Department for use of the facilities of the M.I.T. Sailing Pavilion.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE IV OFFICERS',
    sections: [
      {
        heading: 'Section 1',
        paragraphs: [
          'The Officers of the Association shall consist of a Commodore, a Vice Commodore, a Secretary, a Treasurer, and a Race Committee Chairman. The Commodore, Vice Commodore, Secretary, and Treasurer shall be full-time undergraduate or graduate student members of the Association. No member shall serve as Commodore for more than two full terms.',
        ],
      },
      {
        heading: 'Section 2',
        paragraphs: [
          'The Commodore shall preside at all meetings of the Association and the Executive Committee and enforce the regulations of the Association.',
        ],
      },
      {
        heading: 'Section 3',
        paragraphs: [
          'The Vice Commodore shall assist the Commodore in the performance of his duties and in the absence of the Commodore officiate in his stead.',
        ],
      },
      {
        heading: 'Section 4',
        paragraphs: [
          'The Secretary shall keep minutes of all meetings of the Association and the Executive Committee, carry on necessary correspondence, and publicize the meetings and activities of the Association.',
        ],
      },
      {
        heading: 'Section 5',
        paragraphs: [
          'The Treasurer shall keep records of the property of the Association and execute the financial business of the Association.',
        ],
      },
      {
        heading: 'Section 6',
        paragraphs: [
          'The Race Committee Chairman shall manage the competitive sailing activities of the Association.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE V EXECUTIVE COMMITTEE',
    sections: [
      {
        heading: 'Section 1',
        paragraphs: [
          'There shall be an Executive Committee of the Association consisting of the Officers of the Association, the men’s and women’s varsity sailing team captains, not more than five Representatives at Large, and the chairman of any standing committees appointed by the Commodore with the approval of the Executive Committee. Should the captain of a team be an officer of the Association the members of that team may elect an additional representative to the Executive Committee. The Sailing Master or his designated staff representative shall be an ex officio and nonvoting member of the Executive Committee.',
        ],
      },
      {
        heading: 'Section 2',
        paragraphs: [
          'The Executive Committee shall have full charge of the general policy and management of the Association between meetings of the Association and shall make an annual report of its activities.',
        ],
      },
      {
        heading: 'Section 3',
        paragraphs: [
          'The Executive Committee shall meet at the request of any three of its members and at least once in each of the fall, winter, and spring seasons. All members of the Executive Committee shall be given proper notice of all Executive Committee meetings. The Executive Committee may adopt such other rules for the conduct of its business as it deems advisable.',
        ],
      },
      {
        heading: 'Section 4',
        paragraphs: [
          'The Executive Committee shall make recommendations to the Sailing Master on matters concerning the operation of the Sailing Pavilion and the use of its facilities and resources by members of the Association.',
        ],
      },
      {
        heading: 'Section 5',
        paragraphs: [
          'The Executive Committee may assess a member responsible for avoidable damage to property owned or controlled by the Association for the cost of such damage.',
        ],
      },
      {
        heading: 'Section 6',
        paragraphs: [
          'The Executive Committee may recommend to the Sailing Master that a member be expelled for cause after due hearing.',
        ],
      },
      {
        heading: 'Section 7',
        paragraphs: [
          'Tenure of office for the Officers and Representatives at Large shall be approximately one year beginning on the day following their election. The Executive Committee may, by vote, fill any vacancies that occur between annual meetings of the Association.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE VI BOATSWAINS',
    sections: [
      {
        paragraphs: [
          'There shall be a group of members of the Association known as the Boatswains whose responsibility it shall be to assist the Sailing Master and the Executive Committee in the operation of the Sailing Pavilion and the planning and execution of the educational and recreational activities of the Association. The Boatswains shall draw up their own regulations as to membership and organization.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE VII MEETINGS',
    sections: [
      {
        heading: 'Section 1',
        paragraphs: [
          'There shall be an annual meeting of the Association for the presentation of the reports of the Secretary, the Treasurer, and the Executive Committee, consideration of the actions of the Executive Committee, and election of the Officers and Representatives at Large of the Association. This meeting shall be held during the second or third week of the fall academic term.',
        ],
      },
      {
        heading: 'Section 2',
        paragraphs: [
          'The Commodore may call special meetings of the Association at his discretion and shall do so at the request of the Executive Committee or any twenty members of the Association.',
        ],
      },
      {
        heading: 'Section 3',
        paragraphs: [
          'Notices of all meetings of the Association, listing all special business to be transacted, shall be conspicuously displayed at the Sailing Pavilion and on the Association’s Building 3 bulletin board for at least eight days prior to such meetings. Should a scheduled meeting fail for lack of a quorum, notice of the rescheduled meeting shall be posted within twenty-four hours.',
        ],
      },
      {
        heading: 'Section 4',
        paragraphs: [
          'A quorum for the transaction of any business shall consist of not fewer than twenty members present at any duly called meeting of the Association except a rescheduled meeting held within ten days of a failed meeting, for which a quorum may consist of fewer than twenty members provided that no fewer than eight members of the Executive Committee are present.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE VIII AMENDMENTS',
    sections: [
      {
        paragraphs: [
          'This Constitution may be amended by a two-thirds vote of the members present at any duly called meeting of the Association. Such amendments must be displayed at the Sailing Pavilion for at least one month prior to their consideration by the Association.',
        ],
      },
    ],
  },
  {
    title: 'ARTICLE IX BYLAWS',
    sections: [
      {
        paragraphs: [
          'Bylaws will be hereafter adopted. Such bylaws may be amended by a majority vote of the members present at any duly called meeting of the Association.',
        ],
      },
    ],
  },
] as const;

export const mitnaConstitutionFootnote =
  'Note: A major revision of the March 26, 1959 Constitution of the M.I.T. Nautical Association was adopted on May 17, 1973, further amended on October 17, 1978, and further amended on October 2, 1990, producing this document. HFH 11/1990';

export const mitnaConstitutionBylawsIntro =
  'Bylaws to the Constitution of the M.I.T. Nautical Association (Adopted at the 1988 Annual Meeting)';

export const mitnaConstitutionBylaws: readonly string[] = [
  'Unless at least three members of the Executive Committee request that an Executive Committee meeting be closed, members of the Association may be invited to attend as nonvoting participants. The Officers should encourage participation.',
  'Boatswains shall have the right to attend all meetings of the Executive Committee as nonvoting participants.',
  'Nominees for any office or award may be asked by the Officer presiding to absent themselves from discussion before voting for that office, but they shall be invited to speak and shall be given the opportunity to vote for that office or award.',
  'When there are more nominees for an office than positions to be filled, voting shall be by secret ballot.',
  'When there are more than two nominees for any positions of Officer of the Association, voting shall be by a system such that a) all voters should list all nominees in order of preference, b) ballots shall be initially counted toward nominees according to first preference listed, c) ballots for the nominee or nominees receiving the fewest first preference votes shall be redistributed and counted toward the second preference nominee listed (or discarded if there is no second preference), d) and so forth until one nominee has a majority of votes (of those ballots remaining). In the event of a tie with two nominees remaining, there shall be a revote between those two nominees. If there is a tie for second place with three nominees remaining, there shall be a revote by the preferential procedure described above among those three nominees.',
  'When there are more than five nominees for the office of Representative at Large to the Executive Committee, all voters should indicate those five nominees that they favor without regard to order of preference. The five nominees receiving the largest number of votes are elected. Ties shall be resolved by a revote among those nominees tied.',
  'At the annual meeting of the Association, the membership shall have the opportunity to recognize individuals who have made significant, extraordinary, and exemplary contributions to the programs and activities of the Association and the M.I.T. Sailing Pavilion through voting to bestow the M.I.T. Nautical Association Service Award. The current membership, guided by the spirit and example of previous selections, may use any criterion it wishes, remembering that a) the award may be presented to any friend of M.I.T. sailing, b) the award is not intended to recognize members of the Executive Committee or Pavilion staff for the normal performance of their duties, c) the award need not be presented every year or limited to one person per year, d) the award shall be presented to an individual only once.',
  'The Executive Committee shall, having solicited recommendations from the membership, present at the annual meeting of the Association a nominee or nominees for the M.I.T. Nautical Association Service Award or recommend that no award be given.',
];
