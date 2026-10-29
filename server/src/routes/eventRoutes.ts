import { Router } from 'express';
import { EventsController } from '../controllers/EventsController';

const router = Router();

router.get('/', EventsController.list);
router.get('/:id', EventsController.getById);

export default router;

