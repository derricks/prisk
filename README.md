# PRisk
This is a Chrome plugin that provides some risk heuristics based on characteristics of a github PR.

It's based on research I've read about various forms of defect prediction. Of course,
all heuristics are simply guidelines. They're there just to give you a quick sense
of some things that might warrant extra time in the code review. This isn't a replacement
for a thorough code review, just a set of flags that you should consider when
doing a code review.

What Research?
==============
Some of the work that has inspired and informed this:
  * Predicting Risk of Software Changes - Audris Mockus and David M. Weiss
  * Reading Beside the Lines: Indentation as a Proxy for Complexity Metrics - Abram Hindle, Michael Godfrey, Richard Holt
  * _Your Code As a Crime Scene_, Adam Tornhill
  * Reexamining the Fault Density - Component Size Connection - Les Hatton


What's Implemented
==================
The following risk factors are currently called out:
  * Top-level risk assessments
    * The author's inexperience with the code base.
      Generally, the less a programmer understands the code base, the more defects they'll create.
      This is calculated by comparing the percentage of merged PRs from this author within the total
      number of merged PRs.
    * The average maximum complexity of the additions.
      More complex code has more defects and is harder to maintain.
      This is an average across all the diffs. Complexity is approximated by looking at the
      number of unique indents within the diff.       
    * The total number of changes (additions + deletions)
      The more changes, the harder it is for a reviewer to give careful consideration to them all.
    * The number of affected files
      The more files that have changed, the more likely there are defects and the harder it is for
      a reviewer to keep the whole set of changes in their head.

What's Planned
==============

Provide a top-level risk analysis of PRs
----------------------------------------
  * Author's PRs have a historic median of high numbers of comments
  * Volatile files are included
  * Amount of test code vs. feature code

Provide a per-file (or per-diff) risk analysis
----------------------------------------------
  * Volatile files
  * Stable files (this PR might perturb stability)
  * Sparkline for commits on file over time
  * White space as complexity approximation
  * Number of authors of a given file

Misc.
-----
  * Support arbitrary domains so it can be used with github.com or enterprise github
