/** Provides risk heuristics for a given pull request. */

var prisk = {

  /** This serves as the main entry point for this object.
   *  The page calls this to start the risk assessment.
   *
   *  @public
   */
  createRiskAssessment: function() {
    prisk.configureUI_();

    prisk.loadPRData_(prisk.getPRAPIURL_(window.location.href), function(prData) {

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
     var fileDiffs = prisk.getDiffElements_();

     var maxComplexities = prisk.htmlCollectionMap_( fileDiffs, function(file) {
       return prisk.getComplexityForDiffDiv_(file);
     });

     var nonZeroComplexities = maxComplexities.filter( function(complexity) { return complexity != 0;} );
     var nonZeroComplexitiesSum = nonZeroComplexities.reduce( function( prev, current, _index, _array) { return prev + current; }, 0 );
     return nonZeroComplexitiesSum/nonZeroComplexities.length;
   },

   /** Calculate the volatility risk for the file mentioned in the diff,
    *  and set the appropriate field with the value.
    */
   calculateAndShowFileVolatilityRisk_: function(diffElem) {
     var fileNameElem = diffElem.getElementsByClassName('js-selectable-text').item(0);
     var fileName = fileNameElem.getAttribute('title');

     // 90 days ago
     var threeMonthsAgo = new Date(new Date().getTime() - (90 * 24 * 60 * 60 * 1000));
     git_helper.collectAllCommitData(prisk.getRepoAPIURL_(document.location.href) + '/commits?path=' + fileName + '&since=' + threeMonthsAgo.toISOString(), function(results) {
       prisk.setRiskInDiff_(diffElem, results.length, config.DIFF_FIELD_TO_DESCRIPTION.FILE_VOLATILITY_RISK);
     });
   },

   /** Calculate the author volatility (too many recent contributors)
    *  and update the appropriate field in the diff.
    */
   calculateAndShowAuthorVolatilityRisk_: function(diffElem) {
     var threeMonthsAgo = new Date(new Date().getTime() - (90 * 24 * 60 * 60 * 1000));
     var fileNameElem = diffElem.getElementsByClassName('js-selectable-text').item(0);
     var fileName = fileNameElem.getAttribute('title');
     git_helper.collectAllCommitData(prisk.getRepoAPIURL_(document.location.href) + '/commits?path=' + fileName + '&since=' + threeMonthsAgo.toISOString(), function(results) {

       var authors = results.map( function(commit) {
         return commit.commit.author.name;
       });

       var uniqueAuthors = [];
       authors.forEach( function(author) {
         uniqueAuthors[author] = true;
       });


       prisk.setRiskInDiff_(diffElem, Object.keys(uniqueAuthors).length, config.DIFF_FIELD_TO_DESCRIPTION.AUTHOR_VOLATILITY_RISK);
     });
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
      var additions = diff.getElementsByClassName('blob-code blob-code-addition');
      var individualIndents = prisk.htmlCollectionMap_(additions, function(addition) {
        var codeSegment = addition.getElementsByClassName('blob-code-inner').item(0).firstChild.textContent.substring(1);
        var firstNonWhitespace = codeSegment.search(prisk.constants_.FIRST_NON_WHITESPACE_REGEX);
        if (firstNonWhitespace == -1) {
          // if no non-whitespace characters were found, we just want the length of the all-whitespace string
          // it is sometimes the case that there are whitespace characters in the first text node, sometimes not.
          firstNonWhitespace = codeSegment.length;
        }
        return firstNonWhitespace;
      });

      // now get the unique values of indents within this diff. the length of that
      // is the maximum complexity of the diff's additions
      var uniqueIndents = [];
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
     var returnValue = [];

     for (var collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
       var mapResult = mapFunction(collection.item(collectionIndex));
       returnValue.push(mapResult);
     }
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
     for (var collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
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
     var authorSearchUrl = prisk.getSearchAPIURL_(document.location.href) + '?q=' +
       encodeURIComponent(prisk.mergedSearchQuery + ' author:' + login) + prisk.constants_.MINIMAL_SEARCH_RESULTS;

     prisk.loadJsonFromUrl_(authorSearchUrl, function(authorPRSearchData) {
       var authoredCount = authorPRSearchData.total_count;

       // that gets us the author's PRs, but we need to compare to the total PRs
       // for the repo with another search and then divide
       var allRepoPRsUrl = prisk.getSearchAPIURL_(document.location.href) + '?q=' +
         encodeURIComponent(prisk.mergedSearchQuery) + prisk.constants_.MINIMAL_SEARCH_RESULTS;

       prisk.loadJsonFromUrl_(allRepoPRsUrl, function(allPRSearchData) {
         var totalCount = allPRSearchData.total_count;
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
     var field = document.getElementById(metric.id);
     if (field == null) {
       console.log('field ' + metric.id + ' not found');
       return;
     }

     var riskAssessment = prisk.getRiskAssessment_(value, metric);
     console.log('risk value for ' + metric.id + ': ' + value.toString());

     prisk.setRiskAssessmentCell_(field, riskAssessment);
  },

  /** Sets the risk value for a given metric within a particular diff.
   * @private
   * @param {Element} diff containing the information
   * @param {Number} the value of the risk assessment to be used
   * @param {Object} the general information for this risk assessment
   */
  setRiskInDiff_: function(diff, riskValue, riskConfiguration) {
    var riskFieldId = diff.id + '-' + riskConfiguration.id;
    var riskField = document.getElementById(riskFieldId);
    var riskAssessment = prisk.getRiskAssessment_(riskValue, riskConfiguration);

    console.log('risk value for ' + riskConfiguration.id + ' in ' + diff.id + ': ' + riskValue.toString());

    // todo: refactor
    prisk.setRiskAssessmentCell_(riskField, riskAssessment);
  },

  /** Given a risk assessment value and the configuration for that risk
   * assessment, return the risk assessment as a text field.
   *
   * @private
   * @param {Number} the value of the risk metric
   * @param {Object} the configuration for that risk metric
   * @return {String} the risk assessment for that value based on the configuration
   */
   //TODO: just return the value from the ifs
   getRiskAssessment_: function(value, configuration) {
     var riskAssessment = 'LOW';
     if (value >= configuration.goodValue && value < configuration.warnValue) {
       riskAssessment = 'MEDIUM';
     }

     if (value >= configuration.warnValue) {
       riskAssessment = 'HIGH';
     }

     return riskAssessment;
   },

  /** Iterate through all the file diffs and relevant risk metrics.
   *
   * @private
   * @param {Object} the JSON data for the PR, as a convenience
   */
  loadDiffRisks_: function(prData) {
     var fileBucket = document.getElementById(prisk.constants_.FILES_DIV);
     var diffs = fileBucket.getElementsByClassName(prisk.constants_.FILE_DIV);
     prisk.htmlCollectionForEach_(diffs, function(diff) {
        var maxComplexity = prisk.getComplexityForDiffDiv_(diff);
        prisk.setRiskInDiff_(diff, maxComplexity, config.DIFF_FIELD_TO_DESCRIPTION.MAX_COMPLEXITY);

        prisk.calculateAndShowFileVolatilityRisk_(diff);

        prisk.calculateAndShowAuthorVolatilityRisk_(diff);
     });
   },

  /** Loads the PR JSON from the given URL.
   *
   * @private
   * @param {String} the API url from which to fetch the PR JSON
   * @param {Function} a callback function that takes the PR data JSON
   */
  loadPRData_: function(prUrl, prHandlerFunction) {
     prisk.loadJsonFromUrl_(prUrl, function(payload) {
       prHandlerFunction(payload);
     });
  },

   /** Fetches the passed-in URL, parses it to JSON, and then passes that
    *  JSON to the passed-in function.
    *
    * @private
    * @param {String} the URL to fetch from
    * @param {Function} the function to call when the data loads. Takes the JSON payload.
    */
  loadJsonFromUrl_: function(url, payloadHandlerFunction) {
      var xhr = new XMLHttpRequest();
      xhr.onload = function() {
        payloadHandlerFunction(JSON.parse(xhr.response));
      };
      xhr.open('GET', url);
      xhr.send();
  },

  /** Retrieve the API URL to use for this PR, based
   *  on the page's URL.
   *
   * @private
   * @param {String} the browser URL from which to derive the API url
   * @return {String} the API URL for this PR.
   */
  getPRAPIURL_: function(browserUrl) {
    var urlParts = prisk.splitUrl_(browserUrl);
    return [prisk.getRepoAPIURL_(browserUrl), 'pulls', urlParts[6]].join(prisk.constants_.URL_SLASH);
  },

  /** Retrieve the repos URL for this PR URL.
   *  e.g., https://github.va.opower.it/opower/archmage/pull/516
   *     -> https://github.va.opower.it/repos/opower/archmage
   */
   getRepoAPIURL_: function(documentUrl) {
     var urlParts = prisk.splitUrl_(documentUrl);
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
    var urlParts = prisk.splitUrl_(browserUrl);
    // the extra URL_SLASH here is to handle the two slashes after the protocol
    return [urlParts[0] + prisk.constants_.URL_SLASH, urlParts[2],
           'api', 'v3'].join(prisk.constants_.URL_SLASH);
  },


  /** This configures the dom elements in the UI.
   *
   * @private
   */
  configureUI_: function() {
     var headerPane = document.getElementById(prisk.getPRPanelId_());

     var resultsTable = prisk.appendRiskTableToDiff_(headerPane, 'PRisk Overall Assessment');
     resultsTable.id = prisk.constants_.RESULTS_ID;

     Object.keys(config.OVERALL_FIELD_TO_DESCRIPTION).forEach( function(item) {
       var tr = document.createElement('tr');
       var descTd = document.createElement('td');
       descTd.setAttribute('class', 'prisk-text-default prisk-table-cell-defaults');
       descTd.appendChild(document.createTextNode(config.OVERALL_FIELD_TO_DESCRIPTION[item].description));

       var valueTd = document.createElement('td');
       valueTd.id = config.OVERALL_FIELD_TO_DESCRIPTION[item].id;
       valueTd.setAttribute('class', 'prisk-text-default prisk-table-cell-defaults');
       valueTd.appendChild(document.createTextNode(prisk.constants_.LOADING_STATUS));

       tr.appendChild(descTd);
       tr.appendChild(valueTd);
       resultsTable.appendChild(tr);
     });
     headerPane.appendChild(resultsTable);

     prisk.configureDiffsUI_();
  },

  /** Adds a risk assessment panel to each of the diffs.
   *
   * @private
   */
  configureDiffsUI_: function() {
    var diffDivs = prisk.getDiffElements_();
    prisk.htmlCollectionForEach_(diffDivs, function(diff) {

      var diffHeaderDiv = diff.getElementsByClassName('file-info').item(0);
      var diffRiskTable = prisk.appendRiskTableToDiff_(diffHeaderDiv, 'PRisk Diff Assessment');

      // for each of the per-diff fields, add a row
      Object.keys(config.DIFF_FIELD_TO_DESCRIPTION).forEach(function(riskMetricConfiguration) {
        var riskMetric = config.DIFF_FIELD_TO_DESCRIPTION[riskMetricConfiguration];

        var tr = document.createElement('tr');
        var description = document.createElement('td');
        description.setAttribute('class', 'prisk-table-cell-defaults prisk-text-default');
        description.appendChild(document.createTextNode(riskMetric.description));
        tr.appendChild(description);

        var risk = document.createElement('td');
        risk.id = diff.id + '-' + riskMetric.id;
        risk.setAttribute('class', 'prisk-table-cell-defaults prisk-text-default');
        risk.appendChild(document.createTextNode(prisk.constants_.LOADING_STATUS));
        tr.appendChild(risk);
        diffRiskTable.appendChild(tr);
      });
    });

  },

  /** Return an HTMLCollection of the diffs
   *
   */
  getDiffElements_: function() {

    var filesContainer = document.getElementById(prisk.constants_.FILES_DIV);
    // TODO: why is this sometimes null?
    // https://github.va.opower.it/x-web-widgets/widget-data-browser/pull/272
    if (filesContainer == null) {
      return [];
    }

    return filesContainer.getElementsByClassName(prisk.constants_.FILE_DIV);
  },

  /** Creates the basic assessment table with a header and appends it to
   *  the specified diff.
   *
   * @private
   * @param {Element} diff to append the table to
   * @param {String} table name
   * @return {Element} the newly-created table element
   */
  appendRiskTableToDiff_: function(diffDiv, tableName) {

    var diffRiskTable = document.createElement('table');
    diffRiskTable.setAttribute('class', 'prisk-table');

    var headerRow = document.createElement('tr');
    var header = document.createElement('th');
    header.setAttribute('class', 'prisk-table-cell-defaults');
    header.setAttribute('colspan', '2');
    header.appendChild(document.createTextNode(tableName));

    headerRow.appendChild(header);
    diffRiskTable.appendChild(headerRow);
    diffDiv.appendChild(diffRiskTable);
    return diffRiskTable;
  },

  /** Sets the specified element to have risk assessment text
   * of the correct styling.
   *
   * @private
   * @param {Element} element to update
   * @param {String} risk assessment as a string
   */
  setRiskAssessmentCell_: function(riskElem, riskAssessment) {
    var metricTextSpan = document.createElement('span');
    metricTextSpan.setAttribute('class', 'prisk-risk-' + riskAssessment);
    metricTextSpan.appendChild(document.createTextNode(riskAssessment));
    riskElem.replaceChild(metricTextSpan, riskElem.firstChild);
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
    LOADING_STATUS: 'Loading'
  }
};

prisk.createRiskAssessment();
