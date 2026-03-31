import type { IPage } from '../../types.js';
import type { ChapterInfo } from '../types/weread.js';

/**
 * Shared service for WeRead book operations
 */
export class BookService {
  constructor(private page: IPage) {}
  
  /**
   * Navigate to book reader page
   */
  async navigateToBook(hexBookId: string): Promise<void> {
    await this.page.goto(`https://weread.qq.com/web/reader/${hexBookId}`, { 
      waitUntil: 'load' 
    });
    await this.page.wait(5); // Wait for content to load
  }
  
  /**
   * Extract chapter metadata from __INITIAL_STATE__
   * Uses robust brace-counting algorithm instead of fragile regex
   */
  async extractChapterInfos(): Promise<ChapterInfo[]> {
    const chapters = await this.page.evaluate(`(() => {
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
    
    return chapters;
  }
}
