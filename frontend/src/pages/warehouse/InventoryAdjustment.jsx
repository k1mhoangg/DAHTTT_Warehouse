import { useState, useEffect } from 'react'
import { warehouseService } from '@/services/api'
import { Button } from '@/components/ui/button'
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
    Settings,
    FileText,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    AlertTriangle,
    Eye,
    History,
} from 'lucide-react'

/**
 * UC07: Điều chỉnh kho
 * 
 * Luồng chính:
 * 1. Mở Phiếu Kiểm kê có chênh lệch cần điều chỉnh
 * 2. Chọn "Tạo phiếu điều chỉnh"
 * 3. Hệ thống tạo phiếu xuất cho lô hàng bị thiếu và phiếu nhập cho lô hàng bị thừa
 * 4. Duyệt các phiếu để cập nhật tồn kho
 * 
 * Yêu cầu phi chức năng:
 * - Đảm bảo tính toàn vẹn dữ liệu
 * - Ghi lại nhật ký sửa đổi
 * - Thời gian xử lý phiếu nhanh
 */
export default function InventoryAdjustment() {
    const { toast } = useToast()

    // State
    const [inventories, setInventories] = useState([])
    const [adjustmentHistory, setAdjustmentHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'history'

    // Preview state
    const [showPreview, setShowPreview] = useState(false)
    const [previewData, setPreviewData] = useState(null)
    const [selectedInventory, setSelectedInventory] = useState(null)

    // Load initial data
    useEffect(() => {
        loadData()
    }, [activeTab])

    const loadData = async () => {
        if (activeTab === 'pending') {
            await loadAdjustableInventories()
        } else {
            await loadAdjustmentHistory()
        }
    }

    const loadAdjustableInventories = async () => {
        try {
            setLoading(true)
            const response = await warehouseService.getAdjustableInventories()
            const inventoriesData = response?.data?.inventories || response?.inventories || []

            setInventories(Array.isArray(inventoriesData) ? inventoriesData : [])

            console.log(`✓ Loaded ${inventoriesData.length} adjustable inventories`)
        } catch (error) {
            console.error('Load adjustable inventories error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải danh sách phiếu kiểm kho',
                variant: 'destructive',
            })
            setInventories([])
        } finally {
            setLoading(false)
        }
    }

    const loadAdjustmentHistory = async () => {
        try {
            setLoading(true)
            const response = await warehouseService.getAdjustmentHistory()
            const historyData = response?.data?.adjustments || response?.adjustments || []

            setAdjustmentHistory(Array.isArray(historyData) ? historyData : [])

            console.log(`✓ Loaded ${historyData.length} adjustment records`)
        } catch (error) {
            console.error('Load adjustment history error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải lịch sử điều chỉnh',
                variant: 'destructive',
            })
            setAdjustmentHistory([])
        } finally {
            setLoading(false)
        }
    }

    // UC07 Step 1 & 2: Preview adjustment
    const handlePreviewAdjustment = async (inventory) => {
        try {
            setLoading(true)
            setSelectedInventory(inventory)

            const response = await warehouseService.previewAdjustment({
                MaPhieuKiem: inventory.MaPhieu
            })

            const previewResult = response?.data || response

            setPreviewData(previewResult)
            setShowPreview(true)

            if (previewResult.total_adjustments === 0) {
                toast({
                    title: 'Thông báo',
                    description: 'Không có chênh lệch nào cần điều chỉnh',
                    variant: 'default',
                })
            }
        } catch (error) {
            console.error('Preview adjustment error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể xem trước điều chỉnh',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // UC07 Step 3 & 4: Execute adjustment
    const handleExecuteAdjustment = async () => {
        if (!selectedInventory) return

        if (!confirm(
            `Bạn có chắc chắn muốn điều chỉnh tồn kho?\n\n` +
            `Hành động này sẽ tạo:\n` +
            `- ${previewData?.import_receipts?.length || 0} phiếu nhập (tăng tồn kho)\n` +
            `- ${previewData?.export_receipts?.length || 0} phiếu xuất (giảm tồn kho)\n\n` +
            `Tồn kho sẽ được cập nhật ngay lập tức.`
        )) return

        try {
            setLoading(true)

            const response = await warehouseService.adjustInventory({
                MaPhieuKiem: selectedInventory.MaPhieu
            })

            const adjustmentResult = response?.data || response

            toast({
                title: 'Điều chỉnh thành công',
                description: `Đã tạo ${adjustmentResult.total_adjustments} phiếu điều chỉnh`,
            })

            // Show detailed result
            if (adjustmentResult.summary) {
                const summary = adjustmentResult.summary
                setTimeout(() => {
                    alert(
                        `Kết quả điều chỉnh kho:\n\n` +
                        `Phiếu nhập: ${summary.import_receipts}\n` +
                        `Phiếu xuất: ${summary.export_receipts}\n` +
                        `Tổng tăng: +${summary.total_increase}\n` +
                        `Tổng giảm: -${summary.total_decrease}\n\n` +
                        `Tồn kho đã được cập nhật.`
                    )
                }, 500)
            }

            // Close dialog and reload
            setShowPreview(false)
            setSelectedInventory(null)
            setPreviewData(null)
            loadData()
        } catch (error) {
            console.error('Execute adjustment error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể thực hiện điều chỉnh',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    if (loading && inventories.length === 0 && adjustmentHistory.length === 0) {
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
                        <Settings className="h-8 w-8" />
                        Điều Chỉnh Kho (UC07)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Tạo phiếu điều chỉnh dựa trên kết quả kiểm kho
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
                <Button
                    variant={activeTab === 'pending' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('pending')}
                >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Cần điều chỉnh
                </Button>
                <Button
                    variant={activeTab === 'history' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('history')}
                >
                    <History className="h-4 w-4 mr-2" />
                    Lịch sử điều chỉnh
                </Button>
            </div>

            {/* Pending Adjustments */}
            {activeTab === 'pending' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Phiếu Kiểm Kho Cần Điều Chỉnh</CardTitle>
                        <CardDescription>
                            Các phiếu kiểm kho có chênh lệch giữa hệ thống và thực tế
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {inventories.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold">Không có phiếu nào cần điều chỉnh</p>
                                <p className="text-muted-foreground">
                                    Tất cả phiếu kiểm kho đều khớp với thực tế
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mã phiếu kiểm</TableHead>
                                        <TableHead>Ngày kiểm</TableHead>
                                        <TableHead>Kho</TableHead>
                                        <TableHead>Mục đích</TableHead>
                                        <TableHead className="text-center">Số lô chênh lệch</TableHead>
                                        <TableHead className="text-center">Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventories.map((inventory) => (
                                        <TableRow key={inventory.MaPhieu}>
                                            <TableCell className="font-mono font-semibold">
                                                {inventory.MaPhieu}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(inventory.NgayTao).toLocaleString('vi-VN')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{inventory.MaKho}</Badge>
                                            </TableCell>
                                            <TableCell>{inventory.MucDich || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="destructive">
                                                    {inventory.total_discrepancies}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handlePreviewAdjustment(inventory)}
                                                    disabled={loading}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Xem & Điều chỉnh
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Adjustment History */}
            {activeTab === 'history' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Lịch Sử Điều Chỉnh</CardTitle>
                        <CardDescription>
                            Các lần điều chỉnh kho đã thực hiện
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {adjustmentHistory.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                Chưa có lịch sử điều chỉnh nào
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mã phiếu kiểm</TableHead>
                                        <TableHead>Ngày điều chỉnh</TableHead>
                                        <TableHead className="text-center">Phiếu nhập</TableHead>
                                        <TableHead className="text-center">Phiếu xuất</TableHead>
                                        <TableHead className="text-center">Tổng điều chỉnh</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {adjustmentHistory.map((adjustment, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-mono">
                                                {adjustment.MaPhieuKiem}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(adjustment.NgayDieuChinh).toLocaleString('vi-VN')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="default">
                                                    {adjustment.phieu_nhap?.length || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">
                                                    {adjustment.phieu_xuat?.length || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">
                                                    {(adjustment.phieu_nhap?.length || 0) + (adjustment.phieu_xuat?.length || 0)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Preview & Execute Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Xem trước điều chỉnh - {selectedInventory?.MaPhieu}
                        </DialogTitle>
                        <DialogDescription>
                            Kiểm tra các phiếu sẽ được tạo để điều chỉnh tồn kho
                        </DialogDescription>
                    </DialogHeader>

                    {previewData && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng điều chỉnh</p>
                                    <p className="text-2xl font-bold">{previewData.total_adjustments}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng tăng</p>
                                    <p className="text-xl font-semibold text-green-600">
                                        +{previewData.summary?.total_increase || 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng giảm</p>
                                    <p className="text-xl font-semibold text-red-600">
                                        -{previewData.summary?.total_decrease || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Import Receipts (Increase) */}
                            {previewData.import_receipts && previewData.import_receipts.length > 0 && (
                                <div>
                                    <Alert className="mb-4">
                                        <TrendingUp className="h-4 w-4" />
                                        <AlertTitle>Phiếu Nhập (Tăng Tồn Kho)</AlertTitle>
                                        <AlertDescription>
                                            Sẽ tạo {previewData.import_receipts.length} phiếu nhập cho các lô bị thừa
                                        </AlertDescription>
                                    </Alert>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mã SP</TableHead>
                                                <TableHead>Tên sản phẩm</TableHead>
                                                <TableHead>Mã lô</TableHead>
                                                <TableHead className="text-right">Hệ thống</TableHead>
                                                <TableHead className="text-right">Thực tế</TableHead>
                                                <TableHead className="text-right">Tăng</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.import_receipts.map((item, index) => (
                                                <TableRow key={index} className="bg-green-50">
                                                    <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                    <TableCell>{item.TenSP}</TableCell>
                                                    <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                    <TableCell className="text-right">{item.SLHeThong}</TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {item.SLThucTe}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="default">
                                                            +{item.SoLuong}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Export Receipts (Decrease) */}
                            {previewData.export_receipts && previewData.export_receipts.length > 0 && (
                                <div>
                                    <Alert className="mb-4">
                                        <TrendingDown className="h-4 w-4" />
                                        <AlertTitle>Phiếu Xuất (Giảm Tồn Kho)</AlertTitle>
                                        <AlertDescription>
                                            Sẽ tạo {previewData.export_receipts.length} phiếu xuất cho các lô bị thiếu
                                        </AlertDescription>
                                    </Alert>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mã SP</TableHead>
                                                <TableHead>Tên sản phẩm</TableHead>
                                                <TableHead>Mã lô</TableHead>
                                                <TableHead className="text-right">Hệ thống</TableHead>
                                                <TableHead className="text-right">Thực tế</TableHead>
                                                <TableHead className="text-right">Giảm</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.export_receipts.map((item, index) => (
                                                <TableRow key={index} className="bg-red-50">
                                                    <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                    <TableCell>{item.TenSP}</TableCell>
                                                    <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                    <TableCell className="text-right">{item.SLHeThong}</TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {item.SLThucTe}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="destructive">
                                                            -{item.SoLuong}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Warning */}
                            <Alert variant="default">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Lưu ý quan trọng</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Tồn kho sẽ được cập nhật ngay sau khi xác nhận</li>
                                        <li>Các phiếu điều chỉnh sẽ được tạo tự động</li>
                                        <li>Thao tác này không thể hoàn tác</li>
                                        <li>Nhật ký sửa đổi sẽ được ghi lại đầy đủ</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowPreview(false)
                                setSelectedInventory(null)
                                setPreviewData(null)
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleExecuteAdjustment}
                            disabled={loading || !previewData || previewData.total_adjustments === 0}
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {loading ? 'Đang xử lý...' : 'Xác nhận điều chỉnh'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
