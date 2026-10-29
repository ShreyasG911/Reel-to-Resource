import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authRoutes from './authRoutes';
import resourceRoutes from './resourceRoutes';
import automationRoutes from './automationRoutes';
import eventRoutes from './eventRoutes';
import replyRoutes from './replyRoutes';
import integrationRoutes from './integrationRoutes';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

// General API rate limiter for administrative endpoints: 120 requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(apiLimiter);

// Public Authentication endpoints (login, logout, setup-status)
router.use('/auth', authRoutes);

// Protected Administrative & Dashboard endpoints
router.use('/resources', requireAdminAuth, resourceRoutes);
router.use('/automation', requireAdminAuth, automationRoutes);
router.use('/events', requireAdminAuth, eventRoutes);
router.use('/replies', requireAdminAuth, replyRoutes);
router.use('/integration', requireAdminAuth, integrationRoutes);
router.use('/analytics', requireAdminAuth, integrationRoutes);

export default router;
