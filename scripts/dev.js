#!/usr/bin/env node

const { spawn } = require('child_process');

// Set NODE_OPTIONS to suppress warnings
process.env.NODE_OPTIONS = '--no-warnings';

// Start Next.js dev server with --webpack flag to use webpack instead of Turbopack
const nextDev = spawn('npx', ['next', 'dev', '--webpack'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: process.env,
});

// Pipe stdout directly
nextDev.stdout.on('data', (data) => {
  process.stdout.write(data);
});

// Filter stderr to remove source map warnings
nextDev.stderr.on('data', (data) => {
  const output = data.toString();
  // Filter out source map warnings
  if (!output.includes('Invalid source map') &&
      !output.includes('sourceMapURL could not be parsed') &&
      !output.includes('Only conformant source maps')) {
    process.stderr.write(data);
  }
});

nextDev.on('error', (error) => {
  console.error('Failed to start dev server:', error);
  process.exit(1);
});

nextDev.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle process termination
process.on('SIGINT', () => {
  nextDev.kill('SIGINT');
});

process.on('SIGTERM', () => {
  nextDev.kill('SIGTERM');
});
