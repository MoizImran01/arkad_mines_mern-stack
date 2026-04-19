/**
 * Admin purchase order HTTP handlers (list, create, status) and stone linkage.
 */
import procurementModel from '../Models/procurementModel/procurementModel.js';
import stonesModel from '../Models/stonesModel/stonesModel.js';
import { emitStonesChanged } from '../socket/socketEmitter.js';

export const listPurchaseOrders = async (req, res) => {
  try {
    const orders = await procurementModel.find({}).sort({ createdAt: -1 });
    res.json({ success: true, purchaseOrders: orders });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ success: false, message: 'Error fetching purchase orders' });
  }
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const {
      supplierName,
      stones, 
      stoneDetails, 
      quantityOrdered, 
      pricePerTon,
      expectedDeliveryDate,
      notes
    } = req.body;

    if (stones && Array.isArray(stones) && stones.length > 0) {
      if (!supplierName) {
        return res.status(400).json({ success: false, message: 'Supplier name is required' });
      }

      const count = await procurementModel.countDocuments();
      const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
      
      let totalCost = 0;
      const stonesArray = [];

      for (const stoneItem of stones) {
        if (!stoneItem.stoneName || !stoneItem.category || !stoneItem.subcategory || !stoneItem.quantityOrdered || !stoneItem.pricePerTon) {
          return res.status(400).json({ success: false, message: 'Each stone must have name, category, subcategory, quantity, and price' });
        }

        const stoneCost = Number(stoneItem.quantityOrdered) * Number(stoneItem.pricePerTon);
        totalCost += stoneCost;

        const stone = await stonesModel.findOne({
          stoneName: stoneItem.stoneName,
          category: stoneItem.category,
          subcategory: stoneItem.subcategory
        });

        stonesArray.push({
          stoneId: stone?._id || null,
          stoneName: stoneItem.stoneName,
          category: stoneItem.category,
          subcategory: stoneItem.subcategory,
          quantityOrdered: Number(stoneItem.quantityOrdered),
          pricePerTon: Number(stoneItem.pricePerTon),
          suggestedQuantity: stoneItem.suggestedQuantity ? Number(stoneItem.suggestedQuantity) : undefined
        });

        if (stone) {
          stone.markedForPO = false;
          await stone.save();
        }
      }

      emitStonesChanged({ reason: "purchase_order_created" });

      const po = new procurementModel({
        poNumber,
        supplierName,
        stones: stonesArray,
        totalCost,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes: notes || undefined
      });

      await po.save();
      res.json({ success: true, message: 'Purchase order created', purchaseOrder: po });
    } else {
      if (!supplierName || !stoneDetails?.stoneName || !stoneDetails?.category || !stoneDetails?.subcategory || !quantityOrdered || !pricePerTon) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      const count = await procurementModel.countDocuments();
      const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
      const totalCost = Number(quantityOrdered) * Number(pricePerTon);

      const po = new procurementModel({
        poNumber,
        supplierName,
        stoneDetails,
        quantityOrdered: Number(quantityOrdered),
        pricePerTon: Number(pricePerTon),
        totalCost,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes: notes || undefined
      });

      await po.save();
      res.json({ success: true, message: 'Purchase order created', purchaseOrder: po });
    }
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, message: 'Error creating purchase order' });
  }
};

export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'sent_to_supplier', 'in_transit', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const po = await procurementModel.findById(id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    const previousStatus = po.status;

    const getStoneItems = () => {
      if (po.stones && po.stones.length > 0) {
        return po.stones.map(s => ({ stoneId: s.stoneId, quantity: s.quantityOrdered }));
      }
      if (po.stoneDetails?.stoneId && po.quantityOrdered) {
        return [{ stoneId: po.stoneDetails.stoneId, quantity: po.quantityOrdered }];
      }
      return [];
    };

    const stoneItems = getStoneItems();

    if (status === 'received' && previousStatus !== 'received') {
      for (const item of stoneItems) {
        if (!item.stoneId) continue;
        const stone = await stonesModel.findById(item.stoneId);
        if (stone) {
          stone.stockQuantity = (stone.stockQuantity || 0) + item.quantity;
          const remaining = stone.stockQuantity - (stone.quantityDelivered || 0);
          if (remaining > 0) stone.stockAvailability = "In Stock";
          await stone.save();
        }
      }
      po.actualDeliveryDate = new Date();
    }

    
    if (status === 'cancelled' && previousStatus === 'received') {
      for (const item of stoneItems) {
        if (!item.stoneId) continue;
        const stone = await stonesModel.findById(item.stoneId);
        if (stone) {
          stone.stockQuantity = Math.max(0, (stone.stockQuantity || 0) - item.quantity);
          const remaining = stone.stockQuantity - (stone.quantityDelivered || 0);
          if (remaining <= 0) stone.stockAvailability = "Out of Stock";
          await stone.save();
        }
      }
    }

    po.status = status;
    await po.save();

    if (status === "received" || status === "cancelled") {
      emitStonesChanged({ reason: "purchase_order_status", status });
    }

    res.json({ success: true, message: `Status updated to ${status}`, purchaseOrder: po });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
};
