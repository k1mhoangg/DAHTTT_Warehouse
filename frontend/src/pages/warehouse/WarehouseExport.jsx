import { useState, useEffect } from 'react'
import { warehouseService, productService } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    PackageOpen,
    Plus,
    Trash2,
    Search,
    Scan,
    AlertTriangle,
    CheckCircle,
    XCircle,
    FileText,
    Calendar,
    Package
} from 'lucide-react'

/**
 * UC04: Xuất kho
 * 
 * Luồng chính:
 * 1. Chọn chức năng "Xuất kho"
 * 2. Chọn mục đích xuất
 * 3. Nhập tên sản phẩm
 * 4. Hệ thống hiển thị các lô đang tồn và gợi ý lô có HSD gần nhất (FEFO)
 * 5. Chọn lô và quét Barcode sản phẩm
 * 6. Duyệt phiếu để cập nhật tồn kho
 * 
 * Yêu cầu phi chức năng:
 * - Phản hồi quét barcode < 1s với 96% lô SP
 * - Thuật toán FEFO chính xác
 */
export default function WarehouseExport() {
    const { toast } = useToast()

    // State
    const [warehouses, setWarehouses] = useState([])
    const [products, setProducts] = useState([])
    const [warehouseProducts, setWarehouseProducts] = useState([]) // Sản phẩm trong kho được chọn
    const [exports, setExports] = useState([])
    const [loading, setLoading] = useState(false)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalProducts, setTotalProducts] = useState(0)
    const itemsPerPage = 10

    // Form state
    const [formData, setFormData] = useState({
        MaKho: '',
        MucDich: '',
        MaThamChieu: '',
        items: []
    })

    // Item addition state
    const [currentItem, setCurrentItem] = useState({
        MaSP: '',
        MaLo: '',
        MaVach: '',
        SoLuong: 0
    })

    // FEFO suggestions
    const [fefoBatches, setFefoBatches] = useState([])
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [showFEFODialog, setShowFEFODialog] = useState(false)

    // Barcode scanner
    const [barcodeInput, setBarcodeInput] = useState('')
    const [scanResult, setScanResult] = useState(null)
    const [showScanDialog, setShowScanDialog] = useState(false)

    // View detail
    const [viewingExport, setViewingExport] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)

    // Load initial data
    useEffect(() => {
        loadInitialData()
    }, [])

    // Load warehouse products when warehouse is selected
    useEffect(() => {
        if (formData.MaKho) {
            loadWarehouseProducts(formData.MaKho, 1)
        } else {
            setWarehouseProducts([])
            setCurrentPage(1)
            setTotalPages(1)
        }
    }, [formData.MaKho])

    const loadInitialData = async () => {
        try {
            setLoading(true)
            const [warehousesRes, productsRes, exportsRes] = await Promise.all([
                warehouseService.getWarehouses(),
                productService.getProducts(),
                warehouseService.getExports()
            ])

            console.log('Raw API responses:', {
                warehousesRes,
                productsRes,
                exportsRes
            })

            const warehousesData = warehousesRes?.data?.warehouses
                || warehousesRes?.warehouses
                || warehousesRes?.data?.items
                || warehousesRes?.data
                || warehousesRes
                || []

            const productsData = productsRes?.data?.items
                || productsRes?.data?.products
                || productsRes?.products
                || productsRes?.data
                || productsRes
                || []

            const exportsData = exportsRes?.data?.exports
                || exportsRes?.exports
                || exportsRes?.data?.items
                || exportsRes?.data
                || exportsRes
                || []

            const validWarehouses = Array.isArray(warehousesData)
                ? warehousesData.filter(w => w && w.MaKho)
                : []

            const validProducts = Array.isArray(productsData)
                ? productsData.filter(p => p && p.MaSP && p.TenSP)
                : []

            const validExports = Array.isArray(exportsData)
                ? exportsData.filter(e => e && e.MaPhieu)
                : []

            setWarehouses(validWarehouses)
            setProducts(validProducts)
            setExports(validExports)

            // Toast thông báo
            if (validWarehouses.length === 0) {
                toast({
                    title: 'Cảnh báo',
                    description: 'Không có kho nào trong hệ thống',
                    variant: 'default',
                })
            }

            console.log(`✓ Loaded ${validProducts.length} products successfully`)
        } catch (error) {
            console.error('Load initial data error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || error.message || 'Không thể tải dữ liệu',
                variant: 'destructive',
            })
            setWarehouses([])
            setProducts([])
            setExports([])
        } finally {
            setLoading(false)
        }
    }

    // Load products in selected warehouse with pagination
    const loadWarehouseProducts = async (maKho, page = 1) => {
        try {
            setLoading(true)
            const response = await warehouseService.getWarehouseInventory(maKho)

            console.log('Warehouse inventory response:', response)

            const inventoryData = response?.data?.inventory
                || response?.inventory
                || response?.data
                || response
                || []

            // Group by product and get unique products
            const productMap = new Map()

            inventoryData.forEach(batch => {
                if (batch.MaSP && batch.SLTon > 0) {
                    if (!productMap.has(batch.MaSP)) {
                        const productInfo = batch.product || products.find(p => p.MaSP === batch.MaSP)
                        if (productInfo) {
                            productMap.set(batch.MaSP, {
                                MaSP: batch.MaSP,
                                TenSP: productInfo.TenSP,
                                DVT: productInfo.DVT,
                                LoaiSP: productInfo.LoaiSP,
                                GiaBan: productInfo.GiaBan,
                                TotalStock: batch.SLTon,
                                Batches: 1
                            })
                        }
                    } else {
                        const existing = productMap.get(batch.MaSP)
                        existing.TotalStock += batch.SLTon
                        existing.Batches += 1
                    }
                }
            })

            const allProducts = Array.from(productMap.values())

            // Pagination
            const startIndex = (page - 1) * itemsPerPage
            const endIndex = startIndex + itemsPerPage
            const paginatedProducts = allProducts.slice(startIndex, endIndex)

            setWarehouseProducts(paginatedProducts)
            setTotalProducts(allProducts.length)
            setTotalPages(Math.ceil(allProducts.length / itemsPerPage))
            setCurrentPage(page)

            console.log(`✓ Loaded ${paginatedProducts.length}/${allProducts.length} products for warehouse ${maKho}`)

            if (allProducts.length === 0) {
                toast({
                    title: 'Thông báo',
                    description: `Kho ${maKho} chưa có sản phẩm nào`,
                    variant: 'default',
                })
            }
        } catch (error) {
            console.error('Load warehouse products error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải danh sách sản phẩm trong kho',
                variant: 'destructive',
            })
            setWarehouseProducts([])
        } finally {
            setLoading(false)
        }
    }

    // Handle page change
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages && formData.MaKho) {
            loadWarehouseProducts(formData.MaKho, newPage)
        }
    }

    // Handle warehouse change
    const handleWarehouseChange = (value) => {
        setFormData({ ...formData, MaKho: value })
        // Reset current item when changing warehouse
        setCurrentItem({
            MaSP: '',
            MaLo: '',
            MaVach: '',
            SoLuong: 0
        })
    }

    // UC04 Step 3 & 4: Nhập tên sản phẩm và hiển thị FEFO
    const handleProductSelect = async (maSP) => {
        if (!formData.MaKho) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn kho xuất trước',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const product = products.find(p => p.MaSP === maSP)
            setSelectedProduct(product)

            // Get FEFO batches
            const response = await warehouseService.getFEFOBatches({
                MaSP: maSP,
                MaKho: formData.MaKho,
                SoLuong: currentItem.SoLuong || 0
            })

            const batchesData = response?.data?.batches || response?.batches || response?.data || response || []

            console.log('FEFO batches:', batchesData)

            setFefoBatches(Array.isArray(batchesData) ? batchesData : [])
            setShowFEFODialog(true)

            if (batchesData.length === 0) {
                toast({
                    title: 'Không tìm thấy lô hàng',
                    description: 'Không có lô hàng khả dụng cho sản phẩm này',
                    variant: 'destructive',
                })
            }
        } catch (error) {
            console.error('Get FEFO batches error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || error.message || 'Không thể tải danh sách lô hàng',
                variant: 'destructive',
            })
            setFefoBatches([])
        } finally {
            setLoading(false)
        }
    }

    // UC04 Step 5: Quét Barcode sản phẩm
    const handleBarcodeScan = async () => {
        if (!barcodeInput.trim()) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng nhập mã vạch',
                variant: 'destructive',
            })
            return
        }

        if (!formData.MaKho) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn kho xuất trước',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const startTime = performance.now()

            const response = await warehouseService.scanBarcodeForExport({
                MaVach: barcodeInput,
                MaKho: formData.MaKho,
                MaSP: currentItem.MaSP || undefined
            })

            const endTime = performance.now()
            const responseTime = endTime - startTime

            const resultData = response?.data || response

            console.log('Barcode scan result:', resultData)

            setScanResult({
                ...resultData,
                responseTime: responseTime
            })

            // Auto-fill current item
            if (resultData?.batch_info) {
                setCurrentItem({
                    ...currentItem,
                    MaSP: resultData.batch_info.MaSP,
                    MaLo: resultData.batch_info.MaLo,
                    MaVach: resultData.batch_info.MaVach,
                    SoLuong: currentItem.SoLuong || 1
                })
            }

            // Show warnings if any
            if (resultData?.warnings && Array.isArray(resultData.warnings)) {
                const warningMessages = resultData.warnings.filter(w => w)
                if (warningMessages.length > 0) {
                    toast({
                        title: 'Cảnh báo',
                        description: warningMessages.join(', '),
                        variant: 'default',
                    })
                }
            }

            console.log(`Barcode scan response time: ${responseTime.toFixed(2)}ms`)

        } catch (error) {
            console.error('Barcode scan error:', error)
            toast({
                title: 'Lỗi quét mã vạch',
                description: error.response?.data?.message || error.message || 'Mã vạch không hợp lệ',
                variant: 'destructive',
            })
            setScanResult(null)
        } finally {
            setLoading(false)
        }
    }

    // Select batch from FEFO suggestions
    const handleSelectBatch = (batch) => {
        setCurrentItem({
            ...currentItem,
            MaSP: batch.MaSP,
            MaLo: batch.MaLo,
            MaVach: batch.MaVach,
            SoLuong: batch.suggested_quantity || currentItem.SoLuong || 0
        })
        setShowFEFODialog(false)

        toast({
            title: 'Đã chọn lô hàng',
            description: `Lô ${batch.MaLo} - HSD: ${batch.HSD || 'N/A'}`,
        })
    }

    // Add item to export list
    const handleAddItem = () => {
        // Validation
        if (!currentItem.MaSP || !currentItem.MaLo || !currentItem.SoLuong) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng điền đầy đủ thông tin sản phẩm',
                variant: 'destructive',
            })
            return
        }

        if (currentItem.SoLuong <= 0) {
            toast({
                title: 'Cảnh báo',
                description: 'Số lượng phải lớn hơn 0',
                variant: 'destructive',
            })
            return
        }

        // Check if item already exists
        const existingIndex = formData.items.findIndex(
            item => item.MaSP === currentItem.MaSP && item.MaLo === currentItem.MaLo
        )

        if (existingIndex >= 0) {
            // Update existing item
            const newItems = [...formData.items]
            newItems[existingIndex].SoLuong += parseInt(currentItem.SoLuong)
            setFormData({ ...formData, items: newItems })
        } else {
            // Add new item
            const product = products.find(p => p.MaSP === currentItem.MaSP)
            setFormData({
                ...formData,
                items: [
                    ...formData.items,
                    {
                        ...currentItem,
                        TenSP: product?.TenSP || currentItem.MaSP,
                        DVT: product?.DVT || '',
                        SoLuong: parseInt(currentItem.SoLuong)
                    }
                ]
            })
        }

        // Reset current item
        setCurrentItem({
            MaSP: '',
            MaLo: '',
            MaVach: '',
            SoLuong: 0
        })
        setBarcodeInput('')
        setScanResult(null)

        toast({
            title: 'Thành công',
            description: 'Đã thêm sản phẩm vào phiếu xuất',
        })
    }

    // Remove item from list
    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index)
        setFormData({ ...formData, items: newItems })

        toast({
            title: 'Đã xóa',
            description: 'Đã xóa sản phẩm khỏi phiếu xuất',
        })
    }

    // UC04 Step 6: Submit export
    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validation
        if (!formData.MaKho || !formData.MucDich) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng điền đầy đủ thông tin bắt buộc',
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

        try {
            setLoading(true)

            console.log('Submitting export data:', formData)

            const response = await warehouseService.exportWarehouse(formData)

            console.log('Export response:', response)

            // Handle response structure
            const responseData = response?.data || response
            const phieuData = responseData?.phieu || responseData

            toast({
                title: 'Thành công',
                description: `Đã tạo phiếu xuất kho ${phieuData?.MaPhieu || 'thành công'}`,
            })

            // Reset form
            setFormData({
                MaKho: '',
                MucDich: '',
                MaThamChieu: '',
                items: []
            })
            setCurrentItem({
                MaSP: '',
                MaLo: '',
                MaVach: '',
                SoLuong: 0
            })

            // Reload exports
            loadInitialData()
        } catch (error) {
            console.error('Export error:', error)
            console.error('Error response:', error.response)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || error.message || 'Không thể tạo phiếu xuất kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // View export detail
    const handleViewExport = async (maPhieu) => {
        try {
            setLoading(true)
            const response = await warehouseService.getExport(maPhieu)
            const exportData = response?.data || response

            console.log('Export detail:', exportData)

            setViewingExport(exportData)
            setShowDetailDialog(true)
        } catch (error) {
            console.error('Get export detail error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || error.message || 'Không thể tải chi tiết phiếu xuất',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Delete export (Manager only)
    const handleDeleteExport = async (maPhieu) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu xuất này?')) return

        try {
            setLoading(true)
            await warehouseService.deleteExport(maPhieu)

            toast({
                title: 'Thành công',
                description: 'Đã xóa phiếu xuất kho',
            })

            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể xóa phiếu xuất',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Get status badge
    const getStatusBadge = (status) => {
        const variants = {
            normal: 'default',
            warning: 'warning',
            critical: 'destructive'
        }

        const labels = {
            normal: 'Bình thường',
            warning: 'Cảnh báo',
            critical: 'Nguy hiểm'
        }

        return (
            <Badge variant={variants[status] || 'default'}>
                {labels[status] || status}
            </Badge>
        )
    }

    // Show loading state on initial load
    if (loading && warehouses.length === 0 && products.length === 0 && exports.length === 0) {
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
                        <PackageOpen className="h-8 w-8" />
                        Xuất Kho (UC04)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Ghi nhận hàng hóa xuất khỏi kho - Áp dụng FEFO (First Expired, First Out)
                    </p>
                </div>
            </div>

            {/* Export Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Tạo Phiếu Xuất Kho</CardTitle>
                    <CardDescription>
                        Thêm sản phẩm cần xuất, hệ thống sẽ gợi ý lô hàng theo FEFO
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="MaKho">
                                    Kho xuất <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.MaKho}
                                    onValueChange={handleWarehouseChange}
                                    disabled={loading}
                                >
                                    <SelectTrigger id="MaKho">
                                        <SelectValue placeholder="Chọn kho xuất" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.length === 0 ? (
                                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                                Không có kho nào
                                            </div>
                                        ) : (
                                            warehouses.map((kho) => (
                                                <SelectItem key={kho.MaKho} value={kho.MaKho}>
                                                    {kho.MaKho} - {kho.Loai}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="MucDich">
                                    Mục đích xuất <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="MucDich"
                                    placeholder="Nhập mục đích xuất (vd: Xuất bán hàng, Xuất chuyển kho...)"
                                    value={formData.MucDich}
                                    onChange={(e) =>
                                        setFormData({ ...formData, MucDich: e.target.value })
                                    }
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="MaThamChieu">Mã tham chiếu</Label>
                                <Input
                                    id="MaThamChieu"
                                    placeholder="Mã hóa đơn, đơn hàng..."
                                    value={formData.MaThamChieu}
                                    onChange={(e) =>
                                        setFormData({ ...formData, MaThamChieu: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        {/* Warehouse Products Display */}
                        {formData.MaKho && (
                            <div className="border rounded-lg p-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-lg">
                                        Sản phẩm trong kho {formData.MaKho}
                                    </h3>
                                    <Badge variant="outline">
                                        {totalProducts} sản phẩm
                                    </Badge>
                                </div>

                                {warehouseProducts.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">
                                        Kho này chưa có sản phẩm nào
                                    </p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Mã SP</TableHead>
                                                    <TableHead>Tên sản phẩm</TableHead>
                                                    <TableHead>Loại</TableHead>
                                                    <TableHead className="text-right">Tồn kho</TableHead>
                                                    <TableHead>ĐVT</TableHead>
                                                    <TableHead className="text-center">Số lô</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {warehouseProducts.map((product) => (
                                                    <TableRow key={product.MaSP}>
                                                        <TableCell className="font-mono">{product.MaSP}</TableCell>
                                                        <TableCell className="font-medium">{product.TenSP}</TableCell>
                                                        <TableCell>{product.LoaiSP}</TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {product.TotalStock}
                                                        </TableCell>
                                                        <TableCell>{product.DVT}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary">{product.Batches}</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>

                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-muted-foreground">
                                                    Trang {currentPage} / {totalPages}
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handlePageChange(currentPage - 1)}
                                                        disabled={currentPage === 1 || loading}
                                                    >
                                                        Trước
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handlePageChange(currentPage + 1)}
                                                        disabled={currentPage === totalPages || loading}
                                                    >
                                                        Sau
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Add Item Section */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h3 className="font-semibold text-lg">Thêm Sản Phẩm Xuất</h3>

                            {/* Product Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="productSelect">Sản phẩm</Label>
                                    <Select
                                        value={currentItem.MaSP}
                                        onValueChange={(value) => {
                                            console.log('Selected product:', value)
                                            setCurrentItem({ ...currentItem, MaSP: value })
                                            handleProductSelect(value)
                                        }}
                                        disabled={loading || !formData.MaKho}
                                    >
                                        <SelectTrigger id="productSelect">
                                            <SelectValue placeholder="Chọn sản phẩm" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {!formData.MaKho ? (
                                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                                    Vui lòng chọn kho trước
                                                </div>
                                            ) : warehouseProducts.length === 0 ? (
                                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                                    Không có sản phẩm nào trong kho này
                                                </div>
                                            ) : (
                                                warehouseProducts.map((product) => (
                                                    <SelectItem
                                                        key={product.MaSP}
                                                        value={product.MaSP}
                                                    >
                                                        {product.MaSP} - {product.TenSP} (Tồn: {product.TotalStock})
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {process.env.NODE_ENV === 'development' && (
                                        <p className="text-xs text-muted-foreground">
                                            Sản phẩm trong kho: {warehouseProducts.length}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="MaLo">Mã lô</Label>
                                    <Input
                                        id="MaLo"
                                        placeholder="Mã lô"
                                        value={currentItem.MaLo}
                                        onChange={(e) =>
                                            setCurrentItem({ ...currentItem, MaLo: e.target.value })
                                        }
                                        disabled={loading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="SoLuong">Số lượng</Label>
                                    <Input
                                        id="SoLuong"
                                        type="number"
                                        min="0"
                                        placeholder="Số lượng"
                                        value={currentItem.SoLuong}
                                        onChange={(e) =>
                                            setCurrentItem({
                                                ...currentItem,
                                                SoLuong: parseInt(e.target.value) || 0
                                            })
                                        }
                                        disabled={loading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="w-full"
                                        disabled={loading || !currentItem.MaSP || !currentItem.MaLo || !currentItem.SoLuong}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Thêm
                                    </Button>
                                </div>
                            </div>

                            {/* Barcode Scanner */}
                            <div className="border-t pt-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="barcode">Quét mã vạch (Barcode)</Label>
                                        <Input
                                            id="barcode"
                                            placeholder="Nhập hoặc quét mã vạch..."
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleBarcodeScan()
                                                }
                                            }}
                                            disabled={loading || !formData.MaKho}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleBarcodeScan}
                                        disabled={loading || !barcodeInput || !formData.MaKho}
                                        className="mt-6"
                                    >
                                        <Scan className="h-4 w-4 mr-2" />
                                        {loading ? 'Đang quét...' : 'Quét'}
                                    </Button>
                                </div>

                                {/* Scan Result */}
                                {scanResult && (
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-green-900">
                                                    Quét thành công - {scanResult.product_info?.TenSP}
                                                </p>
                                                <p className="text-sm text-green-700 mt-1">
                                                    Lô: {scanResult.batch_info.MaLo} |
                                                    Tồn kho: {scanResult.batch_info.SLTon} |
                                                    HSD: {scanResult.batch_info.HSD || 'N/A'}
                                                </p>
                                                {scanResult.batch_info.days_to_expiry !== null && (
                                                    <p className="text-sm text-green-700">
                                                        Còn {scanResult.batch_info.days_to_expiry} ngày đến hạn
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Thời gian phản hồi: {scanResult.responseTime?.toFixed(2)}ms
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items List */}
                        {formData.items.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead>Mã vạch</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                            <TableHead>ĐVT</TableHead>
                                            <TableHead className="text-center">Thao tác</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formData.items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.TenSP}</TableCell>
                                                <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {item.MaVach || '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {item.SoLuong}
                                                </TableCell>
                                                <TableCell>{item.DVT}</TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setFormData({
                                        MaKho: '',
                                        MucDich: '',
                                        MaThamChieu: '',
                                        items: []
                                    })
                                    setCurrentItem({
                                        MaSP: '',
                                        MaLo: '',
                                        MaVach: '',
                                        SoLuong: 0
                                    })
                                }}
                                disabled={loading}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || formData.items.length === 0}
                            >
                                <PackageOpen className="h-4 w-4 mr-2" />
                                {loading ? 'Đang xử lý...' : 'Tạo Phiếu Xuất Kho'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Export History */}
            <Card>
                <CardHeader>
                    <CardTitle>Lịch Sử Xuất Kho</CardTitle>
                    <CardDescription>
                        Danh sách các phiếu xuất kho đã tạo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mã phiếu</TableHead>
                                <TableHead>Ngày tạo</TableHead>
                                <TableHead>Mục đích</TableHead>
                                <TableHead>Mã tham chiếu</TableHead>
                                <TableHead className="text-center">Số mặt hàng</TableHead>
                                <TableHead className="text-center">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {exports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        Chưa có phiếu xuất kho nào
                                    </TableCell>
                                </TableRow>
                            ) : (
                                exports.map((phieu) => (
                                    <TableRow key={phieu.MaPhieu || phieu.id}>
                                        <TableCell className="font-mono font-semibold">
                                            {phieu.MaPhieu}
                                        </TableCell>
                                        <TableCell>
                                            {phieu.NgayTao ? new Date(phieu.NgayTao).toLocaleString('vi-VN') : '-'}
                                        </TableCell>
                                        <TableCell>{phieu.MucDich || '-'}</TableCell>
                                        <TableCell className="font-mono">
                                            {phieu.MaThamChieu || '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                {Array.isArray(phieu.items) ? phieu.items.length : 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewExport(phieu.MaPhieu)}
                                                    title="Xem chi tiết"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteExport(phieu.MaPhieu)}
                                                    title="Xóa phiếu"
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* FEFO Dialog */}
            <Dialog open={showFEFODialog} onOpenChange={setShowFEFODialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Gợi ý lô hàng FEFO - {selectedProduct?.TenSP}
                        </DialogTitle>
                        <DialogDescription>
                            Chọn lô hàng để xuất (ưu tiên lô có HSD gần nhất)
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {fefoBatches.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                Không có lô hàng khả dụng
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ưu tiên</TableHead>
                                        <TableHead>Mã lô</TableHead>
                                        <TableHead>NSX</TableHead>
                                        <TableHead>HSD</TableHead>
                                        <TableHead>Tồn kho</TableHead>
                                        <TableHead>Gợi ý SL</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead>Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fefoBatches.map((batch) => (
                                        <TableRow
                                            key={batch.MaLo}
                                            className={batch.is_expired ? 'bg-red-50' : ''}
                                        >
                                            <TableCell>
                                                <Badge variant={batch.priority === 1 ? 'default' : 'secondary'}>
                                                    #{batch.priority}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {batch.MaLo}
                                            </TableCell>
                                            <TableCell>
                                                {batch.NSX || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div>{batch.HSD || '-'}</div>
                                                    {batch.days_to_expiry !== null && (
                                                        <div className="text-xs text-muted-foreground">
                                                            ({batch.days_to_expiry} ngày)
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold">
                                                {batch.SLTon}
                                            </TableCell>
                                            <TableCell>
                                                {batch.suggested_quantity > 0 ? (
                                                    <Badge variant="outline">
                                                        {batch.suggested_quantity}
                                                    </Badge>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {batch.is_expired ? (
                                                    <Badge variant="destructive">
                                                        <XCircle className="h-3 w-3 mr-1" />
                                                        Hết hạn
                                                    </Badge>
                                                ) : (
                                                    getStatusBadge(batch.status)
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSelectBatch(batch)}
                                                    disabled={batch.is_expired}
                                                >
                                                    Chọn
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Chi tiết phiếu xuất - {viewingExport?.MaPhieu}
                        </DialogTitle>
                    </DialogHeader>

                    {viewingExport && (
                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã phiếu</p>
                                    <p className="font-mono font-semibold">{viewingExport.MaPhieu}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ngày tạo</p>
                                    <p>{new Date(viewingExport.NgayTao).toLocaleString('vi-VN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Mục đích</p>
                                    <p>{viewingExport.MucDich}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã tham chiếu</p>
                                    <p className="font-mono">{viewingExport.MaThamChieu || '-'}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="font-semibold mb-2">Danh sách sản phẩm</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead>NSX</TableHead>
                                            <TableHead>HSD</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingExport.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.TenSP}</TableCell>
                                                <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                <TableCell>{item.NSX || '-'}</TableCell>
                                                <TableCell>{item.HSD || '-'}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {item.SoLuong} {item.DVT}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
