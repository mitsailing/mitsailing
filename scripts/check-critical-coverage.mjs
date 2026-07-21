import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
const coverageLcovPath = path.join(process.cwd(), 'coverage', 'lcov.info');

const minimumPct = 95;
const cmsRichTextChangedLineMinimumPct = 90;
const metricNames = /** @type {MetricName[]} */ ([
  'statements',
  'lines',
  'functions',
  'branches',
]);

const authCoverageFiles = [
  'src/app/api/auth/[...all]/route.ts',
  'src/app/api/dev-login/route.ts',
  'src/app/api/unlock-account/route.ts',
  'src/app/[locale]/(auth)/layout.tsx',
  'src/app/[locale]/(auth)/(center)/layout.tsx',
  'src/app/[locale]/(auth)/(center)/login/page.tsx',
  'src/app/[locale]/(auth)/(center)/login/SignInForm.tsx',
  'src/app/[locale]/(auth)/(center)/login/continue/page.tsx',
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
  'src/app/[locale]/(auth)/profile/newsletter/page.tsx',
  'src/app/[locale]/(auth)/profile/password/page.tsx',
  'src/app/[locale]/(auth)/profile/security/page.tsx',
  'src/app/[locale]/(auth)/profile/delete/page.tsx',
  'src/app/[locale]/(auth)/profile/ratings/page.tsx',
  'src/app/[locale]/(auth)/profile/payments/page.tsx',
  'src/app/[locale]/(auth)/profile/ProfileEmailSection.tsx',
  'src/app/[locale]/(auth)/profile/ProfileMemberInformationSection.tsx',
  'src/app/[locale]/(auth)/profile/ProfileSailingCardSection.tsx',
  'src/app/[locale]/(auth)/profile/membership/page.tsx',
  'src/app/[locale]/(auth)/profile/ProfileAccountClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfileDeleteAccountClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfilePasswordClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfileSecurityClient.tsx',
  'src/components/auth/ImpersonationBanner.tsx',
  'src/components/auth/OtpCodeField.tsx',
  'src/components/auth/SignOutForm.tsx',
  'src/components/auth/StopImpersonationButton.tsx',
  'src/components/auth/profile/ProfileAppearanceSection.tsx',
  'src/components/auth/profile/ProfilePaymentsView.tsx',
  'src/components/auth/profile/ProfileSettingsChrome.tsx',
  'src/components/auth/profile/ProfileSideNav.tsx',
  'src/components/auth/profile/profileAuthErrorMaps.ts',
  'src/components/auth/profile/profileBanner.tsx',
  'src/libs/auth.ts',
  'src/libs/auth-client.ts',
  'src/libs/auth/adminHeaderLink.ts',
  'src/libs/auth/appPermissions.ts',
  'src/libs/auth/authClientThrownMessage.ts',
  'src/libs/auth/callbackUrl.ts',
  'src/libs/auth/devAuthShortcut.ts',
  'src/libs/auth/dal.ts',
  'src/libs/auth/hooks.ts',
  'src/libs/auth/passwordHashing.ts',
  'src/libs/auth/password-compromise.ts',
  'src/libs/auth/passwordResetSupportActions.ts',
  'src/libs/auth/profileIdentityActions.ts',
  'src/libs/auth/reportAuthClientError.ts',
  'src/libs/auth/roles.ts',
  'src/libs/auth/server-admin.ts',
  'src/libs/auth/signInEmailActions.ts',
  'src/libs/auth/themePreferenceActions.ts',
  'src/libs/auth/unlock-token.ts',
];

/** @type {CoverageExemption[]} */
const authCoverageExcludedFiles = [
  {
    path: 'src/app/[locale]/(auth)/profile/payments/page.tsx',
    reason:
      'Server profile payments page composes authenticated payment query data for the covered view',
    e2eProof: ['tests/e2e/EventPayments.e2e.ts'],
  },
  {
    path: 'src/components/auth/profile/ProfilePaymentsView.tsx',
    reason:
      'Profile payment receipt and manual-handled behavior is covered through the event payments e2e flow',
    e2eProof: ['tests/e2e/EventPayments.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/page.tsx',
    reason:
      'Server profile page composes authenticated profile, sailing-card, and contact data for the covered profile account client',
    e2eProof: [
      'src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx',
      'src/components/mit-sailing/onboarding/SailingCardOnboardingForm.test.tsx',
    ],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/ProfileAccountClient.tsx',
    reason:
      'Profile account orchestration is covered through section-level state and form tests after splitting the UI into focused sections',
    e2eProof: [
      'src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx',
      'src/components/auth/profile/ProfileSettingsChrome.test.tsx',
      'src/components/auth/profile/ProfileSideNav.test.tsx',
    ],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/ProfileEmailSection.tsx',
    reason:
      'Profile email change and OTP behavior is covered through the composed profile account client tests',
    e2eProof: ['src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/ProfileMemberInformationSection.tsx',
    reason:
      'Profile member identity editing is covered through the composed profile account client tests',
    e2eProof: ['src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/membership/page.tsx',
    reason:
      'Server membership page composes authenticated membership billing data for the covered membership view and actions',
    e2eProof: [
      'src/components/mit-sailing/profile/ProfileMembershipBillingView.test.tsx',
      'src/libs/mit-sailing/membershipBilling/membershipCheckoutActions.test.ts',
      'src/libs/mit-sailing/membershipBilling/membershipWebhookEvents.test.ts',
    ],
  },
  {
    path: 'src/libs/auth/profileIdentityActions.ts',
    reason:
      'Profile identity updates are covered by direct server-action tests and the composed profile account client tests',
    e2eProof: [
      'src/libs/auth/profileIdentityActions.test.ts',
      'src/app/[locale]/(auth)/profile/ProfileAccountClient.test.tsx',
    ],
  },
];

const additionalCriticalCoverageFiles = [
  'src/app/[locale]/(marketing)/(site)/[...cmsPath]/page.tsx',
  'src/app/[locale]/(marketing)/(site)/admin/cms_pages/[id]/revisions/[revisionId]/page.tsx',
  'src/app/api/admin/cms-media/route.ts',
  'src/app/api/admin/cms-media/uploads/route.ts',
  'src/app/api/admin/cms-media/uploads/[id]/route.ts',
  'src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts',
  'src/app/api/internal/cms-media/tusd/hooks/route.ts',
  'src/app/cms-media/[id]/[filename]/route.ts',
  'src/components/mit-sailing/admin/catalog/AdminCmsMediaControlsApi.ts',
  'src/components/mit-sailing/cms/CmsPageBlocks.tsx',
  'src/components/mit-sailing/cms/CmsPricingBlock.tsx',
  'src/components/mit-sailing/cms/CmsRichText.tsx',
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
  'src/libs/mit-sailing/cmsMediaValidation.ts',
  'src/worker/cmsMediaProcessingJob.ts',
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

const cmsRichTextCoverageFiles = [
  'src/components/mit-sailing/cms/CmsRichText.tsx',
  'src/components/mit-sailing/home/MitSailingHomePageView.tsx',
  'src/libs/mit-sailing/cmsRichText.ts',
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
 * @param {string} lcov - LCOV report contents.
 * @returns {Map<string, Map<number, number>>} Hit counts by project path and line.
 */
function lineCoverageFromLcov(lcov) {
  /** @type {Map<string, Map<number, number>>} */
  const coverageByFile = new Map();

  for (const record of lcov.split('end_of_record')) {
    const sourceMatch = record.match(/^SF:(.+)$/m);
    if (!sourceMatch) {
      continue;
    }

    const sourcePath = toProjectPath(sourceMatch[1] ?? '');
    /** @type {Map<number, number>} */
    const lineHits = new Map();
    for (const lineMatch of record.matchAll(/^DA:(\d+),(\d+)/gm)) {
      lineHits.set(Number(lineMatch[1]), Number(lineMatch[2]));
    }
    coverageByFile.set(sourcePath, lineHits);
  }

  return coverageByFile;
}

/**
 * @param {string[]} projectPaths - Project paths whose changed lines should be gated.
 * @returns {Map<string, Set<number>>} Changed new-line numbers by project path.
 */
function changedLinesAgainstBase(projectPaths) {
  const baseRef = process.env.COVERAGE_BASE_REF ?? 'origin/main';
  let diff = '';
  try {
    diff = execFileSync(
      'git',
      ['diff', '--unified=0', baseRef, '--', ...projectPaths],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Skipping changed-line coverage check; could not diff against ${baseRef}: ${message}`
    );
    return new Map();
  }
  /** @type {Map<string, Set<number>>} */
  const changedLineMap = new Map();
  let currentPath = '';

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentPath = line.slice('+++ b/'.length);
      continue;
    }
    if (line.startsWith('+++ /dev/null')) {
      currentPath = '';
      continue;
    }
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u);
    if (!(hunkMatch && currentPath)) {
      continue;
    }

    const start = Number(hunkMatch[1]);
    const count = Number(hunkMatch[2] ?? '1');
    const changedLines = changedLineMap.get(currentPath) ?? new Set();
    for (let offset = 0; offset < count; offset += 1) {
      changedLines.add(start + offset);
    }
    changedLineMap.set(currentPath, changedLines);
  }

  return changedLineMap;
}

/**
 * @param {string[]} projectPaths - Project paths whose changed executable lines should meet the threshold.
 * @param {number} threshold - Minimum accepted percentage.
 * @returns {{ checked: number, covered: number, failures: string[] }} Coverage result.
 */
function changedLineCoverageForFiles(projectPaths, threshold) {
  if (!existsSync(coverageLcovPath)) {
    throw new Error(
      `LCOV coverage report missing: ${coverageLcovPath}. Run tests with coverage so coverage/lcov.info exists.`
    );
  }

  const lcov = readFileSync(coverageLcovPath, 'utf8');
  const coverageByFile = lineCoverageFromLcov(lcov);
  const changedLineMap = changedLinesAgainstBase(projectPaths);
  /** @type {string[]} */
  const failures = [];
  let checked = 0;
  let covered = 0;

  for (const projectPath of projectPaths) {
    const changedLines = changedLineMap.get(projectPath) ?? new Set();
    const lineHits = coverageByFile.get(projectPath);
    if (!lineHits && changedLines.size > 0) {
      failures.push(`${projectPath}: missing from LCOV report`);
      continue;
    }

    const executableChangedLines = [...changedLines].filter((lineNumber) =>
      lineHits?.has(lineNumber)
    );
    if (executableChangedLines.length === 0) {
      continue;
    }

    const coveredLines = executableChangedLines.filter(
      (lineNumber) => Number(lineHits?.get(lineNumber) ?? 0) > 0
    );
    checked += executableChangedLines.length;
    covered += coveredLines.length;
    const pct = (coveredLines.length / executableChangedLines.length) * 100;
    if (pct < threshold) {
      const uncovered = executableChangedLines.filter(
        (lineNumber) => Number(lineHits?.get(lineNumber) ?? 0) === 0
      );
      failures.push(
        `${projectPath}: changed lines ${formatPct(pct)} (${coveredLines.length}/${executableChangedLines.length}); uncovered lines ${uncovered.join(', ')}`
      );
    }
  }

  const totalPct = checked === 0 ? 100 : (covered / checked) * 100;
  if (totalPct < threshold) {
    failures.push(
      `CMS rich text changed-line total: ${formatPct(totalPct)} (${covered}/${checked})`
    );
  }

  return { checked, covered, failures };
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
 * @param {string} label - Human-readable coverage list label.
 * @param {string[]} projectPaths - Every path must exist on disk (phantom entries silently skip checks).
 */
function assertCoverageGatePathsExist(label, projectPaths) {
  const missing = projectPaths.filter(
    (projectPath) => !existsSync(path.join(process.cwd(), projectPath))
  );

  if (missing.length > 0) {
    throw new Error(
      `${label} coverage gate lists paths that are not in the tree (remove dead entries or merge the files first): ${missing.join(', ')}`
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
    normalizedProjectPath === 'src/app/api/unlock-account/route.ts' ||
    normalizedProjectPath === 'src/app/api/dev-login/route.ts'
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
    const fileSummary = summary[filePath];
    const normalizedProjectPath = path.normalize(projectPath);
    if (
      isAuthOwnedPath(projectPath) &&
      isFileCoverageSummary(fileSummary) &&
      metricNames.some((metricName) => fileSummary[metricName].total > 0) &&
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
assertCoverageGatePathsExist('CMS rich text', cmsRichTextCoverageFiles);

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
const cmsRichTextChangedLineCoverage = changedLineCoverageForFiles(
  cmsRichTextCoverageFiles,
  cmsRichTextChangedLineMinimumPct
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
  cmsRichTextChangedLineCoverage.failures.length > 0 ||
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

  if (cmsRichTextChangedLineCoverage.failures.length > 0) {
    console.error('CMS rich text changed lines below threshold:');
    for (const failure of cmsRichTextChangedLineCoverage.failures) {
      console.error(`- ${failure}`);
    }
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
console.log(
  `CMS rich text changed lines checked: ${cmsRichTextChangedLineCoverage.checked} executable lines at ${formatPct(cmsRichTextChangedLineCoverage.checked === 0 ? 100 : (cmsRichTextChangedLineCoverage.covered / cmsRichTextChangedLineCoverage.checked) * 100)} (>=${cmsRichTextChangedLineMinimumPct}%).`
);
