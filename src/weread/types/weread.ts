/**
 * WeRead chapter metadata extracted from __INITIAL_STATE__
 */
export interface ChapterInfo {
  /** Unique chapter identifier */
  chapterUid: number;
  
  /** Chapter index for ordering */
  chapterIdx: number;
  
  /** Chapter title */
  title: string;
  
  /** Hierarchy level (1=main chapter, 2=sub-chapter) */
  level: number;
  
  /** Word count (optional) */
  wordCount?: number;
}

/**
 * Individual outline item from AI-generated outline
 */
export interface OutlineItem {
  /** Outline text content */
  text: string;
  
  /** Outline hierarchy level */
  level: number;
}

/**
 * Chapter outline with mapped title
 */
export interface ChapterOutline {
  /** Chapter unique identifier */
  chapterUid: number;
  
  /** Chapter title (mapped from catalog) */
  title: string;
  
  /** Outline items list */
  items: OutlineItem[];
}

/**
 * Raw response from outline API
 */
export interface OutlineResponse {
  itemsArray: Array<{
    /** Chapter unique identifier */
    chapterUid: number;
    
    /** Version number */
    version: number;
    
    /** Outline items (empty array if no outline) */
    items?: Array<{
      /** Outline text */
      text: string;
      
      /** Outline level */
      level: number;
      
      /** Book ID (numeric) */
      bookId?: string;
      
      /** Text range in book */
      range?: string;
      
      /** Unique identifier */
      uniqId?: string;
      
      /** UI index (e.g., "1.1", "2") */
      uiIdx?: string;
    }>;
  }>;
}
