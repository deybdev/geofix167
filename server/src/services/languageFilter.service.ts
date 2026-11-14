const FLAGGED_TERMS = [
  "putang ina",
  "putangina",
  "putanginamo",
  "tangina",
  "tanginamo",
  "puta",
  "pota",
  "gago",
  "gaga",
  "bobo",
  "tarantado",
  "tarantada",
  "ulol",
  "tanga",
  "punyeta",
  "kupal",
  "inutil",
  "siraulo",
  "leche",
  "motherfucker",
  "fucker",
  "fucking",
  "fucked",
  "fuck",
  "bullshit",
  "shitty",
  "shit",
  "bitches",
  "bitch",
  "asshole",
  "bastard",
] as const;

export type LanguageFilterResult = {
  sanitizedText: string | null;
  hasLanguageFlag: 0 | 1;
  matchedTermsSummary: string | null;
  matchedTerms: string[];
};

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PROFANITY_REGEX = new RegExp(
  `\\b(${FLAGGED_TERMS.map(escapeRegExp).join("|")})\\b`,
  "gi",
);

export function filterLanguage(
  rawText: string | null | undefined,
): LanguageFilterResult {
  if (rawText === null || rawText === undefined) {
    return {
      sanitizedText: null,
      hasLanguageFlag: 0,
      matchedTermsSummary: null,
      matchedTerms: [],
    };
  }

  if (rawText.trim() === "") {
    return {
      sanitizedText: rawText,
      hasLanguageFlag: 0,
      matchedTermsSummary: null,
      matchedTerms: [],
    };
  }

  const matchedSet = new Set<string>();

  const sanitizedText = rawText.replace(PROFANITY_REGEX, (match) => {
    matchedSet.add(match.toLowerCase());
    return "*".repeat(match.length);
  });

  const matchedTerms = Array.from(matchedSet);
  const hasLanguageFlag: 0 | 1 = matchedTerms.length > 0 ? 1 : 0;

  return {
    sanitizedText,
    hasLanguageFlag,
    matchedTermsSummary:
      matchedTerms.length > 0 ? matchedTerms.join(", ") : null,
    matchedTerms,
  };
}

