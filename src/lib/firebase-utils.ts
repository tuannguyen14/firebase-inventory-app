// src/lib/firebase-utils.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  Timestamp,
  writeBatch,
  runTransaction,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

// =============================================================================
// TYPES
// =============================================================================

export interface Material {
  id?: string;
  name: string;
  unit: string;
  currentStock: number;
  unitPrice: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Product {
  id?: string;
  name: string;
  currentStock: number;
  formula: {
    materialId: string;
    materialName: string;
    quantity: number;
  }[];
  sellingPrice: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MaterialTransaction {
  id?: string;
  materialId: string;
  materialName: string;
  type: 'import' | 'export';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  note?: string;
  createdAt?: Timestamp;
  createdBy?: string;
}

export interface ProductionLog {
  id?: string;
  productId: string;
  productName: string;
  quantityProduced: number;
  materialsUsed: {
    materialId: string;
    materialName: string;
    quantityUsed: number;
    unitPrice: number;
  }[];
  totalCost: number;
  costPerUnit: number;
  createdAt?: Timestamp;
  createdBy?: string;
}

export interface Sale {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  createdAt?: Timestamp;
  createdBy?: string;
}

export interface InventorySnapshot {
  id?: string;
  date: string;
  materials: {
    materialId: string;
    materialName: string;
    stock: number;
    value: number;
  }[];
  products: {
    productId: string;
    productName: string;
    stock: number;
    value: number;
  }[];
  totalMaterialValue: number;
  totalProductValue: number;
  createdAt?: Timestamp;
}

// =============================================================================
// MATERIALS UTILITIES
// =============================================================================

export const materialsUtils = {
  // Tạo vật tư mới
  async create(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'materials'), {
      ...material,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  },

  // Lấy tất cả vật tư
  async getAll(): Promise<Material[]> {
    const snapshot = await getDocs(query(collection(db, 'materials'), orderBy('name')));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Material[];
  },

  // Lấy vật tư theo ID
  async getById(id: string): Promise<Material | null> {
    const docSnap = await getDoc(doc(db, 'materials', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Material;
    }
    return null;
  },

  // Cập nhật vật tư
  async update(id: string, updates: Partial<Material>): Promise<void> {
    await updateDoc(doc(db, 'materials', id), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  // Xóa vật tư
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'materials', id));
  },

  // Lấy vật tư tồn kho thấp
  async getLowStock(threshold: number = 10): Promise<Material[]> {
    const snapshot = await getDocs(query(
      collection(db, 'materials'),
      where('currentStock', '<', threshold),
      orderBy('currentStock')
    ));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Material[];
  },

  // Cập nhật tồn kho
  async updateStock(id: string, newStock: number): Promise<void> {
    await updateDoc(doc(db, 'materials', id), {
      currentStock: newStock,
      updatedAt: Timestamp.now()
    });
  }
};

// =============================================================================
// PRODUCTS UTILITIES
// =============================================================================

export const productsUtils = {
  // Tạo sản phẩm mới
  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  },

  // Lấy tất cả sản phẩm
  async getAll(): Promise<Product[]> {
    const snapshot = await getDocs(query(collection(db, 'products'), orderBy('name')));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
  },

  // Lấy sản phẩm theo ID
  async getById(id: string): Promise<Product | null> {
    const docSnap = await getDoc(doc(db, 'products', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Product;
    }
    return null;
  },

  // Cập nhật sản phẩm
  async update(id: string, updates: Partial<Product>): Promise<void> {
    await updateDoc(doc(db, 'products', id), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  // Xóa sản phẩm
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'products', id));
  },

  // Kiểm tra có thể sản xuất bao nhiêu sản phẩm
  async checkProductionCapacity(productId: string): Promise<{ canProduce: number; missingMaterials: string[] }> {
    const product = await this.getById(productId);
    if (!product) throw new Error('Product not found');

    const materials = await materialsUtils.getAll();
    const materialMap = new Map(materials.map(m => [m.id!, m]));

    let canProduce = Infinity;
    const missingMaterials: string[] = [];

    for (const ingredient of product.formula) {
      const material = materialMap.get(ingredient.materialId);
      if (!material) {
        missingMaterials.push(ingredient.materialName);
        canProduce = 0;
        continue;
      }

      const possibleQuantity = Math.floor(material.currentStock / ingredient.quantity);
      canProduce = Math.min(canProduce, possibleQuantity);
    }

    return {
      canProduce: canProduce === Infinity ? 0 : canProduce,
      missingMaterials
    };
  }
};

// =============================================================================
// MATERIAL TRANSACTIONS UTILITIES
// =============================================================================

export const materialTransactionsUtils = {
  // Nhập vật tư (tăng tồn kho)
  async importMaterial(
    materialId: string,
    quantity: number,
    unitPrice: number,
    note?: string,
    userId?: string
  ): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      // Lấy thông tin vật tư hiện tại
      const materialRef = doc(db, 'materials', materialId);
      const materialDoc = await transaction.get(materialRef);
      
      if (!materialDoc.exists()) {
        throw new Error('Material not found');
      }

      const material = materialDoc.data() as Material;
      const newStock = material.currentStock + quantity;

      // Tạo transaction record
      const transactionRef = doc(collection(db, 'material_transactions'));
      const transactionData: MaterialTransaction = {
        materialId,
        materialName: material.name,
        type: 'import',
        quantity,
        unitPrice,
        totalAmount: quantity * unitPrice,
        note,
        createdAt: Timestamp.now(),
        createdBy: userId
      };

      // Cập nhật tồn kho
      transaction.update(materialRef, {
        currentStock: newStock,
        unitPrice: unitPrice, // Cập nhật giá mới nhất
        updatedAt: Timestamp.now()
      });

      // Thêm transaction record
      transaction.set(transactionRef, transactionData);

      return transactionRef.id;
    });
  },

  // Xuất vật tư (giảm tồn kho)
  async exportMaterial(
    materialId: string,
    quantity: number,
    note?: string,
    userId?: string
  ): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, 'materials', materialId);
      const materialDoc = await transaction.get(materialRef);
      
      if (!materialDoc.exists()) {
        throw new Error('Material not found');
      }

      const material = materialDoc.data() as Material;
      
      if (material.currentStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${material.currentStock}, Required: ${quantity}`);
      }

      const newStock = material.currentStock - quantity;

      // Tạo transaction record
      const transactionRef = doc(collection(db, 'material_transactions'));
      const transactionData: MaterialTransaction = {
        materialId,
        materialName: material.name,
        type: 'export',
        quantity,
        unitPrice: material.unitPrice,
        totalAmount: quantity * material.unitPrice,
        note,
        createdAt: Timestamp.now(),
        createdBy: userId
      };

      // Cập nhật tồn kho
      transaction.update(materialRef, {
        currentStock: newStock,
        updatedAt: Timestamp.now()
      });

      // Thêm transaction record
      transaction.set(transactionRef, transactionData);

      return transactionRef.id;
    });
  },

  // Lấy lịch sử giao dịch
  async getHistory(materialId?: string, limit?: number): Promise<MaterialTransaction[]> {
    let q = query(
      collection(db, 'material_transactions'),
      orderBy('createdAt', 'desc')
    );

    if (materialId) {
      q = query(q, where('materialId', '==', materialId));
    }

    if (limit) {
      q = query(q, firestoreLimit(limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MaterialTransaction[];
  }
};

// =============================================================================
// PRODUCTION UTILITIES
// =============================================================================

export const productionUtils = {
  // Đóng gói sản phẩm
  async produceProduct(
    productId: string,
    quantity: number,
    userId?: string
  ): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      // Lấy thông tin sản phẩm
      const productRef = doc(db, 'products', productId);
      const productDoc = await transaction.get(productRef);
      
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }

      const product = productDoc.data() as Product;
      
      // Kiểm tra và cập nhật vật tư
      const materialsUsed: any[] = [];
      let totalCost = 0;

      for (const ingredient of product.formula) {
        const materialRef = doc(db, 'materials', ingredient.materialId);
        const materialDoc = await transaction.get(materialRef);
        
        if (!materialDoc.exists()) {
          throw new Error(`Material ${ingredient.materialName} not found`);
        }

        const material = materialDoc.data() as Material;
        const requiredQuantity = ingredient.quantity * quantity;
        
        if (material.currentStock < requiredQuantity) {
          throw new Error(
            `Insufficient ${ingredient.materialName}. Available: ${material.currentStock}, Required: ${requiredQuantity}`
          );
        }

        const newStock = material.currentStock - requiredQuantity;
        const cost = requiredQuantity * material.unitPrice;

        // Cập nhật tồn kho vật tư
        transaction.update(materialRef, {
          currentStock: newStock,
          updatedAt: Timestamp.now()
        });

        // Tạo material transaction
        const materialTransactionRef = doc(collection(db, 'material_transactions'));
        transaction.set(materialTransactionRef, {
          materialId: ingredient.materialId,
          materialName: ingredient.materialName,
          type: 'export',
          quantity: requiredQuantity,
          unitPrice: material.unitPrice,
          totalAmount: cost,
          note: `Sản xuất ${quantity} ${product.name}`,
          createdAt: Timestamp.now(),
          createdBy: userId
        });

        materialsUsed.push({
          materialId: ingredient.materialId,
          materialName: ingredient.materialName,
          quantityUsed: requiredQuantity,
          unitPrice: material.unitPrice
        });

        totalCost += cost;
      }

      // Cập nhật tồn kho sản phẩm
      const newProductStock = product.currentStock + quantity;
      transaction.update(productRef, {
        currentStock: newProductStock,
        updatedAt: Timestamp.now()
      });

      // Tạo production log
      const productionLogRef = doc(collection(db, 'production_logs'));
      const productionLogData: ProductionLog = {
        productId,
        productName: product.name,
        quantityProduced: quantity,
        materialsUsed,
        totalCost,
        costPerUnit: totalCost / quantity,
        createdAt: Timestamp.now(),
        createdBy: userId
      };

      transaction.set(productionLogRef, productionLogData);

      return productionLogRef.id;
    });
  },

  // Lấy lịch sử sản xuất
  async getProductionHistory(productId?: string, limit?: number): Promise<ProductionLog[]> {
    let q = query(
      collection(db, 'production_logs'),
      orderBy('createdAt', 'desc')
    );

    if (productId) {
      q = query(q, where('productId', '==', productId));
    }

    if (limit) {
      q = query(q, firestoreLimit(limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ProductionLog[];
  }
};

// =============================================================================
// SALES UTILITIES
// =============================================================================

export const salesUtils = {
  // Bán hàng
  async sellProduct(
    productId: string,
    quantity: number,
    unitPrice: number,
    customerName?: string,
    customerPhone?: string,
    note?: string,
    userId?: string
  ): Promise<string> {
    return await runTransaction(db, async (transaction) => {
      // Lấy thông tin sản phẩm
      const productRef = doc(db, 'products', productId);
      const productDoc = await transaction.get(productRef);
      
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }

      const product = productDoc.data() as Product;
      
      if (product.currentStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.currentStock}, Required: ${quantity}`);
      }

      const newStock = product.currentStock - quantity;
      const totalRevenue = quantity * unitPrice;

      // Cập nhật tồn kho sản phẩm
      transaction.update(productRef, {
        currentStock: newStock,
        updatedAt: Timestamp.now()
      });

      // Tạo sale record
      const saleRef = doc(collection(db, 'sales'));
      const saleData: Sale = {
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        totalRevenue,
        customerName,
        customerPhone,
        note,
        createdAt: Timestamp.now(),
        createdBy: userId
      };

      transaction.set(saleRef, saleData);

      return saleRef.id;
    });
  },

  // Lấy lịch sử bán hàng
  async getSalesHistory(productId?: string, limit?: number): Promise<Sale[]> {
    let q = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc')
    );

    if (productId) {
      q = query(q, where('productId', '==', productId));
    }

    if (limit) {
      q = query(q, firestoreLimit(limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];
  },

  // Lấy doanh thu theo khoảng thời gian
  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    totalSales: number;
    salesByProduct: { [productName: string]: { quantity: number; revenue: number } };
  }> {
    const q = query(
      collection(db, 'sales'),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const sales = snapshot.docs.map(doc => doc.data()) as Sale[];

    let totalRevenue = 0;
    let totalSales = 0;
    const salesByProduct: { [productName: string]: { quantity: number; revenue: number } } = {};

    sales.forEach(sale => {
      totalRevenue += sale.totalRevenue;
      totalSales += sale.quantity;

      if (!salesByProduct[sale.productName]) {
        salesByProduct[sale.productName] = { quantity: 0, revenue: 0 };
      }

      salesByProduct[sale.productName].quantity += sale.quantity;
      salesByProduct[sale.productName].revenue += sale.totalRevenue;
    });

    return {
      totalRevenue,
      totalSales,
      salesByProduct
    };
  }
};

// =============================================================================
// INVENTORY UTILITIES
// =============================================================================

export const inventoryUtils = {
  // Tạo snapshot tồn kho
  async createSnapshot(date?: Date): Promise<string> {
    const snapshotDate = date || new Date();
    const dateString = snapshotDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const materials = await materialsUtils.getAll();
    const products = await productsUtils.getAll();

    let totalMaterialValue = 0;
    let totalProductValue = 0;

    const materialSnapshots = materials.map(material => {
      const value = material.currentStock * material.unitPrice;
      totalMaterialValue += value;
      return {
        materialId: material.id!,
        materialName: material.name,
        stock: material.currentStock,
        value
      };
    });

    // Tính giá trị sản phẩm dựa trên chi phí sản xuất trung bình
    const productSnapshots = await Promise.all(
      products.map(async product => {
        // Lấy chi phí sản xuất trung bình từ production logs
        const productionLogs = await productionUtils.getProductionHistory(product.id, 10);
        const avgCostPerUnit = productionLogs.length > 0
          ? productionLogs.reduce((sum, log) => sum + log.costPerUnit, 0) / productionLogs.length
          : 0;

        const value = product.currentStock * avgCostPerUnit;
        totalProductValue += value;

        return {
          productId: product.id!,
          productName: product.name,
          stock: product.currentStock,
          value
        };
      })
    );

    const snapshotData: InventorySnapshot = {
      date: dateString,
      materials: materialSnapshots,
      products: productSnapshots,
      totalMaterialValue,
      totalProductValue,
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'inventory_snapshots'), snapshotData);
    return docRef.id;
  },

  // Lấy snapshot theo ngày
  async getSnapshotByDate(date: string): Promise<InventorySnapshot | null> {
    const q = query(
      collection(db, 'inventory_snapshots'),
      where('date', '==', date),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as InventorySnapshot;
  },

  // Lấy tất cả snapshots
  async getAllSnapshots(): Promise<InventorySnapshot[]> {
    const q = query(
      collection(db, 'inventory_snapshots'),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as InventorySnapshot[];
  }
};

// =============================================================================
// DASHBOARD UTILITIES
// =============================================================================

export const dashboardUtils = {
  // Lấy tất cả thống kê cho dashboard
  async getDashboardStats(): Promise<{
    totalMaterials: number;
    totalProducts: number;
    totalRevenue: number;
    totalProfit: number;
    lowStockItems: number;
    todaySales: number;
    totalCost: number;
    recentActivities: any[];
    lowStockMaterials: Material[];
  }> {
    // Lấy dữ liệu cơ bản
    const [materials, products] = await Promise.all([
      materialsUtils.getAll(),
      productsUtils.getAll()
    ]);

    // Lấy doanh thu hôm nay
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayRevenue = await salesUtils.getRevenueByDateRange(startOfToday, endOfToday);

    // Lấy tổng doanh thu
    const allTimeRevenue = await salesUtils.getRevenueByDateRange(new Date(2020, 0, 1), new Date());

    // Lấy tổng chi phí sản xuất
    const productionLogs = await productionUtils.getProductionHistory();
    const totalCost = productionLogs.reduce((sum, log) => sum + log.totalCost, 0);

    // Lấy vật tư tồn kho thấp
    const lowStockMaterials = await materialsUtils.getLowStock(10);

    // Lấy hoạt động gần đây
    const [recentSales, recentProduction, recentMaterialTransactions] = await Promise.all([
      salesUtils.getSalesHistory(undefined, 5),
      productionUtils.getProductionHistory(undefined, 3),
      materialTransactionsUtils.getHistory(undefined, 3)
    ]);

    const recentActivities = [
      ...recentSales.map(sale => ({
        id: sale.id,
        type: 'sale',
        description: `Bán ${sale.quantity} ${sale.productName}`,
        timestamp: sale.createdAt?.toDate() || new Date(),
        amount: sale.totalRevenue,
        status: 'success'
      })),
      ...recentProduction.map(prod => ({
        id: prod.id,
        type: 'production',
        description: `Đóng gói ${prod.quantityProduced} ${prod.productName}`,
        timestamp: prod.createdAt?.toDate() || new Date(),
        status: 'info'
      })),
      ...recentMaterialTransactions
        .filter(trans => trans.type === 'import')
        .map(trans => ({
          id: trans.id,
          type: 'material_import',
          description: `Nhập ${trans.quantity} ${trans.materialName}`,
          timestamp: trans.createdAt?.toDate() || new Date(),
          status: 'info'
        }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

    return {
      totalMaterials: materials.length,
      totalProducts: products.length,
      totalRevenue: allTimeRevenue.totalRevenue,
      totalProfit: allTimeRevenue.totalRevenue - totalCost,
      lowStockItems: lowStockMaterials.length,
      todaySales: todayRevenue.totalRevenue,
      totalCost,
      recentActivities,
      lowStockMaterials: lowStockMaterials.slice(0, 5)
    };
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export const helperUtils = {
  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  },

  // Format time ago
  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} phút trước`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} giờ trước`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} ngày trước`;
    }
  },

  // Validate material stock
  validateMaterialStock(materials: Material[], formula: Product['formula'], quantity: number): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const materialMap = new Map(materials.map(m => [m.id!, m]));

    for (const ingredient of formula) {
      const material = materialMap.get(ingredient.materialId);
      if (!material) {
        errors.push(`Không tìm thấy vật tư: ${ingredient.materialName}`);
        continue;
      }

      const requiredQuantity = ingredient.quantity * quantity;
      if (material.currentStock < requiredQuantity) {
        errors.push(
          `Vật tư ${ingredient.materialName} không đủ. Cần: ${requiredQuantity}, Có: ${material.currentStock}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};