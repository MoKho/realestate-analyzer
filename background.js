chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "switchToSheets") {
    // Find open Google Sheets tabs
    chrome.tabs.query({ url: "https://docs.google.com/spreadsheets/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Activate the first sheet tab found
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        console.warn("Could not find an active Google Sheets tab to switch to.");
      }
    });
  }
});