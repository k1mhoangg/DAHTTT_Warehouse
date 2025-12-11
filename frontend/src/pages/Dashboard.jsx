import useAuthStore from '@/store/authStore'
import { Package, TrendingUp, AlertTriangle, ShoppingCart } from 'lucide-react'

export default function Dashboard() {
    const { user } = useAuthStore()

    const stats = [
        { name: 'Tổng sản phẩm', value: '1,234', icon: Package, color: 'bg-blue-500' },
        { name: 'Tồn kho', value: '12,345', icon: TrendingUp, color: 'bg-green-500' },
        { name: 'Cảnh báo hết hàng', value: '23', icon: AlertTriangle, color: 'bg-yellow-500' },
        { name: 'Đơn hàng chờ', value: '5', icon: ShoppingCart, color: 'bg-purple-500' },
    ]

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <h1 className="text-3xl font-bold mb-2">
                    Xin chào, {user?.Ten}!
                </h1>
                <p className="text-indigo-100">
                    Chào mừng bạn đến với hệ thống quản lý kho
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.name} className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                            </div>
                            <div className={`${stat.color} rounded-full p-3`}>
                                <stat.icon className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Thao tác nhanh</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user?.Role === 'Quản lý' && (
                        <>
                            <QuickAction href="/products/new" title="Thêm sản phẩm mới" />
                            <QuickAction href="/reports" title="Xem báo cáo" />
                        </>
                    )}
                    {(user?.Role === 'Quản lý' || user?.Role === 'Nhân viên') && (
                        <>
                            <QuickAction href="/warehouse/import" title="Nhập kho" />
                            <QuickAction href="/warehouse/export" title="Xuất kho" />
                            <QuickAction href="/orders/new" title="Đặt hàng NCC" />
                        </>
                    )}
                    {user?.Type === 'ThuNgan' && (
                        <>
                            <QuickAction href="/pos" title="Bán hàng" />
                            <QuickAction href="/returns" title="Trả hàng" />
                        </>
                    )}
                </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Hoạt động gần đây</h2>
                <div className="space-y-3">
                    <ActivityItem
                        title="Nhập kho thành công"
                        description="Đã nhập 100 sản phẩm vào kho A"
                        time="10 phút trước"
                    />
                    <ActivityItem
                        title="Xuất kho"
                        description="Đã xuất 50 sản phẩm từ kho B"
                        time="1 giờ trước"
                    />
                    <ActivityItem
                        title="Đơn hàng mới"
                        description="Đơn hàng #12345 đã được tạo"
                        time="2 giờ trước"
                    />
                </div>
            </div>
        </div>
    )
}

function QuickAction({ href, title }) {
    return (
        <a
            href={href}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
        >
            <span className="text-sm font-medium text-gray-700 hover:text-indigo-600">
                {title}
            </span>
        </a>
    )
}

function ActivityItem({ title, description, time }) {
    return (
        <div className="flex items-start space-x-3 pb-3 border-b last:border-b-0">
            <div className="flex-shrink-0 w-2 h-2 mt-2 bg-indigo-600 rounded-full" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
            <p className="text-xs text-gray-400">{time}</p>
        </div>
    )
}
