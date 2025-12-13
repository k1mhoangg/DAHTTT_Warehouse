import { useState, useEffect } from 'react'
import { orderService, productService } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    FileText,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Eye,
    TrendingDown,
} from 'lucide-react'

/**
 * UC02: Đặt hàng từ nhà cung cấp
 */
export default function SupplierOrders() {
    const { toast } = useToast()

    // State
    const [suppliers, setSuppliers] = useState([])
    const [products, setProducts] = useState([])
    const [orders, setOrders] = useState([])
    const [suggestions, setSuggestions] = useState([])
    const [statistics, setStatistics] = useState(null)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('create')

    // Form state
    const [formData, setFormData] = useState({
        TenNCC: '',
        MucDich: '',
        items: []
    })

    // Dialog states
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [viewingOrder, setViewingOrder] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)
    const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false)

    // Load data
    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (activeTab === 'orders') {
            loadOrders()
        } else if (activeTab === 'suggestions') {
            loadSuggestions()
        }
    }, [activeTab])

    const loadInitialData = async () => {
        try {
            setLoading(true)
            const [suppliersRes, productsRes, statsRes] = await Promise.all([
                orderService.getSuppliers(),
                productService.getProducts(),
                orderService.getOrderStatistics()
            ])

            const suppliersData = suppliersRes?.data?.suppliers || suppliersRes?.suppliers || []
            const productsData = productsRes?.data?.items || productsRes?.data?.products || []
            const statsData = statsRes?.data || statsRes || {}

            setSuppliers(Array.isArray(suppliersData) ? suppliersData : [])
            setProducts(Array.isArray(productsData) ? productsData : [])
            setStatistics(statsData)

            console.log(`✓ Loaded ${suppliersData.length} suppliers, ${productsData.length} products`)
        } catch (error) {
            console.error('Load initial data error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải dữ liệu',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadOrders = async () => {
        try {
            setLoading(true)
            const response = await orderService.getOrders()
            const ordersData = response?.data?.orders || response?.orders || []

            setOrders(Array.isArray(ordersData) ? ordersData : [])
        } catch (error) {
            console.error('Load orders error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải danh sách đơn hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadSuggestions = async () => {
        try {
            setLoading(true)
            const response = await orderService.getSuggestOrder()
            const suggestionsData = response?.data?.suggestions || response?.suggestions || []

            setSuggestions(Array.isArray(suggestionsData) ? suggestionsData : [])
        } catch (error) {
            console.error('Load suggestions error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải gợi ý đặt hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Add item to order
    const handleAddItem = (product = null) => {
        const newItem = product ? {
            MaSP: product.MaSP,
            TenSP: product.TenSP,
            DVT: product.DVT,
            GiaBan: product.GiaBan,
            SoLuongDat: product.suggested_quantity || 1,
            GhiChu: ''
        } : {
            MaSP: '',
            TenSP: '',
            DVT: '',
            GiaBan: 0,
            SoLuongDat: 1,
            GhiChu: ''
        }

        setFormData({
            ...formData,
            items: [...formData.items, newItem]
        })
    }

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index)
        setFormData({ ...formData, items: newItems })
    }

    const handleUpdateItem = (index, field, value) => {
        const newItems = [...formData.items]
        newItems[index][field] = value

        // Auto-update product info when MaSP changes
        if (field === 'MaSP') {
            const product = products.find(p => p.MaSP === value)
            if (product) {
                newItems[index].TenSP = product.TenSP
                newItems[index].DVT = product.DVT
                newItems[index].GiaBan = product.GiaBan
            }
        }

        setFormData({ ...formData, items: newItems })
    }

    const handleUpdateQuantity = (index, delta) => {
        const newItems = [...formData.items]
        newItems[index].SoLuongDat = Math.max(1, newItems[index].SoLuongDat + delta)
        setFormData({ ...formData, items: newItems })
    }

    // Submit order
    const handleSubmitOrder = async () => {
        if (!formData.TenNCC) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn nhà cung cấp',
                variant: 'destructive',
            })
            return
        }

        if (formData.items.length === 0) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng thêm ít nhất một sản phẩm',
                variant: 'destructive',
            })
            return
        }

        // Validate all items
        const invalidItems = formData.items.filter(item => !item.MaSP || !item.SoLuongDat || item.SoLuongDat <= 0)
        if (invalidItems.length > 0) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng điền đầy đủ thông tin sản phẩm và số lượng hợp lệ',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await orderService.createOrder(formData)
            const orderResult = response?.data?.order || response?.order

            toast({
                title: 'Thành công',
                description: `Đã tạo đơn hàng ${orderResult?.MaDonHang}. Chờ quản lý duyệt.`,
            })

            // Show info
            setTimeout(() => {
                alert(
                    `Đơn hàng ${orderResult?.MaDonHang} đã được tạo!\n\n` +
                    `Trạng thái: Chờ duyệt\n` +
                    `Nhà cung cấp: ${orderResult?.TenNCC}\n` +
                    `Tổng mặt hàng: ${orderResult?.total_items}\n` +
                    `Tổng số lượng: ${orderResult?.total_quantity}\n` +
                    `Tổng tiền dự kiến: ${orderResult?.total_amount?.toLocaleString('vi-VN')} VNĐ\n\n` +
                    `Sau khi được duyệt, bạn có thể nhập kho khi hàng về (UC03).`
                )
            }, 500)

            // Reset form
            setFormData({
                TenNCC: '',
                MucDich: '',
                items: []
            })
            setShowCreateDialog(false)

            // Reload data
            loadInitialData()
            if (activeTab === 'orders') {
                loadOrders()
            }
        } catch (error) {
            console.error('Create order error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể tạo đơn hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Approve order
    const handleApproveOrder = async (maDonHang) => {
        if (!confirm('Bạn có chắc chắn muốn duyệt đơn hàng này?')) return

        try {
            setLoading(true)
            await orderService.approveOrder(maDonHang)

            toast({
                title: 'Thành công',
                description: 'Đã duyệt đơn hàng',
            })

            loadOrders()
            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể duyệt đơn hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Reject order
    const handleRejectOrder = async (maDonHang) => {
        const reason = prompt('Nhập lý do từ chối:')
        if (!reason) return

        try {
            setLoading(true)
            await orderService.rejectOrder(maDonHang, reason)

            toast({
                title: 'Đã từ chối',
                description: 'Đơn hàng đã bị từ chối',
            })

            loadOrders()
            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể từ chối đơn hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // View order detail
    const handleViewOrder = async (maDonHang) => {
        try {
            setLoading(true)
            const response = await orderService.getOrder(maDonHang)
            const orderData = response?.data || response

            setViewingOrder(orderData)
            setShowDetailDialog(true)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải chi tiết đơn hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Delete order
    const handleDeleteOrder = async (maDonHang) => {
        if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này?\n\nLưu ý: Chỉ Quản lý mới có quyền xóa.')) return

        try {
            setLoading(true)
            await orderService.deleteOrder(maDonHang)

            toast({
                title: 'Thành công',
                description: 'Đã xóa đơn hàng',
            })

            loadOrders()
            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể xóa đơn hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Get status badge
    const getStatusBadge = (status) => {
        const variants = {
            'Chờ duyệt': 'warning',
            'Đã duyệt': 'default',
            'Từ chối': 'destructive'
        }

        const icons = {
            'Chờ duyệt': AlertTriangle,
            'Đã duyệt': CheckCircle,
            'Từ chối': XCircle
        }

        const Icon = icons[status] || AlertTriangle

        return (
            <Badge variant={variants[status] || 'default'}>
                <Icon className="h-3 w-3 mr-1" />
                {status}
            </Badge>
        )
    }

    if (loading && suppliers.length === 0 && products.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <ShoppingCart className="h-8 w-8" />
                        Đặt Hàng Từ Nhà Cung Cấp (UC02)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Tạo đơn đặt hàng và quản lý đơn hàng từ nhà cung cấp
                    </p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} disabled={loading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo đơn hàng
                </Button>
            </div>

            {/* Statistics */}
            {statistics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Tổng đơn hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.total}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Chờ duyệt
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{statistics.pending}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Đã duyệt
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{statistics.approved}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Từ chối
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{statistics.rejected}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2">
                <Button
                    variant={activeTab === 'orders' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('orders')}
                >
                    Danh sách đơn hàng
                </Button>
                <Button
                    variant={activeTab === 'suggestions' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('suggestions')}
                >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Gợi ý đặt hàng
                </Button>
            </div>

            {/* Create Order Tab */}


            {/* Orders List Tab */}
            {activeTab === 'orders' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Danh Sách Đơn Hàng</CardTitle>
                        <CardDescription>
                            Quản lý và theo dõi trạng thái đơn hàng
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {orders.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                Chưa có đơn hàng nào
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mã đơn</TableHead>
                                        <TableHead>Ngày đặt</TableHead>
                                        <TableHead>Nhà cung cấp</TableHead>
                                        <TableHead className="text-center">Số mặt hàng</TableHead>
                                        <TableHead className="text-right">Tổng tiền</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead className="text-center">Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => (
                                        <TableRow key={order.MaDonHang}>
                                            <TableCell className="font-mono font-semibold">
                                                {order.MaDonHang}
                                            </TableCell>
                                            <TableCell>
                                                {order.NgayDat ? new Date(order.NgayDat).toLocaleDateString('vi-VN') : '-'}
                                            </TableCell>
                                            <TableCell>{order.TenNCC}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{order.total_items}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {order.total_amount?.toLocaleString('vi-VN')} VNĐ
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(order.TrangThai)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleViewOrder(order.MaDonHang)}
                                                        title="Xem chi tiết"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                    {order.TrangThai === 'Chờ duyệt' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleApproveOrder(order.MaDonHang)}
                                                                title="Duyệt đơn"
                                                            >
                                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleRejectOrder(order.MaDonHang)}
                                                                title="Từ chối"
                                                            >
                                                                <XCircle className="h-4 w-4 text-red-600" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {order.TrangThai !== 'Đã duyệt' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleDeleteOrder(order.MaDonHang)}
                                                            title="Xóa đơn"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Gợi Ý Sản Phẩm Cần Đặt</CardTitle>
                        <CardDescription>
                            Các sản phẩm có tồn kho thấp hơn mức cảnh báo
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {suggestions.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold">Tồn kho ổn định</p>
                                <p className="text-muted-foreground">
                                    Không có sản phẩm nào cần đặt hàng gấp
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Phát hiện {suggestions.length} sản phẩm cần đặt</AlertTitle>
                                    <AlertDescription>
                                        Các sản phẩm bên dưới có tồn kho thấp hơn mức cảnh báo. Vui lòng đặt hàng sớm.
                                    </AlertDescription>
                                </Alert>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Loại</TableHead>
                                            <TableHead className="text-right">Tồn hiện tại</TableHead>
                                            <TableHead className="text-right">Mức cảnh báo</TableHead>
                                            <TableHead className="text-right">Thiếu</TableHead>
                                            <TableHead className="text-right">Gợi ý đặt</TableHead>
                                            <TableHead className="text-center">Thao tác</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {suggestions.map((product) => (
                                            <TableRow key={product.MaSP}>
                                                <TableCell className="font-mono">{product.MaSP}</TableCell>
                                                <TableCell className="font-medium">{product.TenSP}</TableCell>
                                                <TableCell>{product.LoaiSP}</TableCell>
                                                <TableCell className="text-right text-red-600 font-semibold">
                                                    {product.current_stock}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {product.warning_level}
                                                </TableCell>
                                                <TableCell className="text-right text-orange-600">
                                                    {product.shortage}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-green-600">
                                                    {product.suggested_quantity}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            handleAddItem(product)
                                                            setShowCreateDialog(true)
                                                        }}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Đặt hàng
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Create Order Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Tạo Đơn Đặt Hàng</DialogTitle>
                        <DialogDescription>
                            Điền thông tin đơn hàng và thêm sản phẩm
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="TenNCC">
                                    Nhà cung cấp <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.TenNCC}
                                    onValueChange={(value) => setFormData({ ...formData, TenNCC: value })}
                                >
                                    <SelectTrigger id="TenNCC">
                                        <SelectValue placeholder="Chọn nhà cung cấp" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.Ten} value={supplier.Ten}>
                                                {supplier.Ten}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="MucDich">Mục đích</Label>
                                <Input
                                    id="MucDich"
                                    placeholder="Đặt hàng định kỳ, Bổ sung tồn kho..."
                                    value={formData.MucDich}
                                    onChange={(e) => setFormData({ ...formData, MucDich: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-lg">Sản phẩm đặt hàng</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddItem()}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Thêm sản phẩm
                                </Button>
                            </div>

                            {formData.items.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Sản phẩm</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                            <TableHead className="text-right">Đơn giá</TableHead>
                                            <TableHead className="text-right">Thành tiền</TableHead>
                                            <TableHead>Ghi chú</TableHead>
                                            <TableHead className="text-center">Thao tác</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formData.items.map((item, index) => {
                                            const product = products.find(p => p.MaSP === item.MaSP)
                                            const giaBan = product?.GiaBan || 0
                                            const thanhTien = giaBan * (item.SoLuongDat || 0)

                                            return (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <Select
                                                            value={item.MaSP}
                                                            onValueChange={(value) => handleUpdateItem(index, 'MaSP', value)}
                                                        >
                                                            <SelectTrigger className="w-[250px]">
                                                                <SelectValue placeholder="Chọn sản phẩm" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {products.map((p) => (
                                                                    <SelectItem key={p.MaSP} value={p.MaSP}>
                                                                        {p.MaSP} - {p.TenSP}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleUpdateQuantity(index, -1)}
                                                                disabled={item.SoLuongDat <= 1}
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </Button>
                                                            <Input
                                                                type="number"
                                                                className="w-20 text-center"
                                                                value={item.SoLuongDat}
                                                                onChange={(e) =>
                                                                    handleUpdateItem(index, 'SoLuongDat', parseInt(e.target.value) || 1)
                                                                }
                                                                min="1"
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleUpdateQuantity(index, 1)}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {giaBan.toLocaleString('vi-VN')} VNĐ
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {thanhTien.toLocaleString('vi-VN')} VNĐ
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            placeholder="Ghi chú..."
                                                            value={item.GhiChu || ''}
                                                            onChange={(e) =>
                                                                handleUpdateItem(index, 'GhiChu', e.target.value)
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleRemoveItem(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}

                            {/* Summary */}
                            {formData.items.length > 0 && (
                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2 p-4 bg-gray-50 rounded-lg">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng số lượng:</span>
                                            <span className="font-semibold">
                                                {formData.items.reduce((sum, item) => sum + (item.SoLuongDat || 0), 0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tổng mặt hàng:</span>
                                            <span className="font-semibold">{formData.items.length}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                                            <span>Tổng tiền:</span>
                                            <span className="text-green-600">
                                                {formData.items.reduce((sum, item) => {
                                                    const product = products.find(p => p.MaSP === item.MaSP)
                                                    return sum + ((product?.GiaBan || 0) * (item.SoLuongDat || 0))
                                                }, 0).toLocaleString('vi-VN')} VNĐ
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Hủy
                        </Button>
                        <Button
                            onClick={handleSubmitOrder}
                            disabled={loading || formData.items.length === 0}
                        >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {loading ? 'Đang xử lý...' : 'Tạo đơn hàng'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Chi tiết đơn hàng - {viewingOrder?.MaDonHang}
                        </DialogTitle>
                    </DialogHeader>

                    {viewingOrder && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã đơn</p>
                                    <p className="font-mono font-semibold">{viewingOrder.MaDonHang}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ngày đặt</p>
                                    <p>{new Date(viewingOrder.NgayDat).toLocaleString('vi-VN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Nhà cung cấp</p>
                                    <p>{viewingOrder.TenNCC}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Trạng thái</p>
                                    {getStatusBadge(viewingOrder.TrangThai)}
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Mục đích</p>
                                    <p>{viewingOrder.MucDich || '-'}</p>
                                </div>
                                {viewingOrder.LyDoTuChoi && (
                                    <div className="col-span-2">
                                        <p className="text-sm text-muted-foreground">Lý do từ chối</p>
                                        <p className="text-red-600">{viewingOrder.LyDoTuChoi}</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Danh sách sản phẩm</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                            <TableHead className="text-right">Đơn giá</TableHead>
                                            <TableHead className="text-right">Thành tiền</TableHead>
                                            <TableHead>Ghi chú</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingOrder.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.TenSP}</TableCell>
                                                <TableCell className="text-right">{item.SoLuongDat}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.GiaBan?.toLocaleString('vi-VN')} VNĐ
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {item.ThanhTien?.toLocaleString('vi-VN')} VNĐ
                                                </TableCell>
                                                <TableCell>{item.GhiChu || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setShowDetailDialog(false)}>Đóng</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
