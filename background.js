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
  
  if (message.action === "openZealty") {
    const mls = message.mls;
    if (!mls) return;

    // Try to resolve MLS via Zealty autocomplete API and build canonical URL.
    async function fetchAutocomplete(mlsArg) {
      const payload = { "0": { json: { query: mlsArg, statuses: ["active", "sold", "expired"] } } };
      try {
        const res = await fetch('https://www.zealty.ca/api/trpc/properties.autocompleteMeili?batch=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return null;
        const txt = await res.text();
        const arr = JSON.parse(txt);
        return arr?.[0]?.result?.data?.json?.groups?.[0]?.items?.[0] || null;
      } catch (e) {
        console.warn('Zealty autocomplete fetch failed', e);
        return null;
      }
    }

    function slugify(str) {
      if (!str) return '';
      let s = String(str).trim().toLowerCase();
      if (s.normalize) s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      s = s.replace(/&/g, 'and');
      s = s.replace(/['"()\[\],.\/]/g, '');
      s = s.replace(/[^a-z0-9\- ]+/g, '');
      s = s.replace(/\s+/g, '-');
      s = s.replace(/-+/g, '-');
      s = s.replace(/^-+|-+$/g, '');
      return s;
    }

    function buildPropertyUrlFromItem(item) {
      if (!item) return null;
      const mlsNum = (item.stats && (item.stats.mlsNumber || item.stats.mlsNumber)) || item.id || '';
      const title = item.title || '';
      // Try stats.city first, then parse subtitle
      let city = (item.stats && item.stats.city) || '';
      if (!city && item.subtitle) {
        city = String(item.subtitle).split('|')[0].replace(/,?\s*[A-Z]{2}\s*\d{3,}/, '').trim();
      }
      const province = (item.stats && item.stats.province) || (item.subtitle ? (item.subtitle.match(/\b([A-Z]{2})\b/) || [])[1] : 'bc') || 'bc';

      const addrSlug = slugify(title);
      const citySlug = slugify(city || '');
      const provinceSlug = String(province || 'bc').toLowerCase();
      const mlsLower = String(mlsNum || '').toLowerCase();
      if (!addrSlug || !citySlug || !mlsLower) return null;
      return `https://www.zealty.ca/property/${provinceSlug}/${citySlug}/${addrSlug}-mls_${mlsLower}`;
    }

    (async () => {
      const item = await fetchAutocomplete(mls);
      if (item) {
        const directUrl = buildPropertyUrlFromItem(item);
        if (directUrl) {
          chrome.tabs.create({ url: directUrl }, (tab) => {
            if (tab && tab.windowId) chrome.windows.update(tab.windowId, { focused: true });
          });
          return;
        }
      }

      // Fallback: open Zealty search results and auto-redirect to the first matching property.
      const searchUrl = `https://www.zealty.ca/?s=${encodeURIComponent(mls)}`;

      chrome.tabs.create({ url: searchUrl }, (tab) => {
        if (!tab || !tab.id) return;

        // Focus the new tab's window
        if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true });

        // Wait for the tab to finish loading, then inject a script to find and open the property link.
        const maxAttempts = 3;
        let attempts = 0;

        const tryInject = () => {
          attempts++;
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              func: (mlsArg) => {
                try {
                  // Find anchors that link to /property/ pages
                  const anchors = Array.from(document.querySelectorAll('a[href*="/property/"]'));
                  // Prefer anchors that contain the MLS in the href or text
                  const needle = String(mlsArg).toLowerCase();
                  let found = anchors.find(a => (a.href || '').toLowerCase().includes(needle));
                  if (!found) found = anchors.find(a => (a.innerText || '').toLowerCase().includes(needle));
                  // Last resort, find any anchor whose href contains 'mls_r' (Zealty pattern)
                  if (!found) found = anchors.find(a => /mls[_-]r?\d+/i.test(a.href || ''));
                  if (found) {
                    // Navigate to the canonical property URL
                    window.location.href = found.href;
                    return true;
                  }
                } catch (e) {
                  // ignore
                }
                return false;
              },
              args: [mls]
            },
            (results) => {
              const redirected = Array.isArray(results) && results[0] && results[0].result;
              if (!redirected && attempts < maxAttempts) {
                // If nothing found yet, wait a short while and try again (page may load results dynamically)
                setTimeout(tryInject, 1000 * attempts);
              } else if (!redirected) {
                // final fallback: open a Google site search to surface the Zealty page
                chrome.tabs.create({ url: `https://www.google.com/search?q=site:zealty.ca+${encodeURIComponent(mls)}` });
              }
            }
          );
        };

        // Start attempts after a small delay to allow initial content to render
        setTimeout(tryInject, 700);
      });
    })();
  }
});