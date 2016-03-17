var config = {
  OVERALL_FIELD_TO_DESCRIPTION: {
    // Sets up the details for each risk, keyed by the ID of the field that
    // will be populated.

    // Note that for newness, the values represent
    // 100 (max percentage) - the risk factor
    // so that we can use the same logic here
    // as elsewhere (value <= goodValue = GOOD )
    AUTHOR_NEWNESS: {
      id: 'prisk-overall-author-newness-risk',
      description: 'Author experience risk',
      goodValue: 80,
      warnValue: 90
    },

    AVG_MAX_COMPLEXITY: {
      id: 'prisk-overall-avg-max-complexity-risk',
      description: 'Average max complexity risk',
      goodValue: 2,
      warnValue: 3
    },

    NUM_FILES: {
      id: 'prisk-overall-num-files-risk',
      description: 'Number of files risk',
      goodValue: 10,
      warnValue: 15
    },

    TOTAL_CHANGES: {
      id: 'prisk-overall-total-changes-risk',
      description: 'Total changes risk',
      goodValue: 150,
      warnValue: 215
    }
  },

  // the fields to use for populating per-diff risks
  // note that IDs in here are prefixed with the id
  // of the diff
  DIFF_FIELD_TO_DESCRIPTION: {
    MAX_COMPLEXITY: {
      id: 'prisk-max-complexity-risk',
      description: 'Max complexity risk',
      goodValue: 5,
      warnValue: 6
    },

    FILE_VOLATILITY_RISK: {
      id: 'prisk-file-volatility-risk',
      description: 'File volatility risk',
      goodValue: 6,
      warnValue: 9
    },

    AUTHOR_VOLATILITY_RISK: {
      id: 'prisk-author-volatility-risk',
      description: 'Author volatility risk',
      goodValue: 4,
      warnValue: 6
    }
  }
};
