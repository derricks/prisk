/** Does various queries to determine overall risk for a given pull request. */

var URL_SLASH = "/";
var RESULTS_ID = "pr-buddy-overall-risk-results";
var MINIMAL_SEARCH_RESULTS = "&per_page=1";
var AUTHOR_NEWNESS_ID = "pr-buddy-author-newness-risk";
var AUTHOR_REPUTATION_ID = "pr-buddy-author-reputation";
var AVG_MAX_COMPLEXITY_ID = "pr-buddy-avg-max-complexity";
var NUM_FILES_ID = "pr-buddy-num-files";
var FIRST_NON_WHITESPACE_REGEX = /[^\s]/;

var FIELD_TO_DESCRIPTION = {};
FIELD_TO_DESCRIPTION[AUTHOR_NEWNESS_ID] = "Author newness risk";
FIELD_TO_DESCRIPTION[AVG_MAX_COMPLEXITY_ID] = "Avg. max complexity risk";
FIELD_TO_DESCRIPTION[NUM_FILES_ID] = "Number of files risk";

function getResultsTable() {
  return document.getElementById(RESULTS_TABLE_ID);
};

/** Split a URL based on the / character. */
function splitURL(url) {
  return url.split(URL_SLASH);
};

/** Replaces the first child of the given element with a text
 *  node containing the given text
 */
function replaceFirstChildWithText(element, newText) {
  element.replaceChild(document.createTextNode(newText), element.firstChild);
}

/** Create a map() equivalent for HTMLCollections.
 *  Returns an array of the results.
*/
function htmlCollectionMap(collection, mapFunction) {
  var returnValue = [];

  for (var collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
    var mapResult = mapFunction(collection.item(collectionIndex));
    returnValue.push(mapResult);
  }
  return returnValue;
}

/** Calculates the github API root based on the incoming URL */
function getAPIRoot(url) {
  var urlParts = splitURL(url);
  return [urlParts[0] + URL_SLASH, urlParts[2], "api", "v3"].join(URL_SLASH);
}

/** Figure out the github API URL from the tab URL */
function getPRAPIURL(url) {
  var url_parts = splitURL(url);
  return [getAPIRoot(url), "repos", url_parts[3], url_parts[4], "pulls", url_parts[6]].join(URL_SLASH);
}

/** Given a page URL, return the search api root. */
function getSearchAPIURL(url) {
  return [getAPIRoot(url), "search", "issues"].join(URL_SLASH);
}

/** Determine the PR's author and send that back to the callback. */
function getPRAuthor(url, callback) {
  var prAPI = getPRAPIURL(url);
  var xhr = new XMLHttpRequest();

  xhr.onload = function() {
    var response = JSON.parse(xhr.response);
    callback(response["user"]["login"]);
  }
  xhr.open('GET', prAPI);
  xhr.send();
}

/** Generate a query string for closed PRs in the org and repo. */
function getClosedPRQueryString(org, repo) {
  return ["type:pr", "is:merged", ("repo:" + org + URL_SLASH + repo) ].join(" ");
}

/** Get the total number of merged PRs for the repo and send that to a callback. */
function getTotalPRCountForRepo(documentUrl, callback) {
  var urlParts = splitURL(documentUrl);
  var queryString = getClosedPRQueryString(urlParts[3], urlParts[4]);
  var searchApiRoot = getSearchAPIURL(documentUrl);

  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    callback(JSON.parse(xhr.response)["total_count"]);
  }

  xhr.open('GET', searchApiRoot + "?q=" + encodeURIComponent(queryString) + MINIMAL_SEARCH_RESULTS);
  xhr.send();
}

/** Figures out the percentage of PRs this PR's author has had merged. */
function getAuthorPRPercentage(url, callback) {
  getPRAuthor(url, function(author) {
    console.log("author: " + author);
    getTotalPRCountForRepo(url, function(totalPRCount) {
      console.log("total PRs: " + totalPRCount);
      var urlParts = splitURL(url);
      var queryString = getClosedPRQueryString(urlParts[3], urlParts[4]) + " author:" + author;
      console.log(queryString);

      var xhr = new XMLHttpRequest();
      xhr.onload = function() {
        console.log("author PRs: " + JSON.parse(xhr.response)["total_count"]);
        callback((JSON.parse(xhr.response)["total_count"]/totalPRCount) * 100);
      }

      // no need to get lots of query results: we only care about the top-level count
      xhr.open('GET', getSearchAPIURL(url) + "?q=" + encodeURIComponent(queryString) + MINIMAL_SEARCH_RESULTS);
      xhr.send();
    });
  });
}

/** Figures out the API URL for the given pull request. */
var headerPane = document.getElementById("partial-discussion-header");

var results = document.createElement("table");
results.id = RESULTS_ID;

Object.keys(FIELD_TO_DESCRIPTION).forEach( function(item) {
  var tr = document.createElement("tr");
  var descTd = document.createElement("td");
  descTd.appendChild(document.createTextNode(FIELD_TO_DESCRIPTION[item]));

  var valueTd = document.createElement("td");
  valueTd.id = item;
  valueTd.appendChild(document.createTextNode("Loading"));

  tr.appendChild(descTd);
  tr.appendChild(valueTd);
  results.appendChild(tr);
});
headerPane.appendChild(results);

// fill in author "newness"
getAuthorPRPercentage(document.location.href, function(authorPercentage) {
  var resultsCell = document.getElementById(AUTHOR_NEWNESS_ID);
  replaceFirstChildWithText(resultsCell, authorPercentage.toString());
});

// fill in "avg max complexity"
// todo: this code is hard to understand and obtuse
//   make cleaner and more clear
var filesBucket = document.getElementById('files');
var fileDiffs = filesBucket.getElementsByClassName('file');
replaceFirstChildWithText(document.getElementById(NUM_FILES_ID), fileDiffs.length.toString());

var maxComplexities = htmlCollectionMap( fileDiffs, function(file) {
  // the given diff represents an entire file, so iterate over additions
  var additions = file.getElementsByClassName('blob-code blob-code-addition');
  var individualIndents = htmlCollectionMap(additions, function(addition) {
      var codeSegment = addition.getElementsByClassName('blob-code-inner').item(0).firstChild.textContent.substring(1);
      var firstNonWhitespace = codeSegment.search(FIRST_NON_WHITESPACE_REGEX);
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
    // use "" + indent because 0.toString seems to yield 0, not "0"
    uniqueIndents[" " + indent] = true;
  });
  // note that you've made an associative array, which is an Object
  // so you need the length of keys to get the length of the "array"
  return Object.keys(uniqueIndents).length;
});

// exclude diffs that have 0 additions (all deletions)
// because they skew the results
var nonZeroComplexities = maxComplexities.filter( function(complexity) { return complexity != 0;} );
var nonZeroComplexitiesSum = nonZeroComplexities.reduce( function( prev, current, _index, _array) { return prev + current; }, 0 );
var complexityCell = document.getElementById(AVG_MAX_COMPLEXITY_ID);
replaceFirstChildWithText(complexityCell, nonZeroComplexitiesSum/nonZeroComplexities.length);
