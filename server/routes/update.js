import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { hostname } from 'os';

const REPO_DIR = process.env.REPO_DIR || '/repo';

const router = Router();

// Resolve the compose project name from the running container's own labels.
// Docker sets the hostname to the (short) container ID, which docker inspect accepts.
function getComposeProjectName() {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', [
      'inspect', '--format',
      '{{index .Config.Labels "com.docker.compose.project"}}',
      hostname(),
    ]);
    let out = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.on('close', (code) => {
      const name = out.trim();
      if (code === 0 && name) resolve(name);
      else reject(new Error('Could not determine compose project name from container labels'));
    });
    proc.on('error', reject);
  });
}

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
      const projectName = await getComposeProjectName();
      await runCommand('docker-compose', ['-p', projectName, 'up', '-d', '--build'], REPO_DIR);

      send('done', 'Update complete! The application is restarting...');
    } catch (err) {
      send('error', err.message);
    }
    res.end();
  })();
});

export default router;
