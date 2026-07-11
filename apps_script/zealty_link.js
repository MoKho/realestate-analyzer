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
    
    var nextRow = sheet2.getLastRow() + 1;
    var cashFlowFormula = "=N" + nextRow + "-M" + nextRow;
    
    var rowData = [
      data["Building Name"] || "",                 // Col A (Property Name)
      data["MLS"] || "",                          // Col B (MLS®)
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
    if (mlsIndex !== -1 && !allParamsRow[mlsIndex]) {
      allParamsRow[mlsIndex] = data["MLS"] || "";
    }
    
    allParamsSheet.appendRow(allParamsRow);
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}