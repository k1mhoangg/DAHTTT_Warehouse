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
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'
import {
    PackageSearch,
    Plus,
    Trash2,
    FileText,
    AlertTriangle,
    CheckCircle,
    Barcode,
    Calendar,
    Package,
    Eye,
} from 'lucide-react'

/**
 * UC03: Nhập kho
 * 
 * Luồng chính:
 * 1. Chọn chức năng "Nhập kho"
 * 2. Chọn mục đích nhập (nhập từ nhà cung cấp, nhập do KH trả,...)
 * 3. Thêm sản phẩm, nhập số lượng
 * 4. Hệ thống yêu cầu nhập thông tin lô hàng: Số lô, NSX, HSD
 * 5. Chọn Kho nhập (Thường/Lỗi)
 * 6. Duyệt phiếu để cập nhật tồn kho
 * 
 * Yêu cầu phi chức năng:
 * - Tốc độ tạo barcode <2s trong 95% lô SP
 * - Các barcode không trùng lặp
 */
export default function WarehouseImport() {
    const { toast } = useToast()

    // State
    const [warehouses, setWarehouses] = useState([])
    const [products, setProducts] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [imports, setImports] = useState([])
    const [warehouseInventory, setWarehouseInventory] = useState([])
    const [loading, setLoading] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        MaKho: '',
        MucDich: '',
        MaThamChieu: '',
        items: []
    })

    // Current item being added
    const [currentItem, setCurrentItem] = useState({
        MaSP: '',
        SoLuong: 0,
        MaLo: '',
        NSX: '',
        HSD: ''
    })

    // Preview state
    const [showPreview, setShowPreview] = useState(false)
    const [previewData, setPreviewData] = useState(null)

    // Detail dialog
    const [viewingImport, setViewingImport] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)

    // Load initial data
    useEffect(() => {
        loadInitialData()
    }, [])

    // Load inventory when warehouse is selected
    useEffect(() => {
        if (formData.MaKho) {
            loadWarehouseInventory(formData.MaKho)
        }
    }, [formData.MaKho])

    const loadInitialData = async () => {
        try {
            setLoading(true)
            const [warehousesRes, productsRes, importsRes, suppliersRes] = await Promise.all([
                warehouseService.getWarehouses(),
                productService.getProducts(),
                warehouseService.getImports(),
                warehouseService.getSuppliersForImport()
            ])

            const warehousesData = warehousesRes?.data?.warehouses || warehousesRes?.warehouses || []
            const productsData = productsRes?.data?.items || productsRes?.data?.products || []
            const importsData = importsRes?.data?.imports || importsRes?.imports || []
            const suppliersData = suppliersRes?.data?.suppliers || suppliersRes?.suppliers || []

            setWarehouses(Array.isArray(warehousesData) ? warehousesData : [])
            setProducts(Array.isArray(productsData) ? productsData : [])
            setImports(Array.isArray(importsData) ? importsData : [])
            setSuppliers(Array.isArray(suppliersData) ? suppliersData : [])

            console.log(`✓ Loaded ${productsData.length} products, ${warehousesData.length} warehouses`)
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

    const loadWarehouseInventory = async (maKho) => {
        try {
            const response = await warehouseService.getWarehouseInventory(maKho)
            const inventoryData = response?.data?.inventory || response?.inventory || []
            setWarehouseInventory(inventoryData)
        } catch (error) {
            console.error('Load warehouse inventory error:', error)
        }
    }

    // Auto-generate batch code
    const handleGenerateBatchCode = async () => {
        if (!currentItem.MaSP) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn sản phẩm trước',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await warehouseService.generateBatchCode({ MaSP: currentItem.MaSP })
            const generatedBatch = response?.data?.MaLo || response?.MaLo

            setCurrentItem({ ...currentItem, MaLo: generatedBatch })

            toast({
                title: 'Thành công',
                description: `Đã tạo mã lô: ${generatedBatch}`,
            })
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tạo mã lô',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Validate batch code
    const handleValidateBatchCode = async (maLo) => {
        if (!currentItem.MaSP || !maLo) return

        try {
            const response = await warehouseService.validateBatchCode({
                MaSP: currentItem.MaSP,
                MaLo: maLo
            })

            if (response?.data?.exists) {
                const batchInfo = response.data.batch_info
                toast({
                    title: 'Lô hàng đã tồn tại',
                    description: `Lô ${maLo} đã có trong hệ thống. Tồn kho hiện tại: ${batchInfo.SLTon}`,
                    variant: 'default',
                })
            }
        } catch (error) {
            console.error('Validate batch error:', error)
        }
    }

    // Add item to import list
    const handleAddItem = () => {
        // Validation
        if (!currentItem.MaSP || !currentItem.SoLuong || !currentItem.MaLo) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng điền đầy đủ: Sản phẩm, Số lượng, Mã lô',
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
            SoLuong: 0,
            MaLo: '',
            NSX: '',
            HSD: ''
        })

        toast({
            title: 'Thành công',
            description: 'Đã thêm sản phẩm vào phiếu nhập',
        })
    }

    // Remove item
    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index)
        setFormData({ ...formData, items: newItems })
    }

    // Preview before submit
    const handlePreview = async () => {
        if (!formData.MaKho || formData.items.length === 0) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn kho và thêm sản phẩm',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await warehouseService.previewImport(formData)
            const previewResult = response?.data || response

            setPreviewData(previewResult)
            setShowPreview(true)

            if (!previewResult.valid) {
                toast({
                    title: 'Có lỗi trong phiếu nhập',
                    description: 'Vui lòng kiểm tra và sửa lỗi',
                    variant: 'destructive',
                })
            }
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể xem trước phiếu nhập',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Submit import
    const handleSubmit = async () => {
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
            const response = await warehouseService.importWarehouse(formData)
            const importResult = response?.data || response

            toast({
                title: 'Thành công',
                description: `Đã tạo phiếu nhập kho ${importResult?.phieu?.MaPhieu || ''}`,
            })

            // Reset form
            setFormData({
                MaKho: '',
                MucDich: '',
                MaThamChieu: '',
                items: []
            })
            setShowPreview(false)
            setPreviewData(null)

            // Reload data
            loadInitialData()
        } catch (error) {
            console.error('Import error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể tạo phiếu nhập kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // View import detail
    const handleViewImport = async (maPhieu) => {
        try {
            setLoading(true)
            const response = await warehouseService.getImport(maPhieu)
            const importData = response?.data || response

            setViewingImport(importData)
            setShowDetailDialog(true)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải chi tiết phiếu nhập',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Delete import
    const handleDeleteImport = async (maPhieu) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu nhập này?\n\nLưu ý: Chỉ Quản lý mới có quyền xóa.')) return

        try {
            setLoading(true)
            await warehouseService.deleteImport(maPhieu)

            toast({
                title: 'Thành công',
                description: 'Đã xóa phiếu nhập kho',
            })

            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể xóa phiếu nhập',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    if (loading && warehouses.length === 0) {
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
                        <PackageSearch className="h-8 w-8" />
                        Nhập Kho (UC03)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Ghi nhận hàng hóa vào kho - Tạo lô hàng và Barcode
                    </p>
                </div>
            </div>

            {/* Import Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Tạo Phiếu Nhập Kho</CardTitle>
                    <CardDescription>
                        Nhập thông tin sản phẩm, lô hàng và chọn kho nhập
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="MaKho">
                                    Kho nhập <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.MaKho}
                                    onValueChange={(value) => setFormData({ ...formData, MaKho: value })}
                                    disabled={loading}
                                >
                                    <SelectTrigger id="MaKho">
                                        <SelectValue placeholder="Chọn kho nhập" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map((kho) => (
                                            <SelectItem key={kho.MaKho} value={kho.MaKho}>
                                                {kho.MaKho} - {kho.Loai}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="MucDich">
                                    Mục đích nhập <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="MucDich"
                                    placeholder="Nhập từ NCC, Khách trả hàng..."
                                    value={formData.MucDich}
                                    onChange={(e) => setFormData({ ...formData, MucDich: e.target.value })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="MaThamChieu">Mã tham chiếu</Label>
                                <Input
                                    id="MaThamChieu"
                                    placeholder="Đơn hàng, PO..."
                                    value={formData.MaThamChieu}
                                    onChange={(e) => setFormData({ ...formData, MaThamChieu: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Current Inventory */}
                        {formData.MaKho && warehouseInventory.length > 0 && (
                            <Alert>
                                <Package className="h-4 w-4" />
                                <AlertTitle>Tồn kho hiện tại: {formData.MaKho}</AlertTitle>
                                <AlertDescription>
                                    Hiện có {warehouseInventory.length} lô hàng trong kho này
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Add Item Section */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h3 className="font-semibold text-lg">Thêm Sản Phẩm Nhập</h3>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Sản phẩm *</Label>
                                    <Select
                                        value={currentItem.MaSP}
                                        onValueChange={(value) => setCurrentItem({ ...currentItem, MaSP: value })}
                                        disabled={loading}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn sản phẩm" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map((product) => (
                                                <SelectItem key={product.MaSP} value={product.MaSP}>
                                                    {product.MaSP} - {product.TenSP}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Số lượng *</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="0"
                                        value={currentItem.SoLuong}
                                        onChange={(e) => setCurrentItem({ ...currentItem, SoLuong: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Mã lô *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="LO001"
                                            value={currentItem.MaLo}
                                            onChange={(e) => setCurrentItem({ ...currentItem, MaLo: e.target.value })}
                                            onBlur={(e) => handleValidateBatchCode(e.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={handleGenerateBatchCode}
                                            title="Tự động tạo mã lô"
                                            disabled={!currentItem.MaSP}
                                        >
                                            <Barcode className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>NSX</Label>
                                    <Input
                                        type="date"
                                        value={currentItem.NSX}
                                        onChange={(e) => setCurrentItem({ ...currentItem, NSX: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>HSD</Label>
                                    <Input
                                        type="date"
                                        value={currentItem.HSD}
                                        onChange={(e) => setCurrentItem({ ...currentItem, HSD: e.target.value })}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handleAddItem}
                                disabled={loading || !currentItem.MaSP || !currentItem.MaLo || !currentItem.SoLuong}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Thêm vào phiếu
                            </Button>
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
                                            <TableHead>NSX</TableHead>
                                            <TableHead>HSD</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                            <TableHead className="text-center">Thao tác</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formData.items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.TenSP}</TableCell>
                                                <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                <TableCell>{item.NSX || '-'}</TableCell>
                                                <TableCell>{item.HSD || '-'}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {item.SoLuong} {item.DVT}
                                                </TableCell>
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

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormData({ MaKho: '', MucDich: '', MaThamChieu: '', items: [] })}
                                disabled={loading}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePreview}
                                disabled={loading || formData.items.length === 0}
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Xem trước
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || formData.items.length === 0}
                            >
                                <PackageSearch className="h-4 w-4 mr-2" />
                                {loading ? 'Đang xử lý...' : 'Tạo Phiếu Nhập Kho'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Import History */}
            <Card>
                <CardHeader>
                    <CardTitle>Lịch Sử Nhập Kho</CardTitle>
                    <CardDescription>
                        Danh sách các phiếu nhập kho đã tạo
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
                            {imports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        Chưa có phiếu nhập kho nào
                                    </TableCell>
                                </TableRow>
                            ) : (
                                imports.map((phieu) => (
                                    <TableRow key={phieu.MaPhieu}>
                                        <TableCell className="font-mono font-semibold">{phieu.MaPhieu}</TableCell>
                                        <TableCell>
                                            {phieu.NgayTao ? new Date(phieu.NgayTao).toLocaleString('vi-VN') : '-'}
                                        </TableCell>
                                        <TableCell>{phieu.MucDich || '-'}</TableCell>
                                        <TableCell className="font-mono">{phieu.MaThamChieu || '-'}</TableCell>
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
                                                    onClick={() => handleViewImport(phieu.MaPhieu)}
                                                    title="Xem chi tiết"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteImport(phieu.MaPhieu)}
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

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Xem Trước Phiếu Nhập Kho</DialogTitle>
                        <DialogDescription>
                            Kiểm tra thông tin trước khi tạo phiếu
                        </DialogDescription>
                    </DialogHeader>

                    {previewData && (
                        <div className="space-y-4">
                            {/* Errors */}
                            {previewData.errors && previewData.errors.length > 0 && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Có lỗi</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-4">
                                            {previewData.errors.map((error, idx) => (
                                                <li key={idx}>{error}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Warnings */}
                            {previewData.warnings && previewData.warnings.length > 0 && (
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Cảnh báo</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-4">
                                            {previewData.warnings.map((warning, idx) => (
                                                <li key={idx}>{warning}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng số mặt hàng</p>
                                    <p className="text-2xl font-bold">{previewData.summary?.total_items || 0}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng số lượng</p>
                                    <p className="text-2xl font-bold">{previewData.summary?.total_quantity || 0}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Kho nhập</p>
                                    <p className="text-lg font-semibold">{previewData.summary?.warehouse?.MaKho}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>STT</TableHead>
                                        <TableHead>Sản phẩm</TableHead>
                                        <TableHead>Lô</TableHead>
                                        <TableHead className="text-right">Số lượng</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.items?.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell>{item.TenSP || item.MaSP}</TableCell>
                                            <TableCell className="font-mono">{item.MaLo}</TableCell>
                                            <TableCell className="text-right">{item.SoLuong}</TableCell>
                                            <TableCell>
                                                {item.status === 'ok' && (
                                                    <Badge variant="default">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        OK
                                                    </Badge>
                                                )}
                                                {item.status === 'warning' && (
                                                    <Badge variant="warning">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        Cảnh báo
                                                    </Badge>
                                                )}
                                                {item.status === 'error' && (
                                                    <Badge variant="destructive">
                                                        Lỗi
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPreview(false)}>
                            Quay lại
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !previewData?.valid}
                        >
                            Xác nhận tạo phiếu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Chi tiết phiếu nhập - {viewingImport?.MaPhieu}
                        </DialogTitle>
                    </DialogHeader>

                    {viewingImport && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã phiếu</p>
                                    <p className="font-mono font-semibold">{viewingImport.MaPhieu}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ngày tạo</p>
                                    <p>{new Date(viewingImport.NgayTao).toLocaleString('vi-VN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Mục đích</p>
                                    <p>{viewingImport.MucDich}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã tham chiếu</p>
                                    <p className="font-mono">{viewingImport.MaThamChieu || '-'}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Danh sách sản phẩm</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead>Barcode</TableHead>
                                            <TableHead>NSX</TableHead>
                                            <TableHead>HSD</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingImport.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.product?.TenSP || '-'}</TableCell>
                                                <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                <TableCell className="font-mono text-xs">{item.MaVach}</TableCell>
                                                <TableCell>{item.NSX || '-'}</TableCell>
                                                <TableCell>{item.HSD || '-'}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {item.SLTon}
                                                </TableCell>
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
