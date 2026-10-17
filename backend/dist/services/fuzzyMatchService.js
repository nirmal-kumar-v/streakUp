"use strict";
/**
 * Fuzzy Task Matching Service
 * Normalizes, compares, and detects equivalent tasks across friends with confidence scoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.extractTaskTokens = extractTaskTokens;
exports.getCanonicalTaskTitle = getCanonicalTaskTitle;
exports.levenshteinDistance = levenshteinDistance;
exports.stringSimilarity = stringSimilarity;
exports.tokenFuzzySimilarity = tokenFuzzySimilarity;
exports.compareTaskTitles = compareTaskTitles;
exports.findBestMatchingTask = findBestMatchingTask;
// Common generic words that should not trigger false positives across unrelated tasks
const GENERIC_STOP_WORDS = new Set([
    'daily',
    'study',
    'practice',
    'practise',
    'task',
    'routine',
    'habit',
    'regular',
    'my',
    'the',
    'for',
    'and',
    'in',
    'to',
    'of',
    'a',
    'an',
]);
// Common domain abbreviation and synonym mappings
const SYNONYMS = {
    prep: 'preparation',
    preperation: 'preparation',
    practise: 'practice',
    prac: 'practice',
    daliy: 'daily',
    dailey: 'daily',
    math: 'mathematics',
    maths: 'mathematics',
    rev: 'revision',
    revising: 'revision',
    algo: 'algorithm',
    algorithms: 'algorithm',
    ds: 'datastructure',
    dsa: 'datastructure',
    dev: 'development',
    prob: 'problem',
    probs: 'problem',
    problems: 'problem',
    ques: 'question',
    questions: 'question',
    mcq: 'mcqs',
    mcqs: 'mcqs',
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    os: 'operatingsystem',
    cn: 'computernetworks',
    dbms: 'database',
};
/**
 * Standard text normalization: lowercased, punctuation removed, trimmed, multiple spaces collapsed.
 */
function normalizeText(text) {
    if (!text)
        return '';
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // replace punctuation with space
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Extract meaningful tokens, replacing abbreviations/synonyms and separating generic stop words.
 */
function extractTaskTokens(title) {
    const normalized = normalizeText(title);
    if (!normalized)
        return { allTokens: [], coreTokens: [] };
    const rawTokens = normalized.split(' ').filter(Boolean);
    const allTokens = rawTokens.map(t => SYNONYMS[t] || t);
    const coreTokens = allTokens.filter(t => !GENERIC_STOP_WORDS.has(t));
    return { allTokens, coreTokens };
}
/**
 * Normalized canonical title for indexing and exact equivalence checks.
 */
function getCanonicalTaskTitle(title) {
    const { coreTokens, allTokens } = extractTaskTokens(title);
    const tokensToUse = coreTokens.length > 0 ? coreTokens : allTokens;
    return tokensToUse.sort().join(' ');
}
/**
 * Standard Levenshtein Distance calculation.
 */
function levenshteinDistance(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return dp[m][n];
}
/**
 * Normalized Levenshtein similarity between 0.0 and 1.0.
 */
function stringSimilarity(s1, s2) {
    if (s1 === s2)
        return 1.0;
    if (!s1 || !s2)
        return 0.0;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0)
        return 1.0;
    const dist = levenshteinDistance(s1, s2);
    return Math.max(0, 1 - dist / maxLen);
}
/**
 * Token similarity using Dice coefficient with fuzzy token matching.
 */
function tokenFuzzySimilarity(tokens1, tokens2) {
    if (tokens1.length === 0 && tokens2.length === 0)
        return 1.0;
    if (tokens1.length === 0 || tokens2.length === 0)
        return 0.0;
    let matchedWeight = 0;
    const used2 = new Set();
    for (const t1 of tokens1) {
        let bestMatchScore = 0;
        let bestIdx = -1;
        for (let j = 0; j < tokens2.length; j++) {
            if (used2.has(j))
                continue;
            const t2 = tokens2[j];
            const sim = stringSimilarity(t1, t2);
            if (sim > bestMatchScore) {
                bestMatchScore = sim;
                bestIdx = j;
            }
        }
        if (bestMatchScore >= 0.70 && bestIdx !== -1) {
            used2.add(bestIdx);
            matchedWeight += bestMatchScore;
        }
    }
    // Dice coefficient: 2 * matched / (len1 + len2)
    return (2 * matchedWeight) / (tokens1.length + tokens2.length);
}
/**
 * Compare two task titles and compute confidence score (0.0 to 1.0).
 * Handles:
 * - Exact normalization (GATE Preparation == gate preparation)
 * - Spelling variations (Daily Leetcode Practise == Daliy LeetCode Practice)
 * - Abbreviations (GATE Prep == GATE Preparation)
 * - Word order variations
 * - Prevents false positive matching on generic words alone (e.g. Daily LeetCode vs Daily Java)
 */
function compareTaskTitles(title1, title2) {
    const norm1 = normalizeText(title1);
    const norm2 = normalizeText(title2);
    // 1. Exact or normalized match
    if (norm1 === norm2) {
        return {
            confidence: 1.0,
            isHighConfidence: true,
            isModerateConfidence: false,
            isMatch: true,
            reason: 'Exact normalized match',
        };
    }
    const tokens1 = extractTaskTokens(title1);
    const tokens2 = extractTaskTokens(title2);
    // Compare core tokens (stripped of generic stop words)
    const core1 = tokens1.coreTokens;
    const core2 = tokens2.coreTokens;
    // CRITICAL GUARD: If both have core tokens but core tokens share no similarity,
    // do NOT match just because both had "daily" or "practice"!
    if (core1.length > 0 && core2.length > 0) {
        // Check if at least one core token is sufficiently similar
        let maxCorePairSim = 0;
        for (const c1 of core1) {
            for (const c2 of core2) {
                const s = stringSimilarity(c1, c2);
                if (s > maxCorePairSim)
                    maxCorePairSim = s;
            }
        }
        // Unrelated tasks like "leetcode" vs "java" have maxCorePairSim < 0.4
        if (maxCorePairSim < 0.6) {
            return {
                confidence: 0.1,
                isHighConfidence: false,
                isModerateConfidence: false,
                isMatch: false,
                reason: 'Unrelated core subjects (e.g. LeetCode vs Java)',
            };
        }
    }
    // Canonical token-sorted comparison (ignoring word order and stop words)
    const canonical1 = getCanonicalTaskTitle(title1);
    const canonical2 = getCanonicalTaskTitle(title2);
    if (canonical1 && canonical1 === canonical2) {
        return {
            confidence: 0.95,
            isHighConfidence: true,
            isModerateConfidence: false,
            isMatch: true,
            reason: 'Canonical core token match',
        };
    }
    // Full string Levenshtein similarity
    const fullStringSim = stringSimilarity(norm1, norm2);
    // Core tokens similarity
    const coreSim = tokenFuzzySimilarity(core1, core2);
    // All tokens similarity
    const allTokensSim = tokenFuzzySimilarity(tokens1.allTokens, tokens2.allTokens);
    // Weighted composite score: core tokens matter most (60%), full string (25%), all tokens (15%)
    const compositeScore = core1.length > 0 && core2.length > 0
        ? (coreSim * 0.6) + (fullStringSim * 0.25) + (allTokensSim * 0.15)
        : (fullStringSim * 0.7) + (allTokensSim * 0.3);
    // If full string similarity is very high (e.g. single typo / transposition), take max
    const effectiveScore = Math.max(compositeScore, fullStringSim >= 0.85 ? fullStringSim : 0);
    const roundedConfidence = Math.round(effectiveScore * 100) / 100;
    const isHighConfidence = roundedConfidence >= 0.80;
    const isModerateConfidence = roundedConfidence >= 0.50 && !isHighConfidence;
    const isMatch = roundedConfidence >= 0.50;
    let reason = 'Low similarity';
    if (isHighConfidence) {
        reason = 'High confidence equivalent task';
    }
    else if (isModerateConfidence) {
        reason = 'Moderate confidence variation — user confirmation suggested';
    }
    return {
        confidence: roundedConfidence,
        isHighConfidence,
        isModerateConfidence,
        isMatch,
        reason,
    };
}
/**
 * Finds the candidate task with the highest fuzzy match score above the match threshold
 */
function findBestMatchingTask(targetTitle, candidates) {
    let bestMatch = null;
    let highestConfidence = 0;
    for (const candidate of candidates) {
        const result = compareTaskTitles(targetTitle, candidate.title);
        if (result.isMatch && result.confidence > highestConfidence) {
            highestConfidence = result.confidence;
            bestMatch = candidate;
        }
    }
    return { match: bestMatch, confidence: highestConfidence };
}
