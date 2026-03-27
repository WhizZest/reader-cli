#!/usr/bin/env node
/**
 * Reader CLI - Fetch books from online reading platforms
 */

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getRegistry } from './registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple CLI setup
const program = new Command();

program
  .name('reader-cli')
  .description('CLI tools for online reading platforms')
  .version('1.0.0');

// Load weread commands to register them
await import('./weread/shelf.js');
await import('./weread/book.js');
await import('./weread/search.js');
await import('./weread/ranking.js');
await import('./weread/notes.js');
await import('./weread/highlights.js');
await import('./weread/notebooks.js');

// Register all commands from registry to commander
const registry = getRegistry();
for (const [key, cmd] of registry) {
  const [site, name] = key.split('/');
  
  // Only register weread commands
  if (site !== 'weread') continue;
  
  const subCommand = program.command(name)
    .description(cmd.description || '');
  
  // Add arguments
  for (const arg of cmd.args || []) {
    const flags = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
    const helpText = arg.help || '';
    subCommand.option(flags, helpText);
  }
  
  // Add action
  if (cmd.func) {
    subCommand.action(async (options) => {
      try {
        const result = await cmd.func!(null as any, options, false);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
  }
}

program.parse();
