// Paste your copied Google Web App URL here
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzK9d9wQHEEsrt9B4J5f_66V2h25qsu6yVJRfKfVayha1anFg26AuPxqr6gxfC_zdXqLQ/exec";

setTimeout(injectExportButton, 2000);

function injectExportButton() {
  if (document.getElementById("zealty-export-btn")) return;

  const btn = document.createElement("button");
  btn.id = "zealty-export-btn";
  btn.innerText = "Export to Sheets";
  
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "80px", 
    right: "20px",
    zIndex: "99999",
    padding: "12px 20px",
    backgroundColor: "#f000c0", 
    color: "white",
    border: "none",
    borderRadius: "24px",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    fontSize: "14px",
    fontFamily: "system-ui, sans-serif",
    transition: "transform 0.2s"
  });

  btn.addEventListener("mouseover", () => btn.style.transform = "scale(1.05)");
  btn.addEventListener("mouseout", () => btn.style.transform = "scale(1)");
  btn.addEventListener("click", runExtraction);

  document.body.appendChild(btn);
}

function runExtraction() {
  const btn = document.getElementById("zealty-export-btn");
  btn.innerText = "Sending...";
  btn.style.backgroundColor = "#888888";
  btn.disabled = true;

  const data = {};
  data["URL"] = window.location.href;

  // MLS ID from URL
  const mlsMatch = window.location.href.match(/mls_([A-Za-z0-9]+)/);
  data["MLS"] = mlsMatch ? mlsMatch[1] : "";

  // 1. Extract JSON-LD values
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach(script => {
    try {
      const parsed = JSON.parse(script.innerText);
      if (parsed["@type"] === "RealEstateListing") {
        data["Listing Name"] = parsed.name || "";
        if (parsed.mainEntity) {
          data["Bedrooms"] = parsed.mainEntity.numberOfBedrooms || "";
          data["Bathrooms"] = parsed.mainEntity.numberOfBathroomsTotal || "";
          if (parsed.mainEntity.floorSize) {
            data["Square Feet"] = parsed.mainEntity.floorSize.value || "";
          }
          data["Year Built"] = parsed.mainEntity.yearBuilt || "";
          if (parsed.mainEntity.address) {
            data["Address"] = parsed.mainEntity.address.streetAddress || "";
          }
        }
        if (parsed.offers) {
          data["Price"] = parsed.offers.price || "";
        }
      }
    } catch (e) {}
  });

  // 2. Extract ONLY from the 'Property Details' section
  const detailsHeading = Array.from(document.querySelectorAll("h2")).find(el => el.textContent.trim() === "Property Details");
  if (detailsHeading) {
    const section = detailsHeading.closest("section");
    if (section) {
      const rows = section.querySelectorAll("table tr");
      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length === 2) {
          const key = cells[0].innerText.trim();
          const val = cells[1].innerText.trim();
          if (key && !isHeaderRow(key)) {
            data[key] = val;
          }
        }
      });
    }
  }

  function isHeaderRow(text) {
    return ["Pricing", "Taxes & Fees", "Home Details", "Land", "Dates & Market", "Property Info", "Features & Amenities", "Agents"].includes(text);
  }

  // 3. Extract Room Information
  const roomHeading = Array.from(document.querySelectorAll("h2")).find(el => el.textContent.trim() === "Room Information");
  if (roomHeading) {
    const section = roomHeading.closest("section");
    if (section) {
      const rows = section.querySelectorAll("table tbody tr");
      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length === 3) {
          const roomName = cells[0].innerText.trim();
          const dimensions = cells[2].innerText.trim();
          if (roomName && dimensions) {
            data[`Room: ${roomName}`] = dimensions;
          }
        }
      });
    }
  }

  // 4. Extract Assessment History
  const assessmentHeading = Array.from(document.querySelectorAll("h2")).find(el => el.textContent.trim() === "Assessment History");
  if (assessmentHeading) {
    const section = assessmentHeading.closest("section");
    if (section) {
      const rows = section.querySelectorAll("table tbody tr");
      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 4) {
          const year = cells[0].innerText.trim();
          const totalAssessed = cells[3].innerText.trim();
          if (year && totalAssessed && !isNaN(year)) {
            data[`Assessed Value (${year})`] = totalAssessed;
          }
        }
      });
    }
  }

  // 5. Extract Estimates (Rent & Value)
  const estimateSection = document.getElementById("estimate");
  if (estimateSection) {
    const cards = estimateSection.querySelectorAll(".bg-ds-background-main");
    cards.forEach(card => {
      const label = card.innerText;
      const valueEl = card.querySelector(".text-ds-card-title");
      if (label && valueEl) {
        const val = valueEl.innerText.trim();
        if (label.includes("OfferValue")) {
          data["OfferValue Estimate"] = val;
        } else if (label.includes("OfferRent")) {
          data["OfferRent Estimate"] = val.replace(/[^0-9]/g, "");
        }
      }
    });
  }

  // 6. Extract Mortgage Cost estimate
  const mortgageSection = document.getElementById("mortgage-calculator");
  if (mortgageSection) {
    const firstRow = mortgageSection.querySelector(".grid-cols-\\[1fr_2\\.5fr_1\\.5fr_1fr\\]");
    if (firstRow) {
      const textContent = Array.from(firstRow.querySelectorAll("div")).map(d => d.textContent.trim());
      const payment = textContent.find(txt => txt.startsWith("$") && !txt.includes("%"));
      if (payment) {
        data["First Mortgage Payment"] = payment.replace(/[^0-9]/g, "");
      }
    }
  }

  // 7. Extract Description
  const descriptionElement = document.querySelector("section.animate-fade-in p");
  if (descriptionElement) {
    data["Description"] = descriptionElement.innerText.trim();
  }

  // 8. Extract Building Name from list items
  let buildingName = "";
  const listItems = document.querySelectorAll("li");
  listItems.forEach(li => {
    if (li.textContent.includes("Building Name:")) {
      buildingName = li.textContent.replace("Building Name:", "").trim();
    }
  });

  // Apply Property Name rules
  if (buildingName) {
    // Rule A: Found exact Building Name
    data["Listing Name"] = buildingName;
  } else {
    // Rule B: Fallback to cleaned street address if Building Name is missing
    let fallbackName = data["Listing Name"] || "";
    if (fallbackName.includes("for Sale at")) {
      let parts = fallbackName.split("for Sale at");
      if (parts.length > 1) {
        let addrPart = parts[1].split(",")[0].trim();
        // Remove unit prefix (e.g. "#212 ")
        addrPart = addrPart.replace(/^#\s*[0-9A-Za-z-]+\s+/, "");
        data["Listing Name"] = addrPart;
      }
    }
  }

  // Dispatch data to the Google Apps Script Web App
  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(() => {
    btn.innerText = "Export to Sheets";
    btn.style.backgroundColor = "#f000c0";
    btn.disabled = false;

    // Direct background worker to pull active Google Sheet tab into focus
    chrome.runtime.sendMessage({ action: "switchToSheets" });
  })
  .catch(err => {
    console.error("Export failed: ", err);
    btn.innerText = "Error!";
    btn.style.backgroundColor = "#e11d48";
    setTimeout(() => {
      btn.innerText = "Export to Sheets";
      btn.style.backgroundColor = "#f000c0";
      btn.disabled = false;
    }, 3000);
  });
}