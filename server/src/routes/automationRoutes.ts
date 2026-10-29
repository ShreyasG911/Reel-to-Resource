import { Router } from 'express';
import { AutomationSettingsController } from '../controllers/AutomationSettingsController';

const router = Router();

router.get('/settings', AutomationSettingsController.getSettings);
router.patch('/settings', AutomationSettingsController.updateSettings);
router.post('/test-match', AutomationSettingsController.testMatch);

export default router;

