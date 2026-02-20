import express from 'express';
import { listPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus } from '../../Controllers/ProcurementController.js';
import { verifyToken, authorizeRoles } from '../../Middlewares/auth.js';

const procurementRouter = express.Router();

procurementRouter.get('/list', verifyToken, authorizeRoles('admin'), listPurchaseOrders);
procurementRouter.post('/create', verifyToken, authorizeRoles('admin'), createPurchaseOrder);
procurementRouter.put('/status/:id', verifyToken, authorizeRoles('admin'), updatePurchaseOrderStatus);

export default procurementRouter;
