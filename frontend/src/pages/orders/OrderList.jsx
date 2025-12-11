export default function OrderList() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Đơn đặt hàng</h1>
                <a href="/orders/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Tạo đơn mới
                </a>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600">UC02: Đặt hàng từ nhà cung cấp - Đang phát triển...</p>
            </div>
        </div>
    )
}
