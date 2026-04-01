import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';
import { BookService } from './services/bookService.js';

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
  columns: ['chapterUid', 'level', 'title'],
  func: async (page: IPage, args: any) => {
    const bookId = args['book-id'];
    const limit = Number(args.limit);
    const searchTerm = args.search;

    // Use BookService for navigation and extraction
    const bookService = new BookService(page);
    await bookService.navigateToBook(bookId);
    const chapters = await bookService.extractChapterInfos();

    if (chapters.length === 0) {
      throw new Error('Could not extract table of contents. This book may not have one, or the page structure has changed.');
    }

    // Remove duplicates using stable identifiers (chapterUid/chapterIdx) instead of title
    const uniqueChapters: Array<{ chapterUid: number; title: string; level?: number }> = [];
    const seen = new Set<number>();
    
    for (const chapter of chapters) {
      // Validate chapter data - skip entries with missing or invalid title
      if (!chapter.title || typeof chapter.title !== 'string') {
        console.warn(`Skipping chapter with invalid title:`, chapter);
        continue;
      }
      
      // Validate chapterUid - must be a valid number
      if (typeof chapter.chapterUid !== 'number' || !isFinite(chapter.chapterUid)) {
        console.warn(`Skipping chapter with invalid chapterUid:`, chapter);
        continue;
      }
      
      const normalizedTitle = chapter.title.replace(/\s+/g, ' ').trim();
      
      // Use chapterUid as primary key
      const uniqueKey = chapter.chapterUid;
      
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        uniqueChapters.push({
          chapterUid: uniqueKey,
          title: normalizedTitle,
          level: chapter.level || 1,
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
