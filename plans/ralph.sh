set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "Iteration $i"
  echo "--------------------------------"
  result=$(claude --permission-mode acceptEdits -p "@plans/prd.json @plans/progress.md @plans/assumptions.md \
1. Find the highest-priority feature to work on and work only on that feature. \
This should be the one YOU decide has the highest priority - not necessarily the first in the list. \
2. Check that the types check via npm run typecheck and that the tests pass via npm run test. \
3. Update the PRD with the work that was done. \
4. Append your progress to the @plans/progress.md file. \
Use this to leave a note for the next person working in the codebase. \
5. Use the 'npm run typecheck' and the 'npm run lint' commands to check that the there are no type issues and lint issues respectively. \
6. Make a git commit of that feature. \
**ONLY WORK ON A SINGLE FEATURE. DO NOT TAKE UP MULTIPLE FEATURES IN A SINGLE COMMIT.** \
7. Any assumptions you make, appent them to the @plans/assumptions.md file. \
If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>. \
")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete, after $i iterations. Exiting.  "
    exit 0
  fi
done
