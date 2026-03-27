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
node dist/main.js shelf --limit 20
```

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
|---------|-------------|---------|
| `shelf` | List books on your shelf | `shelf --limit 50` |
| `book` | Get book details | `book <id>` |
| `search` | Search for books | `search "keyword"` |
| `catalog` | Extract table of contents | `catalog <book-id>` |

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

## License

MIT
