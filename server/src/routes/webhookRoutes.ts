import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { verifyMetaSignature } from '../middleware/verifyMetaSignature';

const router = Router();

// Handshake verification endpoint for Meta webhook setup
router.get('/', WebhookController.verify);

// Incoming messaging webhook events endpoint
router.post('/', verifyMetaSignature, WebhookController.handleEvent);

export default router;

