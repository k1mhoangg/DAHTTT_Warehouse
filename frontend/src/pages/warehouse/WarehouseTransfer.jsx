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
    ArrowRightLeft,
    Plus,
    Trash2,
    FileText,
    AlertTriangle,
    CheckCircle,
    Scan,
    Eye,
    ArrowRight,
} from 'lucide-react'

/**
 * UC05: Chuyển kho
 * 
 * Luồng chính:
 * 1. Chọn chức năng "Chuyển kho"
 * 2. Chọn chiều chuyển: Kho thường -> Kho lỗi hoặc Kho lỗi -> Kho thường
 * 3. Chọn lô hàng và quét barcode sản phẩm cần chuyển
 * 4. Xác nhận
 * 5. Hệ thống tạo 1 Phiếu Xuất (từ kho đi) và 1 Phiếu Nhập (vào kho đến)
 * 
 * Yêu cầu phi chức năng:
 * - Đảm bảo tính toàn vẹn dữ liệu (xuất = nhập)
 */
export default function WarehouseTransfer() {
    const { toast } = useToast()

    // State
    const [warehouses, setWarehouses] = useState([])
    const [products, setProducts] = useState([])
    const [transfers, setTransfers] = useState([])
    const [sourceInventory, setSourceInventory] = useState([])
    const [loading, setLoading] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        KhoXuat: '',
        KhoNhap: '',
        MucDich: '',
        items: []
    })

    // Current item being added
    const [currentItem, setCurrentItem] = useState({
        MaSP: '',
        MaLo: '',
        MaVach: '',
        SoLuong: 0
    })

    // Barcode scanner
    const [barcodeInput, setBarcodeInput] = useState('')
    const [scanResult, setScanResult] = useState(null)

    // Validation state
    const [showValidation, setShowValidation] = useState(false)
    const [validationData, setValidationData] = useState(null)

    // Detail dialog
    const [viewingTransfer, setViewingTransfer] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)

    // Load initial data
    useEffect(() => {
        loadInitialData()
    }, [])

    // Load source inventory when source warehouse is selected
    useEffect(() => {
        if (formData.KhoXuat) {
            loadSourceInventory(formData.KhoXuat)
        }
    }, [formData.KhoXuat])

    const loadInitialData = async () => {
        try {
            setLoading(true)
            const [warehousesRes, productsRes, transfersRes] = await Promise.all([
                warehouseService.getWarehouses(),
                productService.getProducts(),
                warehouseService.getTransfers()
            ])

            const warehousesData = warehousesRes?.data?.warehouses || warehousesRes?.warehouses || []
            const productsData = productsRes?.data?.items || productsRes?.data?.products || []
            const transfersData = transfersRes?.data?.transfers || transfersRes?.transfers || []

            setWarehouses(Array.isArray(warehousesData) ? warehousesData : [])
            setProducts(Array.isArray(productsData) ? productsData : [])
            setTransfers(Array.isArray(transfersData) ? transfersData : [])

            console.log(`✓ Loaded ${warehousesData.length} warehouses, ${transfersData.length} transfers`)
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

    const loadSourceInventory = async (maKho) => {
        try {
            const response = await warehouseService.getWarehouseInventory(maKho)
            const inventoryData = response?.data?.inventory || response?.inventory || []
            setSourceInventory(inventoryData)
        } catch (error) {
            console.error('Load source inventory error:', error)
        }
    }

    // Handle barcode scan
    const handleBarcodeScan = async () => {
        if (!barcodeInput.trim()) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng nhập mã vạch',
                variant: 'destructive',
            })
            return
        }

        if (!formData.KhoXuat) {
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

            const response = await warehouseService.scanBarcodeForTransfer({
                MaVach: barcodeInput,
                MaKho: formData.KhoXuat,
            })

            const endTime = performance.now()
            const responseTime = endTime - startTime

            const resultData = response?.data || response

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

    // Add item to transfer list
    const handleAddItem = () => {
        if (!currentItem.MaSP || !currentItem.MaLo || !currentItem.SoLuong) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng điền đầy đủ thông tin',
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
            const newItems = [...formData.items]
            newItems[existingIndex].SoLuong += parseInt(currentItem.SoLuong)
            setFormData({ ...formData, items: newItems })
        } else {
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

        // Reset
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
            description: 'Đã thêm sản phẩm vào danh sách chuyển kho',
        })
    }

    // Remove item
    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index)
        setFormData({ ...formData, items: newItems })
    }

    // Validate before submit
    const handleValidate = async () => {
        if (!formData.KhoXuat || !formData.KhoNhap) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn kho xuất và kho nhập',
                variant: 'destructive',
            })
            return
        }

        if (formData.items.length === 0) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng thêm sản phẩm cần chuyển',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await warehouseService.validateTransfer(formData)
            const validationResult = response?.data || response

            setValidationData(validationResult)
            setShowValidation(true)

            if (!validationResult.valid) {
                toast({
                    title: 'Có lỗi trong phiếu chuyển',
                    description: 'Vui lòng kiểm tra và sửa lỗi',
                    variant: 'destructive',
                })
            }
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể xác thực phiếu chuyển',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Submit transfer
    const handleSubmit = async () => {
        try {
            setLoading(true)
            const response = await warehouseService.transferWarehouse(formData)
            const transferResult = response?.data || response

            // Check if any partial transfers with new batch codes
            const partialTransfers = transferResult?.transferred_items?.filter(
                item => item.transfer_type === 'partial' && item.new_MaLo !== item.MaLo
            ) || []

            let description = `Đã tạo phiếu chuyển kho ${transferResult?.phieu_chuyen_kho?.MaPhieu || ''}`

            if (partialTransfers.length > 0) {
                description += `\n\nLưu ý: ${partialTransfers.length} lô được tách ra với mã lô mới`
            }

            toast({
                title: 'Thành công',
                description: description,
            })

            // Reset form
            setFormData({
                KhoXuat: '',
                KhoNhap: '',
                MucDich: '',
                items: []
            })
            setShowValidation(false)
            setValidationData(null)

            // Reload data
            loadInitialData()
        } catch (error) {
            console.error('Transfer error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể tạo phiếu chuyển kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // View transfer detail
    const handleViewTransfer = async (maPhieu) => {
        try {
            setLoading(true)
            const response = await warehouseService.getTransfer(maPhieu)
            const transferData = response?.data || response

            setViewingTransfer(transferData)
            setShowDetailDialog(true)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải chi tiết phiếu chuyển',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Delete transfer
    const handleDeleteTransfer = async (maPhieu) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu chuyển này?\n\nLưu ý: Chỉ Quản lý mới có quyền xóa.')) return

        try {
            setLoading(true)
            await warehouseService.deleteTransfer(maPhieu)

            toast({
                title: 'Thành công',
                description: 'Đã xóa phiếu chuyển kho',
            })

            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể xóa phiếu chuyển',
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
                        <ArrowRightLeft className="h-8 w-8" />
                        Chuyển Kho (UC05)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Di chuyển hàng hóa giữa Kho thường và Kho lỗi
                    </p>
                </div>
            </div>

            {/* Transfer Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Tạo Phiếu Chuyển Kho</CardTitle>
                    <CardDescription>
                        Chọn kho và sản phẩm cần chuyển
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Warehouse Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="KhoXuat">
                                    Kho xuất <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.KhoXuat}
                                    onValueChange={(value) => setFormData({ ...formData, KhoXuat: value })}
                                    disabled={loading}
                                >
                                    <SelectTrigger id="KhoXuat">
                                        <SelectValue placeholder="Chọn kho xuất" />
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

                            <div className="flex items-center justify-center">
                                <ArrowRight className="h-8 w-8 text-muted-foreground mt-6" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="KhoNhap">
                                    Kho nhập <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.KhoNhap}
                                    onValueChange={(value) => setFormData({ ...formData, KhoNhap: value })}
                                    disabled={loading}
                                >
                                    <SelectTrigger id="KhoNhap">
                                        <SelectValue placeholder="Chọn kho nhập" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses
                                            .filter(k => k.MaKho !== formData.KhoXuat)
                                            .map((kho) => (
                                                <SelectItem key={kho.MaKho} value={kho.MaKho}>
                                                    {kho.MaKho} - {kho.Loai}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="MucDich">Mục đích chuyển</Label>
                            <Input
                                id="MucDich"
                                placeholder="Hàng lỗi, Tái phân bổ..."
                                value={formData.MucDich}
                                onChange={(e) => setFormData({ ...formData, MucDich: e.target.value })}
                            />
                        </div>

                        {/* Source Inventory Info */}
                        {formData.KhoXuat && sourceInventory.length > 0 && (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Tồn kho: {formData.KhoXuat}</AlertTitle>
                                <AlertDescription>
                                    Hiện có {sourceInventory.length} lô hàng
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Add Item Section */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h3 className="font-semibold text-lg">Thêm Sản Phẩm Chuyển Kho</h3>

                            {/* Barcode Scanner */}
                            <div className="space-y-2">
                                <Label>Quét mã vạch</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nhập hoặc quét mã vạch..."
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                handleBarcodeScan()
                                            }
                                        }}
                                        disabled={loading || !formData.KhoXuat}
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleBarcodeScan}
                                        disabled={loading || !barcodeInput || !formData.KhoXuat}
                                    >
                                        <Scan className="h-4 w-4 mr-2" />
                                        Quét
                                    </Button>
                                </div>

                                {/* Scan Result */}
                                {scanResult && (
                                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-green-900">
                                                    {scanResult.product_info?.TenSP}
                                                </p>
                                                <p className="text-sm text-green-700">
                                                    Lô: {scanResult.batch_info.MaLo} | Tồn: {scanResult.batch_info.SLTon}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Manual Input */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Mã lô</Label>
                                    <Input
                                        placeholder="Mã lô"
                                        value={currentItem.MaLo}
                                        onChange={(e) => setCurrentItem({ ...currentItem, MaLo: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Mã SP</Label>
                                    <Input
                                        placeholder="Mã sản phẩm"
                                        value={currentItem.MaSP}
                                        onChange={(e) => setCurrentItem({ ...currentItem, MaSP: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Số lượng</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Số lượng"
                                        value={currentItem.SoLuong}
                                        onChange={(e) => setCurrentItem({ ...currentItem, SoLuong: e.target.value })}
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

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormData({ KhoXuat: '', KhoNhap: '', MucDich: '', items: [] })}
                                disabled={loading}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleValidate}
                                disabled={loading || formData.items.length === 0}
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Xác thực
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || formData.items.length === 0}
                            >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                {loading ? 'Đang xử lý...' : 'Tạo Phiếu Chuyển Kho'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transfer History */}
            <Card>
                <CardHeader>
                    <CardTitle>Lịch Sử Chuyển Kho</CardTitle>
                    <CardDescription>
                        Danh sách các phiếu chuyển kho đã tạo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mã phiếu</TableHead>
                                <TableHead>Ngày tạo</TableHead>
                                <TableHead>Từ kho</TableHead>
                                <TableHead>Đến kho</TableHead>
                                <TableHead>Mục đích</TableHead>
                                <TableHead className="text-center">Số mặt hàng</TableHead>
                                <TableHead className="text-center">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transfers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        Chưa có phiếu chuyển kho nào
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transfers.map((phieu) => (
                                    <TableRow key={phieu.MaPhieu}>
                                        <TableCell className="font-mono font-semibold">{phieu.MaPhieu}</TableCell>
                                        <TableCell>
                                            {phieu.NgayTao ? new Date(phieu.NgayTao).toLocaleString('vi-VN') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{phieu.KhoXuat}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{phieu.KhoNhap}</Badge>
                                        </TableCell>
                                        <TableCell>{phieu.MucDich || '-'}</TableCell>
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
                                                    onClick={() => handleViewTransfer(phieu.MaPhieu)}
                                                    title="Xem chi tiết"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteTransfer(phieu.MaPhieu)}
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

            {/* Validation Dialog */}
            <Dialog open={showValidation} onOpenChange={setShowValidation}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Xác Thực Phiếu Chuyển Kho</DialogTitle>
                        <DialogDescription>
                            Kiểm tra thông tin trước khi chuyển kho
                        </DialogDescription>
                    </DialogHeader>

                    {validationData && (
                        <div className="space-y-4">
                            {/* Errors */}
                            {validationData.errors && validationData.errors.length > 0 && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Có lỗi</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-4">
                                            {validationData.errors.map((error, idx) => (
                                                <li key={idx}>{error}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Warnings */}
                            {validationData.warnings && validationData.warnings.length > 0 && (
                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Cảnh báo</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-4">
                                            {validationData.warnings.map((warning, idx) => (
                                                <li key={idx}>{warning}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Kho xuất</p>
                                    <p className="text-lg font-semibold">{validationData.summary?.source_warehouse}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Kho nhập</p>
                                    <p className="text-lg font-semibold">{validationData.summary?.destination_warehouse}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng số lượng</p>
                                    <p className="text-2xl font-bold">{validationData.summary?.total_quantity || 0}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sản phẩm</TableHead>
                                        <TableHead>Lô</TableHead>
                                        <TableHead>Tồn kho</TableHead>
                                        <TableHead className="text-right">Chuyển</TableHead>
                                        <TableHead>HSD</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {validationData.items?.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{item.TenSP}</TableCell>
                                            <TableCell className="font-mono">{item.MaLo}</TableCell>
                                            <TableCell>{item.SLTon}</TableCell>
                                            <TableCell className="text-right font-semibold">{item.SoLuong}</TableCell>
                                            <TableCell>{item.HSD || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowValidation(false)}>
                            Quay lại
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !validationData?.valid}
                        >
                            Xác nhận chuyển kho
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Chi tiết phiếu chuyển - {viewingTransfer?.MaPhieu}
                        </DialogTitle>
                    </DialogHeader>

                    {viewingTransfer && (
                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã phiếu</p>
                                    <p className="font-mono font-semibold">{viewingTransfer.MaPhieu}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ngày tạo</p>
                                    <p>{new Date(viewingTransfer.NgayTao).toLocaleString('vi-VN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Từ kho</p>
                                    <Badge variant="outline">{viewingTransfer.KhoXuat}</Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Đến kho</p>
                                    <Badge variant="outline">{viewingTransfer.KhoNhap}</Badge>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Mục đích</p>
                                    <p>{viewingTransfer.MucDich || '-'}</p>
                                </div>
                            </div>

                            {/* Transfer Summary */}
                            {viewingTransfer.summary && (
                                <div className="grid grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Tổng mặt hàng</p>
                                        <p className="text-2xl font-bold">{viewingTransfer.summary.total_items}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Tổng số lượng</p>
                                        <p className="text-2xl font-bold">{viewingTransfer.summary.total_quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Chuyển toàn bộ</p>
                                        <p className="text-xl font-semibold text-green-600">
                                            {viewingTransfer.summary.full_transfers}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Chuyển một phần</p>
                                        <p className="text-xl font-semibold text-orange-600">
                                            {viewingTransfer.summary.partial_transfers}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Related Receipts Info */}
                            {(viewingTransfer.phieu_xuat || viewingTransfer.phieu_nhap) && (
                                <Alert>
                                    <FileText className="h-4 w-4" />
                                    <AlertTitle>Phiếu liên quan</AlertTitle>
                                    <AlertDescription>
                                        {viewingTransfer.phieu_xuat && (
                                            <div>Phiếu xuất: <Badge variant="outline">{viewingTransfer.phieu_xuat.MaPhieu}</Badge></div>
                                        )}
                                        {viewingTransfer.phieu_nhap && (
                                            <div>Phiếu nhập: <Badge variant="outline">{viewingTransfer.phieu_nhap.MaPhieu}</Badge></div>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Items List */}
                            <div>
                                <h4 className="font-semibold mb-2">Danh sách sản phẩm đã chuyển</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Lô gốc</TableHead>
                                            <TableHead>Lô đích</TableHead>
                                            <TableHead className="text-right">Số lượng</TableHead>
                                            <TableHead>Loại</TableHead>
                                            <TableHead>Vị trí hiện tại</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingTransfer.items && viewingTransfer.items.length > 0 ? (
                                            viewingTransfer.items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                    <TableCell>{item.TenSP}</TableCell>
                                                    <TableCell className="font-mono">
                                                        {item.SourceMaLo || item.MaLo}
                                                        {item.RemainingInSource > 0 && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Còn lại: {item.RemainingInSource}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono">
                                                        {item.DestinationMaLo || item.MaLo}
                                                        {item.DestinationMaLo && item.DestinationMaLo !== item.MaLo && (
                                                            <Badge variant="secondary" className="ml-2 text-xs">
                                                                Mới
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {item.SoLuong}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.transfer_type === 'full' ? (
                                                            <Badge variant="default">
                                                                Toàn bộ
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline">
                                                                Một phần
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            {item.CurrentWarehouse || viewingTransfer.KhoNhap}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                    Không có thông tin sản phẩm
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Additional Details */}
                            {viewingTransfer.items && viewingTransfer.items.length > 0 && (
                                <div className="border rounded-lg p-4 bg-gray-50">
                                    <h4 className="font-semibold mb-2 text-sm">Chi tiết kỹ thuật</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Tổng lô ban đầu:</span>
                                            <span className="ml-2 font-mono">
                                                {new Set(viewingTransfer.items.map(i => i.SourceMaLo || i.MaLo)).size}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Tổng lô mới tạo:</span>
                                            <span className="ml-2 font-mono">
                                                {viewingTransfer.items.filter(i => i.DestinationMaLo && i.DestinationMaLo.includes('_CK')).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
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
