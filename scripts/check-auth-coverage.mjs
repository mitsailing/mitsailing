import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {{ pct: number }} CoverageMetric
 * @typedef {{ branches: CoverageMetric, lines: CoverageMetric }} FileCoverageSummary
 * @typedef {Record<string, FileCoverageSummary>} CoverageSummary
 */

const coverageSummaryPath = path.join(
  process.cwd(),
  'coverage',
  'coverage-summary.json'
);

const minimumPct = 95;

const authProfileCoverageFiles = [
  'src/app/api/unlock-account/route.ts',
  'src/app/[locale]/(auth)/(center)/forgot-password/ForgotPasswordForm.tsx',
  'src/app/[locale]/(auth)/(center)/login/SignInForm.tsx',
  'src/app/[locale]/(auth)/(center)/reset-password/ResetPasswordForm.tsx',
  'src/app/[locale]/(auth)/(center)/signup/SignUpForm.tsx',
  'src/app/[locale]/(auth)/(center)/verify-email/VerifyEmailForm.tsx',
  'src/app/[locale]/(auth)/profile/ProfileAccountClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfileDeleteAccountClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfilePasswordClient.tsx',
  'src/app/[locale]/(auth)/profile/ProfileSecurityClient.tsx',
  'src/components/auth/SignOutForm.tsx',
  'src/components/auth/StopImpersonationButton.tsx',
  'src/components/auth/profile/ProfileAppearanceSection.tsx',
  'src/components/auth/profile/ProfileSideNav.tsx',
  'src/components/auth/profile/profileAuthErrorMaps.ts',
  'src/components/auth/profile/profileBanner.tsx',
  'src/libs/auth/adminHeaderLink.ts',
  'src/libs/auth/callbackUrl.ts',
  'src/libs/auth/dal.ts',
  'src/libs/auth/hooks.ts',
  'src/libs/auth/password-compromise.ts',
  'src/libs/auth/roles.ts',
  'src/libs/auth/themePreferenceActions.ts',
  'src/libs/auth/unlock-token.ts',
  'src/libs/email/account-emails.ts',
];

const authProfileExcludedFiles = [
  {
    path: 'src/libs/auth.ts',
    reason: 'Better Auth server/plugin wiring around third-party adapters',
    e2eProof: ['tests/e2e/Auth.e2e.ts', 'tests/e2e/AccountLockout.e2e.ts'],
  },
  {
    path: 'src/libs/auth-client.ts',
    reason: 'Better Auth React client/plugin wiring',
    e2eProof: ['tests/e2e/Auth.e2e.ts', 'tests/e2e/AdminHub.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/layout.tsx',
    reason: 'Next.js route-group layout adapter',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/layout.tsx',
    reason: 'Next.js auth-center layout adapter',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/login/page.tsx',
    reason: 'Next.js page shell and redirect orchestration',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/signup/page.tsx',
    reason: 'Next.js page shell and redirect orchestration',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/forgot-password/page.tsx',
    reason: 'Next.js page shell and redirect orchestration',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/reset-password/page.tsx',
    reason: 'Next.js page shell and redirect orchestration',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/verify-email/page.tsx',
    reason: 'Next.js page shell and redirect orchestration',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/(center)/unlock-account/page.tsx',
    reason: 'Static recovery page covered through browser routing',
    e2eProof: ['tests/e2e/AccountLockout.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/layout.tsx',
    reason: 'Next.js profile layout adapter',
    e2eProof: ['tests/e2e/Auth.e2e.ts', 'tests/e2e/ProfileAppearance.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/page.tsx',
    reason: 'Next.js redirect page adapter',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/account/page.tsx',
    reason: 'Server page shell and profile data wiring',
    e2eProof: ['tests/e2e/Auth.e2e.ts', 'tests/e2e/ProfileAppearance.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/password/page.tsx',
    reason: 'Server page shell and profile data wiring',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/security/page.tsx',
    reason: 'Server page shell and profile data wiring',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/app/[locale]/(auth)/profile/delete/page.tsx',
    reason: 'Server page shell and profile data wiring',
    e2eProof: ['tests/e2e/Auth.e2e.ts'],
  },
  {
    path: 'src/components/auth/ImpersonationBanner.tsx',
    reason: 'Async server component depends on DAL and next-intl server wiring',
    e2eProof: ['tests/e2e/AdminHub.e2e.ts'],
  },
  {
    path: 'src/components/auth/profile/ProfileSettingsChrome.tsx',
    reason:
      'Async server shell composes auth verification and layout components',
    e2eProof: ['tests/e2e/Auth.e2e.ts', 'tests/e2e/AdminHub.e2e.ts'],
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
 * @returns {value is CoverageMetric} True when the metric has a numeric percentage.
 */
function isCoverageMetric(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pct' in value &&
    typeof value.pct === 'number'
  );
}

/**
 * @param {unknown} value - Candidate per-file summary from parsed JSON.
 * @returns {value is FileCoverageSummary} True when line and branch metrics exist.
 */
function isFileCoverageSummary(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'branches' in value &&
    isCoverageMetric(value.branches) &&
    'lines' in value &&
    isCoverageMetric(value.lines)
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
 * @param {string} projectPath - Auth-owned file path relative to the repo root.
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

function formatPct(value) {
  return `${Number(value).toFixed(2)}%`;
}

const rawSummary = await readFile(coverageSummaryPath, 'utf8');
const coverageSummary = JSON.parse(rawSummary);

if (!isCoverageSummary(coverageSummary)) {
  throw new TypeError('Invalid coverage summary format');
}

const failures = [];

for (const projectPath of authProfileCoverageFiles) {
  const fileSummary = findSummaryForFile(coverageSummary, projectPath);

  if (!fileSummary) {
    failures.push(`${projectPath}: missing from coverage summary`);
    continue;
  }

  const linePct = Number(fileSummary.lines.pct);
  const branchPct = Number(fileSummary.branches.pct);

  if (linePct < minimumPct || branchPct < minimumPct) {
    failures.push(
      `${projectPath}: lines ${formatPct(linePct)}, branches ${formatPct(
        branchPct
      )}`
    );
  }
}

if (failures.length > 0) {
  console.error(
    `Auth/profile coverage gate failed. Expected >=${minimumPct}% line and branch coverage for included auth/profile files.`
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(
    'Excluded files require an explicit reason and E2E proof path.'
  );
  for (const exclusion of authProfileExcludedFiles) {
    console.error(
      `- ${exclusion.path}: ${exclusion.reason}; proof: ${exclusion.e2eProof.join(', ')}`
    );
  }
  process.exit(1);
}

console.log(
  `Auth/profile coverage gate passed for ${authProfileCoverageFiles.length} included files at >=${minimumPct}% line and branch coverage.`
);
console.log(
  `Auth/profile coverage gate excludes ${authProfileExcludedFiles.length} files with documented E2E proof paths.`
);
