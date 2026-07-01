/**
 * utils/logger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight structured logger with coloured console output.
 * In production you can swap the transport for Winston / Pino.
 */

'use strict';

const config = require('../config');

const COLOURS = {
  reset: '\x1b[0m',
  info:  '\x1b[36m',   // cyan
  warn:  '\x1b[33m',   // yellow
  error: '\x1b[31m',   // red
  success: '\x1b[32m', // green
  dim:   '\x1b[2m',
};

function timestamp() {
  return new Date().toISOString();
}

function format(level, message, meta) {
  const colour = COLOURS[level] || COLOURS.reset;
  const metaStr = meta ? `  ${JSON.stringify(meta)}` : '';
  return `${COLOURS.dim}${timestamp()}${COLOURS.reset} ${colour}[${level.toUpperCase()}]${COLOURS.reset} ${message}${COLOURS.dim}${metaStr}${COLOURS.reset}`;
}

const logger = {
  info:    (msg, meta) => console.log(format('info', msg, meta)),
  warn:    (msg, meta) => console.warn(format('warn', msg, meta)),
  error:   (msg, meta) => console.error(format('error', msg, meta)),
  success: (msg, meta) => console.log(format('success', msg, meta)),
  debug:   (msg, meta) => {
    if (config.env === 'development') {
      console.log(format('dim', `[DEBUG] ${msg}`, meta));
    }
  },
};

module.exports = logger;
