# PRisk
This is a Chrome plugin that provides some risk heuristics based on characteristics of a github PR.

It's based on research I've read about various forms of defect prediction. Of course,
all heuristics are simply guidelines. They're there just to give you a quick sense
of some things that might warrant extra time in the code review.

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
    * The author's inexperience with the code base
    * The average maximum complexity of the additions
    * The total number of changes (additions + deletions)
    * The number of affected files

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
