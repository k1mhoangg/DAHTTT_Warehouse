import { Outlet, Link, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, Package, ShoppingCart, Warehouse,
    FileText, TrendingUp, LogOut, User, Menu, X,
    PackagePlus, PackageMinus, RefreshCw, ClipboardCheck,
    AlertTriangle, RotateCcw, ShoppingBag
} from 'lucide-react'
import { useState } from 'react'
import useAuthStore from '@/store/authStore'
import { toast } from 'sonner'

export default function MainLayout() {
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const handleLogout = () => {
        logout()
        toast.success('Đăng xuất thành công')
        navigate('/login')
    }

    // Navigation items based on roles
    const getNavigationItems = () => {
        const items = [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['all'] },
        ]

        // Quản lý kho
        if (user?.Role === 'Quản lý') {
            items.push(
                { name: 'Quản lý sản phẩm', href: '/products', icon: Package, roles: ['Quản lý'] },
                { name: 'Báo cáo & Thống kê', href: '/reports', icon: FileText, roles: ['Quản lý'] },
            )
        }

        // Nhân viên kho
        if (user?.Role === 'Quản lý' || user?.Role === 'Nhân viên') {
            items.push(
                { name: 'Đặt hàng NCC', href: '/orders', icon: ShoppingCart, roles: ['Quản lý', 'Nhân viên'] },
                { name: 'Nhập kho', href: '/warehouse/import', icon: PackagePlus, roles: ['Quản lý', 'Nhân viên'] },
                { name: 'Xuất kho', href: '/warehouse/export', icon: PackageMinus, roles: ['Quản lý', 'Nhân viên'] },
                { name: 'Chuyển kho', href: '/warehouse/transfer', icon: RefreshCw, roles: ['Quản lý', 'Nhân viên'] },
                { name: 'Kiểm kho', href: '/warehouse/inventory', icon: ClipboardCheck, roles: ['Quản lý', 'Nhân viên'] },
                { name: 'Điều chỉnh kho', href: '/warehouse/adjustment', icon: TrendingUp, roles: ['Quản lý', 'Nhân viên'] },
                { name: 'Hủy hàng', href: '/warehouse/discard', icon: AlertTriangle, roles: ['Quản lý', 'Nhân viên'] },
            )
        }

        // Thu ngân
        if (user?.Type === 'ThuNgan') {
            items.push(
                { name: 'Bán hàng', href: '/pos', icon: ShoppingBag, roles: ['all'] },
                { name: 'Trả hàng', href: '/returns', icon: RotateCcw, roles: ['all'] },
                { name: 'Báo cáo', href: '/reports', icon: FileText, roles: ['all'] },
            )
        }

        return items
    }

    const navigation = getNavigationItems()

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Sidebar */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-4 border-b">
                        <h1 className="text-xl font-bold text-indigo-600">Quản lý kho</h1>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* User Info */}
                    <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
                        <div className="flex items-center space-x-3">
                            <div className="bg-indigo-600 rounded-full p-2">
                                <User className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{user?.Ten}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.Role}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                to={item.href}
                                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                                <item.icon className="h-5 w-5 mr-3" />
                                {item.name}
                            </Link>
                        ))}
                    </nav>

                    {/* Logout */}
                    <div className="p-4 border-t">
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="h-5 w-5 mr-3" />
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main content */}
            <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
                {/* Top bar */}
                <div className="sticky top-0 z-30 bg-white shadow-sm">
                    <div className="flex items-center justify-between h-16 px-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-md hover:bg-gray-100"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <div className="text-sm text-gray-600">
                            {new Date().toLocaleDateString('vi-VN', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <main className="p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
