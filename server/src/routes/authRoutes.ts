import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

// Strict rate-limiter on login route: 15 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, AuthController.login);
router.get('/me', requireAdminAuth, AuthController.getMe);
router.post('/logout', AuthController.logout);
router.get('/setup-status', AuthController.getSetupStatus);

export default router;

