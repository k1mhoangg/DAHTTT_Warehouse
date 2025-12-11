import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'

// Layouts
import MainLayout from './components/layouts/MainLayout'
import AuthLayout from './components/layouts/AuthLayout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// UC01: Products
import ProductList from './pages/products/ProductList'
import ProductForm from './pages/products/ProductForm'

// UC02: Orders
import OrderList from './pages/orders/OrderList'
import OrderForm from './pages/orders/OrderForm'

// UC03-UC05: Warehouse Operations
import WarehouseImport from './pages/warehouse/WarehouseImport'
import WarehouseExport from './pages/warehouse/WarehouseExport'
import WarehouseTransfer from './pages/warehouse/WarehouseTransfer'

// UC06-UC07: Inventory
import InventoryCheck from './pages/warehouse/InventoryCheck'
import InventoryAdjustment from './pages/warehouse/InventoryAdjustment'

// UC08: Reports
import Reports from './pages/reports/Reports'

// UC09: Discard
import DiscardGoods from './pages/warehouse/DiscardGoods'

// UC10-UC11: Sales & Returns
import PointOfSale from './pages/sales/PointOfSale'
import Returns from './pages/sales/Returns'

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { isAuthenticated, user } = useAuthStore()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.Role)) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

function App() {
    const { isAuthenticated } = useAuthStore()

    return (
        <Routes>
            {/* Public Routes */}
            <Route element={<AuthLayout />}>
                <Route
                    path="/login"
                    element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
                />
            </Route>

            {/* Protected Routes */}
            <Route
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/dashboard" element={<Dashboard />} />

                {/* UC01: Product Management - Quản lý only */}
                <Route
                    path="/products"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý']}>
                            <ProductList />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/products/new"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý']}>
                            <ProductForm />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/products/:id/edit"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý']}>
                            <ProductForm />
                        </ProtectedRoute>
                    }
                />

                {/* UC02: Orders - Nhân viên kho */}
                <Route
                    path="/orders"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <OrderList />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/orders/new"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <OrderForm />
                        </ProtectedRoute>
                    }
                />

                {/* UC03-UC05: Warehouse Operations */}
                <Route
                    path="/warehouse/import"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <WarehouseImport />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/warehouse/export"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <WarehouseExport />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/warehouse/transfer"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <WarehouseTransfer />
                        </ProtectedRoute>
                    }
                />

                {/* UC06-UC07: Inventory Management */}
                <Route
                    path="/warehouse/inventory"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <InventoryCheck />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/warehouse/adjustment"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <InventoryAdjustment />
                        </ProtectedRoute>
                    }
                />

                {/* UC08: Reports - Quản lý & Thu ngân */}
                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý']}>
                            <Reports />
                        </ProtectedRoute>
                    }
                />

                {/* UC09: Discard */}
                <Route
                    path="/warehouse/discard"
                    element={
                        <ProtectedRoute allowedRoles={['Quản lý', 'Nhân viên']}>
                            <DiscardGoods />
                        </ProtectedRoute>
                    }
                />

                {/* UC10-UC11: Sales & Returns - Thu ngân */}
                <Route
                    path="/pos"
                    element={
                        <ProtectedRoute>
                            <PointOfSale />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/returns"
                    element={
                        <ProtectedRoute>
                            <Returns />
                        </ProtectedRoute>
                    }
                />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default App
