#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * @typedef {{ name: string, command: string, args: string[] }} Agent
 * @typedef {{ name: string, command: string, args: string[] }} Check
 * @typedef {{ ok: boolean, output: string }} CheckResult
 * @typedef {{
 *   agent: string,
 *   allowAiChanges: boolean,
 *   checksOnly: boolean,
 *   help: boolean
 * }} Options
 */

const cwd = process.cwd();
const codexPrepushModel = 'gpt-5.4-mini';

/** @type {Check[]} */
const checks = [
  { name: 'lint', command: 'npm', args: ['run', 'lint'] },
  { name: 'types', command: 'npm', args: ['run', 'check:types'] },
  { name: 'tests', command: 'npm', args: ['run', 'test'] },
];

const options = parseOptions(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (process.env.CI) {
  console.log('CI environment detected. Skipping pre-push AI checks.');
  process.exit(0);
}

const initialResult = runChecks();
const hasChanges = getStatusPorcelain().trim().length > 0;

if (!hasChanges && initialResult.ok) {
  console.log('No local changes and all checks passed. Skipping AI review.');
  process.exit(0);
}

if (options.checksOnly) {
  process.exit(initialResult.ok ? 0 : 1);
}

const agent = resolveAgent(options.agent);

if (!agent) {
  console.error(
    'No supported AI CLI found. Install cursor-agent or Codex, or run with ' +
      '--checks-only.'
  );
  process.exit(initialResult.ok ? 0 : 1);
}

const prompt = buildPrompt({
  checksOutput: initialResult.output,
  checksPassed: initialResult.ok,
  status: getStatusPorcelain(),
});

console.log(`\nRunning ${agent.name} pre-push repair/review...\n`);
const diffFingerprintBeforeAi = getDiffFingerprint();
const aiResult = spawnSync(agent.command, [...agent.args, prompt], {
  cwd,
  encoding: 'utf8',
  stdio: 'inherit',
});
const diffFingerprintAfterAi = getDiffFingerprint();

if (aiResult.error) {
  console.error(`Failed to run ${agent.name}: ${aiResult.error.message}`);
  process.exit(1);
}

if (aiResult.status !== 0) {
  console.error(`${agent.name} exited with status ${aiResult.status}.`);
}

const finalResult = runChecks();

if (finalResult.ok) {
  if (
    diffFingerprintAfterAi !== diffFingerprintBeforeAi &&
    !options.allowAiChanges
  ) {
    console.error(
      '\nAI changed the working tree. Review and commit those changes, then ' +
        'push again.'
    );
    process.exit(1);
  }

  console.log('\nPre-push AI checks passed.');
  process.exit(0);
}

console.error('\nPre-push AI checks still have failures.');
process.exit(1);

/**
 * @param {string[]} args - CLI arguments after the script path.
 * @returns {Options} Parsed options.
 */
function parseOptions(args) {
  /** @type {Options} */
  const parsed = {
    agent: 'auto',
    allowAiChanges: false,
    checksOnly: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--allow-ai-changes') {
      parsed.allowAiChanges = true;
      continue;
    }

    if (arg === '--checks-only') {
      parsed.checksOnly = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg.startsWith('--agent=')) {
      parsed.agent = arg.slice('--agent='.length);
      continue;
    }

    console.error(`Unknown option: ${arg}`);
    parsed.help = true;
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/prepush-ai.mjs [options]

Runs lint, typecheck, and unit/component tests. If there are local changes,
it asks an AI CLI to fix real issues in the current diff, then reruns checks.

Options:
  --agent=auto|cursor|codex|none  AI CLI to use. Default: auto.
                                  Auto finds cursor-agent/codex on PATH; on macOS it also checks the Codex app bundle.
  --allow-ai-changes              Exit 0 even if AI edits the working tree.
  --checks-only                   Run checks without invoking AI.
  -h, --help                      Show this help.
`);
}

/**
 * @returns {CheckResult} Combined check result.
 */
function runChecks() {
  let ok = true;
  const output = [];

  for (const check of checks) {
    console.log(`\n> ${check.command} ${check.args.join(' ')}`);
    const result = spawnSync(check.command, check.args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';

    process.stdout.write(stdout);
    process.stderr.write(stderr);

    output.push(`## ${check.name}\n${stdout}${stderr}`);

    if (result.error) {
      ok = false;
      output.push(`Error: ${result.error.message}`);
      break;
    }

    if (result.status !== 0) {
      ok = false;
      break;
    }
  }

  return {
    ok,
    output: output.join('\n\n').slice(-20_000),
  };
}

/**
 * @param {string} requestedAgent - Requested agent id.
 * @returns {Agent | null} Resolved agent command or null.
 */
function resolveAgent(requestedAgent) {
  if (requestedAgent === 'none') {
    return null;
  }

  const cursorAgent = findCommand('cursor-agent', [
    path.join(os.homedir(), '.local/bin/cursor-agent'),
  ]);

  const codexAbsolutePaths =
    process.platform === 'darwin'
      ? ['/Applications/Codex.app/Contents/Resources/codex']
      : [];
  const codexAgent = findCommand('codex', codexAbsolutePaths);

  if (requestedAgent === 'cursor') {
    return cursorAgent ? createCursorAgent(cursorAgent) : null;
  }

  if (requestedAgent === 'codex') {
    return codexAgent ? createCodexAgent(codexAgent) : null;
  }

  if (requestedAgent !== 'auto') {
    console.error(`Unsupported agent: ${requestedAgent}`);
    return null;
  }

  if (cursorAgent) {
    return createCursorAgent(cursorAgent);
  }

  if (codexAgent) {
    return createCodexAgent(codexAgent);
  }

  return null;
}

/**
 * @param {string} command - Absolute or PATH-resolved command.
 * @returns {Agent} Cursor agent invocation.
 */
function createCursorAgent(command) {
  return {
    name: 'cursor-agent',
    command,
    args: [
      '--print',
      '--trust',
      '--force',
      '--workspace',
      cwd,
      '--output-format',
      'text',
    ],
  };
}

/**
 * @param {string} command - Absolute or PATH-resolved command.
 * @returns {Agent} Codex agent invocation.
 */
function createCodexAgent(command) {
  return {
    name: 'codex',
    // Security warning: --dangerously-bypass-approvals-and-sandbox gives Codex
    // full local filesystem and command execution access. Use only on trusted
    // developer machines.
    command,
    args: [
      'exec',
      '--model',
      codexPrepushModel,
      '--dangerously-bypass-approvals-and-sandbox',
      '--cd',
      cwd,
    ],
  };
}

/**
 * @param {string} command - Executable name to find on PATH.
 * @param {string[]} absolutePaths - Preferred absolute command paths.
 * @returns {string | null} Executable path when found.
 */
function findCommand(command, absolutePaths) {
  for (const absolutePath of absolutePaths) {
    if (isExecutableFile(absolutePath)) {
      return absolutePath;
    }
  }

  if (!isBareCommandName(command)) {
    return null;
  }

  const pathEntries = getPathEntries();
  const commandNames = getPlatformCommandNames(command);

  for (const pathEntry of pathEntries) {
    for (const commandName of commandNames) {
      const candidate = path.join(pathEntry, commandName);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * @param {string} command - Executable name to validate.
 * @returns {boolean} Whether command is a plain filename.
 */
function isBareCommandName(command) {
  return (
    command.length > 0 &&
    !command.includes('/') &&
    !command.includes('\\') &&
    command === path.basename(command)
  );
}

/**
 * @returns {string[]} Directories from PATH.
 */
function getPathEntries() {
  const pathValue = process.env.PATH ?? '';

  return pathValue
    .split(path.delimiter)
    .filter((pathEntry) => pathEntry.length > 0);
}

/**
 * @param {string} command - Executable filename.
 * @returns {string[]} Platform-specific executable filename candidates.
 */
function getPlatformCommandNames(command) {
  if (process.platform !== 'win32' || path.extname(command).length > 0) {
    return [command];
  }

  const extensions = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .filter((extension) => extension.length > 0);

  return [command, ...extensions.map((extension) => `${command}${extension}`)];
}

/**
 * @param {string} filePath - File path to check.
 * @returns {boolean} Whether the path exists and is executable.
 */
function isExecutableFile(filePath) {
  try {
    if (!statSync(filePath).isFile()) {
      return false;
    }
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {string} Current porcelain status output.
 */
function getStatusPorcelain() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf8',
  });

  return result.stdout ?? '';
}

/**
 * @returns {string} Stable fingerprint of status and diff.
 */
function getDiffFingerprint() {
  const status = getStatusPorcelain();
  const diff = spawnSync(
    'git',
    ['diff', '--no-ext-diff', '--binary', 'HEAD', '--'],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    }
  );

  return createHash('sha256')
    .update(status)
    .update(diff.stdout ?? '')
    .digest('hex');
}

/**
 * @param {{ checksOutput: string, checksPassed: boolean, status: string }} options - Prompt inputs.
 * @returns {string} Prompt for the AI repair command.
 */
function buildPrompt({ checksOutput, checksPassed, status }) {
  const checkInstruction = checksPassed
    ? 'The required checks passed before your review.'
    : 'The required checks failed before your review. Use the failure output ' +
      'below.';

  return `You are running as the repo's pre-push AI repair step.

Follow AGENTS.md and the applicable Cursor rules. Keep changes minimal and
focused on the current working tree. Do not commit, stage, push, rebase, or
revert unrelated user changes.

${checkInstruction}

Task:
1. Inspect the current git diff and the check output.
2. Fix real bugs, regressions, type errors, lint errors, or missing tests
   directly in the working tree.
3. Do not make cosmetic rewrites or unrelated refactors.
4. Rerun only relevant allowed checks while you work:
   npm run lint
   npm run check:types
   npm run test
5. Stop when the issue is fixed or when you can explain the remaining blocker.

Current git status:
${status}

Check output:
${checksOutput}
`;
}
