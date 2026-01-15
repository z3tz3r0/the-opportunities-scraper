// src/index.js
// Entry point - Main orchestration

import { randomDelay, sleep, validateEnv } from './config.js';
import {
    closeBrowser,
    connectBrowser,
    loginFacebook,
    scrapeSource,
} from './scraper.js';
import {
    getActiveSources,
    getExistingUrls,
    initSheets,
    saveItems,
    updateSourceTimestamp,
    writeLog,
} from './sheets.js';

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🚀 Facebook Opportunities Scraper');
  console.log('   📅 ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  const stats = {
    sourcesProcessed: 0,
    sourcesSuccess: 0,
    sourcesFailed: 0,
    itemsFound: 0,
    itemsSaved: 0,
    itemsSkipped: 0,
  };

  try {
    // Step 1: Validate environment
    console.log('📋 Step 1: Validating environment...');
    validateEnv();

    // Step 2: Initialize Google Sheets
    console.log('\n📋 Step 2: Initializing Google Sheets...');
    await initSheets();

    // Step 3: Get active sources
    console.log('\n📋 Step 3: Getting active sources...');
    const sources = await getActiveSources();

    if (sources.length === 0) {
      console.log('⚠️ No active sources found. Exiting.');
      await writeLog('github-actions', 'info', 'No active sources found');
      return;
    }

    // Step 4: Get existing URLs (for duplicate check)
    console.log('\n📋 Step 4: Loading existing items for duplicate check...');
    const existingUrls = await getExistingUrls();

    // Step 5: Connect to Lightpanda
    console.log('\n📋 Step 5: Connecting to Lightpanda...');
    await connectBrowser();

    // Step 6: Login to Facebook
    console.log('\n📋 Step 6: Logging in to Facebook...');
    await loginFacebook();

    // Step 7: Scrape each source
    console.log('\n📋 Step 7: Scraping sources...');
    console.log('─────────────────────────────────────────────────────────\n');

    const allNewItems = [];

    for (const source of sources) {
      stats.sourcesProcessed++;

      try {
        // Scrape the source
        const items = await scrapeSource(source);
        stats.itemsFound += items.length;

        // Filter out duplicates
        const newItems = items.filter(item => {
          if (existingUrls.has(item.url)) {
            stats.itemsSkipped++;
            return false;
          }
          // Add to existing set to prevent duplicates within this run
          existingUrls.add(item.url);
          return true;
        });

        if (newItems.length > 0) {
          allNewItems.push(...newItems);
          console.log(`   ✨ ${newItems.length} new items (${items.length - newItems.length} duplicates skipped)`);
        } else {
          console.log(`   ⏭️ All items are duplicates, skipping`);
        }

        // Update source timestamp
        await updateSourceTimestamp(source.sourceId);

        // Log success
        await writeLog(
          'github-actions',
          'success',
          `Scraped ${items.length} items, ${newItems.length} new`,
          source.sourceId
        );

        stats.sourcesSuccess++;

        // Random delay before next source
        if (sources.indexOf(source) < sources.length - 1) {
          const delay = randomDelay();
          console.log(`   ⏳ Waiting ${delay}ms before next source...\n`);
          await sleep(delay);
        }

      } catch (error) {
        stats.sourcesFailed++;
        console.error(`   ❌ Failed to scrape ${source.sourceName}: ${error.message}`);
        
        await writeLog(
          'github-actions',
          'error',
          `Failed: ${error.message}`,
          source.sourceId
        );

        // Continue to next source
        continue;
      }
    }

    // Step 8: Save all new items
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('📋 Step 8: Saving new items to Google Sheets...');

    if (allNewItems.length > 0) {
      stats.itemsSaved = await saveItems(allNewItems);
    } else {
      console.log('⚠️ No new items to save');
    }

    // Step 9: Final summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Sources processed:  ${stats.sourcesProcessed}`);
    console.log(`   Sources success:    ${stats.sourcesSuccess}`);
    console.log(`   Sources failed:     ${stats.sourcesFailed}`);
    console.log(`   Items found:        ${stats.itemsFound}`);
    console.log(`   Items saved:        ${stats.itemsSaved}`);
    console.log(`   Items skipped:      ${stats.itemsSkipped} (duplicates)`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Log final summary
    await writeLog(
      'github-actions',
      'success',
      `Completed: ${stats.sourcesSuccess}/${stats.sourcesProcessed} sources, ${stats.itemsSaved} new items saved`
    );

    console.log('✅ Scraping completed successfully!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);

    // Try to log the error
    try {
      await writeLog('github-actions', 'error', `Fatal: ${error.message}`);
    } catch (logError) {
      console.error('Failed to write error log:', logError.message);
    }

    process.exit(1);

  } finally {
    // Always close browser
    await closeBrowser();
  }
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});