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
      prisk.setMetricField_(prisk.constants_.FIELD_TO_DESCRIPTION.TOTAL_CHANGES,
                              prData.additions + prData.deletions);
      // changed files
      prisk.setMetricField_(prisk.constants_.FIELD_TO_DESCRIPTION.NUM_FILES, prData.changed_files);

      prisk.showAuthorNewness_(prData.user.login);
    });

    // with that kicked off, calculate the average max complexity
    prisk.setMetricField_(prisk.constants_.FIELD_TO_DESCRIPTION.AVG_MAX_COMPLEXITY,
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
     var filesBucket = document.getElementById('files');
     var fileDiffs = filesBucket.getElementsByClassName('file');

     var maxComplexities = prisk.htmlCollectionMap_( fileDiffs, function(file) {
       return prisk.getComplexityForDiffDiv_(file);
     });

     var nonZeroComplexities = maxComplexities.filter( function(complexity) { return complexity != 0;} );
     console.log(nonZeroComplexities);
     var nonZeroComplexitiesSum = nonZeroComplexities.reduce( function( prev, current, _index, _array) { return prev + current; }, 0 );
     console.log(nonZeroComplexitiesSum);
     return nonZeroComplexitiesSum/nonZeroComplexities.length;
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
         prisk.setMetricField_(prisk.constants_.FIELD_TO_DESCRIPTION.AUTHOR_NEWNESS, 100 - ((authoredCount/totalCount) * 100));
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

     var riskAssessment = 'LOW';
     if (value > metric.goodValue && value <= metric.warnValue) {
       riskAssessment = 'MEDIUM';
     }

     if (value > metric.warnValue) {
       riskAssessment = 'HIGH';
     }
     console.log('risk value for ' + metric.id + ': ' + value.toString());

     field.replaceChild(document.createTextNode(riskAssessment), field.firstChild);
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
    var url_parts = prisk.splitUrl_(browserUrl);
    return [prisk.getAPIRootURL_(browserUrl), 'repos', url_parts[3], url_parts[4],
           'pulls', url_parts[6]].join(prisk.constants_.URL_SLASH);
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

     var resultsTable = document.createElement('table');
     resultsTable.id = prisk.constants_.RESULTS_ID;

     Object.keys(prisk.constants_.FIELD_TO_DESCRIPTION).forEach( function(item) {
       var tr = document.createElement('tr');
       var descTd = document.createElement('td');
       descTd.appendChild(document.createTextNode(prisk.constants_.FIELD_TO_DESCRIPTION[item].description));

       var valueTd = document.createElement('td');
       valueTd.id = prisk.constants_.FIELD_TO_DESCRIPTION[item].id;
       valueTd.appendChild(document.createTextNode('Loading'));

       tr.appendChild(descTd);
       tr.appendChild(valueTd);
       resultsTable.appendChild(tr);
     });
     headerPane.appendChild(resultsTable);
  },

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

    FIELD_TO_DESCRIPTION: {
      // Sets up the details for each risk, keyed by the ID of the field that
      // will be populated.

      // Note that for newness, the values represent
      // 100 (max percentage) - the risk factor
      // so that we can use the same logic here
      // as elsewhere (value <= goodValue = GOOD )
      AUTHOR_NEWNESS: {
        id: 'prisk-author-newness-risk',
        description: 'Author experience risk',
        goodValue: 80,
        warnValue: 90
      },

      AVG_MAX_COMPLEXITY: {
        id: 'pr-buddy-avg-max-complexity',
        description: 'Average max complexity risk',
        goodValue: 2,
        warnValue: 4
      },

      NUM_FILES: {
        id: 'pr-buddy-num-files',
        description: 'Number of files risk',
        goodValue: 10,
        warnValue: 15
      },

      TOTAL_CHANGES: {
        id: 'pr-buddy-total-changes',
        description: 'Total changes risk',
        goodValue: 150,
        warnValue: 215
      }
    }

  }
};

prisk.createRiskAssessment();
