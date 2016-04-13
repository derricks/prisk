// A ui object that handles tasks such as manipulating and traversing the
// browser UI.

const ui = {

  /** This configures the dom elements in the UI.
   *
   * @private
   */
  configureUI: function() {
     const headerPane = document.getElementById(prisk.getPRPanelId_());

     const resultsTable = ui.appendTopLevelRiskTableToDiff(headerPane, 'PRisk Overall Assessment');
     resultsTable.id = prisk.constants_.RESULTS_ID;

     Object.keys(config.OVERALL_FIELD_TO_DESCRIPTION).forEach( function(item) {
       const tr = document.createElement('tr');
       const descTd = document.createElement('td');
       descTd.setAttribute('class', 'prisk-text-default prisk-table-cell-defaults');
       descTd.appendChild(document.createTextNode(config.OVERALL_FIELD_TO_DESCRIPTION[item].description));

       const valueTd = document.createElement('td');
       valueTd.id = config.OVERALL_FIELD_TO_DESCRIPTION[item].id;
       valueTd.setAttribute('class', 'prisk-text-default prisk-table-cell-defaults');
       valueTd.appendChild(document.createTextNode(prisk.constants_.LOADING_STATUS));

       tr.appendChild(descTd);
       tr.appendChild(valueTd);
       resultsTable.appendChild(tr);
     });
     headerPane.appendChild(resultsTable);

     ui.configureDiffsUI();
  },

  /** Adds a risk assessment panel to each of the diffs.
   *
   * @private
   */
  configureDiffsUI: function() {
    const diffDivs = ui.getDiffElements_();

    // diffDivs is an array, because that's what getDiffElements_ returns
    diffDivs.forEach( function(diff) {

      const diffHeaderDiv = diff.getElementsByClassName('file-info').item(0);
      const diffRiskTable = ui.appendDiffLevelRiskTableToDiff(diffHeaderDiv, 'PRisk Diff Assessment');
      const trElem = document.createElement('tr');
      diffRiskTable.appendChild(trElem);

      // for each of the per-diff fields, add a row
      Object.keys(config.DIFF_FIELD_TO_DESCRIPTION).forEach(function(riskMetricConfiguration) {
        const riskMetric = config.DIFF_FIELD_TO_DESCRIPTION[riskMetricConfiguration];

        const riskIconElem = document.createElement('td');
        riskIconElem.id = diff.id + '-' + riskMetric.id;

        const riskImgElem = document.createElement('img')
        riskImgElem.setAttribute('src', chrome.extension.getURL('images/prisk-loading.png'));

        riskIconElem.appendChild(riskImgElem);
        trElem.appendChild(riskIconElem);
      });
    });

  },

  /** Return an array of the diff elements
   *
   * @return the HTMLCollection representing all the file diffs.
   */
  getDiffElements_: function() {

    const filesContainer = document.getElementById(prisk.constants_.FILES_DIV);
    // TODO: why is this sometimes null?
    // https://github.va.opower.it/x-web-widgets/widget-data-browser/pull/272
    if (filesContainer == null) {
      return [];
    }

    const fileElems = filesContainer.getElementsByClassName(prisk.constants_.FILE_DIV);

    return prisk.htmlCollectionFilter_(fileElems, function excludeRegexes(fileElem) {

      // if there's a regex that matches the string, that string should be included.
      const foundMatch = config.excludedFileRegexes.find( function findMatch(regex) {
        return regex.exec(prisk.getFileNameForDiff_(fileElem)) !== null;
      });

      return foundMatch === undefined;
    });
  },



  /** Creates the basic assessment table with a header and appends it to
   *  the specified diff.
   *
   * @private
   * @param {Element} diff to append the table to
   * @param {String} table name
   * @return {Element} the newly-created table element
   */
  appendTopLevelRiskTableToDiff: function(diffDiv, tableName) {
    const diffRiskTable = document.createElement('table');
    diffRiskTable.setAttribute('class', 'prisk-table');

    const headerRow = document.createElement('tr');
    const header = document.createElement('th');
    header.setAttribute('class', 'prisk-table-cell-defaults');
    header.setAttribute('colspan', '2');
    header.appendChild(document.createTextNode(tableName));

    headerRow.appendChild(header);
    diffRiskTable.appendChild(headerRow);
    diffDiv.appendChild(diffRiskTable);
    return diffRiskTable;
  },

  /** Appends a headerless table to the specified diff.
   *
   * @param {Element} diff to append the table to
   * @return {Element} the created/appended table element
   */
   appendDiffLevelRiskTableToDiff: function(diffDiv) {
     const diffRiskTable = document.createElement('table');
     diffDiv.appendChild(diffRiskTable);
     return diffRiskTable;
   },

   /** Sets the specified element to have risk assessment text
    * of the correct styling.
    *
    * @private
    * @param {Element} element to update
    * @param {String} risk assessment as a string
    */
   setTextRiskAssessmentCell_: function(riskElem, riskAssessment) {
     const metricTextSpan = document.createElement('span');
     metricTextSpan.setAttribute('class', 'prisk-risk-' + riskAssessment);
     metricTextSpan.appendChild(document.createTextNode(riskAssessment));
     riskElem.replaceChild(metricTextSpan, riskElem.firstChild);
   },

   /** Set the risk assessment for an image cell (such as in the diffs)
    *
    * @private
    * @param {Element} the element containing the image
    * @param {Object} a configuration for the risk assessment being set
    * @param {String} LOW, MEDIUM, or HIGH
    */
   setImageRiskAssessmentCell_: function(riskFieldElem, riskConfiguration, riskAssessment) {
     const newImage = document.createElement('img');
     newImage.setAttribute('src', chrome.extension.getURL('images/' + riskConfiguration.id + '-' + riskAssessment + '.png') );
     const altText = riskConfiguration.description + ': ' + riskAssessment;
     newImage.setAttribute('alt', altText);
     newImage.setAttribute('title', altText);
     riskFieldElem.replaceChild(newImage, riskFieldElem.firstChild);
   }



};
