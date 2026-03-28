# AIDEOLOGY STAFF TRACKER PRO
## Project File Structure

```
AIDEOLOGY_STAFF_TRACKER/
│
├── index.html                        ← Main webpage (open this in browser)
│
├── css/
│   └── style.css                     ← All styles & brand tokens
│
├── js/
│   └── app.js                        ← All JavaScript logic
│
├── google-apps-script/
│   └── GOOGLE_APPS_SCRIPT.gs         ← Paste into script.google.com
│
└── README.md                         ← This file
```

---

## HOW TO USE

### 1 — Open the app
Double-click `index.html` to open in your browser.  
All files must stay in the same folder structure for CSS and JS to load correctly.

### 2 — Deploy Google Apps Script (for Drive sync)
1. Go to https://script.google.com/ → New Project
2. Paste the contents of `google-apps-script/GOOGLE_APPS_SCRIPT.gs`
3. Click **Deploy** → New Deployment → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the Web App URL

### 3 — Configure Settings (in the app)
Click **⚙ SETTINGS** (bottom-left corner):
- **Google Apps Script URL** → paste the Web App URL from step 2
- **Google Drive Folder ID** → ID from your Drive folder URL
- **Claude API Key** → from console.anthropic.com (optional, for AI insights)

---

## EXCEL FILE STRUCTURE

When you click **⬇ DOWNLOAD EXCEL**, one `.xlsx` file is created with 4 sheets:

| Sheet        | Member     |
|--------------|------------|
| Sheet1       | PRASHANTH  |
| Sheet2       | CHANDU     |
| Sheet3       | IMMI       |
| Sheet4       | SRIRAJ     |

- Row 1 = first entry ever (ascending order)
- Row 2 = second entry, etc.
- Empty fields are **blank** (no dashes)

---

## GOOGLE DRIVE FILE STRUCTURE

The Apps Script creates **one spreadsheet** named `AIDEOLOGY_STAFF_DATA` with the same 4-sheet structure above.

---

## TECHNOLOGIES USED
- HTML5 / CSS3 / Vanilla JavaScript
- [SheetJS (xlsx)](https://sheetjs.com/) — client-side Excel export
- Google Apps Script — Drive sync backend
- Claude AI (Anthropic) — optional AI insights
- Google Fonts — Bebas Neue, Barlow Condensed, DM Sans
