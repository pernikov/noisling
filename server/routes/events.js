import { Router } from 'express';
import { addClient } from '../services/events.js';

const router = Router();

router.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  addClient(res);
});

export default router;
