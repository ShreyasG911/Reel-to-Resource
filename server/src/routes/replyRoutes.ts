import { Router } from 'express';
import { RepliesController } from '../controllers/RepliesController';

const router = Router();

router.get('/', RepliesController.list);
router.get('/:id', RepliesController.getById);

export default router;

