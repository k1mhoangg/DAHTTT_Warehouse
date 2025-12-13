import { useState, useEffect } from 'react'
import { warehouseService } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
    Trash2,
    Plus,
    Minus,
    AlertTriangle,
    CheckCircle,
    XCircle,
    FileText,
    Eye,
    History,
} from 'lucide-react'

/**
 * UC09: Hủy hàng
 * 
 * Luồng chính:
 * 1. Chọn "Hủy hàng"
 * 2. Chọn hàng cần hủy ở kho lỗi
 * 3. Nhập số lượng và lý do
 * 4. Hệ thống tạo Phiếu Xuất Kho (mục đích: Xuất hủy hàng)
 * 
 * Yêu cầu phi chức năng:
 * - Ghi nhật ký tất cả hoạt động hủy hàng để chống gian lận
 */
export default function DiscardGoods() {
    const { toast } = useToast()

    // State
    const [errorWarehouse, setErrorWarehouse] = useState(null)
    const [inventory, setInventory] = useState([])
    const [discardHistory, setDiscardHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('discard') // 'discard' or 'history'

    // Form state
    const [formData, setFormData] = useState({
        LyDo: '',
        items: []
    })

    // Validation state
    const [showValidation, setShowValidation] = useState(false)
    const [validationData, setValidationData] = useState(null)

    // Detail dialog
    const [viewingDiscard, setViewingDiscard] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)

    // Load initial data
    useEffect(() => {
        loadData()
    }, [activeTab])

    const loadData = async () => {
        if (activeTab === 'discard') {
            await loadErrorWarehouseInventory()
        } else {
            await loadDiscardHistory()
        }
    }

    const loadErrorWarehouseInventory = async () => {
        try {
            setLoading(true)
            const response = await warehouseService.getErrorWarehouseInventory()
            const data = response?.data || response

            setErrorWarehouse(data.warehouse)
            setInventory(data.batches || [])

            console.log(`✓ Loaded ${data.batches?.length || 0} items in error warehouse`)

            if (!data.warehouse) {
                toast({
                    title: 'Cảnh báo',
                    description: 'Không tìm thấy kho lỗi',
                    variant: 'destructive',
                })
            }
        } catch (error) {
            console.error('Load error warehouse inventory error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải danh sách hàng trong kho lỗi',
                variant: 'destructive',
            })
            setInventory([])
        } finally {
            setLoading(false)
        }
    }

    const loadDiscardHistory = async () => {
        try {
            setLoading(true)
            const response = await warehouseService.getDiscardHistory()
            const data = response?.data || response

            setDiscardHistory(data.discards || [])

            console.log(`✓ Loaded ${data.discards?.length || 0} discard records`)
        } catch (error) {
            console.error('Load discard history error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải lịch sử hủy hàng',
                variant: 'destructive',
            })
            setDiscardHistory([])
        } finally {
            setLoading(false)
        }
    }

    // Add item to discard list
    const handleAddItem = (batch) => {
        const existingIndex = formData.items.findIndex(
            item => item.MaSP === batch.MaSP && item.MaLo === batch.MaLo
        )

        if (existingIndex >= 0) {
            toast({
                title: 'Thông báo',
                description: 'Sản phẩm đã có trong danh sách',
                variant: 'default',
            })
            return
        }

        setFormData({
            ...formData,
            items: [
                ...formData.items,
                {
                    MaSP: batch.MaSP,
                    TenSP: batch.TenSP,
                    DVT: batch.DVT,
                    MaLo: batch.MaLo,
                    MaVach: batch.MaVach,
                    NSX: batch.NSX,
                    HSD: batch.HSD,
                    SLTon: batch.SLTon,
                    SoLuong: 1,
                    expiry_status: batch.expiry_status
                }
            ]
        })

        toast({
            title: 'Đã thêm',
            description: `${batch.TenSP} đã được thêm vào danh sách hủy`,
        })
    }

    // Remove item from discard list
    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index)
        setFormData({ ...formData, items: newItems })
    }

    // Update quantity
    const handleUpdateQuantity = (index, newQuantity) => {
        const newItems = [...formData.items]
        const maxQuantity = newItems[index].SLTon

        if (newQuantity > maxQuantity) {
            toast({
                title: 'Cảnh báo',
                description: `Số lượng tối đa: ${maxQuantity}`,
                variant: 'destructive',
            })
            return
        }

        newItems[index].SoLuong = Math.max(1, Math.min(newQuantity, maxQuantity))
        setFormData({ ...formData, items: newItems })
    }

    // Validate before submit
    const handleValidate = async () => {
        if (!formData.LyDo || formData.LyDo.trim().length < 10) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng nhập lý do hủy hàng (tối thiểu 10 ký tự)',
                variant: 'destructive',
            })
            return
        }

        if (formData.items.length === 0) {
            toast({
                title: 'Cảnh báo',
                description: 'Vui lòng chọn ít nhất một sản phẩm để hủy',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await warehouseService.validateDiscard(formData)
            const validationResult = response?.data || response

            setValidationData(validationResult)
            setShowValidation(true)

            if (!validationResult.valid) {
                toast({
                    title: 'Có lỗi trong phiếu hủy',
                    description: 'Vui lòng kiểm tra và sửa lỗi',
                    variant: 'destructive',
                })
            }
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể xác thực phiếu hủy hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Submit discard
    const handleSubmit = async () => {
        try {
            setLoading(true)
            const response = await warehouseService.discardGoods(formData)
            const result = response?.data || response

            toast({
                title: 'Thành công',
                description: `Đã hủy ${result.total_items} lô hàng, tổng ${result.total_quantity} sản phẩm`,
            })

            // Show detailed result
            setTimeout(() => {
                alert(
                    `Phiếu xuất hủy hàng: ${result.phieu.MaPhieu}\n\n` +
                    `Tổng mặt hàng: ${result.total_items}\n` +
                    `Tổng số lượng: ${result.total_quantity}\n` +
                    `Lý do: ${result.reason}\n\n` +
                    `Nhật ký đã được ghi lại.`
                )
            }, 500)

            // Reset form
            setFormData({
                LyDo: '',
                items: []
            })
            setShowValidation(false)
            setValidationData(null)

            // Reload data
            loadData()
        } catch (error) {
            console.error('Discard error:', error)
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể hủy hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // View discard detail
    const handleViewDiscard = async (maPhieu) => {
        try {
            setLoading(true)
            const response = await warehouseService.getDiscardDetail(maPhieu)
            const discardData = response?.data || response

            setViewingDiscard(discardData)
            setShowDetailDialog(true)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải chi tiết phiếu hủy',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    // Get status badge for expiry
    const getExpiryBadge = (status) => {
        const variants = {
            expired: 'destructive',
            critical: 'destructive',
            warning: 'warning',
            normal: 'default'
        }

        const labels = {
            expired: 'Đã hết hạn',
            critical: 'Sắp hết hạn',
            warning: 'Cảnh báo',
            normal: 'Bình thường'
        }

        return (
            <Badge variant={variants[status] || 'default'}>
                {labels[status] || status}
            </Badge>
        )
    }

    if (loading && inventory.length === 0 && discardHistory.length === 0) {
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
                        <Trash2 className="h-8 w-8" />
                        Hủy Hàng (UC09)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Loại bỏ các sản phẩm hỏng, lỗi từ kho lỗi
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
                <Button
                    variant={activeTab === 'discard' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('discard')}
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hủy hàng
                </Button>
                <Button
                    variant={activeTab === 'history' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('history')}
                >
                    <History className="h-4 w-4 mr-2" />
                    Lịch sử hủy hàng
                </Button>
            </div>

            {/* Discard Tab */}
            {activeTab === 'discard' && (
                <>
                    {/* Error Warehouse Info */}
                    {errorWarehouse && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Kho lỗi: {errorWarehouse.MaKho}</AlertTitle>
                            <AlertDescription>
                                Địa chỉ: {errorWarehouse.DiaChi || 'N/A'} |
                                Tổng: {inventory.length} lô hàng
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Inventory Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Danh Sách Hàng Trong Kho Lỗi</CardTitle>
                            <CardDescription>
                                Chọn sản phẩm cần hủy từ danh sách bên dưới
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {inventory.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                    <p className="text-lg font-semibold">Kho lỗi trống</p>
                                    <p>Không có sản phẩm nào cần hủy</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mã SP</TableHead>
                                                <TableHead>Tên sản phẩm</TableHead>
                                                <TableHead>Mã lô</TableHead>
                                                <TableHead>NSX</TableHead>
                                                <TableHead>HSD</TableHead>
                                                <TableHead className="text-right">Tồn kho</TableHead>
                                                <TableHead>Trạng thái</TableHead>
                                                <TableHead className="text-center">Thao tác</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {inventory.map((batch) => (
                                                <TableRow key={`${batch.MaSP}_${batch.MaLo}`}>
                                                    <TableCell className="font-mono">{batch.MaSP}</TableCell>
                                                    <TableCell>{batch.TenSP}</TableCell>
                                                    <TableCell className="font-mono">{batch.MaLo}</TableCell>
                                                    <TableCell>{batch.NSX || '-'}</TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <div>{batch.HSD || '-'}</div>
                                                            {batch.days_to_expiry !== null && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    ({batch.is_expired ? 'Đã hết hạn' : `${batch.days_to_expiry} ngày`})
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {batch.SLTon}
                                                    </TableCell>
                                                    <TableCell>
                                                        {getExpiryBadge(batch.expiry_status)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleAddItem(batch)}
                                                            disabled={formData.items.some(
                                                                item => item.MaSP === batch.MaSP && item.MaLo === batch.MaLo
                                                            )}
                                                        >
                                                            <Plus className="h-4 w-4 mr-1" />
                                                            Chọn
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

                    {/* Discard Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Tạo Phiếu Hủy Hàng</CardTitle>
                            <CardDescription>
                                Nhập lý do và xác nhận số lượng cần hủy
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Reason */}
                            <div className="space-y-2">
                                <Label htmlFor="LyDo">
                                    Lý do hủy hàng <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="LyDo"
                                    placeholder="Nhập lý do chi tiết (tối thiểu 10 ký tự)..."
                                    value={formData.LyDo}
                                    onChange={(e) => setFormData({ ...formData, LyDo: e.target.value })}
                                    rows={3}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {formData.LyDo.length}/10 ký tự tối thiểu
                                </p>
                            </div>

                            {/* Selected Items */}
                            {formData.items.length > 0 && (
                                <div>
                                    <Label className="mb-2 block">Sản phẩm đã chọn</Label>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Sản phẩm</TableHead>
                                                    <TableHead>Lô</TableHead>
                                                    <TableHead>HSD</TableHead>
                                                    <TableHead>Tồn kho</TableHead>
                                                    <TableHead className="text-center">Số lượng hủy</TableHead>
                                                    <TableHead className="text-center">Thao tác</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formData.items.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <div>
                                                                <div className="font-medium">{item.TenSP}</div>
                                                                <div className="text-sm text-muted-foreground font-mono">
                                                                    {item.MaSP}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                        <TableCell>
                                                            <div>
                                                                <div>{item.HSD || '-'}</div>
                                                                {getExpiryBadge(item.expiry_status)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-semibold">{item.SLTon}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleUpdateQuantity(index, item.SoLuong - 1)}
                                                                    disabled={item.SoLuong <= 1}
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    className="w-20 text-center"
                                                                    value={item.SoLuong}
                                                                    onChange={(e) =>
                                                                        handleUpdateQuantity(index, parseInt(e.target.value) || 1)
                                                                    }
                                                                    min="1"
                                                                    max={item.SLTon}
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleUpdateQuantity(index, item.SoLuong + 1)}
                                                                    disabled={item.SoLuong >= item.SLTon}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleRemoveItem(index)}
                                                            >
                                                                <XCircle className="h-4 w-4 text-red-600" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Summary */}
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Tổng mặt hàng:</span>
                                                <span className="ml-2 font-semibold">{formData.items.length}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Tổng số lượng:</span>
                                                <span className="ml-2 font-semibold">
                                                    {formData.items.reduce((sum, item) => sum + item.SoLuong, 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setFormData({ LyDo: '', items: [] })}
                                    disabled={loading}
                                >
                                    Hủy
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleValidate}
                                    disabled={loading || formData.items.length === 0}
                                >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Xem trước
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading || formData.items.length === 0 || !formData.LyDo}
                                    variant="destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {loading ? 'Đang xử lý...' : 'Xác nhận hủy hàng'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Lịch Sử Hủy Hàng</CardTitle>
                        <CardDescription>
                            Nhật ký tất cả các hoạt động hủy hàng (để chống gian lận)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {discardHistory.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                Chưa có lịch sử hủy hàng
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mã phiếu</TableHead>
                                        <TableHead>Ngày hủy</TableHead>
                                        <TableHead>Lý do</TableHead>
                                        <TableHead className="text-center">Số mặt hàng</TableHead>
                                        <TableHead>Người tạo</TableHead>
                                        <TableHead className="text-center">Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {discardHistory.map((discard) => (
                                        <TableRow key={discard.MaPhieu}>
                                            <TableCell className="font-mono font-semibold">
                                                {discard.MaPhieu}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(discard.NgayTao).toLocaleString('vi-VN')}
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">
                                                {discard.MaThamChieu?.replace('Lý do: ', '')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">
                                                    {discard.items?.length || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {discard.created_by || '-'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleViewDiscard(discard.MaPhieu)}
                                                >
                                                    <FileText className="h-4 w-4" />
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

            {/* Validation Dialog */}
            <Dialog open={showValidation} onOpenChange={setShowValidation}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Xác Nhận Hủy Hàng</DialogTitle>
                        <DialogDescription>
                            Kiểm tra thông tin trước khi hủy
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
                                    <p className="text-sm text-muted-foreground">Kho</p>
                                    <p className="text-lg font-semibold">{validationData.summary?.warehouse}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng mặt hàng</p>
                                    <p className="text-2xl font-bold">{validationData.summary?.total_items}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tổng số lượng</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {validationData.summary?.total_quantity}
                                    </p>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="p-4 border rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Lý do hủy:</p>
                                <p className="font-medium">{validationData.summary?.reason}</p>
                            </div>

                            {/* Items */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sản phẩm</TableHead>
                                        <TableHead>Lô</TableHead>
                                        <TableHead>HSD</TableHead>
                                        <TableHead className="text-right">Tồn kho</TableHead>
                                        <TableHead className="text-right">Hủy</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {validationData.items?.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{item.TenSP}</TableCell>
                                            <TableCell className="font-mono">{item.MaLo}</TableCell>
                                            <TableCell>{item.HSD || '-'}</TableCell>
                                            <TableCell className="text-right">{item.SLTon}</TableCell>
                                            <TableCell className="text-right font-semibold text-red-600">
                                                {item.SoLuong}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Warning Note */}
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Cảnh báo quan trọng</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Hành động này không thể hoàn tác</li>
                                        <li>Tồn kho sẽ được cập nhật ngay lập tức</li>
                                        <li>Phiếu xuất hủy hàng sẽ được tạo tự động</li>
                                        <li>Nhật ký sẽ được ghi lại để chống gian lận</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowValidation(false)}>
                            Quay lại
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleSubmit}
                            disabled={loading || !validationData?.valid}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Xác nhận hủy hàng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Chi tiết phiếu hủy - {viewingDiscard?.MaPhieu}
                        </DialogTitle>
                    </DialogHeader>

                    {viewingDiscard && (
                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Mã phiếu</p>
                                    <p className="font-mono font-semibold">{viewingDiscard.MaPhieu}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ngày hủy</p>
                                    <p>{new Date(viewingDiscard.NgayTao).toLocaleString('vi-VN')}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Lý do</p>
                                    <p className="font-medium">{viewingDiscard.MaThamChieu?.replace('Lý do: ', '')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Người tạo</p>
                                    <p className="font-mono">{viewingDiscard.created_by || '-'}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="font-semibold mb-2">Danh sách sản phẩm đã hủy</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead>NSX</TableHead>
                                            <TableHead>HSD</TableHead>
                                            <TableHead className="text-right">Số lượng đã hủy</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingDiscard.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.MaSP}</TableCell>
                                                <TableCell>{item.TenSP}</TableCell>
                                                <TableCell className="font-mono">{item.MaLo}</TableCell>
                                                <TableCell>{item.NSX || '-'}</TableCell>
                                                <TableCell>{item.HSD || '-'}</TableCell>
                                                <TableCell className="text-right font-semibold text-red-600">
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
