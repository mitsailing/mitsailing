# Codacy PR Triage

Use this runbook when a pull request has Codacy comments, a red Codacy status, or local Codacy CLI findings.

## Top 10 practices

1. Fix source findings before changing configuration. Do not exclude app-owned files to hide analyzer output.
2. Keep `.codacy.yaml` exclusions narrow: generated output, build output, test reports, vendored code, migrations, policy prose, and documented analyzer mismatches only.
3. Keep local CLI state out of git. `codacy-cli init` creates `.codacy/`, and that directory must stay ignored.
4. Use the PR quality gate as the remote source of truth. A local CLI scan is useful for reproduction, but the GitHub status updates only after Codacy reanalyzes the pushed commit.
5. Triage by risk: security issues and Critical/High/Medium findings first, then warnings that simplify code. Low and Info findings are not PR blockers by repo policy.
6. Prefer minimal source fixes that improve maintainability. Avoid broad rewrites, new abstractions, or formatting churn just to satisfy a metric.
7. Treat analyzer mismatches explicitly. If a generic rule conflicts with React, Next.js, i18n, accessibility, or app design rules, document the mismatch instead of weakening all analysis.
8. Use tool-scoped exclusions only for proven low-signal files. Keep other Codacy analyzers active on the same source area when possible.
9. Reproduce locally with the same tool when useful:

   ```sh
   codacy-cli init
   codacy-cli install
   codacy-cli analyze --tool lizard --format sarif --output /tmp/codacy-lizard.sarif
   ```

10. After a fix, run the repo checks that cover the touched code, push normally, and wait for Codacy's remote PR analysis before claiming the Codacy gate is clean.

## Official docs

- Codacy configuration file: https://docs.codacy.com/repositories-configure/codacy-configuration-file
- Adjusting quality gates: https://docs.codacy.com/repositories-configure/adjusting-quality-gates
- Git workflow integration: https://docs.codacy.com/getting-started/integrating-codacy-with-your-git-workflow
- Codacy Guardrails CLI getting started: https://docs.codacy.com/codacy-guardrails/codacy-guardrails-getting-started
- Codacy local analysis example: https://docs.codacy.com/repositories-configure/local-analysis/running-eslint
