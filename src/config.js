// src/config.js
// Configuration และ constants สำหรับ scraper

export const config = {
  // CDP Endpoint (Lightpanda)
  cdpEndpoint: process.env.CDP_ENDPOINT || 'ws://localhost:9222',

  // Facebook credentials
  facebook: {
    email: process.env.FB_EMAIL,
    password: process.env.FB_PASSWORD,
  },

  // Google Sheets
  sheets: {
    spreadsheetId: process.env.SPREADSHEET_ID,
    tabs: {
      sources: 'Sources',
      items: 'Items',
      logs: 'Logs',
    },
  },

  // Scraping settings
  scraping: {
    maxPosts: 10,                    // จำนวน posts สูงสุดที่จะ scrape ต่อ page
    scrollCount: 3,                  // จำนวนครั้งที่ scroll เพื่อโหลด posts เพิ่ม
    delayBetweenActions: {
      min: 2000,                     // milliseconds
      max: 5000,
    },
    timeout: 30000,                  // page load timeout
  },

  // Timezone
  timezone: 'Asia/Bangkok',
};

/**
 * Random delay ระหว่าง min และ max
 */
export function randomDelay() {
  const { min, max } = config.scraping.delayBetweenActions;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep function
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate ว่า environment variables ครบ
 */
export function validateEnv() {
  const required = [
    'FB_EMAIL',
    'FB_PASSWORD',
    'SPREADSHEET_ID',
    'GOOGLE_CREDENTIALS',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment variables validated');
}

/**
 * Sanitize text เพื่อป้องกัน prompt injection
 */
export function sanitizeText(text) {
  if (!text) return '';
  
  return text
    // Remove potential prompt injection patterns
    .replace(/ignore previous instructions/gi, '[FILTERED]')
    .replace(/disregard all prior/gi, '[FILTERED]')
    .replace(/system:\s*/gi, '[FILTERED]')
    .replace(/assistant:\s*/gi, '[FILTERED]')
    .replace(/user:\s*/gi, '[FILTERED]')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Limit length
    .substring(0, 5000);
}

/**
 * Generate unique ID
 */
export function generateId(prefix = 'ITM') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}