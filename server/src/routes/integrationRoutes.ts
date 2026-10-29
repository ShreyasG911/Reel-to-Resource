import { Router } from 'express';
import { IntegrationController } from '../controllers/IntegrationController';

const router = Router();

router.get('/status', IntegrationController.getStatus);
router.post('/verify-credentials', IntegrationController.verifyCredentials);
router.get('/overview', IntegrationController.getOverview);

export default router;
