import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';

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

  const capture = (cmd, args) =>
    new Promise((resolve, reject) => {
      const proc = spawn(cmd, args);
      let out = '';
      proc.stdout.on('data', (d) => { out += d; });
      proc.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${code}`))));
      proc.on('error', (err) => reject(err));
    });

  (async () => {
    try {
      send('step', 'Running git pull...');
      await runCommand('git', ['-c', `safe.directory=${REPO_DIR}`, 'pull'], REPO_DIR);

      send('step', 'Building new image (this will take a moment)...');
      await runCommand('docker-compose', ['-p', PROJECT_NAME, 'build'], REPO_DIR);

      // Inspect the current container (via the host Docker daemon) to find the real
      // host-side path for the /repo mount. This is needed because docker-compose
      // resolves relative paths ("." in volumes) using the daemon's perspective, not
      // the container's. If we pass the container path (/repo) directly, the new
      // container would fail to mount it (the host has no /repo directory).
      const containerId = existsSync('/etc/hostname')
        ? readFileSync('/etc/hostname', 'utf8').trim()
        : process.env.HOSTNAME;

      const hostRepoPath = await capture('docker', [
        'inspect', '--format',
        '{{range .Mounts}}{{if eq .Destination "/repo"}}{{.Source}}{{end}}{{end}}',
        containerId,
      ]);

      if (!hostRepoPath) {
        throw new Error('Could not determine host path for the /repo mount');
      }

      // Clean up any leftover updater container from a previous run
      await capture('docker', ['rm', '-f', 'noisling-updater']).catch(() => {});

      send('step', 'Container is restarting...');

      // Run `docker compose up -d` in a separate, detached helper container.
      // Because this helper is a *different* container from the app, it survives
      // when the app container is stopped and replaced — the previous approach ran
      // docker-compose inside the app container itself, which got killed (exit 137)
      // mid-restart, leaving the new container in "Created" but never started.
      await runCommand('docker', [
        'run', '--rm', '-d',
        '--name', 'noisling-updater',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', `${hostRepoPath}:/repo`,
        '-w', '/repo',
        'docker:cli',
        'sh', '-c',
        `sleep 2 && docker compose -p ${PROJECT_NAME} up -d`,
      ]);

      send('done', 'Update complete! The application is restarting...');
    } catch (err) {
      send('error', err.message);
    }
    res.end();
  })();
});

export default router;
