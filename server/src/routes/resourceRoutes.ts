import { Router } from 'express';
import { ResourceController } from '../controllers/ResourceController';

const router = Router();

router.get('/', ResourceController.list);
router.get('/:id', ResourceController.getById);
router.post('/', ResourceController.create);
router.patch('/:id', ResourceController.update);
router.delete('/:id', ResourceController.delete);

export default router;

