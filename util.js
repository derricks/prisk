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


};
