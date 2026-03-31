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
  columns: ['index', 'level', 'title'],
  func: async (page: IPage, args: any) => {
    const bookId = args['book-id'];
    const limit = Number(args.limit);
    const searchTerm = args.search;

    // Navigate to book page
    await page.goto(`https://weread.qq.com/web/reader/${bookId}`, { waitUntil: 'load' });
    await page.wait(5); // Wait for content to load

    // Extract chapter information from __INITIAL_STATE__
    const chapters = await page.evaluate(`(() => {
      return fetch(window.location.href)
        .then(r => r.text())
        .then(html => {
          // Match window.__INITIAL_STATE__ = {...};
          const match = html.match(/window\\.__INITIAL_STATE__\\s*=\\s*({.+?});/s);
          if (!match) {
            console.error('Could not find __INITIAL_STATE__');
            return [];
          }
          
          try {
            const initialState = JSON.parse(match[1]);
            const chapterInfos = initialState?.reader?.chapterInfos || [];
            
            // Transform to our format
            return chapterInfos.map((info) => ({
              title: info.title,
              level: info.level || 1,
              chapterUid: info.chapterUid,
              chapterIdx: info.chapterIdx,
              wordCount: info.wordCount || 0
            }));
          } catch (e) {
            console.error('Failed to parse __INITIAL_STATE__:', e);
            return [];
          }
        })
        .catch(err => {
          console.error('Failed to fetch page:', err);
          return [];
        });
    })()`);

    if (chapters.length === 0) {
      throw new Error('Could not extract table of contents. This book may not have one, or the page structure has changed.');
    }

    // Remove duplicates and clean up
    const uniqueChapters: Array<{ index: number; title: string; level?: number }> = [];
    const seen = new Set<string>();
    
    for (const chapter of chapters) {
      const normalizedTitle = chapter.title.replace(/\s+/g, ' ').trim();
      
      if (!seen.has(normalizedTitle)) {
        seen.add(normalizedTitle);
        uniqueChapters.push({
          index: uniqueChapters.length + 1,
          title: normalizedTitle,
          level: chapter.level || 1,  // Include level information
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
