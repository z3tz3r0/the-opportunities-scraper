// src/scraper.js
// Facebook scraper using Playwright + Lightpanda (CDP)

import { chromium } from 'playwright-core';
import { config, randomDelay, sanitizeText, sleep } from './config.js';

let browser = null;
let context = null;
let page = null;

/**
 * Connect to Lightpanda via CDP
 */
export async function connectBrowser() {
  if (browser) return browser;

  console.log(`🔌 Connecting to Lightpanda at ${config.cdpEndpoint}...`);

  try {
    browser = await chromium.connectOverCDP(config.cdpEndpoint, {
      timeout: config.scraping.timeout,
    });

    context = browser.contexts()[0] || await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    page = context.pages()[0] || await context.newPage();

    console.log('✅ Connected to Lightpanda');
    return browser;
  } catch (error) {
    console.error('❌ Failed to connect to Lightpanda:', error.message);
    throw error;
  }
}

/**
 * Login to Facebook
 */
export async function loginFacebook() {
  const { email, password } = config.facebook;

  if (!email || !password) {
    throw new Error('Facebook credentials not provided');
  }

  console.log('🔐 Logging in to Facebook...');

  try {
    await page.goto('https://www.facebook.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: config.scraping.timeout,
    });

    await sleep(randomDelay());

    // Fill email
    await page.fill('input[name="email"]', email);
    await sleep(500);

    // Fill password
    await page.fill('input[name="pass"]', password);
    await sleep(500);

    // Click login button
    await page.click('button[name="login"]');

    // Wait for navigation
    await page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: config.scraping.timeout,
    }).catch(() => {
      // Sometimes navigation doesn't trigger, check URL instead
    });

    await sleep(randomDelay());

    // Check if login successful
    const currentUrl = page.url();
    
    if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
      throw new Error('Login failed - may need verification or incorrect credentials');
    }

    console.log('✅ Logged in to Facebook');
    return true;
  } catch (error) {
    console.error('❌ Facebook login failed:', error.message);
    throw error;
  }
}

/**
 * Scrape posts from a Facebook page
 */
export async function scrapeFacebookPage(source) {
  const { sourceId, sourceName, url } = source;
  
  console.log(`\n📄 Scraping: ${sourceName}`);
  console.log(`   URL: ${url}`);

  const items = [];

  try {
    // Navigate to the page
    const fullUrl = url.startsWith('http') ? url : `https://www.facebook.com/${url}`;
    
    await page.goto(fullUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.scraping.timeout,
    });

    await sleep(randomDelay());

    // Scroll to load more posts
    console.log(`   📜 Scrolling to load posts...`);
    
    for (let i = 0; i < config.scraping.scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });
      await sleep(randomDelay());
    }

    // Extract posts
    console.log(`   🔍 Extracting posts...`);

    const posts = await page.evaluate((maxPosts) => {
      const results = [];
      
      // Try multiple selectors for posts
      const postSelectors = [
        '[data-ad-preview="message"]',
        '[data-ad-comet-preview="message"]',
        'div[class*="x1iorvi4"]', // Common FB post container
        'div[role="article"]',
      ];

      let postElements = [];
      
      for (const selector of postSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          postElements = Array.from(elements);
          break;
        }
      }

      // If no posts found with selectors, try to find post-like content
      if (postElements.length === 0) {
        // Fallback: look for divs with substantial text content
        const allDivs = document.querySelectorAll('div');
        postElements = Array.from(allDivs).filter(div => {
          const text = div.innerText?.trim() || '';
          return text.length > 100 && text.length < 5000;
        });
      }

      // Extract data from each post
      for (const element of postElements.slice(0, maxPosts)) {
        try {
          const text = element.innerText?.trim() || '';
          
          if (text.length < 50) continue; // Skip very short content

          // Try to find associated link
          let postUrl = '';
          const linkElement = element.closest('a') || element.querySelector('a[href*="/posts/"]');
          if (linkElement) {
            postUrl = linkElement.href;
          }

          // Extract first line as title (or first 100 chars)
          const lines = text.split('\n').filter(l => l.trim());
          const title = lines[0]?.substring(0, 200) || text.substring(0, 200);

          results.push({
            title,
            content: text.substring(0, 3000),
            url: postUrl,
          });
        } catch (e) {
          // Skip problematic elements
        }
      }

      return results;
    }, config.scraping.maxPosts);

    console.log(`   📊 Found ${posts.length} posts`);

    // Process and sanitize posts
    for (const post of posts) {
      // Sanitize content to prevent prompt injection
      const sanitizedTitle = sanitizeText(post.title);
      const sanitizedContent = sanitizeText(post.content);

      // Skip if no meaningful content
      if (sanitizedTitle.length < 20) continue;

      items.push({
        sourceId,
        titleTh: sanitizedTitle,
        descriptionTh: sanitizedContent,
        url: post.url || fullUrl,
        deadline: extractDeadline(sanitizedContent),
        grantAmount: extractAmount(sanitizedContent),
      });
    }

    console.log(`   ✅ Processed ${items.length} valid items`);
    
    return items;
  } catch (error) {
    console.error(`   ❌ Error scraping ${sourceName}:`, error.message);
    throw error;
  }
}

/**
 * Extract deadline from text (Thai format)
 */
function extractDeadline(text) {
  // Pattern: วันที่ DD เดือน YYYY, DD/MM/YYYY, etc.
  const patterns = [
    /(?:หมดเขต|ภายใน|ถึงวันที่|สิ้นสุด)[:\s]*(\d{1,2}[\s/-]\w+[\s/-]\d{2,4})/i,
    /(\d{1,2}[\s/-](?:ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?)[\s/-]\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extract grant amount from text
 */
function extractAmount(text) {
  // Pattern: X บาท, X,XXX บาท, X ล้านบาท
  const patterns = [
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:บาท|baht)/i,
    /(?:วงเงิน|มูลค่า|ทุน)[:\s]*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:ล้าน|ล้านบาท)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let amount = match[1].replace(/,/g, '');
      
      // Convert "ล้าน" to full number
      if (text.includes('ล้าน')) {
        amount = (parseFloat(amount) * 1000000).toString();
      }
      
      return amount;
    }
  }

  return '';
}

/**
 * Close browser connection
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
    console.log('🔌 Browser disconnected');
  }
}

/**
 * Main scrape function for a single source
 */
export async function scrapeSource(source) {
  return await scrapeFacebookPage(source);
}