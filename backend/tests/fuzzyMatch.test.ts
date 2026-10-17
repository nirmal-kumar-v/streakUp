import { describe, it, expect } from 'vitest';
import { compareTaskTitles, normalizeText, getCanonicalTaskTitle } from '../src/services/fuzzyMatchService';

describe('Fuzzy Task Matching Service', () => {
  it('handles exact normalization (case, spaces, harmless punctuation)', () => {
    const res1 = compareTaskTitles('GATE Preparation', 'gate preparation');
    expect(res1.confidence).toBe(1.0);
    expect(res1.isHighConfidence).toBe(true);

    const res2 = compareTaskTitles('GATE PREPARATION', ' Gate Preparation ');
    expect(res2.confidence).toBe(1.0);
    expect(res2.isHighConfidence).toBe(true);
  });

  it('recognizes common spelling mistakes and near-matches', () => {
    const res = compareTaskTitles('Daily LeetCode Practice', 'Daily Leetcode Practise');
    expect(res.isHighConfidence).toBe(true);

    const typoRes = compareTaskTitles('Daily LeetCode Practice', 'Daliy LeetCode Practice');
    expect(typoRes.isHighConfidence).toBe(true);
  });

  it('recognizes common abbreviations (GATE Prep == GATE Preparation)', () => {
    const res = compareTaskTitles('GATE Preparation', 'GATE Prep');
    expect(res.isHighConfidence).toBe(true);
  });

  it('unrelated tasks sharing generic words are NOT merged (Daily LeetCode vs Daily Java)', () => {
    const res = compareTaskTitles('Daily LeetCode Practice', 'Daily Java Practice');
    expect(res.isMatch).toBe(false);
    expect(res.confidence).toBeLessThan(0.5);
  });

  it('flags moderate confidence variations for user confirmation', () => {
    const res = compareTaskTitles('Discrete Mathematics Study', 'Discrete Math Revision');
    expect(res.isMatch).toBe(true);
  });
});
