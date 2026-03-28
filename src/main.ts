#!/usr/bin/env node
/**
 * Reader CLI - Fetch books from online reading platforms
 */

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getRegistry, Strategy } from './registry.js';
import { getBrowserFactory, browserSession } from './runtime.js';
import type { IPage } from './types.js';

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
await import('./weread/catalog.js');

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
    
    // Check if it's a positional or option argument
    if (arg.positional) {
      // Positional argument
      subCommand.argument(flags, helpText);
    } else {
      // Option argument with --flag
      const optionFlag = `--${arg.name}`;
      // Pass default value to commander for proper handling
      if (arg.default != null) {
        subCommand.option(`${optionFlag} ${flags}`, helpText, String(arg.default));
      } else {
        subCommand.option(`${optionFlag} ${flags}`, helpText);
      }
    }
  }
  
  // Add action with proper browser initialization
  if (cmd.func) {
    subCommand.action(async (...actionArgs) => {
      try {
        // Commander passes positional args as separate arguments before the options object
        // The second-to-last argument is the options object (last is the Command instance)
        const optionsObj = actionArgs[actionArgs.length - 2];
        const options = typeof optionsObj === 'object' && optionsObj !== null && !(optionsObj instanceof Command) ? optionsObj : {};
        
        // Collect positional args (all arguments except the last two: options and Command instance)
        const positionalArgs = actionArgs.slice(0, -2);
        
        // Map positional args to their names
        cmd.args?.forEach((arg, index) => {
          if (arg.positional && positionalArgs[index] !== undefined) {
            options[arg.name] = positionalArgs[index];
          }
        });
        
        // Check if command needs browser
        const needsBrowser = cmd.strategy !== Strategy.PUBLIC;
        
        if (needsBrowser) {
          // Initialize browser and execute with page
          const BrowserFactory = getBrowserFactory();
          await browserSession(BrowserFactory, async (page) => {
            // Navigate to domain first for cookie strategy
            if (cmd.domain && cmd.strategy === Strategy.COOKIE) {
              await page.goto(`https://${cmd.domain}`);
            }
            
            // Execute the command function
            const result = await cmd.func!(page, options, false);
            console.log(JSON.stringify(result, null, 2));
          });
        } else {
          // No browser needed (public data)
          const result = await cmd.func!(null as unknown as IPage, options, false);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
  }
}

program.parse();
