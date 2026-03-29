import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';

interface ShelfBook {
  index?: number;
  title: string;
  bookId: string;
  archive?: string | null;
}

cli({
  site: 'weread',
  name: 'shelf',
  description: 'List books on your WeRead bookshelf',
  domain: 'weread.qq.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Max results' },
    { name: 'verbose', type: 'boolean', default: false, help: 'Show debug info' },
  ],
  columns: ['index', 'title', 'bookId'],
  func: async (page: IPage, args) => {
    const limit = Number(args.limit);
    const verbose = args.verbose === true || args.verbose === 'true';
    
    // Navigate to shelf page
    await page.goto('https://weread.qq.com/web/shelf', { waitUntil: 'load' });
    await page.wait(2); // Wait for SSR content and localStorage to populate
    
    const allBooks: ShelfBook[] = [];
    
    // Extract books from main shelf (with lazy loading)
    const extractMainShelfBooks = async () => {
      return await page.evaluate(String.raw`
        (() => {
          const result = [];
          const elements = document.querySelectorAll('a.shelfBook, a.shelfArchive');
          
          elements.forEach((el) => {
            const href = el.getAttribute('href') || '';
            const isArchive = el.classList.contains('shelfArchive');
            
            if (isArchive) {
              // Archive group - just store the title
              const titleEl = el.querySelector('.title');
              const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
              result.push({
                type: 'archive',
                title
              });
            } else {
              // Regular book
              const bookIdMatch = href.match(/\/web\/reader\/([a-zA-Z0-9]+)/);
              const bookId = bookIdMatch ? bookIdMatch[1] : '';
              const titleEl = el.querySelector('.title');
              const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
              if (title && bookId) {
                result.push({
                  type: 'book',
                  title,
                  bookId
                });
              }
            }
          });
          
          return result;
        })()
      `);
    };
    
    // Extract books from archive page (called after clicking the archive)
    const extractArchiveBooks = async (archiveName: string): Promise<ShelfBook[]> => {
      if (verbose) console.log(`  Extracting books from archive: ${archiveName}`);
      
      // Optimized: Vue component renders quickly, no network request needed
      // Tested: 0.2s is sufficient for DOM to fully render after route change
      await page.wait(0.2);
      
      // Debug: Check what we found (only in verbose mode)
      let debugInfo;
      if (verbose) {
        debugInfo = await page.evaluate(String.raw`
          (() => {
            const allLinks = document.querySelectorAll('a');
            const shelfBooks = document.querySelectorAll('a.shelfBook');
            const addButtons = document.querySelectorAll('a.shelfBook_add');
            const regularBooks = document.querySelectorAll('a.shelfBook:not(.shelfBook_add)');
            
            return {
              totalLinks: allLinks.length,
              shelfBooks: shelfBooks.length,
              addButtons: addButtons.length,
              regularBooks: regularBooks.length,
              firstBookTitle: shelfBooks[0]?.querySelector('.title')?.textContent
            };
          })()
        `);
        
        console.log(`  Debug info:`, debugInfo);
      }
      
      if (verbose && debugInfo && debugInfo.regularBooks === 0 && debugInfo.shelfBooks <= 1) {
        console.warn(`  Archive appears empty. Shelf books: ${debugInfo.shelfBooks}`);
      }
      
      const verboseStr = JSON.stringify(verbose);
      const books = await page.evaluate(String.raw`
        (() => {
          const result = [];
          const bookLinks = document.querySelectorAll('a.shelfBook:not(.shelfBook_add)');
          const verboseFlag = ${verboseStr};
          
          if (verboseFlag) console.log('Found', bookLinks.length, 'book links in archive');
            
          bookLinks.forEach((link, index) => {
            const href = link.getAttribute('href') || '';
            const bookIdMatch = href.match(/\/web\/reader\/([a-zA-Z0-9]+)/);
            const bookId = bookIdMatch ? bookIdMatch[1] : '';
            const titleEl = link.querySelector('.title');
            const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
              
            if (verboseFlag && index < 3) {
              console.log('Book ' + index + ':', { title: title, bookId: bookId, href: href });
            }
              
            if (title && bookId) {
              result.push({ title: title, bookId: bookId });
            }
          });
            
          return result;
        })()
      `);
      
      if (verbose) console.log(`  Extracted ${books.length} books from archive`);
      
      // Navigate back to main shelf using browser history (preserves lazy-loaded state)
      await page.evaluate('window.history.back()');
      // 0.5s allows browser back animation to complete before next operation
      await page.wait(0.5);
      
      return books;
    };
    
    // Get initial screen elements
    let elements = await extractMainShelfBooks();
    if (verbose) console.log(`Initial screen: ${elements.length} elements`);
    
    // Lazy load more if needed (based on element count, not book count)
    // This is safe because: archives are guaranteed to contain ≥1 books
    // (WeRead automatically removes empty archives from the UI), so counting
    // elements (books + archives) provides a reliable lower bound for scrolling.
    if (limit > elements.length) {
      const maxScrolls = Math.ceil((limit - elements.length) / 20);
      let previousCount = elements.length;
      let stagnantCount = 0;
      const MAX_STAGNANT_SCROLLS = 3;
      
      for (let i = 0; i < maxScrolls && elements.length < limit; i++) {
        await page.evaluate('() => window.scrollTo(0, document.body.scrollHeight)');
        await page.wait(1);
        
        elements = await extractMainShelfBooks();
        if (verbose) console.log(`After scroll ${i + 1}: ${elements.length} elements`);
        
        if (elements.length === previousCount) {
          stagnantCount++;
          if (stagnantCount >= MAX_STAGNANT_SCROLLS) {
            console.log(`Loading stagnated at ${elements.length} elements`);
            break;
          }
        } else {
          stagnantCount = 0;
        }
        
        previousCount = elements.length;
      }
      
      await page.evaluate('() => window.scrollTo(0, 0)');
      await page.wait(1);
    }
    
    // Process elements in order and extract books
    // Main shelf elements are ordered, archives should be expanded in place
    for (const element of elements) {
      if (allBooks.length >= limit) break;
      
      if (element.type === 'book') {
        allBooks.push({
          index: allBooks.length + 1,
          title: element.title,
          bookId: element.bookId,
          archive: null
        });
      } else if (element.type === 'archive') {
        // Click archive to navigate to its page
        if (verbose) console.log(`Clicking archive: ${element.title}`);
        
        // Click the archive element by matching title (use same logic as extraction)
        const clicked = await page.evaluate(String.raw`
          (() => {
            const archives = document.querySelectorAll('a.shelfArchive');
            const targetTitle = ${JSON.stringify(element.title)};
            
            for (const archive of archives) {
              const titleEl = archive.querySelector('.title');
              // Use same priority as extraction: title attribute first, then textContent
              const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
              if (title === targetTitle) {
                archive.click();
                return true;
              }
            }
            return false;
          })()
        `);
        
        if (!clicked) {
          if (verbose) console.warn(`  Could not find archive with title: ${element.title}`);
          continue;
        }
        
        const archiveBooks = await extractArchiveBooks(element.title);
        if (verbose) console.log(`  Found ${archiveBooks.length} books in archive`);
        
        for (const book of archiveBooks) {
          if (allBooks.length >= limit) break;
          allBooks.push({
            index: allBooks.length + 1,
            ...book,
            archive: element.title
          });
        }
      }
    }
    
    console.log(`Found ${allBooks.length} books on shelf`);
    
    // Warn if we got fewer books than requested
    if (allBooks.length < limit && allBooks.length <= 40) {
      console.warn('⚠️ Warning: Only loaded few books. Keep the browser window visible.');
      console.warn('💡 Tip: Make sure the browser window is not minimized during execution.');
    }
    
    return allBooks.slice(0, limit);
  },
});
