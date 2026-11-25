import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';

const router = Router();

router.use(requireAuth, requireWorkspace('VIEWER'));
router.get('/overview', analyticsController.getOverview);
router.get('/export/csv', analyticsController.exportCsv);
router.get('/statement/pdf', analyticsController.downloadMonthlyStatementPdf);

export default router;
