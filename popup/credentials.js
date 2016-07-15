window.addEventListener('load', loadCredentials)

const ACCESS_INFO_KEY = 'access_info';
const CAPTURE_EVENTS = {capture: true};
const EDITOR_ID = 'credential_editor';
const BROWSER_ID = 'credential_browser';

/** Load the credentials from storage
  * and display a full list.
  */
function loadCredentials() {
  const browserElem = _getElement(BROWSER_ID);
  _hideElement(_getElement(EDITOR_ID));
  _showElement(browserElem);

  _clearChildren(browserElem);

  chrome.storage.sync.get(ACCESS_INFO_KEY, function(fullDictionary) {
    fullDictionary.access_info.forEach( function createDivs(credentials) {
       const credentialsElem = document.createElement('div');
       credentialsElem.id = credentials.github_url;
       credentialsElem.addEventListener('click', event => showEditingPane(event.currentTarget.id), CAPTURE_EVENTS);

       const urlElem = document.createElement('div');
       urlElem.appendChild(document.createTextNode(credentials.github_url));
       credentialsElem.appendChild(urlElem);

       browserElem.appendChild(credentialsElem);
    });
  });
}

/** Switch the visibility of the credential list and editing view */
function showEditingPane(id) {
  chrome.storage.sync.get(ACCESS_INFO_KEY, function(fullDictionary) {

    const credentials = fullDictionary.access_info.find(item => item.github_url === id)

    if (credentials === undefined) {
      // this seems highly unlikely, as the person clicked on an item in the list
      // still, better safe than sorry
      console.log('Could not find credentials for ' + id);
      return;
    }

    const urlField = _getElement('github_site');
    const usernameField = _getElement('username');
    const tokenField = _getElement('auth_token');
    const saveButton = _getElement('save_button');

    urlField.value = credentials.github_url;
    usernameField.value = credentials.username;
    tokenField.value = credentials.auth_token;
    saveButton.addEventListener('click', event => saveValuesFromEditor(event.currentTarget), CAPTURE_EVENTS)

    const listElem = document.getElementById('credential_browser');
    const editorElem = document.getElementById('credential_editor');
    listElem.style.display = 'none';
    editorElem.style.display = 'block';
  });
}

function saveValuesFromEditor(editorElem) {
  const urlFieldValue = _getElementValue('github_site');
  const usernameFieldValue = _getElementValue('username');
  const tokenFieldValue = _getElementValue('auth_token');

  // first get the current view of credentials
  chrome.storage.sync.get(ACCESS_INFO_KEY, function(fullDictionary) {
    const currentCredentials = fullDictionary.access_info.find( item => item.github_url === urlFieldValue);

    if (currentCredentials === undefined) {
      // add
      fullDictionary.access_info.push(
        {
          github_url: urlFieldValue,
          username: usernameFieldValue,
          auth_token: tokenFieldValue
        }
      );
    } else {
      // update
      currentCredentials.username = usernameFieldValue;
      currentCredentials.auth_token = tokenFieldValue;
    }

    chrome.storage.sync.set(fullDictionary);
  });

  loadCredentials();
}

function _getElement(id) {
  return document.getElementById(id);
}

function _getElementValue(id) {
  return _getElement(id).value;
}

/** Remove all children of the specified element.
 *
 * @param {Element} DOM element to clear
 */
function _clearChildren(elementToClear) {
  while(elementToClear.hasChildNodes()) {
    elementToClear.removeChild(elementToClear.firstChild);
  }
}

/** Hides an element by setting display to none.
 *
 *  @param {Element} element to hide
 */
 function _hideElement(elementToHide) {
   elementToHide.style.display = 'none';
 }

 /** Shows an element by setting its display style to block.
  *
  * @param {Element} the element to show
  */
  function _showElement(elementToShow) {
    elementToShow.style.display = 'block';
  }
