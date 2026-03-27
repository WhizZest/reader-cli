import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';

cli({
  site: 'weread',
  name: 'shelf',
  description: 'List books on your WeRead bookshelf',
  domain: 'weread.qq.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Max results' },
  ],
  columns: ['title', 'bookId'],
  func: async (page: IPage, args) => {
    const limit = Number(args.limit);
    
    // Navigate to shelf page
    await page.goto('https://weread.qq.com/web/shelf', { waitUntil: 'load' });
    await page.wait(3); // Wait for initial content to load
    
    // Extract book data from DOM
    const extractBooks = async () => {
      return await page.evaluate(String.raw`
        (() => {
          const result = [];
          const bookLinks = document.querySelectorAll('a.shelfBook');
          bookLinks.forEach((link) => {
            const href = link.getAttribute('href') || '';
            const bookIdMatch = href.match(/\/web\/reader\/([a-zA-Z0-9]+)/);
            const bookId = bookIdMatch ? bookIdMatch[1] : '';
            const titleEl = link.querySelector('.title');
            const title = titleEl?.textContent?.trim() || '';
            if (title && bookId) {
              result.push({ title, bookId });
            }
          });
          return result;
        })()
      `);
    };
    
    // Get initial screen books count
    let books = await extractBooks();
    console.log(`Initial screen: ${books.length} books`);
    
    // Only trigger lazy loading if limit exceeds initial screen
    if (limit > books.length) {
      // Scroll to load more books incrementally
      const maxScrolls = Math.ceil((limit - books.length) / 20); // Estimate ~20 books per scroll
      let previousCount = books.length;
      let stagnantCount = 0; // Track consecutive scrolls with no new books
      const MAX_STAGNANT_SCROLLS = 3; // Stop if 3 consecutive scrolls yield no new books
      
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate('() => window.scrollTo(0, document.body.scrollHeight)');
        await page.wait(1); // Wait for batch to load
        
        // Re-extract and check if we have enough
        books = await extractBooks();
        console.log(`After scroll ${i + 1}: ${books.length} books`);
        
        // Check if we reached the target
        if (books.length >= limit) {
          console.log(`Reached target: ${books.length} books`);
          break;
        }
        
        // Check if loading has stagnated (no new books)
        if (books.length === previousCount) {
          stagnantCount++;
          if (stagnantCount >= MAX_STAGNANT_SCROLLS) {
            console.log(`Loading stagnated at ${books.length} books (no new books after ${MAX_STAGNANT_SCROLLS} scrolls)`);
            break;
          }
        } else {
          stagnantCount = 0; // Reset counter if we got new books
        }
        
        previousCount = books.length;
      }
      
      // Scroll back to top
      await page.evaluate('() => window.scrollTo(0, 0)');
      await page.wait(1);
    } else {
      console.log(`Limit ${limit} <= initial screen ${books.length}, skipping lazy loading`);
    }
    
    console.log(`Found ${books.length} books on shelf`);
    
    // Warn if lazy loading may have failed
    if (books.length < limit && books.length <= 40) {
      console.warn('⚠️ Warning: Only loaded few books. This may happen if the browser window was minimized or in background.');
      console.warn('💡 Tip: Keep the browser window visible and not minimized during execution.');
    }
    
    return books.slice(0, limit);
  },
});
