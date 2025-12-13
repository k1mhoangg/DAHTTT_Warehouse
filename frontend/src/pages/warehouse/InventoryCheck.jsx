import { useState, useEffect } from 'react'
import { warehouseService } from '@/services/api'
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
    ClipboardCheck,
    Scan,
    Plus,
    Eye,
    FileText,
    Trash2,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Package,
} from 'lucide-react'

/**
 * UC06: Kiểm kho
 * 
 * Luồng chính:
 * 1. Chọn chức năng "Kiểm kê kho" và kho cần kiểm
 * 2. Hệ thống xuất danh sách tồn kho chi tiết theo từng lô
 * 3. NV quét mã barcode và điền số lượng thực tế kiểm tra được
 * 4. Chọn "Hoàn thành", hệ thống tính chênh lệch hiện tại
 * 
 * Yêu cầu phi chức năng:
 * - Đảm bảo dữ liệu tồn kho tại thời điểm bắt đầu chính xác để so sánh đúng
 */
export default function InventoryCheck() {
    const { toast } = useToast()

    // State
    const [warehouses, setWarehouses] = useState([])
    const [inventories, setInventories] = useState([])
    const [loading, setLoading] = useState(false)

    // Start inventory state
    const [showStartDialog, setShowStartDialog] = useState(false)
    const [startData, setStartData] = useState({
        MaKho: '',
        MucDich: ''
    })

    // Current checking state
    const [currentInventory, setCurrentInventory] = useState(null)
    const [batches, setBatches] = useState([])
    const [countedBatches, setCountedBatches] = useState({})

    // Barcode scanner
    const [barcodeInput, setBarcodeInput] = useState('')
    const [scanResult, setScanResult] = useState(null)

    // View detail
    const [viewingInventory, setViewingInventory] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)

    // Load initial data
    useEffect(() => {
        loadInitialData()
    }, [])

    const loadInitialData = async () => {
        try {
            setLoading(true)
            const [warehousesRes, inventoriesRes] = await Promise.all([
                warehouseService.getWarehouses(),
                warehouseService.getInventories()
            ])

            const warehousesData = warehousesRes?.data?.warehouses || warehousesRes?.warehouses || []
            const inventoriesData = inventoriesRes?.data?.inventories || inventoriesRes?.inventories || []

            setWarehouses(Array.isArray(warehousesData) ? warehousesData : [])
            setInventories(Array.isArray(inventoriesData) ? inventoriesData : [])

            console.log(`✓ Loaded ${warehousesData.length} warehouses, ${inventoriesData.length} inventories`)
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

    // UC06 Step 1 & 2: Start inventory check
    const handleStartInventory = async () => {
        if (!startData.MaKho) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn kho kiểm',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await warehouseService.startInventory(startData)
            const result = response?.data || response

            setCurrentInventory(result.phieu)
            setBatches(result.batches || [])
            setCountedBatches({})
            setShowStartDialog(false)

            toast({
                title: 'Thành công',
                description: `Đã bắt đầu kiểm kho ${result.phieu.MaPhieu}. Có ${result.total_batches} lô cần kiểm.`,
            })

            // Reset start dialog
            setStartData({
                MaKho: '',
                MucDich: ''
            })
        } catch (error) {
            console.error('Start inventory error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể bắt đầu kiểm kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // UC06 Step 3: Scan barcode
    const handleBarcodeScan = async () => {
        if (!barcodeInput.trim()) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng nhập mã vạch',
                variant: 'destructive',
            })
            return
        }

        if (!currentInventory) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng bắt đầu kiểm kho trước',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await warehouseService.scanBatchForInventory({
                MaVach: barcodeInput,
                MaKho: currentInventory.MaKho
            })

            const resultData = response?.data || response

            setScanResult(resultData)

            // Find the batch in list
            const batchIndex = batches.findIndex(b => b.MaVach === barcodeInput)
            if (batchIndex >= 0) {
                // Scroll to batch in table (optional)
                console.log(`Found batch at index ${batchIndex}`)
            }

            toast({
                title: 'Quét thành công',
                description: `Lô ${resultData.batch_info.MaLo} - ${resultData.product_info?.TenSP}`,
            })
        } catch (error) {
            console.error('Barcode scan error:', error)
            toast({
                title: 'Lỗi quét mã vạch',
                description: error.response?.data?.message || 'Mã vạch không hợp lệ',
                variant: 'destructive',
            })
            setScanResult(null)
        } finally {
            setLoading(false)
        }
    }

    // Update actual quantity for a batch
    const handleUpdateActualQuantity = (maLo, maVach, slThucTe) => {
        const key = `${maLo}_${maVach}`
        setCountedBatches({
            ...countedBatches,
            [key]: parseInt(slThucTe) || 0
        })
    }

    // UC06 Step 4: Complete inventory and calculate discrepancies
    const handleCompleteInventory = async () => {
        if (!currentInventory) return

        // Prepare items
        const items = batches.map(batch => {
            const key = `${batch.MaLo}_${batch.MaVach}`
            const slThucTe = countedBatches[key]

            return {
                MaSP: batch.MaSP,
                MaLo: batch.MaLo,
                MaVach: batch.MaVach,
                SLThucTe: slThucTe !== undefined ? slThucTe : batch.SLHeThong
            }
        })

        try {
            setLoading(true)
            const response = await warehouseService.recordInventory({
                MaPhieu: currentInventory.MaPhieu,
                items: items
            })

            const result = response?.data || response

            toast({
                title: 'Hoàn thành kiểm kho',
                description: `Đã kiểm ${result.total_items} lô, phát hiện ${result.total_discrepancies} lô có chênh lệch`,
            })

            // Show summary
            if (result.has_discrepancies) {
                alert(
                    `Kết quả kiểm kho:\n\n` +
                    `Tổng số lô kiểm: ${result.summary.items_checked}\n` +
                    `Lô có chênh lệch: ${result.summary.items_with_discrepancy}\n` +
                    `Tổng thừa: +${result.summary.total_surplus}\n` +
                    `Tổng thiếu: -${result.summary.total_shortage}\n\n` +
                    `Vui lòng tạo phiếu điều chỉnh để cân bằng tồn kho.`
                )
            }

            // Reset current inventory
            setCurrentInventory(null)
            setBatches([])
            setCountedBatches({})
            setScanResult(null)
            setBarcodeInput('')

            // Reload data
            loadInitialData()
        } catch (error) {
            console.error('Complete inventory error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể hoàn thành kiểm kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // View inventory detail
    const handleViewInventory = async (maPhieu) => {
        try {
            setLoading(true)
            const response = await warehouseService.getInventoryReport(maPhieu)
            const inventoryData = response?.data || response

            setViewingInventory(inventoryData)
            setShowDetailDialog(true)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải chi tiết phiếu kiểm kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Delete inventory
    const handleDeleteInventory = async (maPhieu) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phiếu kiểm kho này?\n\nLưu ý: Chỉ Quản lý mới có quyền xóa.')) return

        try {
            setLoading(true)
            await warehouseService.deleteInventory(maPhieu)

            toast({
                title: 'Thành công',
                description: 'Đã xóa phiếu kiểm kho',
            })

            loadInitialData()
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể xóa phiếu kiểm kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Cancel current inventory
    const handleCancelInventory = () => {
        if (confirm('Bạn có chắc chắn muốn hủy kiểm kho đang thực hiện?')) {
            setCurrentInventory(null)
            setBatches([])
            setCountedBatches({})
            setScanResult(null)
            setBarcodeInput('')
        }
    }

    // Calculate progress
    const getProgress = () => {
        const countedCount = Object.keys(countedBatches).length
        const totalCount = batches.length
        return totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0
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
                        <ClipboardCheck className="h-8 w-8" />
                        Kiểm Kho (UC06)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Đếm số lượng thực tế và so sánh với hệ thống
                    </p>
                </div>
                {!currentInventory && (
                    <Button onClick={() => setShowStartDialog(true)} disabled={loading}>
                        <Plus className="h-4 w-4 mr-2" />
                        Bắt đầu kiểm kho
                    </Button>
                )}
            </div>

            {/* Current Inventory Check */}
            {currentInventory && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Đang kiểm kho: {currentInventory.MaPhieu}</CardTitle>
                                <CardDescription>
                                    Kho: {currentInventory.MaKho} | Ngày: {new Date(currentInventory.NgayTao).toLocaleString('vi-VN')}
                                </CardDescription>
                            </div>
                            <Badge variant="default" className="text-lg px-4 py-2">
                                {getProgress()}% hoàn thành
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Progress Info */}
                        <Alert>
                            <Package className="h-4 w-4" />
                            <AlertTitle>Tiến độ kiểm kho</AlertTitle>
                            <AlertDescription>
                                Đã kiểm: {Object.keys(countedBatches).length}/{batches.length} lô
                            </AlertDescription>
                        </Alert>

                        {/* Barcode Scanner */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h3 className="font-semibold">Quét mã vạch để kiểm nhanh</h3>
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
                                    disabled={loading}
                                />
                                <Button
                                    type="button"
                                    onClick={handleBarcodeScan}
                                    disabled={loading || !barcodeInput}
                                >
                                    <Scan className="h-4 w-4 mr-2" />
                                    Quét
                                </Button>
                            </div>

                            {/* Scan Result */}
                            {scanResult && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="font-medium text-green-900">
                                                {scanResult.product_info?.TenSP}
                                            </p>
                                            <p className="text-sm text-green-700">
                                                Lô: {scanResult.batch_info.MaLo} |
                                                Tồn hệ thống: {scanResult.batch_info.SLTon}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Batch List */}
                        <div>
                            <h3 className="font-semibold mb-2">Danh sách lô cần kiểm</h3>
                            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10">
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead>Barcode</TableHead>
                                            <TableHead className="text-right">Hệ thống</TableHead>
                                            <TableHead className="text-right">Thực tế</TableHead>
                                            <TableHead className="text-right">Chênh lệch</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {batches.map((batch) => {
                                            const key = `${batch.MaLo}_${batch.MaVach}`
                                            const slThucTe = countedBatches[key]
                                            const chenhLech = slThucTe !== undefined ? slThucTe - batch.SLHeThong : 0

                                            return (
                                                <TableRow key={key}>
                                                    <TableCell className="font-mono">{batch.MaSP}</TableCell>
                                                    <TableCell>{batch.TenSP}</TableCell>
                                                    <TableCell className="font-mono">{batch.MaLo}</TableCell>
                                                    <TableCell className="font-mono text-xs">{batch.MaVach}</TableCell>
                                                    <TableCell className="text-right">{batch.SLHeThong}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="w-24 text-right"
                                                            placeholder="0"
                                                            value={slThucTe !== undefined ? slThucTe : ''}
                                                            onChange={(e) =>
                                                                handleUpdateActualQuantity(
                                                                    batch.MaLo,
                                                                    batch.MaVach,
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {slThucTe !== undefined && (
                                                            <Badge
                                                                variant={
                                                                    chenhLech === 0
                                                                        ? 'default'
                                                                        : chenhLech > 0
                                                                            ? 'default'
                                                                            : 'destructive'
                                                                }
                                                            >
                                                                {chenhLech > 0 && '+'}
                                                                {chenhLech}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-4">
                            <Button
                                variant="outline"
                                onClick={handleCancelInventory}
                                disabled={loading}
                            >
                                Hủy
                            </Button>
                            <Button
                                onClick={handleCompleteInventory}
                                disabled={loading}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {loading ? 'Đang xử lý...' : 'Hoàn thành kiểm kho'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Inventory History */}
            <Card>
                <CardHeader>
                    <CardTitle>Lịch Sử Kiểm Kho</CardTitle>
                    <CardDescription>
                        Danh sách các phiếu kiểm kho đã thực hiện
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mã phiếu</TableHead>
                                <TableHead>Ngày kiểm</TableHead>
                                <TableHead>Kho</TableHead>
                                <TableHead>Mục đích</TableHead>
                                <TableHead className="text-center">Số lô</TableHead>
                                <TableHead className="text-center">Chênh lệch</TableHead>
                                <TableHead className="text-center">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inventories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        Chưa có phiếu kiểm kho nào
                                    </TableCell>
                                </TableRow>
                            ) : (
                                inventories.map((phieu) => (
                                    <TableRow key={phieu.MaPhieu}>
                                        <TableCell className="font-mono font-semibold">
                                            {phieu.MaPhieu}
                                        </TableCell>
                                        <TableCell>
                                            {phieu.NgayTao ? new Date(phieu.NgayTao).toLocaleString('vi-VN') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{phieu.MaKho}</Badge>
                                        </TableCell>
                                        <TableCell>{phieu.MucDich || '-'}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">{phieu.total_items || 0}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {phieu.total_discrepancies > 0 ? (
                                                <Badge variant="destructive">
                                                    {phieu.total_discrepancies}
                                                </Badge>
                                            ) : (
                                                <Badge variant="default">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    OK
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewInventory(phieu.MaPhieu)}
                                                    title="Xem chi tiết"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteInventory(phieu.MaPhieu)}
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

            {/* Start Inventory Dialog */}
            <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bắt đầu kiểm kho</DialogTitle>
                        <DialogDescription>
                            Chọn kho cần kiểm và nhập mục đích
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Kho kiểm *</Label>
                            <Select
                                value={startData.MaKho}
                                onValueChange={(value) => setStartData({ ...startData, MaKho: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn kho" />
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
                            <Label>Mục đích</Label>
                            <Input
                                placeholder="Kiểm kê định kỳ, Kiểm kê đột xuất..."
                                value={startData.MucDich}
                                onChange={(e) => setStartData({ ...startData, MucDich: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowStartDialog(false)}>
                            Hủy
                        </Button>
                        <Button onClick={handleStartInventory} disabled={loading || !startData.MaKho}>
                            Bắt đầu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Chi tiết kiểm kho - {viewingInventory?.phieu?.MaPhieu}
                        </DialogTitle>
                    </DialogHeader>

                    {viewingInventory && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã phiếu</p>
                                    <p className="font-mono font-semibold">{viewingInventory.phieu.MaPhieu}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ngày kiểm</p>
                                    <p>{new Date(viewingInventory.phieu.NgayTao).toLocaleString('vi-VN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Kho</p>
                                    <Badge variant="outline">{viewingInventory.phieu.MaKho}</Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Mục đích</p>
                                    <p>{viewingInventory.phieu.MucDich}</p>
                                </div>
                            </div>

                            {/* Statistics */}
                            <div className="grid grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng lô kiểm</p>
                                    <p className="text-2xl font-bold">{viewingInventory.summary.total_items}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Lô có chênh lệch</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        {viewingInventory.summary.items_with_discrepancy}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng thừa</p>
                                    <p className="text-xl font-semibold text-green-600">
                                        +{viewingInventory.summary.total_surplus}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng thiếu</p>
                                    <p className="text-xl font-semibold text-red-600">
                                        -{viewingInventory.summary.total_shortage}
                                    </p>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="font-semibold mb-2">Chi tiết từng lô</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead className="text-right">Hệ thống</TableHead>
                                            <TableHead className="text-right">Thực tế</TableHead>
                                            <TableHead className="text-right">Chênh lệch</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingInventory.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.TenSP}</TableCell>
                                                <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                <TableCell className="text-right">{item.SLHeThong}</TableCell>
                                                <TableCell className="text-right">{item.SLThucTe}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.ChenhLech !== 0 ? (
                                                        <Badge
                                                            variant={item.ChenhLech > 0 ? 'default' : 'destructive'}
                                                        >
                                                            {item.ChenhLech > 0 && '+'}
                                                            {item.ChenhLech}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
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
