import procurementModel from '../Models/procurementModel/procurementModel.js';
import stonesModel from '../Models/stonesModel/stonesModel.js';

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
      stones, // Array of stones with quantities
      stoneDetails, // Legacy: single stone
      quantityOrdered, // Legacy
      pricePerTon, // Legacy
      expectedDeliveryDate,
      notes
    } = req.body;

    // Support both new multi-stone format and legacy single-stone format
    if (stones && Array.isArray(stones) && stones.length > 0) {
      // New format: multiple stones
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

        // Find the stone in database to get its ID
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

        // Unmark the stone from PO list
        if (stone) {
          stone.markedForPO = false;
          await stone.save();
        }
      }

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
      // Legacy format: single stone
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

    const update = { status };
    if (status === 'received') {
      update.actualDeliveryDate = new Date();
    }

    const po = await procurementModel.findByIdAndUpdate(id, update, { new: true });
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    res.json({ success: true, message: `Status updated to ${status}`, purchaseOrder: po });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
};
