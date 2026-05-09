import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {'branches' | 'functions' | 'lines' | 'statements'} MetricName
 * @typedef {{ covered: number, pct: number, skipped: number, total: number }} CoverageMetric
 * @typedef {{ branches: CoverageMetric, functions: CoverageMetric, lines: CoverageMetric, statements: CoverageMetric }} FileCoverageSummary
 * @typedef {Record<string, FileCoverageSummary>} CoverageSummary
 * @typedef {{ e2eProof: string[], path: string, reason: string }} CoverageExemption
 */

const coverageSummaryPath = path.join(
  process.cwd(),
  'coverage',
  'coverage-summary.json'
);

const minimumPct = 95;
const metricNames = /** @type {MetricName[]} */ ([
  'statements',
  'lines',
  'functions',
  'branches',
]);

const authCoverageFiles = [
  'src/app/api/auth/[...all]/route.ts',
  'src/app/api/unlock-account/route.ts',
  'src/app/[locale]/(auth)/layout.tsx',
  'src/app/[locale]/(auth)/(center)/layout.tsx',
  'src/app/[locale]/(auth)/(center)/login/page.tsx',
  'src/app/[locale]/(auth)/(center)/login/SignInForm.tsx',
  'src/app/[locale]/(auth)/(center)/signup/page.tsx',
  'src/app/[locale]/(auth)/(center)/signup/SignUpForm.tsx',
  'src/app/[locale]/(auth)/(center)/forgot-password/page.tsx',
  'src/app/[locale]/(auth)/(center)/forgot-password/ForgotPasswordForm.tsx',
  'src/app/[locale]/(auth)/(center)/reset-password/page.tsx',
  'src/app/[locale]/(auth)/(center)/reset-password/ResetPasswordForm.tsx',
  'src/app/[locale]/(auth)/(center)/verify-email/page.tsx',
  'src/app/[locale]/(auth)/(center)/verify-email/VerifyEmailForm.tsx',
  'src/app/[locale]/(auth)/(center)/unlock-account/page.tsx',
  'src/app/[locale]/(auth)/profile/layout.tsx',
  'src/app/[locale]/(auth)/profile/page.tsx',
  'src/app/[locale]/(auth)/profile/account/page.tsx',
  'src/app/[locale]/(auth)/profile/password/page.tsx',
  'src/app/[locale]/(auth)/profile/security/page.tsx',
  'src/app/[locale]/(auth)/profile/delete/page.tsx',
  'src/app/[locale]/(auth)/profile/ProfileAccountClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfileDeleteAccountClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfilePasswordClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfileSecurityClient.tsx',
  'src/components/auth/ImpersonationBanner.tsx',
  'src/components/auth/SignOutForm.tsx',
  'src/components/auth/StopImpersonationButton.tsx',
  'src/components/auth/profile/ProfileAppearanceSection.tsx',
  'src/components/auth/profile/ProfileSettingsChrome.tsx',
  'src/components/auth/profile/ProfileSideNav.tsx',
  'src/components/auth/profile/profileAuthErrorMaps.ts',
  'src/components/auth/profile/profileBanner.tsx',
  'src/libs/auth.ts',
  'src/libs/auth-client.ts',
  'src/libs/auth/adminHeaderLink.ts',
  'src/libs/auth/callbackUrl.ts',
  'src/libs/auth/dal.ts',
  'src/libs/auth/hooks.ts',
  'src/libs/auth/password-compromise.ts',
  'src/libs/auth/reportAuthClientError.ts',
  'src/libs/auth/roles.ts',
  'src/libs/auth/themePreferenceActions.ts',
  'src/libs/auth/unlock-token.ts',
];

/** @type {CoverageExemption[]} */
const authCoverageExcludedFiles = [];

const additionalCriticalCoverageFiles = [
  'src/components/mit-sailing/SiteShellHeaderNav.tsx',
  'src/components/mit-sailing/site/SiteHeader.tsx',
  'src/components/mit-sailing/site/NavigationDropdown.tsx',
  'src/components/mit-sailing/site/WeatherConditionsBar.tsx',
  'src/lib/mit-sailing/navPathMatch.ts',
  'src/lib/mitWeatherUpstreamContract.ts',
  'src/lib/weather.ts',
  'src/lib/weatherParse.ts',
  'src/libs/email/account-emails.ts',
  'src/libs/email/sendTransactional.ts',
  'emails/account-unlock.tsx',
  'emails/confirm-email-change.tsx',
  'emails/delete-account.tsx',
  'emails/email-change-requested.tsx',
  'emails/email-layout.tsx',
  'emails/password-changed.tsx',
  'emails/password-reset.tsx',
  'emails/sign-in-otp.tsx',
  'emails/verify-email.tsx',
];

/** @type {CoverageExemption[]} */
const additionalCriticalExcludedFiles = [
  {
    path: 'src/components/mit-sailing/SiteShellHeaderNav.tsx',
    reason:
      'Async server shell composes Prisma-backed nav items and auth hints',
    e2eProof: ['tests/e2e/MobileNav.e2e.ts'],
  },
];

/**
 * @param {string} filePath - Absolute or project-relative coverage path.
 * @returns {string} Project-relative path when the file belongs to this repo.
 */
function toProjectPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith('..') ? filePath : relative;
}

/**
 * @param {unknown} value - Candidate coverage metric from parsed JSON.
 * @returns {value is CoverageMetric} True when the metric has numeric counts.
 */
function isCoverageMetric(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'covered' in value &&
    typeof value.covered === 'number' &&
    'pct' in value &&
    typeof value.pct === 'number' &&
    'skipped' in value &&
    typeof value.skipped === 'number' &&
    'total' in value &&
    typeof value.total === 'number'
  );
}

/**
 * @param {unknown} value - Candidate per-file summary from parsed JSON.
 * @returns {value is FileCoverageSummary} True when all gated metrics exist.
 */
function isFileCoverageSummary(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return metricNames.every(
    (metricName) => metricName in value && isCoverageMetric(value[metricName])
  );
}

/**
 * @param {unknown} value - Parsed coverage summary JSON.
 * @returns {value is CoverageSummary} True when every file entry has gated metrics.
 */
function isCoverageSummary(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  for (const [key, fileSummary] of Object.entries(value)) {
    if (key !== 'total' && !isFileCoverageSummary(fileSummary)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {CoverageSummary} summary - Parsed and validated coverage summary.
 * @param {string} projectPath - File path relative to the repo root.
 * @returns {FileCoverageSummary | null} Matching file summary, or null when missing.
 */
function findSummaryForFile(summary, projectPath) {
  const normalizedProjectPath = path.normalize(projectPath);

  for (const [filePath, fileSummary] of Object.entries(summary)) {
    if (filePath === 'total') {
      continue;
    }

    const normalizedFilePath = path.normalize(toProjectPath(filePath));
    if (normalizedFilePath === normalizedProjectPath) {
      return fileSummary;
    }
  }

  return null;
}

/**
 * @param {number} value - Percentage value.
 * @returns {string} Percentage formatted for reports.
 */
function formatPct(value) {
  return `${Number(value).toFixed(2)}%`;
}

/**
 * @param {FileCoverageSummary} fileSummary - Coverage summary for one file.
 * @returns {string[]} Metric failures for this file.
 */
function metricsBelowThreshold(fileSummary) {
  return metricNames
    .filter((metricName) => Number(fileSummary[metricName].pct) < minimumPct)
    .map(
      (metricName) =>
        `${metricName} ${formatPct(Number(fileSummary[metricName].pct))}`
    );
}

/**
 * @param {CoverageSummary} summary - Parsed coverage summary.
 * @param {string[]} projectPaths - Files expected to meet the threshold.
 * @returns {string[]} Human-readable failures.
 */
function coverageFailuresForFiles(summary, projectPaths) {
  /** @type {string[]} */
  const failures = [];

  for (const projectPath of projectPaths) {
    const fileSummary = findSummaryForFile(summary, projectPath);

    if (!fileSummary) {
      failures.push(`${projectPath}: missing from coverage summary`);
      continue;
    }

    const metricFailures = metricsBelowThreshold(fileSummary);
    if (metricFailures.length > 0) {
      failures.push(`${projectPath}: ${metricFailures.join(', ')}`);
    }
  }

  return failures;
}

/**
 * @param {string[]} projectPaths - Gated project-relative paths.
 * @param {CoverageExemption[]} exemptions - Documented exemptions.
 * @returns {string[]} Gated paths after applying documented exemptions.
 */
function withoutCoverageExemptions(projectPaths, exemptions) {
  const exempted = new Set(
    exemptions.map((exemption) => path.normalize(exemption.path))
  );

  return projectPaths.filter(
    (projectPath) => !exempted.has(path.normalize(projectPath))
  );
}

/**
 * @param {string} label - Human-readable coverage list label.
 * @param {string[]} projectPaths - Coverage list paths that may be exempted.
 * @param {CoverageExemption[]} exemptions - Documented exemptions.
 */
function assertCoverageExemptionsExist(label, projectPaths, exemptions) {
  const gated = new Set(
    projectPaths.map((projectPath) => path.normalize(projectPath))
  );
  const missing = exemptions
    .map((exemption) => exemption.path)
    .filter((exemptionPath) => !gated.has(path.normalize(exemptionPath)));

  if (missing.length > 0) {
    throw new Error(
      `${label} coverage exemptions must also appear in the matching coverage file list: ${missing.join(', ')}`
    );
  }
}

/**
 * @param {string} label - Human-readable coverage list label.
 * @param {CoverageExemption[]} exemptions - Documented exemptions.
 */
function assertCoverageExemptionProofsExist(label, exemptions) {
  const missingProofs = exemptions.flatMap((exemption) =>
    exemption.e2eProof
      .filter((proofPath) => !existsSync(path.join(process.cwd(), proofPath)))
      .map((proofPath) => `${exemption.path} -> ${proofPath}`)
  );

  if (missingProofs.length > 0) {
    throw new Error(
      `${label} coverage exemption E2E proof files must exist: ${missingProofs.join(', ')}`
    );
  }
}

/**
 * @param {string} projectPath - Project-relative source path.
 * @returns {string} Project path with POSIX separators for prefix checks.
 */
function normalizeProjectPathSeparators(projectPath) {
  return path.normalize(projectPath).replaceAll('\\', '/');
}

/**
 * @param {string} projectPath - Project-relative source path.
 * @returns {boolean} True when the file belongs to the auth-owned surface.
 */
function isAuthOwnedPath(projectPath) {
  const normalizedProjectPath = normalizeProjectPathSeparators(projectPath);

  return (
    normalizedProjectPath.startsWith('src/app/[locale]/(auth)/') ||
    normalizedProjectPath.startsWith('src/components/auth/') ||
    normalizedProjectPath.startsWith('src/libs/auth/') ||
    normalizedProjectPath === 'src/libs/auth.ts' ||
    normalizedProjectPath === 'src/libs/auth-client.ts' ||
    normalizedProjectPath === 'src/app/api/auth/[...all]/route.ts' ||
    normalizedProjectPath === 'src/app/api/unlock-account/route.ts'
  );
}

/**
 * @param {CoverageSummary} summary - Parsed coverage summary.
 * @returns {string[]} Auth-owned files in coverage that are neither gated nor exempted.
 */
function ungatedAuthFiles(summary) {
  const gated = new Set(
    authCoverageFiles.map((filePath) => path.normalize(filePath))
  );
  const exempted = new Set(
    authCoverageExcludedFiles.map((exemption) => path.normalize(exemption.path))
  );
  /** @type {string[]} */
  const ungated = [];

  for (const filePath of Object.keys(summary)) {
    if (filePath === 'total') {
      continue;
    }

    const projectPath = toProjectPath(filePath);
    const normalizedProjectPath = path.normalize(projectPath);
    if (
      isAuthOwnedPath(projectPath) &&
      !gated.has(normalizedProjectPath) &&
      !exempted.has(normalizedProjectPath)
    ) {
      ungated.push(projectPath);
    }
  }

  return ungated;
}

/**
 * @returns {Record<MetricName, CoverageMetric>} Empty aggregate metric counts.
 */
function emptyAggregate() {
  return {
    branches: { covered: 0, pct: 100, skipped: 0, total: 0 },
    functions: { covered: 0, pct: 100, skipped: 0, total: 0 },
    lines: { covered: 0, pct: 100, skipped: 0, total: 0 },
    statements: { covered: 0, pct: 100, skipped: 0, total: 0 },
  };
}

/**
 * @param {CoverageMetric} aggregate - Existing aggregate counts.
 * @param {CoverageMetric} next - File metric counts.
 */
function addMetricCounts(aggregate, next) {
  aggregate.covered += next.covered;
  aggregate.skipped += next.skipped;
  aggregate.total += next.total;
  aggregate.pct =
    aggregate.total === 0 ? 100 : (aggregate.covered / aggregate.total) * 100;
}

/**
 * @param {Record<MetricName, CoverageMetric>} aggregate - Aggregate counts.
 * @param {FileCoverageSummary} fileSummary - File summary to include.
 */
function addFileToAggregate(aggregate, fileSummary) {
  for (const metricName of metricNames) {
    addMetricCounts(aggregate[metricName], fileSummary[metricName]);
  }
}

/**
 * @param {CoverageSummary} summary - Parsed coverage summary.
 * @returns {Map<string, Record<MetricName, CoverageMetric>>} Folder aggregates for auth app routes.
 */
function authAppFolderAggregates(summary) {
  const folderRoots = [
    'src/app/[locale]/(auth)',
    'src/app/[locale]/(auth)/(center)',
    'src/app/[locale]/(auth)/profile',
  ];
  const aggregates = new Map(
    folderRoots.map((folderRoot) => [folderRoot, emptyAggregate()])
  );

  for (const [filePath, fileSummary] of Object.entries(summary)) {
    if (filePath === 'total') {
      continue;
    }

    const projectPath = normalizeProjectPathSeparators(toProjectPath(filePath));
    for (const folderRoot of folderRoots) {
      const normalizedFolderRoot = normalizeProjectPathSeparators(folderRoot);
      if (projectPath.startsWith(`${normalizedFolderRoot}/`)) {
        const aggregate = aggregates.get(folderRoot);
        if (aggregate) {
          addFileToAggregate(aggregate, fileSummary);
        }
      }
    }
  }

  return aggregates;
}

/**
 * @param {Record<MetricName, CoverageMetric>} aggregate - Folder aggregate.
 * @returns {string} Compact metric summary.
 */
function formatAggregate(aggregate) {
  return metricNames
    .map(
      (metricName) => `${metricName} ${formatPct(aggregate[metricName].pct)}`
    )
    .join(', ');
}

/**
 * @param {CoverageExemption[]} exemptions - Exemptions to print.
 * @param {(message: string) => void} write - Output function.
 */
function printExemptions(exemptions, write = console.error) {
  if (exemptions.length === 0) {
    write('- none');
    return;
  }

  for (const exemption of exemptions) {
    write(
      `- ${exemption.path}: ${exemption.reason}; proof: ${exemption.e2eProof.join(', ')}`
    );
  }
}

if (!existsSync(coverageSummaryPath)) {
  throw new Error(
    `Coverage summary missing: ${coverageSummaryPath}. Run tests with coverage (e.g. npm run test:coverage) so coverage/coverage-summary.json exists.`
  );
}

const rawSummary = await readFile(coverageSummaryPath, 'utf8');

let coverageSummary;
try {
  coverageSummary = JSON.parse(rawSummary);
} catch (error) {
  throw new TypeError(
    `Invalid JSON in coverage summary: ${coverageSummaryPath}`,
    { cause: error }
  );
}

if (!isCoverageSummary(coverageSummary)) {
  throw new TypeError(
    `Invalid coverage summary format: ${coverageSummaryPath}`
  );
}

assertCoverageExemptionsExist(
  'Auth',
  authCoverageFiles,
  authCoverageExcludedFiles
);
assertCoverageExemptionsExist(
  'Additional critical',
  additionalCriticalCoverageFiles,
  additionalCriticalExcludedFiles
);
assertCoverageExemptionProofsExist('Auth', authCoverageExcludedFiles);
assertCoverageExemptionProofsExist(
  'Additional critical',
  additionalCriticalExcludedFiles
);

const gatedAuthCoverageFiles = withoutCoverageExemptions(
  authCoverageFiles,
  authCoverageExcludedFiles
);
const gatedAdditionalCriticalCoverageFiles = withoutCoverageExemptions(
  additionalCriticalCoverageFiles,
  additionalCriticalExcludedFiles
);

const authFailures = coverageFailuresForFiles(
  coverageSummary,
  gatedAuthCoverageFiles
);
const additionalFailures = coverageFailuresForFiles(
  coverageSummary,
  gatedAdditionalCriticalCoverageFiles
);
const ungatedAuthCoverageFiles = ungatedAuthFiles(coverageSummary);

console.log(
  `Auth coverage files checked: ${gatedAuthCoverageFiles.length} at >=${minimumPct}% statements, lines, functions, and branches.`
);

console.log('Folder aggregates for src/app/[locale]/(auth):');
for (const [folderRoot, aggregate] of authAppFolderAggregates(
  coverageSummary
)) {
  console.log(`- ${folderRoot}: ${formatAggregate(aggregate)}`);
}

if (
  authFailures.length > 0 ||
  additionalFailures.length > 0 ||
  ungatedAuthCoverageFiles.length > 0
) {
  console.error('Auth files below threshold:');
  if (authFailures.length === 0) {
    console.error('- none');
  } else {
    for (const failure of authFailures) {
      console.error(`- ${failure}`);
    }
  }

  console.error('Auth files intentionally exempted:');
  printExemptions(authCoverageExcludedFiles);

  if (ungatedAuthCoverageFiles.length > 0) {
    console.error(
      'Auth-owned files present in coverage but not gated or exempted:'
    );
    for (const filePath of ungatedAuthCoverageFiles) {
      console.error(`- ${filePath}`);
    }
  }

  if (additionalFailures.length > 0) {
    console.error('Additional critical files below threshold:');
    for (const failure of additionalFailures) {
      console.error(`- ${failure}`);
    }
    console.error('Additional critical files intentionally exempted:');
    printExemptions(additionalCriticalExcludedFiles);
  }

  process.exit(1);
}

console.log('Auth files below threshold: none');
console.log('Auth files intentionally exempted:');
printExemptions(authCoverageExcludedFiles, console.log);
console.log(
  `Additional critical coverage files checked: ${gatedAdditionalCriticalCoverageFiles.length} at >=${minimumPct}% statements, lines, functions, and branches.`
);
if (additionalCriticalExcludedFiles.length > 0) {
  console.log(
    `Additional critical coverage excludes ${additionalCriticalExcludedFiles.length} files with documented E2E proof paths.`
  );
}
