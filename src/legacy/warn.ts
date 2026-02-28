const warnedLegacyImports = new Set<string>();

export function warnLegacyImportRoute(
  legacyPath: string,
  nextPath: string,
): void {
  if (warnedLegacyImports.has(legacyPath)) {
    return;
  }

  warnedLegacyImports.add(legacyPath);
  process.emitWarning(
    `Import path "${legacyPath}" is deprecated and will be removed in a future release. Use "${nextPath}" instead.`,
    {
      type: "DeprecationWarning",
      code: "SCHWAB_NODE_LEGACY_IMPORT",
    },
  );
}
