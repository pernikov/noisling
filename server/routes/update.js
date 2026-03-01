import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const REPO_DIR = process.env.REPO_DIR || '/repo';
const PROJECT_NAME = process.env.COMPOSE_PROJECT_NAME || 'noisling';

const router = Router();

router.post('/update', (_req, res) => {
  if (!existsSync(`${REPO_DIR}/.git`)) {
    return res.status(500).json({
      error: `No git repository found at ${REPO_DIR}. Make sure the repo is mounted (docker-compose.yml: "- .:/repo").`,
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, message) => {
    res.write(`data: ${JSON.stringify({ type, message })}\n\n`);
  };

  const runCommand = (cmd, args, cwd) =>
    new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { cwd });
      proc.stdout.on('data', (data) => send('output', data.toString()));
      proc.stderr.on('data', (data) => send('output', data.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`"${cmd} ${args.join(' ')}" exited with code ${code}`));
      });
      proc.on('error', (err) => reject(new Error(`Failed to run ${cmd}: ${err.message}`)));
    });

  (async () => {
    try {
      send('step', 'Running git pull...');
      await runCommand('git', ['-c', `safe.directory=${REPO_DIR}`, 'pull'], REPO_DIR);

      send('step', 'Building and restarting containers (this will take a moment)...');
      await runCommand('docker-compose', ['-p', PROJECT_NAME, 'up', '-d', '--build'], REPO_DIR);

      send('done', 'Update complete! The application is restarting...');
    } catch (err) {
      send('error', err.message);
    }
    res.end();
  })();
});

export default router;
