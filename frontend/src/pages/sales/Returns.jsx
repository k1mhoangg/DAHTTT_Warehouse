import { useState, useEffect } from 'react'
import { salesService } from '@/services/api'
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    RotateCcw,
    Search,
    Receipt,
    AlertTriangle,
    CheckCircle2,
    Package,
    Calendar,
    DollarSign,
    FileText
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'

/**
 * UC10: Trả hàng (Returns)
 * 
 * Luồng chính:
 * 1. Khách hàng yêu cầu trả hàng, cung cấp hóa đơn
 * 2. Thu ngân tìm hóa đơn gốc
 * 3. Kiểm tra điều kiện trả hàng
 * 4. Chọn kho nhập (Thường/Lỗi)
 * 5. Hệ thống tính tiền cần trả
 * 6. Thu ngân hoàn tiền cho khách
 * 7. Nhân viên chuyển hàng đến kho tương ứng và cập nhật
 */
export default function Returns() {
    const { toast } = useToast()

    // States
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState(false)

    // Search invoice
    const [invoiceCode, setInvoiceCode] = useState('')
    const [searchedInvoice, setSearchedInvoice] = useState(null)

    // Return form
    const [returnForm, setReturnForm] = useState({
        ly_do: '',
        kho_nhap: 'Kho thường',
        return_policy_days: 7
    })

    // Selected items for return
    const [selectedItems, setSelectedItems] = useState([])

    // Return history
    const [returns, setReturns] = useState([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    // View detail
    const [viewingReturn, setViewingReturn] = useState(null)
    const [showDetailDialog, setShowDetailDialog] = useState(false)

    // Confirmation dialog
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)

    // Load return history on mount
    useEffect(() => {
        loadReturns()
    }, [currentPage])

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(value)
    }

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('vi-VN')
    }

    // Format datetime
    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleString('vi-VN')
    }

    // Search invoice
    const handleSearchInvoice = async () => {
        if (!invoiceCode.trim()) {
            toast({
                title: 'Thiếu thông tin',
                description: 'Vui lòng nhập mã hóa đơn',
                variant: 'destructive',
            })
            return
        }

        try {
            setLoading(true)
            const response = await salesService.searchInvoiceForReturn({
                ma_hd: invoiceCode
            })

            const invoice = response.data || response

            // Check if already returned
            if (invoice.da_tra_hang) {
                toast({
                    title: 'Hóa đơn đã trả',
                    description: 'Hóa đơn này đã được trả hàng trước đó',
                    variant: 'destructive',
                })
                setSearchedInvoice(null)
                return
            }

            // Check return policy
            if (invoice.days_since_purchase > returnForm.return_policy_days) {
                toast({
                    title: 'Quá hạn trả hàng',
                    description: `Hóa đơn đã quá ${returnForm.return_policy_days} ngày. Không thể trả hàng.`,
                    variant: 'destructive',
                })
                setSearchedInvoice(null)
                return
            }

            setSearchedInvoice(invoice)

            // Auto-select all items with max quantity
            const autoSelected = invoice.items.map(item => ({
                ...item,
                SoLuongTra: item.SoLuong,
                selected: true
            }))
            setSelectedItems(autoSelected)

            toast({
                title: 'Tìm thấy hóa đơn',
                description: `Hóa đơn ${invoice.MaHD} - ${invoice.days_since_purchase} ngày trước`,
            })

        } catch (error) {
            console.error('Search error:', error)
            toast({
                title: 'Lỗi tìm kiếm',
                description: error.response?.data?.message || 'Không tìm thấy hóa đơn',
                variant: 'destructive',
            })
            setSearchedInvoice(null)
            setSelectedItems([])
        } finally {
            setLoading(false)
        }
    }

    // Toggle item selection
    const toggleItemSelection = (index) => {
        const newItems = [...selectedItems]
        newItems[index].selected = !newItems[index].selected
        setSelectedItems(newItems)
    }

    // Update return quantity
    const updateReturnQuantity = (index, quantity) => {
        const newItems = [...selectedItems]
        const maxQty = newItems[index].SoLuong

        if (quantity < 0) quantity = 0
        if (quantity > maxQty) quantity = maxQty

        newItems[index].SoLuongTra = quantity
        setSelectedItems(newItems)
    }

    // Calculate total refund
    const calculateTotalRefund = () => {
        return selectedItems
            .filter(item => item.selected)
            .reduce((sum, item) => sum + (item.DonGia * item.SoLuongTra), 0)
    }

    // Process return
    const handleProcessReturn = async () => {
        const itemsToReturn = selectedItems.filter(item => item.selected && item.SoLuongTra > 0)

        if (itemsToReturn.length === 0) {
            toast({
                title: 'Không có sản phẩm',
                description: 'Vui lòng chọn ít nhất một sản phẩm để trả',
                variant: 'destructive',
            })
            return
        }

        if (!returnForm.ly_do.trim()) {
            toast({
                title: 'Thiếu lý do',
                description: 'Vui lòng nhập lý do trả hàng',
                variant: 'destructive',
            })
            return
        }

        try {
            setProcessing(true)

            const returnData = {
                ma_hd: searchedInvoice.MaHD,
                ly_do: returnForm.ly_do,
                kho_nhap: returnForm.kho_nhap,
                return_policy_days: returnForm.return_policy_days,
                items: itemsToReturn.map(item => ({
                    MaSP: item.MaSP,
                    MaLo: item.batch_info?.MaLo || '',
                    SoLuong: item.SoLuongTra
                }))
            }

            const response = await salesService.createReturn(returnData)
            const result = response.data || response

            toast({
                title: 'Trả hàng thành công!',
                description: `Mã yêu cầu: ${result.MaYC}. Số tiền hoàn trả: ${formatCurrency(result.TongTienHoanTra)}`,
            })

            // Reset form
            setSearchedInvoice(null)
            setSelectedItems([])
            setInvoiceCode('')
            setReturnForm({
                ...returnForm,
                ly_do: ''
            })
            setShowConfirmDialog(false)

            // Reload returns list
            loadReturns()

        } catch (error) {
            console.error('Return error:', error)
            toast({
                title: 'Lỗi trả hàng',
                description: error.response?.data?.message || 'Không thể xử lý trả hàng',
                variant: 'destructive',
            })
        } finally {
            setProcessing(false)
        }
    }

    // Load returns history
    const loadReturns = async () => {
        try {
            setLoading(true)
            const response = await salesService.getReturns({
                page: currentPage,
                per_page: 10
            })

            const data = response.data || response
            setReturns(data.items || [])
            setTotalPages(data.pages || 1)

        } catch (error) {
            console.error('Load returns error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải danh sách trả hàng',
                variant: 'destructive',
            })
            setReturns([])
        } finally {
            setLoading(false)
        }
    }

    // View return detail
    const handleViewDetail = async (maYC) => {
        try {
            const response = await salesService.getReturn(maYC)
            const returnDetail = response.data || response

            setViewingReturn(returnDetail)
            setShowDetailDialog(true)
        } catch (error) {
            console.error('Get detail error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải chi tiết trả hàng',
                variant: 'destructive',
            })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Trả Hàng</h1>
                    <p className="text-gray-500">Xử lý yêu cầu trả hàng từ khách hàng</p>
                </div>
            </div>

            <Tabs defaultValue="return" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="return">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Xử lý trả hàng
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <FileText className="h-4 w-4 mr-2" />
                        Lịch sử trả hàng
                    </TabsTrigger>
                </TabsList>

                {/* Return Processing Tab */}
                <TabsContent value="return" className="space-y-4">
                    {/* Search Invoice */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Search className="h-5 w-5 mr-2" />
                                Tìm hóa đơn
                            </CardTitle>
                            <CardDescription>
                                Nhập mã hóa đơn để bắt đầu xử lý trả hàng
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <Label>Mã hóa đơn *</Label>
                                    <Input
                                        placeholder="Nhập mã hóa đơn (VD: HD123456)"
                                        value={invoiceCode}
                                        onChange={(e) => setInvoiceCode(e.target.value.toUpperCase())}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearchInvoice()
                                            }
                                        }}
                                    />
                                </div>
                                <div className="w-48">
                                    <Label>Chính sách trả hàng</Label>
                                    <Select
                                        value={returnForm.return_policy_days.toString()}
                                        onValueChange={(value) =>
                                            setReturnForm({ ...returnForm, return_policy_days: parseInt(value) })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="7">7 ngày</SelectItem>
                                            <SelectItem value="15">15 ngày</SelectItem>
                                            <SelectItem value="30">30 ngày</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="pt-6">
                                    <Button onClick={handleSearchInvoice} disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Tìm kiếm
                                    </Button>
                                </div>
                            </div>

                            {searchedInvoice && (
                                <Alert>
                                    <CheckCircle2 className="h-4 w-4" />
                                    <AlertDescription>
                                        Tìm thấy hóa đơn: <strong>{searchedInvoice.MaHD}</strong>
                                        {' '}- Ngày mua: {formatDateTime(searchedInvoice.NgayTao)}
                                        {' '}({searchedInvoice.days_since_purchase} ngày trước)
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {/* Invoice Details & Return Form */}
                    {searchedInvoice && (
                        <>
                            {/* Invoice Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <Receipt className="h-5 w-5 mr-2" />
                                        Thông tin hóa đơn
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-600">Mã hóa đơn:</p>
                                            <p className="font-semibold font-mono">{searchedInvoice.MaHD}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Ngày mua:</p>
                                            <p className="font-semibold">{formatDateTime(searchedInvoice.NgayTao)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Thu ngân:</p>
                                            <p className="font-semibold">{searchedInvoice.ThuNgan?.Ten || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Tổng tiền gốc:</p>
                                            <p className="font-semibold text-primary">
                                                {formatCurrency(searchedInvoice.TongTien)}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Select Items for Return */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <Package className="h-5 w-5 mr-2" />
                                        Chọn sản phẩm trả hàng
                                    </CardTitle>
                                    <CardDescription>
                                        Chọn sản phẩm và số lượng cần trả
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12"></TableHead>
                                                    <TableHead>Sản phẩm</TableHead>
                                                    <TableHead className="text-center">SL mua</TableHead>
                                                    <TableHead className="text-center">SL trả</TableHead>
                                                    <TableHead className="text-right">Đơn giá</TableHead>
                                                    <TableHead className="text-right">Hoàn trả</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedItems.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <input
                                                                type="checkbox"
                                                                checked={item.selected}
                                                                onChange={() => toggleItemSelection(index)}
                                                                className="h-4 w-4"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">{item.TenSP}</p>
                                                                <p className="text-sm text-gray-500">
                                                                    {item.MaSP}
                                                                    {item.batch_info && ` - Lô: ${item.batch_info.MaLo}`}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {item.SoLuong}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                max={item.SoLuong}
                                                                value={item.SoLuongTra}
                                                                onChange={(e) =>
                                                                    updateReturnQuantity(index, parseInt(e.target.value) || 0)
                                                                }
                                                                disabled={!item.selected}
                                                                className="w-20 text-center"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(item.DonGia)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatCurrency(item.DonGia * item.SoLuongTra)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <div className="mt-4 flex justify-end">
                                        <div className="text-right">
                                            <p className="text-gray-600">Tổng tiền hoàn trả:</p>
                                            <p className="text-2xl font-bold text-primary">
                                                {formatCurrency(calculateTotalRefund())}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Return Details */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Thông tin trả hàng</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label>Lý do trả hàng *</Label>
                                        <Textarea
                                            placeholder="Nhập lý do trả hàng (VD: Sản phẩm lỗi, không đúng mô tả...)"
                                            value={returnForm.ly_do}
                                            onChange={(e) =>
                                                setReturnForm({ ...returnForm, ly_do: e.target.value })
                                            }
                                            rows={3}
                                        />
                                    </div>

                                    <div>
                                        <Label>Kho nhập</Label>
                                        <Select
                                            value={returnForm.kho_nhap}
                                            onValueChange={(value) =>
                                                setReturnForm({ ...returnForm, kho_nhap: value })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Kho thường">
                                                    Kho thường (Hàng tốt)
                                                </SelectItem>
                                                <SelectItem value="Kho lỗi">
                                                    Kho lỗi (Hàng lỗi/hỏng)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Chọn kho phù hợp dựa trên tình trạng sản phẩm
                                        </p>
                                    </div>

                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>
                                            Hệ thống sẽ tự động tạo Phiếu Nhập Kho và cập nhật tồn kho sau khi xử lý.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSearchedInvoice(null)
                                                setSelectedItems([])
                                                setInvoiceCode('')
                                            }}
                                        >
                                            Hủy
                                        </Button>
                                        <Button
                                            onClick={() => setShowConfirmDialog(true)}
                                            disabled={calculateTotalRefund() === 0 || !returnForm.ly_do.trim()}
                                        >
                                            <DollarSign className="h-4 w-4 mr-2" />
                                            Xác nhận trả hàng
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* Returns History Tab - Continue in next response */}
                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Lịch sử trả hàng</CardTitle>
                            <CardDescription>
                                Danh sách các yêu cầu trả hàng đã xử lý
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">Đang tải...</p>
                                </div>
                            ) : returns.length === 0 ? (
                                <div className="text-center py-8">
                                    <RotateCcw className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-gray-500">Chưa có yêu cầu trả hàng nào</p>
                                </div>
                            ) : (
                                <>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Mã YC</TableHead>
                                                    <TableHead>Mã HĐ</TableHead>
                                                    <TableHead>Ngày tạo</TableHead>
                                                    <TableHead>Thu ngân</TableHead>
                                                    <TableHead className="text-right">Số tiền hoàn</TableHead>
                                                    <TableHead></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {returns.map((returnItem) => (
                                                    <TableRow key={returnItem.MaYC}>
                                                        <TableCell className="font-mono">
                                                            {returnItem.MaYC}
                                                        </TableCell>
                                                        <TableCell className="font-mono">
                                                            {returnItem.MaHD || 'N/A'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {formatDateTime(returnItem.NgayTao)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {returnItem.ThuNgan || 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatCurrency(returnItem.TongTienHoanTra || 0)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleViewDetail(returnItem.MaYC)}
                                                            >
                                                                Xem
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Trang trước
                                            </Button>
                                            <span className="text-sm text-gray-600">
                                                Trang {currentPage} / {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                Trang sau
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận trả hàng</DialogTitle>
                        <DialogDescription>
                            Vui lòng kiểm tra thông tin trước khi xác nhận
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="border rounded-lg p-4">
                            <h4 className="font-medium mb-2">Thông tin trả hàng</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Mã hóa đơn:</span>
                                    <span className="font-medium font-mono">{searchedInvoice?.MaHD}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Số sản phẩm trả:</span>
                                    <span className="font-medium">
                                        {selectedItems.filter(i => i.selected).length} sản phẩm
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Kho nhập:</span>
                                    <span className="font-medium">{returnForm.kho_nhap}</span>
                                </div>
                                <div className="flex justify-between text-lg pt-2 border-t">
                                    <span className="font-semibold">Tổng hoàn trả:</span>
                                    <span className="font-bold text-primary">
                                        {formatCurrency(calculateTotalRefund())}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>
                                Sau khi xác nhận, hệ thống sẽ tự động tạo Phiếu Nhập Kho và hoàn tiền cho khách hàng.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmDialog(false)}
                            disabled={processing}
                        >
                            Hủy
                        </Button>
                        <Button onClick={handleProcessReturn} disabled={processing}>
                            {processing ? 'Đang xử lý...' : 'Xác nhận trả hàng'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Chi tiết trả hàng</DialogTitle>
                        <DialogDescription>
                            Mã yêu cầu: {viewingReturn?.MaYC}
                        </DialogDescription>
                    </DialogHeader>

                    {viewingReturn && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Mã hóa đơn:</p>
                                    <p className="font-semibold font-mono">{viewingReturn.MaHD}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Ngày trả:</p>
                                    <p className="font-semibold">{formatDateTime(viewingReturn.NgayTao)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Người xử lý:</p>
                                    <p className="font-semibold">{viewingReturn.NguoiXuLy?.Ten || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Mã phiếu nhập:</p>
                                    <p className="font-semibold font-mono">{viewingReturn.MaPhieuNK || 'N/A'}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-gray-600 mb-1">Lý do:</p>
                                <p className="border rounded p-2 bg-gray-50">{viewingReturn.LyDo || 'N/A'}</p>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Sản phẩm</TableHead>
                                            <TableHead className="text-center">SL</TableHead>
                                            <TableHead className="text-right">Đơn giá</TableHead>
                                            <TableHead className="text-right">Thành tiền</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingReturn.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{item.TenSP}</p>
                                                        <p className="text-sm text-gray-500">{item.MaSP}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">{item.SoLuong}</TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(item.DonGia)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(item.ThanhTien)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-between items-center text-lg border-t pt-4">
                                <span className="font-semibold">Tổng hoàn trả:</span>
                                <span className="font-bold text-primary text-2xl">
                                    {formatCurrency(viewingReturn.TongTienHoanTra)}
                                </span>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                            Đóng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
