
const git_helper = {

  /** Given a URL, collect the relevant results of the query
   *  and pass them to the callback  function.
   *
   * @param {String} the url from which to start the query
   * @param {Function} the function to call with the results
   * @param {Function} a function that can be used to see if enough data has been captured.
   *        The  function is passed the current state of the array and returns true (continue) or false (stop)
   */
  collectAllCommitData: function(url, resultFunction, shouldContinue) {
    const allResults = git_helper.accumulateJSONResults([], url, shouldContinue).then(resultFunction);
  },

  json: function(response) {
    return response.json();
  },

  // Fetch a given URL, interpret as JSON, and call the
  // handler function.
  fetchAsJson: function(url, resultsFunction) {
    return fetch(url, git_helper.getFetchOptions()).then(git_helper.json).then(resultsFunction);
  },

  /** Accumulate results from a given URL, and paginate if necessary
   *
   * @param {Array} the results array to start with
   * @param {String} the url to query for more data
   * @param {Function} the callback function to use for processing the results
   * @param {Function} a function that is passed the current array and
   *        returns true or false to determine if the URL crawling should continue
   * @return {Array} the set of JSON results added to the starting array
   */
  accumulateJSONResults: function(startArray, url, callback, shouldContinue) {
    return fetch(url, git_helper.getFetchOptions() ).then(function parseResponse(response) {

      const linkHeader = response.headers.get('Link');
      const nextLink = git_helper.parseNextLinkFromLinkHeader(linkHeader);

      // once the json is parsed, if there's a next link, recurse
      return response.json().then( function(json) {
        const newResults = startArray.concat(json);
        if (!(shouldContinue === undefined || shouldContinue(newResults))) {
          return newResults;
        }

        return nextLink === null ? newResults : git_helper.accumulateJSONResults(newResults, nextLink);
      });
    });
  },

  // Parse out the "next" Link from the Link header, if present.
  //
  // @param {String} Link response header. Can be null.
  // @return {String} null if there's no Link header or there's no next link
  parseNextLinkFromLinkHeader: function(linkHeader) {
    if (linkHeader === null) {
      return null;
    }

    const links = linkHeader.split(',');
    const link = links.find( function findNextLink(link) {
      return link.match(/rel="next"/);
    });

    if (link === undefined) {
      return null;
    } else {
      const rawLink = link.split(';')[0];
      return rawLink.substring(1, rawLink.trim().length - 1);
    }
  },

  /** Determines the API base URL given the current browser URL.
   *
   * @param {String} the window's URL
   * @return {String} the base of the API URL, based on the browser URL
   */
 getAPIRootURL: function(browserUrl) {
   const urlParts = git_helper.splitUrl(browserUrl);
   if (git_helper.isGithubCom()) {
     return 'https://api.github.com';
   }

   // the extra URL_SLASH here is to handle the two slashes after the protocol
   return [urlParts[0] + prisk.constants.URL_SLASH, urlParts[2],
          'api', 'v3'].join(prisk.constants.URL_SLASH);
 },

 /** Determine if you're on github.com (which has different names for elements)
  *
  * @return true if you're on github.com, false otherwise
  */
  isGithubCom: function() {
    return git_helper.splitUrl(document.location.href)[2].endsWith('github.com');
  },

  /** Loads the PR JSON from the given URL.
   *
   * @private
   * @param {String} the API url from which to fetch the PR JSON
   * @param {Function} a callback function that takes the PR data JSON
   */
  loadPRData: function(prUrl, prHandlerFunction) {
    return git_helper.fetchAsJson(prUrl, prHandlerFunction);
  },

  /** Retrieve the API URL to use for this PR, based
   *  on the page's URL.
   *
   * @private
   * @param {String} the browser URL from which to derive the API url
   * @return {String} the API URL for this PR.
   */
  getPRAPIURL: function(browserUrl) {
    const urlParts = git_helper.splitUrl(browserUrl);
    return [git_helper.getRepoAPIURL(browserUrl), 'pulls', urlParts[6]].join(prisk.constants.URL_SLASH);
  },

  /** Retrieve the repos URL for this PR URL.
   *  e.g., https://github.va.opower.it/opower/archmage/pull/516
   *     -> https://github.va.opower.it/repos/opower/archmage
   */
   getRepoAPIURL: function(documentUrl) {
     const urlParts = git_helper.splitUrl(documentUrl);
     return [git_helper.getAPIRootURL(documentUrl), 'repos', urlParts[3], urlParts[4]].join(prisk.constants.URL_SLASH);
   },

   /** Get the search API URL as derived from the passed-in URL.
    *
    * @private
    * @param {String} the base URL of the page
    * @return {String} the search API base.
    */
  getSearchAPIURL: function(documentURL) {
    return [git_helper.getAPIRootURL(documentURL), 'search', 'issues'].join(prisk.constants.URL_SLASH);
  },

  /** Returns the various URL components of the passed-in URL.
   *
   * @private
   * @param {String} the URL to parse
   * @return {Array} the components of the URL split on /
   */
  splitUrl: function(url) {
    return url.split(prisk.constants.URL_SLASH);
  },

  /** Returns whether or not this is a git PR page based on
   *  the presence or absence of a diff with ID partial-discussion-header'
   *
   * @param {String} diff name to find.
   * @return {Boolean} true if the diff is present, false if not.
   */
   isPRDiffPresent: function(diffName) {
     const diffElem = document.getElementById(diffName);
     return diffElem !== undefined && diffElem !== null;
   },

   /** Return the fetch object needed for making calls to the server.
    *
    * @return the object to use for fetch parameters
    */
    getFetchOptions: function() {
      return config.auth_token && config.username ?
      {
        headers: {
          'Authorization': 'Basic ' + btoa(config.username + ':' + config.auth_token)
        }
      } : {}
    }

};
