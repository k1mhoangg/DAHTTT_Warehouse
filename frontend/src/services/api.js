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

    exportWarehouse: async (data) => {
        const response = await api.post('/warehouse/export', data)
        return response.data
    },

    deleteExport: async (id) => {
        const response = await api.delete(`/warehouse/export/${id}`)
        return response.data
    },

    // UC05: Transfer
    transferWarehouse: async (data) => {
        const response = await api.post('/warehouse/transfer', data)
        return response.data
    },

    // UC06: Inventory Check
    startInventory: async (data) => {
        const response = await api.post('/warehouse/inventory/start', data)
        return response.data
    },

    recordInventory: async (data) => {
        const response = await api.post('/warehouse/inventory/record', data)
        return response.data
    },

    getInventoryReport: async (id) => {
        const response = await api.get(`/warehouse/inventory/${id}`)
        return response.data
    },

    // UC07: Adjustment
    adjustInventory: async (data) => {
        const response = await api.post('/warehouse/adjustment', data)
        return response.data
    },

    // UC09: Discard
    discardGoods: async (data) => {
        const response = await api.post('/warehouse/discard', data)
        return response.data
    },
}

// =============================================
// ORDERS (UC02)
// =============================================

export const orderService = {
    getOrders: async (params) => {
        const response = await api.get('/orders', { params })
        return response.data
    },

    getOrder: async (id) => {
        const response = await api.get(`/orders/${id}`)
        return response.data
    },

    createOrder: async (data) => {
        const response = await api.post('/orders', data)
        return response.data
    },

    approveOrder: async (id) => {
        const response = await api.put(`/orders/${id}/approve`)
        return response.data
    },

    rejectOrder: async (id, reason) => {
        const response = await api.put(`/orders/${id}/reject`, { reason })
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
