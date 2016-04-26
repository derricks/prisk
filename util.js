const util = {
  /**
   * Return a date that is numberOfDays in the past.
   *
   * @param {Number} the number of days back to calculate
   * @return {Date} the date that is numberOfDays in the past
   */
  getNDaysAgo: function(numberOfDays) {
    return new Date(new Date().getTime() - (numberOfDays * prisk.constants_.MILLIS_PER_DAY));
  }
}
