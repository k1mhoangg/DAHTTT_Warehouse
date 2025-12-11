export default function ProductList() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
                <a
                    href="/products/new"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Thêm sản phẩm
                </a>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600">UC01: Quản lý danh mục sản phẩm - Đang phát triển...</p>
                <p className="text-sm text-gray-500 mt-2">
                    Chức năng: Thêm, sửa, xóa sản phẩm. Quản lý theo lô hàng.
                </p>
            </div>
        </div>
    )
}
