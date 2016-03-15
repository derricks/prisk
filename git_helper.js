
var git_helper = {

  // Call the specifed URL and gather all the results
  // into one array (across pages) that is then sent back to the
  // result function.
  collectAllCommitData: function(url, resultFunction) {
    var xhr = new XMLHttpRequest();
    var allResults = [];
    xhr.onload = function() {
      var linkHeader = xhr.getResponseHeader('Link');
      var newResults = JSON.parse(xhr.response);
      allResults = allResults.concat(newResults);

      if (linkHeader == null) {
        // one page of results = done!
        resultFunction(allResults);

      } else {

        var links = linkHeader.split(',');
        var link = links.find( function findNextLink(link) {
          return link.match(/rel="next"/);
        });

        if (link === undefined) {
          // last page = done
          resultFunction(allResults);
        } else {
          // found a next link; need to keep going
          var rawLink = link.split(';')[0];
          rawLink = rawLink.substring(1, rawLink.trim().length - 1);
          git_helper.collectAllCommitData(rawLink, function goToNext(results) {
            resultFunction(results);
          })
        }
      }
    };
    xhr.open('GET', url);
    xhr.send();
  }

}
