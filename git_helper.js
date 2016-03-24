
var git_helper = {

  // Given a commit URL, get the data and
  // call resultFunction with it.
  collectAllCommitData: function(url, resultFunction) {
    var allResults = git_helper.accumulateJSONResults([], url).then(resultFunction);
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

      var linkHeader = response.headers.get('Link');
      var nextLink = git_helper.parseNextLinkFromLinkHeader(linkHeader);

      // once the json is parsed, if there's a next link, recurse
      return response.json().then( function(json) {
        var newResults = startArray.concat(json);
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

    var links = linkHeader.split(',');
    var link = links.find( function findNextLink(link) {
      return link.match(/rel="next"/);
    });

    if (link === undefined) {
      return null;
    } else {
      var rawLink = link.split(';')[0];
      return rawLink.substring(1, rawLink.trim().length - 1);
    }
  }
}
