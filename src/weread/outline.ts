import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';
import { BookService } from './services/bookService.js';

cli({
  site: 'weread',
  name: 'outline',
  description: 'Extract AI-generated outline from a book',
  domain: 'weread.qq.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'book-id', positional: true, required: true, help: 'Book ID (from shelf or search results)' },
    { name: 'chapter', type: 'int', help: 'Specific chapter UID to extract outline for' },
  ],
  columns: ['chapterUid', 'title', 'items'],
  func: async (page: IPage, args: any) => {
    const bookId = args['book-id'];
    const targetChapterUid = args.chapter;

    // Use BookService for all operations
    const bookService = new BookService(page);
    
    // Navigate to book and get numeric bookId
    await bookService.navigateToBook(bookId);
    const numericBookId = await bookService.getNumericBookId(bookId);
    
    // Get all chapter infos for title mapping
    const chapters = await bookService.extractChapterInfos();
    const chapterTitleMap = new Map<number, string>();
    for (const chapter of chapters) {
      chapterTitleMap.set(chapter.chapterUid, chapter.title);
    }
    
    // Determine which chapters to fetch outlines for
    let chapterUids: number[];
    if (targetChapterUid) {
      // Fetch outline for specific chapter only
      chapterUids = [Number(targetChapterUid)];
    } else {
      // Fetch outlines for all chapters
      chapterUids = chapters.map(c => c.chapterUid);
    }
    
    // Fetch outlines from API
    const outlines = await bookService.fetchOutline(numericBookId, chapterUids);
    
    // Fill in chapter titles from catalog data
    for (const outline of outlines) {
      const title = chapterTitleMap.get(outline.chapterUid);
      if (title) {
        outline.title = title;
      }
    }
    
    console.log(`Found outlines for ${outlines.length} chapters`);
    
    return outlines;
  },
});
