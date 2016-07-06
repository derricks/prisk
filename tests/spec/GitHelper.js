describe('When determining the authors from a series of commits', function() {
  it('returns an empty array if there are no commits', function() {
    const testArray = []
    expect(git_helper.getAuthorsAndCommitCountsFromCommits(testArray).length).toBe(0);
  });

  it('returns an array of tuples when there are authors', function() {
    const commitsArray = [
      {commit: {author: {name: 'A'}}},
      {commit: {author: {name: 'B'}}},
      {commit: {author: {name: 'C'}}},
      {commit: {author: {name: 'A'}}},
      {commit: {author: {name: 'B'}}},
      {commit: {author: {name: 'A'}}},
    ];

    const authorTuples = git_helper.getAuthorsAndCommitCountsFromCommits(commitsArray);
    expect(authorTuples).toContain(['A',3]);
    expect(authorTuples).toContain(['B',2]);
    expect(authorTuples).toContain(['C',1]);
  });

  it('returns a filtered array if the author is not present', function() {
    const commitsArray = [
      {commit: {author: {name: 'A'}}},
      {commit: {author: {test: 'blah'}}},
      {commit: {author: {name: 'C'}}},
    ];

    const authorTuples = git_helper.getAuthorsAndCommitCountsFromCommits(commitsArray);
    expect(authorTuples).toContain(['A', 1]);
    expect(authorTuples).toContain(['C', 1]);
    expect(authorTuples.length).toBe(2);
  });
});

describe('When making requests to github', function() {
  describe('and parsing the link headers', function() {

    // From the github developer guide sample header
    const sampleHeaderWithNext = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next",<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"';

    const sampleHeaderWithFull = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>; rel="next",' +
                                 '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last",' +
                                 '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1>; rel="first",' +
                                '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=13>; rel="prev"';
    const malformedLinkHeader = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"';

    it('returns null if no link header is found', function() {
      expect(git_helper.parseNextLinkFromLinkHeader(null)).toBeNull();
    });

    it('returns the next link when the header is well-formed', function() {
      expect(git_helper.parseNextLinkFromLinkHeader(sampleHeaderWithNext)).toBe('https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2');
      expect(git_helper.parseNextLinkFromLinkHeader(sampleHeaderWithFull)).toBe('https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15');
    });

    it('returns null if it can not find a next link in the header', function() {
      expect(git_helper.parseNextLinkFromLinkHeader(malformedLinkHeader)).toBeNull();
    });

  });

  describe('and there is more than one page of results', function() {
    it('will query again if github indicates that it should', function() {
      pending('Not implemented');
    });
  });
});
