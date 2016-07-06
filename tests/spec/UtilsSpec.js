describe("Looking for owners of a file", function() {
  describe("and using author array", function() {

    it("returns an empty array when there are no entries", function(){
      const testArray = [];
      const lettersToCounts = util.countCopiesOfStringInArray(testArray);
      expect(lettersToCounts.length).toBe(0);
    });

    it("returns a properly collated array for non-empty arrays", function() {
      const testArray = ['A', 'A', 'B', 'C', 'A', 'B'];
      const collatedResults = util.countCopiesOfStringInArray(testArray);
      expect(collatedResults['A']).toBe(3);
      expect(collatedResults['B']).toBe(2);
      expect(collatedResults['C']).toBe(1);
    });

    it('generates tuples of [string, count] from a collated array', function() {
      const testArray = [];
      testArray['A'] = 3;
      testArray['B'] = 2;
      testArray['C'] = 1;

      const tuples = util.stringsAndCountsToTuples(testArray);
      expect(tuples.find( tuple => tuple[0] === 'A' && tuple[1] === '3')).not.toBe(-1);
    });

  });
});
