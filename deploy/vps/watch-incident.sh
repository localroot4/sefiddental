#!/usr/bin/env bash
# The incident issue of the workflow "Watch" (.github/workflows/watch.yml, docs/deploy.md 3.6).
#
#   watch-incident.sh FAILURES RUN_URL SITE_URL
#
# FAILURES: a file with one line per failed check, empty when every check passed. Through gh
# (GH_TOKEN, GH_REPO) it keeps at most one open issue labelled "incident":
# - failures and no open issue: opens one; GitHub mails it to everyone who watches the repository;
# - failures and an open issue: comments when the lines, digits aside, differ from its last
#   report, else nothing;
# - no failures and an open issue: comments the recovery and closes the issue.
# The repository is public, and so are its issues: the lines name checks, never a secret.
set -Eeuo pipefail
failures=$1
run=$2
site=$3
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
number=$(gh issue list --label incident --state open --limit 1 --json number --jq '.[0].number // empty')

if [ ! -s "$failures" ]; then
  if [ -n "$number" ]; then
    gh issue comment "$number" --body "Recovered at $now UTC: every check passed. Run: $run"
    gh issue close "$number"
    echo "every check passed: closed incident #$number"
  else
    echo "every check passed: no incident"
  fi
  exit 0
fi

# Digits do not count: "27 h old" and "28 h old" are the same failure, which must not mail
# again every hour.
sig=$(sed -E 's/[0-9]+/N/g' "$failures" | sort | sha256sum | cut -c 1-16)
# shellcheck disable=SC2016 # Markdown backticks, not command substitution
report=$(
  printf 'Failed at %s UTC on %s:\n\n```\n%s\n```\n\n' "$now" "$site" "$(cat "$failures")"
  printf 'Run: %s\n\n' "$run"
  printf 'Next: run the workflow "Server" with the action `status`, then follow docs/deploy.md 3.6. '
  printf 'This issue closes itself after the first run in which every check passes.\n\n'
  printf '<!-- watch:%s -->\n' "$sig"
)
if [ -z "$number" ]; then
  gh label create incident --color B60205 --description 'Opened and closed by the workflow Watch' --force >/dev/null
  echo "opened $(gh issue create --title "Site check failed: $site" --label incident --body "$report")"
  exit 0
fi
# The repository is public: only the body and the comments of the workflow's own bot count, so
# a comment by anyone else cannot silence a report.
last=$(gh issue view "$number" --json body,comments --jq '[.body, (.comments[] | select(.author.login == "github-actions" or .author.login == "app/github-actions") | .body)] | map(select(contains("<!-- watch:"))) | last // ""')
if [[ $last == *"<!-- watch:$sig -->"* ]]; then
  echo "incident #$number: the same failures as its last report, no new comment"
else
  gh issue comment "$number" --body "$report"
  echo "incident #$number: commented the changed failures"
fi
