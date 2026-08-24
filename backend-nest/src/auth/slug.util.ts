export const generateSlug = (text: string): string => {
  if (!text) return '';
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      // M6: the combining-diacritics range (U+0300-U+036F, stripped after NFD
      // normalization splits accented characters into base + combining mark)
      // was previously written as raw combining characters embedded directly
      // in the regex literal — behaviorally identical, but renders as mojibake
      // in editors/diffs and any future normalization pass on this file could
      // silently corrupt it. Spelled out as the \u escape sequence instead.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
};
