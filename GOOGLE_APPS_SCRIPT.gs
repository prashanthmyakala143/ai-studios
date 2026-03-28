/**
 * AIDEOLOGY STAFF TRACKER — GOOGLE APPS SCRIPT
 * =============================================
 * File: GOOGLE_APPS_SCRIPT.gs
 *
 * HOW TO DEPLOY:
 * 1. Go to https://script.google.com/  → New Project
 * 2. Paste this entire file into the editor
 * 3. Save as "Aideology Staff Backend"
 * 4. Click Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Click Deploy → copy the Web App URL
 * 6. Paste the URL in the HTML Settings panel
 *
 * WHAT IT CREATES IN GOOGLE DRIVE:
 *   One spreadsheet: "AIDEOLOGY_STAFF_DATA"
 *   With 4 sheets (tabs):
 *     Sheet1 - PRASHANTH
 *     Sheet2 - CHANDU
 *     Sheet3 - IMMI
 *     Sheet4 - SRIRAJ
 *   Data rows in ascending order (Row 1 = Entry 1, Row 2 = Entry 2...)
 */

// ── CONFIGURATION ────────────────────────────────────────────
const MASTER_FILE_NAME = 'AIDEOLOGY_STAFF_DATA';
const MEMBERS_LIST     = ['PRASHANTH', 'CHANDU', 'IMMI', 'SRIRAJ'];
const HEADERS          = ['No','Date','Attendance','Project','Type','Duration','Status','Remarks','Link 1','Link 2'];

// ── HTTP HANDLERS ────────────────────────────────────────────

function doGet(e) {
  const member = (e.parameter.member || '').trim().toUpperCase();
  if (!member) return jsonResponse({ error: 'Member parameter required' });
  try {
    return jsonResponse(loadMemberData(member));
  } catch (err) {
    Logger.log('doGet error: ' + err);
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Full sync of all 4 members (from ☁ SYNC DRIVE button)
    if (data.action === 'syncAllToDrive') {
      return handleSyncAll(data);
    }

    // Single entry append (auto-called on each ADD ENTRY)
    const member = (data.member || '').trim().toUpperCase();
    if (!member) return jsonResponse({ error: 'Member parameter required' });
    appendEntry(member, data);
    return jsonResponse({ success: true, message: 'Entry appended for ' + member });

  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonResponse({ error: err.toString() });
  }
}

// ── MASTER SPREADSHEET ───────────────────────────────────────

function getMasterSpreadsheet(folderId) {
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      const files  = folder.getFilesByName(MASTER_FILE_NAME);
      if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());
      return createMasterSpreadsheet(folder);
    } catch(e) {
      throw new Error('Invalid folder ID: ' + e.toString());
    }
  }
  // Fallback: search all of Drive
  const files = DriveApp.getFilesByName(MASTER_FILE_NAME);
  if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());
  return createMasterSpreadsheet(null);
}

function createMasterSpreadsheet(folder) {
  const ss = SpreadsheetApp.create(MASTER_FILE_NAME);

  // First sheet — rename to member 0
  ss.getSheets()[0].setName('Sheet1 - ' + MEMBERS_LIST[0]);
  setupSheetHeaders(ss.getSheets()[0], MEMBERS_LIST[0]);

  // Create sheets for members 1–3
  for (let i = 1; i < MEMBERS_LIST.length; i++) {
    const sh = ss.insertSheet('Sheet' + (i + 1) + ' - ' + MEMBERS_LIST[i]);
    setupSheetHeaders(sh, MEMBERS_LIST[i]);
  }

  if (folder) DriveApp.getFileById(ss.getId()).moveTo(folder);

  Logger.log('Created: ' + MASTER_FILE_NAME);
  return ss;
}

function setupSheetHeaders(sheet, memberName) {
  // Row 1: title banner
  const titleRange = sheet.getRange(1, 1, 1, HEADERS.length);
  titleRange.merge();
  titleRange.setValue('AIDEOLOGY STUDIOS — ' + memberName + ' WORK LOG');
  titleRange.setBackground('#050505');
  titleRange.setFontColor('#FF0090');
  titleRange.setFontWeight('bold');
  titleRange.setFontSize(13);

  // Row 2: column headers
  const headerRange = sheet.getRange(2, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setBackground('#FF0090');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  // Column widths (pixels)
  const widths = [40, 90, 90, 180, 110, 90, 110, 220, 240, 240];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Freeze title + header rows
  sheet.setFrozenRows(2);
}

// ── GET SHEET FOR A MEMBER ───────────────────────────────────

function getMemberSheet(ss, member) {
  const idx  = MEMBERS_LIST.indexOf(member.toUpperCase());
  if (idx === -1) throw new Error('Unknown member: ' + member);
  const name = 'Sheet' + (idx + 1) + ' - ' + member.toUpperCase();
  let sheet  = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    setupSheetHeaders(sheet, member.toUpperCase());
  }
  return sheet;
}

// ── APPEND ONE ENTRY (ascending: new row at bottom) ──────────

function appendEntry(member, entry) {
  const ss    = getMasterSpreadsheet('');
  const sheet = getMemberSheet(ss, member);

  // Data starts at row 3 (row 1 = title, row 2 = headers)
  const lastRow = sheet.getLastRow();
  const nextRow = Math.max(lastRow + 1, 3);
  const rowNo   = nextRow - 2; // sequential entry number

  const rowData = [
    rowNo,
    entry.date       || '',
    entry.attendance || 'Present',
    entry.project    || '',
    entry.type       || 'Ad Video',
    entry.duration   ? entry.duration + ' hrs' : '',
    entry.status     || 'Completed',
    entry.remarks    || '',
    entry.link       || '',
    entry.link2      || ''
  ];

  sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

  // Alternate row background
  const bg = (rowNo % 2 === 0) ? '#111111' : '#0a0a0a';
  sheet.getRange(nextRow, 1, 1, rowData.length).setBackground(bg);
  sheet.getRange(nextRow, 1, 1, rowData.length).setFontColor('#F5F5F5');

  Logger.log('Entry #' + rowNo + ' appended for ' + member);
}

// ── SYNC ALL 4 MEMBERS (full overwrite) ──────────────────────

function handleSyncAll(data) {
  try {
    const folderId = data.folderId || '';
    const members  = data.members  || {};
    const ss       = getMasterSpreadsheet(folderId);

    MEMBERS_LIST.forEach(member => {
      const sheet   = getMemberSheet(ss, member);
      const entries = members[member] || [];

      // Clear existing data rows (keep rows 1–2)
      const lastRow = sheet.getLastRow();
      if (lastRow >= 3) {
        sheet.getRange(3, 1, lastRow - 2, HEADERS.length).clearContent();
        sheet.getRange(3, 1, lastRow - 2, HEADERS.length).setBackground(null);
      }

      if (entries.length === 0) return;

      // Write ascending from row 3
      const rows = entries.map((e, i) => [
        i + 1,
        e['Date']       || '',
        e['Attendance'] || 'Present',
        e['Project']    || '',
        e['Type']       || '',
        e['Duration']   || '',
        e['Status']     || '',
        e['Remarks']    || '',
        e['Link 1']     || '',
        e['Link 2']     || ''
      ]);

      sheet.getRange(3, 1, rows.length, HEADERS.length).setValues(rows);

      // Alternate row shading
      rows.forEach((_, i) => {
        const row = 3 + i;
        const bg  = ((i + 1) % 2 === 0) ? '#111111' : '#0a0a0a';
        sheet.getRange(row, 1, 1, HEADERS.length).setBackground(bg);
        sheet.getRange(row, 1, 1, HEADERS.length).setFontColor('#F5F5F5');
      });

      Logger.log(entries.length + ' rows written for ' + member);
    });

    return jsonResponse({
      success: true,
      message: 'All members synced to ' + MASTER_FILE_NAME,
      fileId:  ss.getId()
    });

  } catch (err) {
    Logger.log('handleSyncAll error: ' + err);
    return jsonResponse({ error: err.toString() });
  }
}

// ── LOAD MEMBER DATA (GET request) ───────────────────────────

function loadMemberData(member) {
  const ss    = getMasterSpreadsheet('');
  const sheet = getMemberSheet(ss, member);
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];

  const data = sheet.getRange(3, 1, lastRow - 2, HEADERS.length).getValues();

  return data
    .filter(row => row[0] !== '' && row[0] !== null)
    .map((row, i) => ({
      id:         Date.now() + i,
      date:       row[1]  || '',
      attendance: row[2]  || 'Present',
      project:    row[3]  || '—',
      type:       row[4]  || 'Ad Video',
      duration:   String(row[5] || '').replace(' hrs', ''),
      status:     row[6]  || 'Completed',
      remarks:    row[7]  || '—',
      link:       row[8]  || '',
      link2:      row[9]  || ''
    }));
}

// ── UTILITY ──────────────────────────────────────────────────

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this manually in the Apps Script editor to verify setup.
 * Click Run → testSetup and check the Execution Log.
 */
function testSetup() {
  Logger.log('=== AIDEOLOGY STAFF TRACKER — TEST ===');
  const ss = getMasterSpreadsheet('');
  Logger.log('Spreadsheet: ' + ss.getName() + '  ID: ' + ss.getId());
  MEMBERS_LIST.forEach(m => {
    const sh = getMemberSheet(ss, m);
    Logger.log('  Sheet OK → ' + sh.getName());
  });
  Logger.log('✓ Test passed — all 4 member sheets ready.');
}
