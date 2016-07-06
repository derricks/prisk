const util = {
  /**
   * Return a date that is numberOfDays in the past.
   *
   * @param {Number} the number of days back to calculate
   * @return {Date} the date that is numberOfDays in the past
   */
  getNDaysAgo: function(numberOfDays) {
    return new Date(new Date().getTime() - (numberOfDays * prisk.constants.MILLIS_PER_DAY));
  },

  /** Given an HTMLCollection, apply the map  function to each element
   *
   * @private
   * @param {HTMLCollection} the collection of HTML elements to traverse
   * @param {Function} the mapping  function to apply to each item
   * @return {Array} the mapped values from the collection
   */
  htmlCollectionMap: function(collection, mapFunction) {
    const returnValue = [];

    for (let collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
      const mapResult = mapFunction(collection.item(collectionIndex));
      returnValue.push(mapResult);
    }
    return returnValue;
  },

  /** Filter out elements from an HTMLCollection that don't pass
   *  the filter  function. If filter: function returns true, the item
   *  is included.
   *
   * @param {HTMLCollection} the HTMLCollection to filter
   * @return {Array} the items that have passed the filter  function
   */
   htmlCollectionFilter: function(collection, filterFunction) {
     const returnValue = [];
     util.htmlCollectionForEach(collection, function(item) {
       if (filterFunction(item)) {
         returnValue.push(item);
       }
     });
     return returnValue;
   },

  /** Given an HTMLCollection, iterate over the each item and call
   *  the callback  function with that item.
   *
   * @private
   * @param {HTMLCollection} collection
   * @param {Function} the  function to invoke with each item
   */
  htmlCollectionForEach: function(collection, forEachFunction) {
    for (let collectionIndex = 0; collectionIndex < collection.length; collectionIndex++) {
      forEachFunction(collection.item(collectionIndex));
    }
  },

  /** Given an array of Strings, count the number of times each string appears in the list.
   *
   * @param {Array} strings to check
   * @return {Array} an associative array where each key is one of the strings passed in and its value is the number of times
   *         that string appeared in the array.
   */
   countCopiesOfStringInArray: function(stringsToCount) {
     return stringsToCount.reduce(
       function countStrings(currentView, currentString) {
         currentView[currentString] = (currentView[currentString] ? currentView[currentString] + 1 : 1);
         return currentView;
       }, []
     );
   },

   /** Given an associative array of keys to an integer, return an array of tuples
    *  where tuple[0] is the key and tuple[1] is the integer.
    *
    * @param {Array} associative array of key to integer
    * @return {Array} an array where each item is another array where item 0 is the key and item 1 is the count
    */
    stringsAndCountsToTuples: function(stringToIntegerArray) {
      return Object.keys(stringToIntegerArray).map( key => [key, stringToIntegerArray[key]]);
    }

};
