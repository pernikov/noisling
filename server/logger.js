import chalk from 'chalk';

function ts() {
  return chalk.dim(new Date().toLocaleTimeString('en-US', { hour12: false }));
}

export function createLogger(tag, color) {
  const label = chalk[color].bold(`[${tag}]`);
  return {
    log:     (...a) => console.log(  ts(), label, ...a),
    info:    (...a) => console.log(  ts(), label, chalk.cyan(String(a[0])),  ...a.slice(1)),
    success: (...a) => console.log(  ts(), label, chalk.green(String(a[0])), ...a.slice(1)),
    warn:    (...a) => console.warn( ts(), label, chalk.yellow(`⚠  ${a[0]}`), ...a.slice(1)),
    error:   (...a) => console.error(ts(), label, chalk.red(`✖  ${a[0]}`),    ...a.slice(1)),
  };
}

const METHOD_COLORS = {
  GET:    chalk.blue.bold,
  POST:   chalk.green.bold,
  PUT:    chalk.yellow.bold,
  PATCH:  chalk.magenta.bold,
  DELETE: chalk.red.bold,
};

function colorStatus(code) {
  if (code >= 500) return chalk.red.bold(code);
  if (code >= 400) return chalk.yellow(code);
  if (code >= 300) return chalk.cyan(code);
  return chalk.green(code);
}

// Routes too noisy to log on every request
const SKIP_PREFIXES = ['/api/covers/', '/api/events'];

export function requestLogger() {
  const label = chalk.white.bold('[http]');
  return (req, res, next) => {
    if (SKIP_PREFIXES.some((p) => req.path.startsWith(p))) return next();
    // Skip range sub-requests on streams (seeking) — only log the initial play
    if (req.path.startsWith('/api/stream/') && req.headers.range) return next();

    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const method = (METHOD_COLORS[req.method] ?? chalk.white.bold)(req.method.padEnd(6));
      const url = chalk.white(req.originalUrl.replace(/^\/api/, ''));
      const status = colorStatus(res.statusCode);
      const time = chalk.dim(`${ms}ms`);
      console.log(ts(), label, `${method} ${url} ${status} ${time}`);
    });
    next();
  };
}
