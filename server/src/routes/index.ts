import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import resourceRoutes from './resourceRoutes';
import automationRoutes from './automationRoutes';
import eventRoutes from './eventRoutes';
import replyRoutes from './replyRoutes';
import integrationRoutes from './integrationRoutes';

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

router.use('/resources', resourceRoutes);
router.use('/automation', automationRoutes);
router.use('/events', eventRoutes);
router.use('/replies', replyRoutes);
router.use('/integration', integrationRoutes);
router.use('/analytics', integrationRoutes);

export default router;

