# Reader CLI

A command-line tool for fetching books and novels from online reading platforms.

## Features

- 📚 Fetch your bookshelf
- 📖 Extract book details and chapters
- ⚡ Fast and lightweight
- 🔒 Works with most reading platforms

## Installation

```bash
# Clone the repository
git clone https://github.com/WhizZest/reader-cli.git
cd reader-cli

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Usage

### List Books on Your Shelf

```bash
# List first 20 books
node dist/main.js shelf --limit 20

# Include debug output
node dist/main.js shelf --limit 20 --verbose
```

**Output example:**
```json
[
  {
    "index": 1,
    "title": "Book Title",
    "bookId": "abc123",
    "archive": null
  },
  {
    "index": 2,
    "title": "Another Book",
    "bookId": "def456",
    "archive": "My Collection"
  }
]
```

**Fields:**
- `index` - Book sequence number (1, 2, 3...)
- `title` - Book title
- `bookId` - Unique book identifier
- `archive` - Group/archive name (null for books not in any group)

### Get Book Details

```bash
node dist/main.js book <book-id>
```

### Search Books

```bash
node dist/main.js search "keyword" --limit 10
```

## Configuration

Reader CLI requires a browser extension to manage cookies for automated login.

### Extension Setup

1. Open Chrome/Edge browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `extension` folder in this project
6. The extension will automatically handle cookie management

## Commands

| Command | Description | Example |
|---------|-------------|----------|
| `shelf` | List books on your shelf | `shelf --limit 50` |
| `book` | Get book details | `book <id>` |
| `search` | Search for books | `search "keyword"` |
| `catalog` | Extract table of contents | `catalog <book-id>` |

### Shelf Command Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--limit` | int | 20 | Maximum number of books to retrieve |
| `--verbose` | boolean | false | Show debug information (scrolling, group expansion, etc.) |

**Features:**
- Automatically expands book groups/archives and extracts books within
- Preserves original bookshelf order
- Supports lazy loading for large bookshelves
- Returns flat list with `archive` field indicating group membership

## Development

```bash
# Watch mode
npm run dev

# Type checking
npm run typecheck

# Rebuild
npm run build
```

## Notes

- This tool is for educational purposes only
- Please respect the terms of service of reading platforms
- Do not use for commercial purposes
- **Keep the browser window visible during execution** - Lazy loading requires the window to be rendered (minimizing may cause issues)
- Book groups/archives will be automatically expanded, adding ~3 seconds per group

## License

MIT
