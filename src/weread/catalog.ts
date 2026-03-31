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

    // Extract chapter information from __INITIAL_STATE__ using robust parsing
    const chapters = await page.evaluate(`(() => {
      async function getChapterInfos() {
        const url = window.location.href;
        const response = await fetch(url);
        const html = await response.text();

        // Find window.__INITIAL_STATE__ = marker
        const markerRegex = /window\.__INITIAL_STATE__\s*=/;
        const match = markerRegex.exec(html);
        if (!match) {
          throw new Error('未找到 __INITIAL_STATE__ 定义');
        }
        const markerEnd = match.index + match[0].length; // Position after '='

        // Find first '{'
        let braceStart = html.indexOf('{', markerEnd);
        if (braceStart === -1) {
          throw new Error('未找到 JSON 起始大括号');
        }

        // Count braces to find matching end
        let braceCount = 0;
        let i = braceStart;
        for (; i < html.length; i++) {
          const ch = html[i];
          if (ch === '{') braceCount++;
          if (ch === '}') braceCount--;
          if (braceCount === 0) break;
        }
        if (braceCount !== 0) {
          throw new Error('JSON 大括号未闭合');
        }

        const jsonStr = html.substring(braceStart, i + 1);
        const initialState = JSON.parse(jsonStr);
        const chapterInfos = initialState?.reader?.chapterInfos || [];
        
        if (!chapterInfos) {
          throw new Error('未找到章节信息');
        }
        
        return chapterInfos.map((info) => ({
          title: info.title || 'Unknown Chapter',
          level: info.level || 1,
          chapterUid: info.chapterUid,
          chapterIdx: info.chapterIdx,
          wordCount: info.wordCount || 0
        }));
      }
      
      return getChapterInfos().catch(err => {
        console.error('Failed to extract chapter info:', err.message);
        return [];
      });
    })()`);

    if (chapters.length === 0) {
      throw new Error('Could not extract table of contents. This book may not have one, or the page structure has changed.');
    }

    // Remove duplicates using stable identifiers (chapterUid/chapterIdx) instead of title
    const uniqueChapters: Array<{ index: number; title: string; level?: number }> = [];
    const seen = new Set<string | number>();
    
    for (const chapter of chapters) {
      // Validate chapter data - skip entries with missing or invalid title
      if (!chapter.title || typeof chapter.title !== 'string') {
        console.warn(`Skipping chapter with invalid title:`, chapter);
        continue;
      }
      
      const normalizedTitle = chapter.title.replace(/\s+/g, ' ').trim();
      
      // Use chapterUid as primary key, fallback to chapterIdx, then title only if neither exists
      let uniqueKey: string | number;
      if (chapter.chapterUid) {
        uniqueKey = chapter.chapterUid;
      } else if (chapter.chapterIdx !== undefined) {
        uniqueKey = chapter.chapterIdx;
      } else {
        // Only use title as last resort
        uniqueKey = normalizedTitle;
      }
      
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        uniqueChapters.push({
          index: uniqueChapters.length + 1,
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
