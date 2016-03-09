# git-pr-buddy
Chrome plugin to add risk analysis to git PRs

What's Implemented
------------------

What's Planned
--------------
Provide a top-level risk analysis of PRs
  * Author has contributed a small number of commits to code base (relative to total)
  * Author's PRs have a historic median of high numbers of comments
  * Number of lines changed
  * Volatile files are included
  * Average max complexity is high
  * Amount of test code vs. feature code

Provide a per-file (or per-diff) risk analysis
----------------------------------------------
  * Volatile files
  * Stable files (this PR might perturb stability)
  * Sparkline for commits on file over time
  * White space as complexity approximation
