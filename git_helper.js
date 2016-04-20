
const git_helper = {

  // Given a commit URL, get the data and
  // call resultFunction with it.
  collectAllCommitData: function(url, resultFunction) {
    const allResults = git_helper.accumulateJSONResults([], url).then(resultFunction);
  },

  json: function(response) {
    return response.json();
  },

  // Fetch a given URL, interpret as JSON, and call the
  // handler function.
  fetchAsJson: function(url, resultsFunction) {
    return fetch(url).then(git_helper.json).then(resultsFunction);
  },

  // Accumulate results from a given URL, and paginate if necessary
  //
  // @param {Array} the array to start with
  // @param {String} the url to query for more data
  // @param {Function}
  // @return {Array} the set of JSON results added to the starting array
  accumulateJSONResults: function(startArray, url, callback) {
    return fetch(url).then(function parseResponse(response) {

      const linkHeader = response.headers.get('Link');
      const nextLink = git_helper.parseNextLinkFromLinkHeader(linkHeader);

      // once the json is parsed, if there's a next link, recurse
      return response.json().then( function(json) {
        const newResults = startArray.concat(json);
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
   const urlParts = prisk.splitUrl_(browserUrl);
   if (git_helper.isGithubCom()) {
     return 'https://api.github.com';
   }

   // the extra URL_SLASH here is to handle the two slashes after the protocol
   return [urlParts[0] + prisk.constants_.URL_SLASH, urlParts[2],
          'api', 'v3'].join(prisk.constants_.URL_SLASH);
 },

 /** Determine if you're on github.com (which has different names for elements)
  *
  * @return true if you're on github.com, false otherwise
  */
  isGithubCom: function() {
    return prisk.splitUrl_(document.location.href)[2].endsWith('github.com');
  },

 /** For a given file diff, figure out the the name of the file being represented
  *
  * @param {Element} the diff element to inspect
  * @return {String} the name of the file the diff represents
  */
  getFileNameForDiff: function(diffElem) {
    const fileHeader = diffElem.getElementsByClassName('file-header').item(0);
    return fileHeader.getAttribute('data-path');
  }

}
