import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chatAssistant, confirmAssistantBid, prepareAssistantBid } from '../controllers/assistantController.js';
import type { AuthRequest } from '../middleware/auth.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const assistantRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?._id.toString() ?? 'anonymous',
  message: { message: 'Assistant request limit reached. Please wait a minute and try again.' },
});

router.use(authenticateToken, assistantRateLimit);
router.post('/chat', chatAssistant);
router.post('/prepare-bid', prepareAssistantBid);
router.post('/confirm-bid', confirmAssistantBid);

export default router;
