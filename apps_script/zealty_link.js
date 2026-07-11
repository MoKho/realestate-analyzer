function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 1. Write to "Sheet2" ---
    var sheet2 = ss.getSheetByName("Sheet2");
    if (!sheet2) {
      sheet2 = ss.insertSheet("Sheet2");
      sheet2.appendRow([
        "Property Name", "MLS®", "Age", "Address", "Beds", "Baths", 
        "SqFt", "Price", "2026 Assessment", "Price/SqFt", "Maintenace", 
        "Maintenace per SQFT", "Est. Monthly Cost", "Est. Monthly Rent", 
        "Monthly Cash Flow", "Link/Notes"
      ]);
    }
    
    // --- Deduplication: check column B (MLS) in Sheet2 ---
    var lastRow = sheet2.getLastRow();
    var mlsToCheck = data["MLS"] || "";
    // Normalize MLS: trim, uppercase, remove non-alphanumeric characters
    mlsToCheck = String(mlsToCheck).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (mlsToCheck) {
      if (lastRow >= 2) {
        var mlsRange = sheet2.getRange(2, 2, lastRow - 1, 1).getValues();
        for (var i = 0; i < mlsRange.length; i++) {
          var cellVal = (mlsRange[i][0] || "");
          if (String(cellVal).trim().toUpperCase() == mlsToCheck) {
            var foundRow = i + 2; // account for header
            // Move the active cell to the found MLS cell and show a short-lived toast
            try {
              var targetRange = sheet2.getRange(foundRow, 2);
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
    var cashFlowFormula = "=N" + nextRow + "-M" + nextRow;
    // Robust building name: accept several possible keys from the incoming data
    var buildingName = data["Building Name"] || data["Property Name"] || data["Listing Name"] || data["Building"] || data["buildingName"] || "";

    var rowData = [
      buildingName,                                  // Col A (Property Name)
      mlsToCheck || (data["MLS"] || ""),          // Col B (MLS®) - normalized
      data["Year Built"] || "",                   // Col C (Age / Year Built)
      data["Address"] || "",                      // Col D (Address)
      data["Bedrooms"] || "",                     // Col E (Beds)
      data["Bathrooms"] || "",                    // Col F (Baths)
      data["Square Feet"] || data["Floor Area"] || "", // Col G (SqFt)
      data["Asking Price"] || data["Price"] || "", // Col H (Price)
      data["Assessed Value (2026)"] || "",        // Col I (2026 Assessment)
      data["Price per Floor SqFt"] || "",         // Col J (Price/SqFt)
      data["Maintenance Fee"] || "",              // Col K (Maintenace)
      data["Maint. Fee per SqFt"] || "",          // Col L (Maintenace per SQFT)
      data["First Mortgage Payment"] || "",       // Col M (Est. Monthly Cost)
      data["OfferRent Estimate"] || "",           // Col N (Est. Monthly Rent)
      cashFlowFormula,                            // Col O (Monthly Cash Flow)
      data["URL"] || ""                           // Col P (Link/Notes)
    ];
    
    sheet2.appendRow(rowData);
    
    // --- 2. Write to "all-params" ---
    var allParamsSheet = ss.getSheetByName("all-params");
    if (!allParamsSheet) {
      allParamsSheet = ss.insertSheet("all-params");
      allParamsSheet.appendRow(["MLS"]);
    }
    
    var headers = allParamsSheet.getRange(1, 1, 1, allParamsSheet.getLastColumn()).getValues()[0];
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
    
    var mlsIndex = headers.indexOf("MLS");
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
          if (String(apVal).trim().toUpperCase() == mlsToCheck) {
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
  }
}