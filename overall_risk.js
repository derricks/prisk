/** Does various queries to determine overall risk for a given pull request. */

var urlSlash = "/";
var RESULTS_DIV_ID = "pr-buddy-overall-risk-results"

function getResultsDiv() {
  return document.getElementById(RESULTS_DIV_ID);
}
/** Split a URL based on the / character. */
function splitURL(url) {
  return url.split(urlSlash);
}

/** Calculates the github API root based on the incoming URL */
function getAPIRoot(url) {
  var urlParts = splitURL(url);
  return [urlParts[0] + urlSlash, urlParts[2], "api", "v3"].join(urlSlash);
}

/** Figure out the github API URL from the tab URL */
function getPRAPIURL(url) {
  var url_parts = splitURL(url);
  return [getAPIRoot(url), "repos", url_parts[3], url_parts[4], "pulls", url_parts[6]].join(urlSlash);
}

/** Given a page URL, return the search api root. */
function getSearchAPIURL(url) {
  return [getAPIRoot(url), "search", "issues"].join(urlSlash);
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
  return ["type:pr", "is:merged", ("repo:" + org + urlSlash + repo) ].join(" ");
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

  xhr.open('GET', searchApiRoot + "?q=" + encodeURIComponent(queryString));
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

      xhr.open('GET', getSearchAPIURL(url) + "?q=" + encodeURIComponent(queryString));
      xhr.send();
    });
  });
}


/** Figures out the API URL for the given pull request. */
var headerPane = document.getElementById("partial-discussion-header");

var resultsDiv = document.createElement("div");
resultsDiv.id = RESULTS_DIV_ID;
headerPane.appendChild(resultsDiv);

getAuthorPRPercentage(document.location.href, function(authorPercentage) {
  resultsDiv.appendChild(document.createTextNode(authorPercentage));
});
