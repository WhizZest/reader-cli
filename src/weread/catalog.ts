import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';

cli({
  site: 'weread',
  name: 'catalog',
  description: 'Extract table of contents from a book',
  domain: 'weread.qq.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'book-id', positional: true, required: true, help: 'Book ID (from shelf or search results)' },
    { name: 'limit', type: 'int', default: '0', help: 'Max chapters to show (0=all)' },
    { name: 'search', type: 'string', help: 'Filter chapters by keyword' },
  ],
  columns: ['index', 'title'],
  func: async (page: IPage, args: any) => {
    const bookId = args['book-id'];
    const limit = Number(args.limit);
    const searchTerm = args.search;

    // Navigate to book page
    await page.goto(`https://weread.qq.com/web/reader/${bookId}`, { waitUntil: 'load' });
    await page.wait(5); // Wait for content to load

    // Click catalog button and extract chapters
    const clicked = await page.evaluate(`(() => {
      // Find and click the catalog button (has class "catalog")
      const catalogBtn = document.querySelector('.catalog');
      if (catalogBtn) {
        catalogBtn.click();
        return true;
      }
      return false;
    })()`);

    if (!clicked) {
      throw new Error('Could not find catalog button. The book may not have a table of contents.');
    }

    await page.wait(3); // Wait for sidebar to expand

    // Extract chapter list
    const chapters = await page.evaluate(`(() => {
      const allChapters = [];
      
      // Find the catalog sidebar container
      const catalogContainer = document.querySelector('[class*="Catalog"]') || 
                               document.querySelector('[class*="catalog"]') ||
                               document.querySelector('[class*="menu"]');
      
      if (!catalogContainer) {
        return allChapters;
      }
      
      // Look for chapter elements with various selectors
      const items = catalogContainer.querySelectorAll('[role="button"], div[class*="item"], .chapterItem, .wr_catalog_item, [class*="section"]');
      
      items.forEach(item => {
        const title = item.textContent.trim();
        
        // Filter out noise: reading progress, empty text, too long text
        if (!title || 
            title.length < 3 || 
            title.length > 300 ||
            title.includes('当前读到') ||
            title.includes('+书签') ||
            title.includes('close')) {
          return;
        }
        
        // Determine hierarchy level based on indentation or styling
        let level = 1;
        const className = item.className || '';
        const paddingLeft = parseFloat(item.style?.paddingLeft || '0');
        
        // Check for visual indicators of sub-levels
        if (className.includes('sub') || 
            className.includes('level2') || 
            className.includes('secondary') ||
            item.getAttribute('aria-level') === '2' ||
            paddingLeft > 20) {  // Indented items are usually sub-levels
          level = 2;
        } else if (className.includes('level3') || 
                   item.getAttribute('aria-level') === '3' ||
                   paddingLeft > 40) {
          level = 3;
        }
        
        allChapters.push({
          title,
          level,
          paddingLeft
        });
      });
      
      return allChapters;
    })()`);

    // Remove duplicates and clean up
    const uniqueChapters: Array<{ index: number; title: string }> = [];
    const seen = new Set<string>();
    
    for (const chapter of chapters) {
      const normalizedTitle = chapter.title.replace(/\s+/g, ' ').trim();
      
      if (!seen.has(normalizedTitle)) {
        seen.add(normalizedTitle);
        uniqueChapters.push({
          index: uniqueChapters.length + 1,
          title: normalizedTitle,
        });
      }
    }

    // Apply search filter if provided
    let filteredChapters = uniqueChapters;
    if (searchTerm) {
      filteredChapters = uniqueChapters.filter(ch => 
        ch.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply limit if specified
    if (limit > 0) {
      filteredChapters = filteredChapters.slice(0, limit);
    }

    console.log(`Found ${filteredChapters.length} chapters${searchTerm ? ` matching "${searchTerm}"` : ''}`);
    
    return filteredChapters;
  },
});
