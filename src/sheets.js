// src/sheets.js
// Google Sheets helper functions

import { formatInTimeZone } from 'date-fns-tz';
import { google } from 'googleapis';
import { config, generateId } from './config.js';

let sheets = null;
let auth = null;

/**
 * Initialize Google Sheets API
 */
export async function initSheets() {
  if (sheets) return sheets;

  try {
    // Parse credentials from environment variable (base64 encoded)
    const credentialsJson = Buffer.from(
      process.env.GOOGLE_CREDENTIALS,
      'base64'
    ).toString('utf-8');
    
    const credentials = JSON.parse(credentialsJson);

    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    
    console.log('✅ Google Sheets API initialized');
    return sheets;
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets:', error.message);
    throw error;
  }
}

/**
 * Get active sources from Sources tab
 */
export async function getActiveSources() {
  await initSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.tabs.sources}!A:H`,
  });

  const rows = response.data.values || [];
  
  if (rows.length <= 1) {
    console.log('⚠️ No sources found');
    return [];
  }

  // Skip header row, parse data
  const sources = rows.slice(1).map(row => ({
    sourceId: row[0] || '',
    sourceName: row[1] || '',
    sourceType: row[2] || '',
    url: row[3] || '',
    scrapeSelector: row[4] || '',
    isActive: row[5]?.toUpperCase() === 'TRUE',
    lastScraped: row[6] || '',
    notes: row[7] || '',
  }));

  // Filter active sources only
  const activeSources = sources.filter(s => s.isActive);
  
  console.log(`📋 Found ${activeSources.length} active sources`);
  return activeSources;
}

/**
 * Get existing item URLs to check for duplicates
 */
export async function getExistingUrls() {
  await initSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.tabs.items}!G:G`, // URL column
  });

  const rows = response.data.values || [];
  
  // Skip header, get URLs
  const urls = rows.slice(1).map(row => row[0]).filter(Boolean);
  
  console.log(`📋 Found ${urls.length} existing items`);
  return new Set(urls);
}

/**
 * Save scraped items to Items tab
 */
export async function saveItems(items) {
  if (!items || items.length === 0) {
    console.log('⚠️ No items to save');
    return 0;
  }

  await initSheets();

  const now = formatInTimeZone(
    new Date(),
    config.timezone,
    'yyyy-MM-dd HH:mm:ss'
  );

  // Prepare rows (match column order in Items tab)
  const rows = items.map(item => [
    generateId('ITM'),           // A: item_id
    item.sourceId || '',         // B: source_id
    item.titleTh || '',          // C: title_th
    '',                          // D: title_en (n8n จะเติม)
    item.descriptionTh || '',    // E: description_th
    '',                          // F: description_en (n8n จะเติม)
    item.url || '',              // G: url
    'pending',                   // H: category (n8n จะ classify)
    item.deadline || '',         // I: deadline
    item.grantAmount || '',      // J: grant_amount
    '',                          // K: suitability_score (Phase 2)
    '',                          // L: suitability_reason (Phase 2)
    now,                         // M: scraped_at
    'FALSE',                     // N: processed
    'FALSE',                     // O: is_sent
    '',                          // P: sent_at
  ]);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.tabs.items}!A:P`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });

  const savedCount = response.data.updates?.updatedRows || rows.length;
  console.log(`✅ Saved ${savedCount} items to Google Sheets`);
  
  return savedCount;
}

/**
 * Update last_scraped timestamp in Sources tab
 */
export async function updateSourceTimestamp(sourceId) {
  await initSheets();

  const now = formatInTimeZone(
    new Date(),
    config.timezone,
    'yyyy-MM-dd HH:mm:ss'
  );

  // First, find the row number for this source
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.tabs.sources}!A:A`,
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === sourceId);

  if (rowIndex === -1) {
    console.log(`⚠️ Source ${sourceId} not found`);
    return;
  }

  // Update the last_scraped column (G)
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.tabs.sources}!G${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[now]],
    },
  });

  console.log(`✅ Updated timestamp for source: ${sourceId}`);
}

/**
 * Write log entry to Logs tab
 */
export async function writeLog(source, eventType, message, sourceId = '') {
  await initSheets();

  const now = formatInTimeZone(
    new Date(),
    config.timezone,
    'yyyy-MM-dd HH:mm:ss'
  );

  const logRow = [
    generateId('LOG'),    // A: log_id
    now,                  // B: timestamp
    source,               // C: source (github-actions / n8n)
    sourceId,             // D: source_id
    eventType,            // E: event_type (success/error/skip/info)
    message,              // F: message
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheets.spreadsheetId,
    range: `${config.sheets.tabs.logs}!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [logRow],
    },
  });

  const emoji = eventType === 'error' ? '❌' : 
                eventType === 'success' ? '✅' : 
                eventType === 'skip' ? '⏭️' : 'ℹ️';
  
  console.log(`${emoji} [LOG] ${eventType}: ${message}`);
}