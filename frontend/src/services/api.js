import api from '@/lib/api'

// =============================================
// AUTHENTICATION
// =============================================

export const authService = {
    login: async (credentials) => {
        const response = await api.post('/auth/login', credentials)
        return response.data
    },

    logout: async () => {
        const response = await api.post('/auth/logout')
        return response.data
    },

    getCurrentUser: async () => {
        const response = await api.get('/auth/me')
        return response.data
    },

    changePassword: async (data) => {
        const response = await api.post('/auth/change-password', data)
        return response.data
    },
}

// =============================================
// PRODUCTS (UC01)
// =============================================

export const productService = {
    getProducts: async (params) => {
        const response = await api.get('/products', { params })
        return response.data
    },

    getProduct: async (id) => {
        const response = await api.get(`/products/${id}`)
        return response.data
    },

    createProduct: async (data) => {
        const response = await api.post('/products', data)
        return response.data
    },

    updateProduct: async (id, data) => {
        const response = await api.put(`/products/${id}`, data)
        return response.data
    },

    deleteProduct: async (id) => {
        const response = await api.delete(`/products/${id}`)
        return response.data
    },

    getCategories: async () => {
        const response = await api.get('/products/categories')
        return response.data
    },

    getLowStockProducts: async () => {
        const response = await api.get('/products/low-stock')
        return response.data
    },
}

// =============================================
// WAREHOUSE OPERATIONS (UC03-UC09)
// =============================================

export const warehouseService = {
    // Warehouse data
    getWarehouses: async () => {
        const response = await api.get('/warehouse/warehouses')
        return response.data
    },

    getWarehouseInventory: async (maKho, params) => {
        const response = await api.get(`/warehouse/warehouses/${maKho}/inventory`, { params })
        return response.data
    },

    getBatches: async (params) => {
        const response = await api.get('/warehouse/batches', { params })
        return response.data
    },

    // UC03: Import - Enhanced
    getImports: async () => {
        const response = await api.get('/warehouse/import')
        return response.data
    },

    getImport: async (id) => {
        const response = await api.get(`/warehouse/import/${id}`)
        return response.data
    },

    importWarehouse: async (data) => {
        const response = await api.post('/warehouse/import', data)
        return response.data
    },

    deleteImport: async (id) => {
        const response = await api.delete(`/warehouse/import/${id}`)
        return response.data
    },

    // New endpoints for UC03
    getSuppliersForImport: async () => {
        const response = await api.get('/warehouse/import/suppliers')
        return response.data
    },

    validateBatchCode: async (data) => {
        const response = await api.post('/warehouse/import/validate-batch', data)
        return response.data
    },

    generateBatchCode: async (data) => {
        const response = await api.post('/warehouse/import/generate-batch', data)
        return response.data
    },

    previewImport: async (data) => {
        const response = await api.post('/warehouse/import/preview', data)
        return response.data
    },

    // UC04: Export
    getExports: async () => {
        const response = await api.get('/warehouse/export')
        return response.data
    },

    getExport: async (id) => {
        const response = await api.get(`/warehouse/export/${id}`)
        return response.data
    },

    getFEFOBatches: async (data) => {
        const response = await api.post('/warehouse/export/fefo-batches', data)
        return response.data
    },

    scanBarcodeForExport: async (data) => {
        const response = await api.post('/warehouse/export/scan-barcode', data)
        return response.data
    },

    scanBarcodeForTransfer: async (data) => {
        const response = await api.post('/warehouse/transfer/scan-barcode', data)
        return response.data
    },

    exportWarehouse: async (data) => {
        const response = await api.post('/warehouse/export', data)
        return response.data
    },

    deleteExport: async (id) => {
        const response = await api.delete(`/warehouse/export/${id}`)
        return response.data
    },

    // UC05: Transfer - Enhanced
    transferWarehouse: async (data) => {
        const response = await api.post('/warehouse/transfer', data)
        return response.data
    },

    getTransfers: async () => {
        const response = await api.get('/warehouse/transfer')
        return response.data
    },

    getTransfer: async (id) => {
        const response = await api.get(`/warehouse/transfer/${id}`)
        return response.data
    },

    deleteTransfer: async (id) => {
        const response = await api.delete(`/warehouse/transfer/${id}`)
        return response.data
    },

    validateTransfer: async (data) => {
        const response = await api.post('/warehouse/transfer/validate', data)
        return response.data
    },

    // UC06: Inventory Check - Enhanced
    startInventory: async (data) => {
        const response = await api.post('/warehouse_inventory/inventory/start', data)
        return response.data
    },

    recordInventory: async (data) => {
        const response = await api.post('/warehouse_inventory/inventory/record', data)
        return response.data
    },

    getInventories: async () => {
        const response = await api.get('/warehouse_inventory/inventory')
        return response.data
    },

    getInventoryReport: async (id) => {
        const response = await api.get(`/warehouse_inventory/inventory/${id}`)
        return response.data
    },

    deleteInventory: async (id) => {
        const response = await api.delete(`/warehouse_inventory/inventory/${id}`)
        return response.data
    },

    scanBatchForInventory: async (data) => {
        const response = await api.post('/warehouse_inventory/inventory/scan-batch', data)
        return response.data
    },

    // UC07: Adjustment - Enhanced
    getAdjustableInventories: async () => {
        const response = await api.get('/warehouse_inventory/adjustment')
        return response.data
    },

    previewAdjustment: async (data) => {
        const response = await api.post('/warehouse_inventory/adjustment/preview', data)
        return response.data
    },

    adjustInventory: async (data) => {
        const response = await api.post('/warehouse_inventory/adjustment', data)
        return response.data
    },

    getAdjustmentHistory: async () => {
        const response = await api.get('/warehouse_inventory/adjustment/history')
        return response.data
    },

    // UC09: Discard - Enhanced
    getErrorWarehouseInventory: async () => {
        const response = await api.get('/warehouse_inventory/discard/error-warehouse-inventory')
        return response.data
    },

    validateDiscard: async (data) => {
        const response = await api.post('/warehouse_inventory/discard/validate', data)
        return response.data
    },

    discardGoods: async (data) => {
        const response = await api.post('/warehouse_inventory/discard', data)
        return response.data
    },

    getDiscardHistory: async () => {
        const response = await api.get('/warehouse_inventory/discard/history')
        return response.data
    },

    getDiscardDetail: async (id) => {
        const response = await api.get(`/warehouse_inventory/discard/${id}`)
        return response.data
    },
}

// =============================================
// ORDERS (UC02)
// =============================================

export const orderService = {
    // Get all suppliers
    getSuppliers: async () => {
        const response = await api.get('/orders/suppliers')
        return response.data
    },

    // Get supplier details
    getSupplier: async (ten) => {
        const response = await api.get(`/orders/suppliers/${encodeURIComponent(ten)}`)
        return response.data
    },

    // Get order suggestions based on low stock
    getSuggestOrder: async () => {
        const response = await api.get('/orders/suggest-order')
        return response.data
    },

    // Get all orders with filters
    getOrders: async (params) => {
        const response = await api.get('/orders/orders', { params })
        return response.data
    },

    // Get order details
    getOrder: async (id) => {
        const response = await api.get(`/orders/orders/${id}`)
        return response.data
    },

    // Create new order
    createOrder: async (data) => {
        const response = await api.post('/orders/orders', data)
        return response.data
    },

    // Approve order (Manager only)
    approveOrder: async (id, data) => {
        const response = await api.post(`/orders/orders/${id}/approve`, data)
        return response.data
    },

    // Reject order (Manager only)
    rejectOrder: async (id, reason) => {
        const response = await api.post(`/orders/orders/${id}/reject`, { LyDo: reason })
        return response.data
    },

    // Delete order (Manager only)
    deleteOrder: async (id) => {
        const response = await api.delete(`/orders/orders/${id}`)
        return response.data
    },

    // Get order statistics
    getOrderStatistics: async () => {
        const response = await api.get('/orders/orders/statistics')
        return response.data
    },
}

// =============================================
// REPORTS (UC08)
// =============================================

export const reportService = {
    getInventoryReport: async (params) => {
        const response = await api.get('/reports/inventory', { params })
        return response.data
    },

    getSalesReport: async (params) => {
        const response = await api.get('/reports/sales', { params })
        return response.data
    },

    getBatchHistory: async (params) => {
        const response = await api.get('/reports/batch-history', { params })
        return response.data
    },

    getExpiryReport: async (params) => {
        const response = await api.get('/reports/expiry', { params })
        return response.data
    },

    exportReport: async (type, params, format = 'pdf') => {
        const response = await api.get(`/reports/${type}/export`, {
            params: { ...params, format },
            responseType: 'blob',
        })
        return response.data
    },
}

// =============================================
// SALES & RETURNS (UC10, UC11)
// =============================================

export const salesService = {
    // UC11: Create sale
    createSale: async (data) => {
        const response = await api.post('/sales', data)
        return response.data
    },

    getInvoice: async (id) => {
        const response = await api.get(`/sales/invoices/${id}`)
        return response.data
    },

    // UC10: Process return
    createReturn: async (data) => {
        const response = await api.post('/sales/returns', data)
        return response.data
    },

    getReturn: async (id) => {
        const response = await api.get(`/sales/returns/${id}`)
        return response.data
    },
}

// =============================================
// SUPPLIERS
// =============================================

export const supplierService = {
    getSuppliers: async (params) => {
        const response = await api.get('/suppliers', { params })
        return response.data
    },

    getSupplier: async (name) => {
        const response = await api.get(`/suppliers/${encodeURIComponent(name)}`)
        return response.data
    },

    createSupplier: async (data) => {
        const response = await api.post('/suppliers', data)
        return response.data
    },

    updateSupplier: async (name, data) => {
        const response = await api.put(`/suppliers/${encodeURIComponent(name)}`, data)
        return response.data
    },

    deleteSupplier: async (name) => {
        const response = await api.delete(`/suppliers/${encodeURIComponent(name)}`)
        return response.data
    },
}
