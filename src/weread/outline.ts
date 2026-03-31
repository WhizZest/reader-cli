import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';
import { BookService } from './services/bookService.js';
import * as fs from 'fs';

cli({
  site: 'weread',
  name: 'outline',
  description: 'Extract AI-generated outline from a book',
  domain: 'weread.qq.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'book-id', positional: true, required: true, help: 'Book ID (from shelf or search results)' },
    { name: 'chapter', type: 'int', help: 'Specific chapter UID to extract outline for' },
    { name: 'output', type: 'string', help: 'Export outlines to a Markdown file' },
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
    
    // Export to Markdown file if --output is specified
    const outputFile = args.output;
    if (outputFile) {
      const markdownContent = formatToMarkdown(outlines);
      fs.writeFileSync(outputFile, markdownContent, 'utf-8');
      console.log(`Markdown outline exported to: ${outputFile}`);
      return { message: `Exported ${outlines.length} chapters to ${outputFile}`, count: outlines.length };
    }
    
    return outlines;
  },
});

/**
 * Convert outlines to Markdown format
 * @param outlines - Array of chapter outlines
 * @returns Markdown formatted string
 */
function formatToMarkdown(outlines: any[]): string {
  const lines: string[] = [];
  
  for (const outline of outlines) {
    // Add chapter title as a heading
    if (outline.title) {
      lines.push(`# ${outline.title}\n`);
    }
    
    // Add outline items with appropriate heading levels
    for (const item of outline.items || []) {
      const level = Math.min(item.level || 1, 6); // Max 6 levels for markdown headings
      const prefix = '#'.repeat(level);
      lines.push(`${prefix} ${item.text}`);
    }
    
    lines.push(''); // Empty line between chapters
  }
  
  return lines.join('\n');
}
