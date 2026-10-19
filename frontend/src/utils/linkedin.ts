export interface LinkedInGameDefinition {
  id: string;
  name: string;
  description: string;
  tagline: string;
  category: string;
}

export const LINKEDIN_GAMES_LIST: LinkedInGameDefinition[] = [
  {
    id: 'pinpoint',
    name: 'Pinpoint',
    description: 'Guess the secret category in as few clues as possible.',
    tagline: '5 clues • 1 category',
    category: 'Word & Association',
  },
  {
    id: 'crossclimb',
    name: 'Crossclimb',
    description: 'Solve trivia clues to build the word ladder from start to finish.',
    tagline: 'Trivia • Word ladder',
    category: 'Trivia & Ladder',
  },
  {
    id: 'queens',
    name: 'Queens',
    description: 'Place exactly one crown in every row, column, and color region without touching.',
    tagline: 'Crown logic puzzle',
    category: 'Logic & Grid',
  },
  {
    id: 'tango',
    name: 'Tango',
    description: 'Balance suns and moons across the grid so no more than two adjacent match.',
    tagline: 'Sun & Moon grid logic',
    category: 'Grid Constraint',
  },
  {
    id: 'zip',
    name: 'Zip',
    description: 'Trace through the number path connecting points in sequential order.',
    tagline: 'Connect the path',
    category: 'Path & Sequence',
  },
  {
    id: 'mini-sudoku',
    name: 'Mini Sudoku',
    description: 'Solve the quick 6x6 number grid puzzle with numbers 1 through 6.',
    tagline: 'Quick 6x6 numbers',
    category: 'Number Logic',
  },
  {
    id: 'patches',
    name: 'Patches',
    description: 'Arrange pattern shapes to perfectly cover the target silhouette.',
    tagline: 'Pattern matching & tangram',
    category: 'Visual & Shape',
  },
  {
    id: 'wend',
    name: 'Wend',
    description: 'Step-by-step word morphing puzzle to navigate from starting to target word.',
    tagline: 'Word morphing pathway',
    category: 'Word Transformation',
  },
];

export function isLinkedInName(name?: string | null): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase().replace(/[\s\-_]+/g, '');
  return clean === 'linkedin' || clean === 'linkdin' || clean === 'linked' || clean.includes('linkedin');
}

