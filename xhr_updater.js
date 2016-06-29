/** Sends a message when an xhr request is made. This message will trigger
 *  the PRisk content script to fire. This is particularly to handle the case
 *  where various "pages" on github are loaded via xhr objects.
 */

chrome.webRequest.onCompleted.addListener( function(details) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    // response is ignored
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {xhr_event: true, details: details});
    }
  });
}, {urls:["http://*/*", "https://*/*"], types: ["xmlhttprequest"]});
