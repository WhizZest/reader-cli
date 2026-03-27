import { cli, Strategy } from '../registry.js';
import type { IPage } from '../types.js';

cli({
  site: 'weread',
  name: 'book',
  description: 'View book details on WeRead',
  domain: 'weread.qq.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'book-id', positional: true, required: true, help: 'Book ID (numeric, from search or shelf results)' },
  ],
  columns: ['title', 'author', 'publisher', 'intro', 'category', 'rating'],
  func: async (page: IPage, args) => {
    const bookId = args['book-id'];
    
    // Navigate to book page
    await page.goto(`https://weread.qq.com/web/reader/${bookId}`, { waitUntil: 'load' });
    await page.wait(5); // Wait for content to load
    
    // Extract book data from DOM
    const bookData = await page.evaluate(String.raw`
      (() => {
        // Try to get book info from different sources
        
        // Method 1: From page title
        const pageTitle = document.title;
        let title = '';
        let author = '';
        
        // Title format: "书名 - 作者 著 - 微信读书"
        const titleMatch = pageTitle.match(/^(.+?) - (.+?) 著 - 微信读书/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          author = titleMatch[2].trim();
        }
        
        // Method 2: From page content (h1, or other elements)
        const h1El = document.querySelector('h1');
        if (h1El && !title) {
          title = h1El.textContent.trim();
        }
        
        // Look for author in common selectors
        const authorSelectors = [
          '[class*="author"]',
          '[class*="Author"]',
          '[data-testid*="author"]'
        ];
        
        if (!author) {
          for (const selector of authorSelectors) {
            const authorEl = document.querySelector(selector);
            if (authorEl) {
              author = authorEl.textContent.trim();
              break;
            }
          }
        }
        
        // Look for publisher info
        let publisher = '-';
        const publisherEl = document.querySelector('[class*="publisher"]') || 
                           Array.from(document.querySelectorAll('span')).find(el => 
                             el.textContent.includes('出版社')
                           );
        if (publisherEl) {
          publisher = publisherEl.textContent.replace('出版社', '').trim();
        }
        
        // Look for category
        let category = '-';
        const categoryEl = document.querySelector('[class*="category"]') ||
                          document.querySelector('[class*="tag"]');
        if (categoryEl) {
          category = categoryEl.textContent.trim();
        }
        
        // Look for intro/description (use the correct selector from weread.qq.com)
        let intro = '-';
        const introEl = document.querySelector('.wr_flyleaf_page_bookIntro');
        if (introEl) {
          // WeRead sometimes duplicates content in multiple child elements
          // Strategy: Only use first paragraph/child to avoid duplication
          const firstChild = introEl.firstElementChild;
          if (firstChild) {
            // Get text from first child element only (usually <p> tag)
            intro = firstChild.textContent
              .replace(/\s+/g, ' ')  // Replace multiple spaces/newlines with single space
              .trim();
          } else {
            // Fallback to full textContent if no child elements
            intro = introEl.textContent
              .replace(/\s+/g, ' ')
              .replace(/close\s*简介/g, '')
              .replace(/^\s*简介\s*/, '')
              .trim();
          }
        }
        
        // Rating not easily available in DOM
        const rating = '-';
        
        return {
          title: title || 'Unknown',
          author: author || '-',
          publisher,
          intro,
          category,
          rating
        };
      })()
    `);
    
    console.log(`Found book: ${bookData.title}`);
    return [bookData];
  },
});
