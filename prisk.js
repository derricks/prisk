/** Provides risk heuristics for a given pull request. */

const prisk = {

  /** This serves as the main entry point for this object.
   *  The page calls this to start the risk assessment.
   *
   *  @public
   */
  createRiskAssessment: function() {
    if (!git_helper.isPRDiffPresent(prisk.constants.PR_DIFF_DIV_ID)) {
      return;
    }

    ui.configureUI();

    git_helper.fetchAsJson(git_helper.getPRAPIURL(window.location.href), function(prData) {

      // fill in some convenience info from the data
      prisk.pr_repo =  prData.base.repo.name;
      prisk.pr_org = prData.base.repo.owner.login;
      prisk.mergedSearchQuery = 'type:pr is:merged repo:' + prisk.pr_org + prisk.constants.URL_SLASH + prisk.pr_repo;

      // fill in the "total changes" risk value, which is just the sum of additions/deletions
      prisk.setMetricField(config.OVERALL_FIELD_TO_DESCRIPTION.TOTAL_CHANGES,
                              prData.additions + prData.deletions);
      // changed files
      prisk.setMetricField(config.OVERALL_FIELD_TO_DESCRIPTION.NUM_FILES, prData.changed_files);

      prisk.showAuthorNewness(prData.user.login);

      prisk.loadDiffRisks(prData);
    });

    // with that kicked off, calculate the average max complexity
    prisk.setMetricField(config.OVERALL_FIELD_TO_DESCRIPTION.AVG_MAX_COMPLEXITY,
      prisk.calculateAverageMaxComplexity());
  },

  /** Calculate the average max complexity of the PR
   *  by trawling through the diff divs and looking at the
   * indentation of the code lines.
   *
   * @private
   * @return {Float} the average max complexity of all the diffs.
   */
   calculateAverageMaxComplexity: function() {

     const fileDiffs = ui.getDiffElements();
     const maxComplexities = fileDiffs.map( function(file) {
       return prisk.getComplexityForDiffDiv(file);
     });

     const nonZeroComplexities = maxComplexities.filter( function(complexity) { return complexity != 0;} );
     const nonZeroComplexitiesSum = nonZeroComplexities.reduce( function( prev, current, _index, _array) { return prev + current; }, 0 );
     return nonZeroComplexitiesSum/nonZeroComplexities.length;
   },

   /** Calculate the volatility risk for the file mentioned in the diff,
    *  and set the appropriate field with the value.
    */
   calculateAndShowFileVolatilityRisk: function(diffElem) {
     const fileName = ui.getFileNameForDiff(diffElem);

     // 90 days ago
     const threeMonthsAgo = util.getNDaysAgo(90);
     git_helper.collectAllCommitData(git_helper.getCommitsURLForFile(fileName) + '&since=' + threeMonthsAgo.toISOString(), function(results) {
       prisk.setRiskInDiff(diffElem, results.length, config.DIFF_FIELD_TO_DESCRIPTION.FILE_VOLATILITY_RISK);
     });
   },

   /** Calculate the author volatility (too many recent contributors)
    *  and update the appropriate field in the diff.
    */
   calculateAndShowAuthorVolatilityRisk: function(diffElem) {
     const threeMonthsAgo = util.getNDaysAgo(90);
     const fileName = ui.getFileNameForDiff(diffElem);
     git_helper.collectAllCommitData(git_helper.getCommitsURLForFile(fileName) + '&since=' + threeMonthsAgo.toISOString(), function(results) {

       const authors = results.map( function(commit) {
         return commit.commit.author.name;
       });

       const uniqueAuthors = [];
       authors.forEach( function(author) {
         uniqueAuthors[author] = true;
       });

       prisk.setRiskInDiff(diffElem, Object.keys(uniqueAuthors).length, config.DIFF_FIELD_TO_DESCRIPTION.AUTHOR_VOLATILITY_RISK);
     });
   },

   /** Calculate the file youth risk. Newer files tend to have more
    *  defects. Note that this is a reverse risk assessment, since
    *  the various  functions that show risk assume a lower number is
    *  better. We do this by subtracting from our "best" value.
    */
   calculateAndShowFileYouthRisk: function(diffElem) {
     const filename = ui.getFileNameForDiff(diffElem);
     // if any item in the result set is older than this date,
     // we can stop fetching results
     const safeDate = util.getNDaysAgo(config.DIFF_FIELD_TO_DESCRIPTION.FILE_YOUTH_RISK.safeDaysBack);

     git_helper.collectAllCommitData(git_helper.getCommitsURLForFile(filename),
       function(commits) {

         const commitDates = commits.map( function timestampsOnly(commit) {
           return new Date(commit.commit.author.date).getTime()
         });

         // sort the commits by age, and find the oldest commit
         const sortedCommits = commitDates.sort( function sortByCommitAge(commitTimestamp1, commitTimestamp2) {
           if (commitTimestamp1 < commitTimestamp2) {
             return -1;
           } else if (commitTimestamp1 > commitTimestamp2) {
             return 1;
           } else {
             return 0;
           }
         });

         // if there are no commits for this file, it's a new file, so set it to now so that risk is high
         const earliestTimestamp = sortedCommits.length === 0 ? new Date().getTime() : sortedCommits[0];
         const daysSinceEarliestCommit = (new Date().getTime() - earliestTimestamp)/prisk.constants.MILLIS_PER_DAY
         prisk.setRiskInDiff(diffElem, config.DIFF_FIELD_TO_DESCRIPTION.FILE_YOUTH_RISK.safeDaysBack - daysSinceEarliestCommit,
               config.DIFF_FIELD_TO_DESCRIPTION.FILE_YOUTH_RISK);
    }, function commitsAreYounger(currentResults) {
      const safeDateMillis = safeDate.getTime();
      // if any element in the current set of results is older than safeDate, then we can stop querying
      // because we know the risk is low
      const foundOlderCommit = currentResults.find( function isAnyDateOldEnough(commit) {
        return new Date(commit.commit.author.date).getTime() < safeDateMillis;
      });

      return foundOlderCommit === undefined
    });

   },

   /** Given a file, figure out who the most likely owners are by looking at the last 50 commits
    *
    * @param {Element} the diff element to populate
    */
    calculateOwners: function(diffElem) {
      const filename = ui.getFileNameForDiff(diffElem);

      git_helper.collectAllCommitData(git_helper.getCommitsURLForFile(filename),
        function retrieveAuthors(commits) {

          const allAuthors = commits.map( commit => commit.commit.author.name );
          const authorCounts = allAuthors.reduce(
            function countAuthors(currentView, currentAuthor) {
              currentView[currentAuthor] = (currentView[currentAuthor] ? currentView[currentAuthor] + 1 : 1);
              return currentView;
            }, []
          );

          const authorCountTuples = Object.keys(authorCounts).map( author => [author, authorCounts[author]]);
          authorCountTuples.sort( (left, right) => left[1] > right[1] ? -1 : (left[1] < right[1] ? 1 : 0) );
          const topTwo = authorCountTuples.slice(0,2).map( tuple => tuple[0] );

          // now find the authors div and append the text
          const diffAuthorDiv = document.getElementById(diffElem.id + '-' + prisk.constants.PR_DIFF_OWNER_DIV_ID);
          diffAuthorDiv.appendChild(document.createTextNode('Owners: ' + topTwo.toString()));

        }, function(commits) { return commits.length < 50; }
      );
    },


   /** Given a diff representing a file, return the maximum complexity
    * as defined by the number of unique indent levels, which is a stand-in
    * for McCabe complexity.
    * See  Reading Beside the Lines: Indentation as a Proxy for Complexity Metrics
    * Hindle, Godfrey, Holt.
    *
    * @private
    * @param {Element} the diff for a given file
    * @return {Integer} the maximum complexity within this diff.
    */
    getComplexityForDiffDiv: function(diff) {
      const additions = diff.getElementsByClassName('blob-code blob-code-addition');
      const individualIndents = util.htmlCollectionMap(additions, function(addition) {
        const codeSegment = addition.getElementsByClassName('blob-code-inner').item(0).firstChild.textContent.substring(1);
        const firstNonWhitespace = codeSegment.search(prisk.constants.FIRST_NON_WHITESPACE_REGEX);
        return firstNonWhitespace === -1 ? codeSegment.length : firstNonWhitespace;
      });

      // now get the unique values of indents within this diff. the length of that
      // is the maximum complexity of the diff's additions
      const uniqueIndents = [];
      individualIndents.forEach( function(indent) {
        // use "" + indent because "number".toString creates an index into a sparse array
        // even though "number" is a string; it's coerced to an Integer
        uniqueIndents[" " + indent] = true;
      });
      return Object.keys(uniqueIndents).length;
    },

  /** Sets the metric for an author's newness, which is defined as 100 -
   *  the percentage of merged PRs authored by this person.
   *  The subtraction is to make the logic consistent for calculating
   *  low, medium, or high risk. A newness value of 0 means the author
   *  wrote everything in the repo. A newness value of 100 means the
   *  author has never written anything for this repo.
   *
   * @private
   * @param {String} the username of this PR's author
   */
  showAuthorNewness: function(login) {
     const authorSearchUrl = git_helper.getSearchAPIURL(document.location.href) + '?q=' +
       encodeURIComponent(prisk.mergedSearchQuery + ' author:' + login) + prisk.constants.MINIMAL_SEARCH_RESULTS;

     git_helper.fetchAsJson(authorSearchUrl, function(authorPRSearchData) {
       const authoredCount = authorPRSearchData.total_count;

       // that gets us the author's PRs, but we need to compare to the total PRs
       // for the repo with another search and then divide
       const allRepoPRsUrl = git_helper.getSearchAPIURL(document.location.href) + '?q=' +
         encodeURIComponent(prisk.mergedSearchQuery) + prisk.constants.MINIMAL_SEARCH_RESULTS;

       git_helper.fetchAsJson(allRepoPRsUrl, function(allPRSearchData) {
         const totalCount = allPRSearchData.total_count;
         prisk.setMetricField(config.OVERALL_FIELD_TO_DESCRIPTION.AUTHOR_NEWNESS, 100 - ((authoredCount/totalCount) * 100));
       });
     });
  },

  /** Sets the value of the specified metric field.
   *
   * @private
   * @param {String} the ID of the field to set
   * @param {Object} the value to put into that field
   */
 setMetricField: function(metric, value) {
     const field = document.getElementById(metric.id);
     if (field == null) {
       console.log('field ' + metric.id + ' not found');
       return;
     }

     const riskAssessment = prisk.getRiskAssessment(value, metric);
     console.log('risk value for ' + metric.id + ': ' + value.toString());
     ui.setTextRiskAssessmentCell(field, riskAssessment);
  },

  /** Sets the risk value for a given metric within a particular diff.
   * @private
   * @param {Element} diff containing the information
   * @param {Number} the value of the risk assessment to be used
   * @param {Object} the general information for this risk assessment
   */
  setRiskInDiff: function(diff, riskValue, riskConfiguration) {
    const riskFieldId = diff.id + '-' + riskConfiguration.id;
    const riskField = document.getElementById(riskFieldId);
    const riskAssessment = prisk.getRiskAssessment(riskValue, riskConfiguration);

    console.log('risk value for ' + riskConfiguration.id + ' in ' + diff.id + ': ' + riskValue.toString());
    ui.setImageRiskAssessmentCell(riskField, riskConfiguration, riskAssessment);
  },

  /** Given a risk assessment value and the configuration for that risk
   * assessment, return the risk assessment as a text field.
   *
   * @private
   * @param {Number} the value of the risk metric
   * @param {Object} the configuration for that risk metric
   * @return {String} the risk assessment for that value based on the configuration
   */
   getRiskAssessment: function(value, configuration) {
     if (value >= configuration.warnValue) {
       return 'HIGH';
     }

     if (value >= configuration.goodValue) {
       return 'MEDIUM';
     }

     return 'LOW';
   },

  /** Iterate through all the file diffs and relevant risk metrics.
   *
   * @private
   * @param {Object} the JSON data for the PR, as a convenience
   */
  loadDiffRisks: function(prData) {
     const diffs = ui.getDiffElements();
     diffs.forEach(function(diffElem) {
        const maxComplexity = prisk.getComplexityForDiffDiv(diffElem);
        prisk.setRiskInDiff(diffElem, maxComplexity, config.DIFF_FIELD_TO_DESCRIPTION.MAX_COMPLEXITY);

        prisk.calculateAndShowFileVolatilityRisk(diffElem);

        prisk.calculateAndShowAuthorVolatilityRisk(diffElem);

        prisk.calculateAndShowFileYouthRisk(diffElem);

        prisk.calculateOwners(diffElem);

     });
   },

  constants: {
    URL_SLASH: '/',
    RESULTS_ID: 'prisk-overall-risk-results',
    MINIMAL_SEARCH_RESULTS: '&per_page=1',
    FIRST_NON_WHITESPACE_REGEX: /[^\s]/,
    FILES_DIV: 'files',
    FILE_DIV: 'file',
    LOADING_STATUS: 'Loading',
    MILLIS_PER_DAY: 24 * 60 * 60 * 1000,
    PR_DIFF_DIV_ID: 'partial-discussion-header',
    PR_DIFF_OWNER_DIV_ID: 'prisk-owner-list'
  }
};


prisk.createRiskAssessment();
