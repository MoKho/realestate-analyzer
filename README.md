# realestate-analyzer

Chrome extension that extracts property data from zealty.com property pages and writes it to a designated Google Sheet.

Contents:
- `manifest.json`, `background.js`, `content.js` — extension code
- `apps_script/` — Google Apps Script helpers
- `template/` and `test_files/` — test inputs

See the repository description for usage and installation notes.

## Changes

### 1.6.3

- Prevents duplicate MLS exports even when older rows store MLS in the pre-Neighbourhood column.

### 1.6.2

- Removes the post-export background message that could fail after an extension reload.

### 1.6.1

- Exports the building-information `Neighbourhood` value to column B of `Sheet2`.