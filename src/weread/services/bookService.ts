import type { IPage } from '../../types.js';
import type { ChapterInfo, OutlineResponse, ChapterOutline } from '../types/weread.js';

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
        
        return chapterInfos
          .map((info) => ({
            title: info.title || 'Unknown Chapter',
            level: info.level || 1,
            chapterUid: info.chapterUid,
            chapterIdx: info.chapterIdx,
            wordCount: info.wordCount || 0
          }))
          .filter((chapter) => {
            // Validate chapterUid: must be a finite number
            const isValidUid = typeof chapter.chapterUid === 'number' && 
                               isFinite(chapter.chapterUid) && 
                               chapter.chapterUid > 0;
            
            if (!isValidUid) {
              console.warn('Skipping chapter with invalid chapterUid:', chapter);
              return false;
            }
            
            return true;
          });
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

  /**
   * Extract numeric bookId with SSR-first strategy (approved by PR reviewer)
   * 
   * Priority order:
   * 1. Parse from __INITIAL_STATE__ in SSR HTML (most reliable, tied to current URL)
   * 2. Fallback to AIChat:Chat_bookid_* keys in localStorage
   * 3. Fallback to AIChat:Channel_*_b_${bookId} for cross-validation
   */
  async getNumericBookId(hexBookId: string): Promise<string> {
    const numericBookId = await this.page.evaluate(`(() => {
      // Priority 1: Fetch HTML and parse SSR __INITIAL_STATE__ (primary source)
      return fetch(window.location.href)
        .then(res => res.text())
        .then(html => {
          const match = html.match(/window\\.__INITIAL_STATE__\\s*=\\s*({.*?});/s);
          if (!match) {
            return null; // 找不到 __INITIAL_STATE__，降级
          }
          
          const initialState = JSON.parse(match[1]);
          const ssrBookId = initialState.reader?.bookId;
          const infoId = initialState.reader?.infoId;
          const encodeId = initialState.reader?.bookInfo?.encodeId;
          
          // Validate: SSR data must match the expected hexBookId
          if (infoId !== '${hexBookId}' && encodeId !== '${hexBookId}') {
            console.warn(
              'SSR bookId mismatch: expected ${hexBookId}, got infoId=' + infoId + ', encodeId=' + encodeId
            );
            return null; // 验证失败，降级
          }
          
          if (ssrBookId) {
            console.log('Found verified bookId from SSR:', ssrBookId);
            return ssrBookId;
          }
          
          return null; // 没有 bookId，降级
        })
        .catch(ssrError => {
          console.warn('SSR extraction failed, falling back to localStorage:', ssrError.message);
          
          // Priority 2: Try AIChat:Chat_bookid_* keys
          const aiChatKeys = Object.keys(localStorage).filter(k => 
            k.startsWith('AIChat:Chat_bookid_')
          );
          
          if (aiChatKeys.length > 0) {
            const match = aiChatKeys[0].match(/AIChat:Chat_bookid_(\\d+)/);
            if (match && match[1]) {
              console.warn('Using fallback: AIChat:Chat_bookid_* =', match[1]);
              return match[1];
            }
          }
          
          // Priority 3: Try AIChat:Channel_*_b_
          const channelKey = Object.keys(localStorage)
            .find(k => k.startsWith('AIChat:Channel_') && k.includes('_b_'));
          
          if (channelKey) {
            const match = channelKey.match(/_b_(\\d+)$/);
            if (match && match[1]) {
              console.warn('Using last fallback: AIChat:Channel_*_b_ =', match[1]);
              return match[1];
            }
          }
          
          throw new Error('No numeric bookId found in any source');
        });
    })()`);
    
    if (!numericBookId) {
      throw new Error(`Could not find numeric bookId for hex bookId: ${hexBookId}`);
    }
    
    return numericBookId;
  }

  /**
   * Fetch outline for specific chapters
   * @param numericBookId - Numeric book ID from localStorage
   * @param chapterUids - Chapter UIDs to fetch outlines for (empty array = all)
   */
  async fetchOutline(numericBookId: string, chapterUids: number[] = []): Promise<ChapterOutline[]> {
    const response = await this.page.evaluate(`(() => {
      return fetch('https://weread.qq.com/web/book/outline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({
          bookId: '${numericBookId}',
          chapterUids: ${JSON.stringify(chapterUids).replace(/'/g, "'")}
        })
      }).then(res => {
        if (!res.ok) {
          throw new Error('Outline API failed with status ' + res.status);
        }
        return res.json();
      });
    })()`);
    
    const outlineResponse = response as OutlineResponse;
    
    // Filter out chapters without outlines and transform data format
    const outlines: ChapterOutline[] = [];
    
    for (const item of outlineResponse.itemsArray || []) {
      if (item.items && item.items.length > 0) {
        outlines.push({
          chapterUid: item.chapterUid,
          title: '', // Will be filled by outline command using catalog data
          items: item.items.map(outlineItem => ({
            text: outlineItem.text,
            level: outlineItem.level
          }))
        });
      }
    }
    
    return outlines;
  }
}
