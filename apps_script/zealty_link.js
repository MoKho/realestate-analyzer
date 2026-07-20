function doPost(e) {
  var lock = null;
  var lockAcquired = false;
  try {
    // Serialize exports so two near-simultaneous clicks cannot both pass the
    // duplicate check before either row has been appended.
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    lockAcquired = true;

    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 1. Write to "Sheet2" ---
    var sheet2 = ss.getSheetByName("Sheet2");
    if (!sheet2) {
      sheet2 = ss.insertSheet("Sheet2");
      sheet2.appendRow([
        "Property Name", "Neighbourhood", "MLS®", "Age", "Address", "Beds", "Baths",
        "SqFt", "Price", "2026 Assessment", "Price/SqFt", "Maintenace", 
        "Maintenace per SQFT", "Est. Monthly Cost", "Est. Monthly Rent", 
        "Monthly Cash Flow", "Link/Notes"
      ]);
    }
    
    // --- Deduplication: locate MLS column by header and check for existing MLS (robust) ---
    var lastRow = sheet2.getLastRow();
    var mlsToCheck = data["MLS"] || "";
    // Normalize MLS: trim, uppercase, remove non-alphanumeric characters
    function normalizeMls(s) {
      return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    mlsToCheck = normalizeMls(mlsToCheck);
    // Determine MLS column by header. Older rows may have MLS in a different
    // column, so the duplicate scan below also checks every populated column.
    var sheet2Headers = sheet2.getRange(1, 1, 1, sheet2.getLastColumn()).getValues()[0] || [];
    function normHeader(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    var mlsCol = -1;
    for (var hi = 0; hi < sheet2Headers.length; hi++) {
      var nh = normHeader(sheet2Headers[hi]);
      if (nh === 'mls' || nh === 'mls' + String.fromCharCode(174) || nh.indexOf('mls') !== -1) {
        mlsCol = hi + 1; break;
      }
    }
    if (mlsToCheck) {
      if (lastRow >= 2) {
        var sheet2Rows = sheet2.getRange(2, 1, lastRow - 1, sheet2.getLastColumn()).getDisplayValues();
        for (var i = 0; i < sheet2Rows.length; i++) {
          var duplicateCol = -1;
          for (var ci = 0; ci < sheet2Rows[i].length; ci++) {
            if (normalizeMls(sheet2Rows[i][ci]) == mlsToCheck) {
              duplicateCol = ci + 1;
              break;
            }
          }
          if (duplicateCol !== -1) {
            var foundRow = i + 2; // account for header
            // Move the active cell to the found MLS cell and show a short-lived toast
            try {
              var targetRange = sheet2.getRange(foundRow, duplicateCol);
              sheet2.activate();
              sheet2.setActiveSelection(targetRange);
              // Temporarily highlight the cell and show a toast for visibility
              var originalBg = targetRange.getBackground();
              targetRange.setBackground('#fff2a8');
              ss.toast('MLS "' + mlsToCheck + '" already on sheet (row ' + foundRow + ').', 'Duplicate found', 10);
              SpreadsheetApp.flush();
              // Wait so the user can see the highlight/toast, then restore background
              try {
                Utilities.sleep(10000);
                targetRange.setBackground(originalBg);
              } catch (sleepErr) {
                // ignore sleep/restore errors
              }
            } catch (e) {
              // ignore UI errors when script isn't running with an active UI (e.g., webapp triggers)
            }

            return ContentService.createTextOutput(JSON.stringify({
              "status": "exists",
              "message": "MLS already exists on sheet",
              "row": foundRow,
              "mls": mlsToCheck
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
    }

    var nextRow = sheet2.getLastRow() + 1;
    // Determine column letters for monthly rent/cost using headers so formulas remain correct if columns shift
    var sheet2HeadersAfter = sheet2.getRange(1, 1, 1, sheet2.getLastColumn()).getValues()[0];
    function colLetter(n) {
      var s = '';
      while (n > 0) {
        var m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    }
    var costIdx = sheet2HeadersAfter.indexOf("Est. Monthly Cost");
    var rentIdx = sheet2HeadersAfter.indexOf("Est. Monthly Rent");
    var costColLetter = (costIdx !== -1) ? colLetter(costIdx + 1) : 'M';
    var rentColLetter = (rentIdx !== -1) ? colLetter(rentIdx + 1) : 'N';
    var cashFlowFormula = "=" + rentColLetter + nextRow + "-" + costColLetter + nextRow;

    // Robust building name: accept several possible keys from the incoming data
    var buildingName = data["Building Name"] || data["Property Name"] || data["Listing Name"] || data["Building"] || data["buildingName"] || "";

    var rowData = [
      buildingName,                                  // Col A (Property Name)
      data["Neighbourhood"] || "",                // Col B (Neighbourhood)
      mlsToCheck || (data["MLS"] || ""),         // Col C (MLS®) - normalized
      data["Year Built"] || "",                   // Col D (Age / Year Built)
      data["Address"] || "",                      // Col E (Address)
      data["Bedrooms"] || "",                     // Col F (Beds)
      data["Bathrooms"] || "",                    // Col G (Baths)
      data["Square Feet"] || data["Floor Area"] || "", // Col H (SqFt)
      data["Asking Price"] || data["Price"] || "", // Col I (Price)
      data["Assessed Value (2026)"] || "",        // Col J (2026 Assessment)
      data["Price per Floor SqFt"] || "",         // Col K (Price/SqFt)
      data["Maintenance Fee"] || "",              // Col L (Maintenace)
      data["Maint. Fee per SqFt"] || "",          // Col M (Maintenace per SQFT)
      data["First Mortgage Payment"] || "",       // Col N (Est. Monthly Cost)
      data["OfferRent Estimate"] || "",           // Col O (Est. Monthly Rent)
      cashFlowFormula,                                // Col P (Monthly Cash Flow)
      data["Description"] || ""                    // Col Q (Description)
    ];
    
    sheet2.appendRow(rowData);
    // If a URL was provided, make the Property Name (Col A) a hyperlink to it
    var url = data["URL"] || "";
    if (url) {
      try {
        var displayText = buildingName || data["Listing Name"] || "";
        var rich = SpreadsheetApp.newRichTextValue().setText(displayText).setLinkUrl(url).build();
        sheet2.getRange(nextRow, 1).setRichTextValue(rich);
      } catch (linkErr) {
        // Fallback: set a HYPERLINK formula if RichText linking fails
        try {
          var safeUrl = String(url).replace(/"/g, '""');
          var safeText = String(buildingName || data["Listing Name"] || "").replace(/"/g, '""');
          sheet2.getRange(nextRow, 1).setFormula('=HYPERLINK("' + safeUrl + '", "' + safeText + '")');
        } catch (e) {
          // ignore
        }
      }
    }
    
    // --- 2. Write to "all-params" ---
    var allParamsSheet = ss.getSheetByName("all-params");
    if (!allParamsSheet) {
      allParamsSheet = ss.insertSheet("all-params");
      allParamsSheet.appendRow(["MLS"]);
    }
    
    var headers = allParamsSheet.getRange(1, 1, 1, allParamsSheet.getLastColumn()).getValues()[0] || [];
    var updatedHeaders = [...headers];
    var keys = Object.keys(data);
    var headersChanged = false;
    
    keys.forEach(function(key) {
      if (updatedHeaders.indexOf(key) === -1) {
        updatedHeaders.push(key);
        headersChanged = true;
      }
    });
    
    if (headersChanged) {
      allParamsSheet.getRange(1, 1, 1, updatedHeaders.length).setValues([updatedHeaders]);
      headers = updatedHeaders;
    }
    
    var allParamsRow = new Array(headers.length).fill("");
    keys.forEach(function(key) {
      var colIndex = headers.indexOf(key);
      if (colIndex !== -1) {
        allParamsRow[colIndex] = data[key];
      }
    });
    
    // Find MLS column in all-params robustly
    var mlsIndex = -1;
    for (var hh = 0; hh < headers.length; hh++) {
      var nhh = String(headers[hh] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (nhh.indexOf('mls') !== -1) { mlsIndex = hh; break; }
    }
    if (mlsIndex !== -1) {
      allParamsRow[mlsIndex] = mlsToCheck || (data["MLS"] || "");
    }

    // --- Avoid duplicate MLS in all-params as well (if a MLS column exists) ---
    var appendAllParams = true;
    if (mlsIndex !== -1 && mlsToCheck) {
      var apLastRow = allParamsSheet.getLastRow();
      if (apLastRow >= 2) {
        var apRange = allParamsSheet.getRange(2, mlsIndex + 1, apLastRow - 1, 1).getValues();
        for (var j = 0; j < apRange.length; j++) {
          var apVal = (apRange[j][0] || "");
          if (normalizeMls(apVal) == mlsToCheck) {
            appendAllParams = false;
            break;
          }
        }
      }
    }

    if (appendAllParams) {
      allParamsSheet.appendRow(allParamsRow);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "row": nextRow, "mls": mlsToCheck }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lock && lockAcquired) {
      lock.releaseLock();
    }
  }
}