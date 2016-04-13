/** Provides risk heuristics for a given pull request. */

const prisk = {

  /** This serves as the main entry point for this object.
   *  The page calls this to start the risk assessment.
   *
   *  @public
   */
  createRiskAssessment: function() {
    ui.configureUI();

    git_helper.fetchAsJson(prisk.getPRAPIURL_(window.location.href), function(prData) {

      // fill in some convenience info from the data
      prisk.pr_repo =  prData.base.repo.name;
      prisk.pr_org = prData.base.repo.owner.login;
      prisk.mergedSearchQuery = 'type:pr is:merged repo:' + prisk.pr_org + prisk.constants_.URL_SLASH + prisk.pr_repo;

      // fill in the "total changes" risk value, which is just the sum of additions/deletions
      prisk.setMetricField_(config.OVERALL_FIELD_TO_DESCRIPTION.TOTAL_CHANGES,
                              prData.additions + prData.deletions);
      // changed files
      prisk.setMetricField_(config.OVERALL_FIELD_TO_DESCRIPTION.NUM_FILES, prData.changed_files);

      prisk.showAuthorNewness_(prData.user.login);

      prisk.loadDiffRisks_(prData);
    });

    // with that kicked off, calculate the average max complexity
    prisk.setMetricField_(config.OVERALL_FIELD_TO_DESCRIPTION.AVG_MAX_COMPLEXITY,
      prisk.calculateAverageMaxComplexity_());
  },

  /** Calculate the average max complexity of the PR
   *  by trawling through the diff divs and looking at the
   * indentation of the code lines.
   *
   * @private
   * @return {Float} the average max complexity of all the diffs.
   */
   calculateAverageMaxComplexity_: function() {

     const fileDiffs = ui.getDiffElements_();
     const maxComplexities = fileDiffs.map( function(file) {
       return prisk.getComplexityForDiffDiv_(file);
     });

     const nonZeroComplexities = maxComplexities.filter( function(complexity) { return complexity != 0;} );
     const nonZeroComplexitiesSum = nonZeroComplexities.reduce( function( prev, current, _index, _array) { return prev + current; }, 0 );
     return nonZeroComplexitiesSum/nonZeroComplexities.length;
   },

   /** Calculate the volatility risk for the file mentioned in the diff,
    *  and set the appropriate field with the value.
    */
   calculateAndShowFileVolatilityRisk_: function(diffElem) {
     const fileName = prisk.getFileNameForDiff_(diffElem);

     // 90 days ago
     const threeMonthsAgo = new Date(new Date().getTime() - (90 * prisk.constants_.MILLIS_PER_DAY));
     git_helper.collectAllCommitData(prisk.getRepoAPIURL_(document.location.href) + '/commits?path=' + fileName + '&since=' + threeMonthsAgo.toISOString(), function(results) {
       prisk.setRiskInDiff_(diffElem, results.length, config.DIFF_FIELD_TO_DESCRIPTION.FILE_VOLATILITY_RISK);
     });
   },

   /** Calculate the author volatility (too many recent contributors)
    *  and update the appropriate field in the diff.
    */
   calculateAndShowAuthorVolatilityRisk_: function(diffElem) {
     const threeMonthsAgo = new Date(new Date().getTime() - (90 * prisk.constants_.MILLIS_PER_DAY));
     const fileName = prisk.getFileNameForDiff_(diffElem);
     git_helper.collectAllCommitData(prisk.getRepoAPIURL_(document.location.href) + '/commits?path=' + fileName + '&since=' + threeMonthsAgo.toISOString(), function(results) {

       const authors = results.map( function(commit) {
         return commit.commit.author.name;
       });

       const uniqueAuthors = [];
       authors.forEach( function(author) {
         uniqueAuthors[author] = true;
       });

       prisk.setRiskInDiff_(diffElem, Object.keys(uniqueAuthors).length, config.DIFF_FIELD_TO_DESCRIPTION.AUTHOR_VOLATILITY_RISK);
     });
   },

   /** Calculate the file youth risk. Newer files tend to have more
    *  defects. Note that this is a reverse risk assessment, since
    *  the various functions that show risk assume a lower number is
    *  better. We do this by subtracting from our "best" value.
    */
   calculateAndShowFileYouthRisk_: function(diffElem) {
     const filename = prisk.getFileNameForDiff_(diffElem);
     git_helper.collectAllCommitData(prisk.getRepoAPIURL_(document.location.href) + '/commits?path=' + filename,
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
         const daysSinceEarliestCommit = (new Date().getTime() - earliestTimestamp)/prisk.constants_.MILLIS_PER_DAY
         prisk.setRiskInDiff_(diffElem, 30 - daysSinceEarliestCommit, config.DIFF_FIELD_TO_DESCRIPTION.FILE_YOUTH_RISK);
    });

   },

   getFileNameForDiff_: function(diffElem) {
     const fileNameElem = diffElem.getElementsByClassName('js-selectable-text').item(0);
     return fileNameElem.getAttribute('title');
   },


   /** Given a diff representing a file, return the maximum complexity
    * as defined by the number of unique indent levels, which is a stand-in
    * for McCabe complexity.
    * See: Reading Beside the Lines: Indentation as a Proxy for Complexity Metrics
    * Hindle, Godfrey, Holt.
    *
    * @private
    * @param {Element} the diff for a given file
    * @return {Integer} the maximum complexity within this diff.
    */
    getComplexityForDiffDiv_(diff) {
      const additions = diff.getElementsByClassName('blob-code blob-code-addition');
      const individualIndents = prisk.htmlCollectionMap_(additions, function(addition) {
        const codeSegment = addition.getElementsByClassName('blob-code-inner').item(0).firstChild.textContent.substring(1);
        const firstNonWhitespace = codeSegment.search(prisk.constants_.FIRST_NON_WHITESPACE_REGEX);
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

   /** Given an HTMLCollection, apply the map function to each element
    *
    * @private
    * @param {HTMLCollection} the collection of HTML elements to traverse
    * @param {Function} the mapping function to apply to each item
    * @return {Array} the mapped values from the collection
    */
   htmlCollectionMap_: function(collection, mapFunction) {
     const returnValue = [];

     for (let collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
       const mapResult = mapFunction(collection.item(collectionIndex));
       returnValue.push(mapResult);
     }
     return returnValue;
   },

   /** Filter out elements from an HTMLCollection that don't pass
    *  the filter function. If filter function returns true, the item
    *  is included.
    *
    * @param {HTMLCollection} the HTMLCollection to filter
    * @return {Array} the items that have passed the filter function
    */
    htmlCollectionFilter_: function(collection, filterFunction) {
      const returnValue = [];
      prisk.htmlCollectionForEach_(collection, function(item) {
        if (filterFunction(item)) {
          returnValue.push(item);
        }
      });
      return returnValue;
    },

   /** Given an HTMLCollection, iterate over the each item and call
    *  the callback function with that item.
    *
    * @private
    * @param {HTMLCollection} collection
    * @param {Function} the function to invoke with each item
    */
   htmlCollectionForEach_: function(collection, forEachFunction) {
     for (let collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
       forEachFunction(collection.item(collectionIndex));
     }
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
  showAuthorNewness_: function(login) {
     const authorSearchUrl = prisk.getSearchAPIURL_(document.location.href) + '?q=' +
       encodeURIComponent(prisk.mergedSearchQuery + ' author:' + login) + prisk.constants_.MINIMAL_SEARCH_RESULTS;

     git_helper.fetchAsJson(authorSearchUrl, function(authorPRSearchData) {
       const authoredCount = authorPRSearchData.total_count;

       // that gets us the author's PRs, but we need to compare to the total PRs
       // for the repo with another search and then divide
       const allRepoPRsUrl = prisk.getSearchAPIURL_(document.location.href) + '?q=' +
         encodeURIComponent(prisk.mergedSearchQuery) + prisk.constants_.MINIMAL_SEARCH_RESULTS;

       git_helper.fetchAsJson(allRepoPRsUrl, function(allPRSearchData) {
         const totalCount = allPRSearchData.total_count;
         prisk.setMetricField_(config.OVERALL_FIELD_TO_DESCRIPTION.AUTHOR_NEWNESS, 100 - ((authoredCount/totalCount) * 100));
       });
     });
  },

  /** Sets the value of the specified metric field.
   *
   * @private
   * @param {String} the ID of the field to set
   * @param {Object} the value to put into that field
   */
 setMetricField_: function(metric, value) {
     const field = document.getElementById(metric.id);
     if (field == null) {
       console.log('field ' + metric.id + ' not found');
       return;
     }

     const riskAssessment = prisk.getRiskAssessment_(value, metric);
     console.log('risk value for ' + metric.id + ': ' + value.toString());

     ui.setTextRiskAssessmentCell_(field, riskAssessment);
  },

  /** Sets the risk value for a given metric within a particular diff.
   * @private
   * @param {Element} diff containing the information
   * @param {Number} the value of the risk assessment to be used
   * @param {Object} the general information for this risk assessment
   */
  setRiskInDiff_: function(diff, riskValue, riskConfiguration) {
    const riskFieldId = diff.id + '-' + riskConfiguration.id;
    const riskField = document.getElementById(riskFieldId);
    const riskAssessment = prisk.getRiskAssessment_(riskValue, riskConfiguration);

    console.log('risk value for ' + riskConfiguration.id + ' in ' + diff.id + ': ' + riskValue.toString());
    ui.setImageRiskAssessmentCell_(riskField, riskConfiguration, riskAssessment);
  },

  /** Given a risk assessment value and the configuration for that risk
   * assessment, return the risk assessment as a text field.
   *
   * @private
   * @param {Number} the value of the risk metric
   * @param {Object} the configuration for that risk metric
   * @return {String} the risk assessment for that value based on the configuration
   */
   getRiskAssessment_: function(value, configuration) {
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
  loadDiffRisks_: function(prData) {
     const diffs = ui.getDiffElements_();
     diffs.forEach(function(diffElem) {
        const maxComplexity = prisk.getComplexityForDiffDiv_(diffElem);
        prisk.setRiskInDiff_(diffElem, maxComplexity, config.DIFF_FIELD_TO_DESCRIPTION.MAX_COMPLEXITY);

        prisk.calculateAndShowFileVolatilityRisk_(diffElem);

        prisk.calculateAndShowAuthorVolatilityRisk_(diffElem);

        prisk.calculateAndShowFileYouthRisk_(diffElem);
     });
   },

  /** Loads the PR JSON from the given URL.
   *
   * @private
   * @param {String} the API url from which to fetch the PR JSON
   * @param {Function} a callback function that takes the PR data JSON
   */
  loadPRData_: function(prUrl, prHandlerFunction) {
    return git_helper.fetchAsJson(prUrl, prHandlerFunction);
  },

  /** Retrieve the API URL to use for this PR, based
   *  on the page's URL.
   *
   * @private
   * @param {String} the browser URL from which to derive the API url
   * @return {String} the API URL for this PR.
   */
  getPRAPIURL_: function(browserUrl) {
    const urlParts = prisk.splitUrl_(browserUrl);
    return [prisk.getRepoAPIURL_(browserUrl), 'pulls', urlParts[6]].join(prisk.constants_.URL_SLASH);
  },

  /** Retrieve the repos URL for this PR URL.
   *  e.g., https://github.va.opower.it/opower/archmage/pull/516
   *     -> https://github.va.opower.it/repos/opower/archmage
   */
   getRepoAPIURL_: function(documentUrl) {
     const urlParts = prisk.splitUrl_(documentUrl);
     return [prisk.getAPIRootURL_(documentUrl), 'repos', urlParts[3], urlParts[4]].join(prisk.constants_.URL_SLASH);
   },

   /** Get the search API URL as derived from the passed-in URL.
    *
    * @private
    * @param {String} the base URL of the page
    * @return {String} the search API base.
    */
  getSearchAPIURL_: function(documentURL) {
    return [prisk.getAPIRootURL_(documentURL), 'search', 'issues'].join(prisk.constants_.URL_SLASH);
  },

   /** Determines the API base URL given the current browser URL.
    *
    * @private
    * @param {String} the window's URL
    * @return {String} the base of the API URL, based on the browser URL
    */
  getAPIRootURL_: function(browserUrl) {
    const urlParts = prisk.splitUrl_(browserUrl);
    // the extra URL_SLASH here is to handle the two slashes after the protocol
    return [urlParts[0] + prisk.constants_.URL_SLASH, urlParts[2],
           'api', 'v3'].join(prisk.constants_.URL_SLASH);
  },

  /**

  /** Gets the appropriate div ID for the panel
   *  where the results will be displayed.
   *  Implemented as a function to handle different div IDs
   *  for different versions of the UI.
   *
   * @private
   * @return {String} the ID to use for finding the header pane
   */
  getPRPanelId_: function() {
    return 'partial-discussion-header';
  },

  /** Returns the various URL components of the passed-in URL.
   *
   * @private
   * @param {String} the URL to parse
   * @return {Array} the components of the URL split on /
   */
  splitUrl_: function(url) {
    return url.split(prisk.constants_.URL_SLASH);
  },

  constants_: {
    URL_SLASH: '/',
    RESULTS_ID: 'prisk-overall-risk-results',
    MINIMAL_SEARCH_RESULTS: '&per_page=1',
    FIRST_NON_WHITESPACE_REGEX: /[^\s]/,
    FILES_DIV: 'files',
    FILE_DIV: 'file',
    LOADING_STATUS: 'Loading',
    MILLIS_PER_DAY: 24 * 60 * 60 * 1000
  }
};

prisk.createRiskAssessment();
