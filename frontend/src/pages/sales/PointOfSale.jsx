import { useState, useEffect, useRef } from 'react'
import { salesService } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    ShoppingCart,
    Scan,
    Plus,
    Trash2,
    Receipt,
    Search,
    CheckCircle2,
    DollarSign,
    Minus
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import useAuthStore from '@/store/authStore'

/**
 * UC11: Mua hàng (Point of Sale)
 * 
 * Luồng chính:
 * 1. Thu ngân quét barcode sản phẩm
 * 2. Hệ thống xác định lô FEFO từ Kho thường, tính tổng tiền
 * 3. Thu ngân nhận thanh toán
 * 4. Hoàn tất giao dịch. Hệ thống in hóa đơn và tự động tạo Phiếu Xuất Kho
 */
export default function PointOfSale() {
    const { toast } = useToast()
    const { user } = useAuthStore()
    const barcodeInputRef = useRef(null)

    // Cart state
    const [cart, setCart] = useState([])
    const [cartTotal, setCartTotal] = useState(0)

    // Product search
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)

    // Barcode scanner
    const [barcodeInput, setBarcodeInput] = useState('')
    const [scanning, setScanning] = useState(false)

    // Product selection dialog
    const [showProductDialog, setShowProductDialog] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [productBatches, setProductBatches] = useState([])
    const [selectedBatch, setSelectedBatch] = useState(null)
    const [quantity, setQuantity] = useState(1)

    // Checkout dialog
    const [showCheckoutDialog, setShowCheckoutDialog] = useState(false)
    const [processing, setProcessing] = useState(false)

    // Invoice view
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
    const [currentInvoice, setCurrentInvoice] = useState(null)

    // Calculate cart total
    useEffect(() => {
        const total = cart.reduce((sum, item) => sum + (item.ThanhTien || 0), 0)
        setCartTotal(total)
    }, [cart])

    // Auto-focus barcode input
    useEffect(() => {
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus()
        }
    }, [])

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

    // Search products
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([])
            return
        }

        try {
            setSearching(true)
            const response = await salesService.searchProducts({
                search: searchQuery,
                per_page: 10
            })

            const items = response.data?.items || response.items || []
            setSearchResults(items)

            if (items.length === 0) {
                toast({
                    title: 'Không tìm thấy',
                    description: 'Không có sản phẩm nào khớp với tìm kiếm',
                })
            }
        } catch (error) {
            console.error('Search error:', error)
            toast({
                title: 'Lỗi tìm kiếm',
                description: error.response?.data?.message || 'Không thể tìm kiếm sản phẩm',
                variant: 'destructive',
            })
            setSearchResults([])
        } finally {
            setSearching(false)
        }
    }

    // Scan barcode
    const handleScanBarcode = async () => {
        if (!barcodeInput.trim()) return

        try {
            setScanning(true)
            const response = await salesService.scanBarcode(barcodeInput)

            const product = response.data?.product || response.product
            const batch = response.data?.batch || response.batch
            const warning = response.data?.expiry_warning || response.expiry_warning

            if (warning) {
                toast({
                    title: 'Cảnh báo hạn sử dụng',
                    description: warning,
                    variant: 'destructive',
                })
            }

            // Auto add to cart
            if (product && batch) {
                addToCart({
                    ...product,
                    MaLo: batch.MaLo,
                    MaVach: batch.MaVach,
                    SLTon: batch.SLTon,
                    HSD: batch.HSD,
                    NSX: batch.NSX
                }, 1, batch)
            }

            setBarcodeInput('')

            setTimeout(() => {
                if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus()
                }
            }, 100)
        } catch (error) {
            console.error('Scan error:', error)
            toast({
                title: 'Lỗi quét mã',
                description: error.response?.data?.message || 'Không thể quét mã vạch',
                variant: 'destructive',
            })
            setBarcodeInput('')
        } finally {
            setScanning(false)
        }
    }

    // Select product to add
    const handleSelectProduct = async (product) => {
        try {
            setSelectedProduct(product)

            const response = await salesService.getProductBatches(product.MaSP)
            const batches = response.data?.batches || response.batches || []

            setProductBatches(batches)

            if (batches.length > 0) {
                setSelectedBatch(batches[0])
            }

            setQuantity(1)
            setShowProductDialog(true)
        } catch (error) {
            console.error('Get batches error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải thông tin lô hàng',
                variant: 'destructive',
            })
        }
    }

    // Add to cart
    const addToCart = (product, qty, batch) => {
        if (!batch) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng chọn lô hàng',
                variant: 'destructive',
            })
            return
        }

        if (qty <= 0) {
            toast({
                title: 'Lỗi',
                description: 'Số lượng phải lớn hơn 0',
                variant: 'destructive',
            })
            return
        }

        if (qty > batch.SLTon) {
            toast({
                title: 'Không đủ hàng',
                description: `Lô này chỉ còn ${batch.SLTon} sản phẩm`,
                variant: 'destructive',
            })
            return
        }

        const existingIndex = cart.findIndex(
            item => item.MaSP === product.MaSP && item.MaLo === batch.MaLo
        )

        if (existingIndex >= 0) {
            const newCart = [...cart]
            const newQty = newCart[existingIndex].SoLuong + qty

            if (newQty > batch.SLTon) {
                toast({
                    title: 'Không đủ hàng',
                    description: `Lô này chỉ còn ${batch.SLTon} sản phẩm`,
                    variant: 'destructive',
                })
                return
            }

            newCart[existingIndex].SoLuong = newQty
            newCart[existingIndex].ThanhTien = newQty * product.GiaBan
            setCart(newCart)
        } else {
            setCart([...cart, {
                MaSP: product.MaSP,
                TenSP: product.TenSP,
                DVT: product.DVT,
                MaLo: batch.MaLo,
                MaVach: batch.MaVach,
                HSD: batch.HSD,
                NSX: batch.NSX,
                SLTon: batch.SLTon,
                SoLuong: qty,
                DonGia: product.GiaBan,
                ThanhTien: qty * product.GiaBan
            }])
        }

        toast({
            title: 'Đã thêm vào giỏ',
            description: `${product.TenSP} x${qty}`,
        })

        setShowProductDialog(false)
        setSearchResults([])
        setSearchQuery('')

        setTimeout(() => {
            if (barcodeInputRef.current) {
                barcodeInputRef.current.focus()
            }
        }, 100)
    }

    // Update cart quantity
    const updateCartQuantity = (index, newQty) => {
        if (newQty <= 0) {
            removeFromCart(index)
            return
        }

        const item = cart[index]
        if (newQty > item.SLTon) {
            toast({
                title: 'Không đủ hàng',
                description: `Lô này chỉ còn ${item.SLTon} sản phẩm`,
                variant: 'destructive',
            })
            return
        }

        const newCart = [...cart]
        newCart[index].SoLuong = newQty
        newCart[index].ThanhTien = newQty * item.DonGia
        setCart(newCart)
    }

    // Remove from cart
    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index))
        toast({
            title: 'Đã xóa khỏi giỏ',
        })
    }

    // Clear cart
    const clearCart = () => {
        setCart([])
        toast({
            title: 'Đã xóa giỏ hàng',
        })
    }

    // Checkout
    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast({
                title: 'Giỏ hàng trống',
                description: 'Vui lòng thêm sản phẩm vào giỏ hàng',
                variant: 'destructive',
            })
            return
        }

        try {
            setProcessing(true)

            const items = cart.map(item => ({
                MaSP: item.MaSP,
                MaLo: item.MaLo,
                MaVach: item.MaVach,
                SoLuong: item.SoLuong
            }))

            const response = await salesService.createInvoice({ items })
            const invoice = response.data || response

            toast({
                title: 'Thanh toán thành công!',
                description: `Hóa đơn ${invoice.MaHD} đã được tạo`,
            })

            setCurrentInvoice(invoice)
            setShowCheckoutDialog(false)
            setShowInvoiceDialog(true)
            setCart([])

        } catch (error) {
            console.error('Checkout error:', error)
            toast({
                title: 'Lỗi thanh toán',
                description: error.response?.data?.message || 'Không thể hoàn tất thanh toán',
                variant: 'destructive',
            })
        } finally {
            setProcessing(false)
        }
    }

    // Print invoice
    const handlePrintInvoice = () => {
        window.print()
    }

    // Get expiry badge
    const getExpiryBadge = (hsd) => {
        if (!hsd) return null

        const daysToExpire = Math.ceil((new Date(hsd) - new Date()) / (1000 * 60 * 60 * 24))

        if (daysToExpire < 0) {
            return <Badge variant="destructive">Hết hạn</Badge>
        } else if (daysToExpire <= 7) {
            return <Badge variant="destructive">Gần hết hạn</Badge>
        } else if (daysToExpire <= 30) {
            return <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                {daysToExpire} ngày
            </Badge>
        } else {
            return <Badge variant="outline" className="border-green-500 text-green-700">
                {daysToExpire} ngày
            </Badge>
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Bán Hàng (POS)</h1>
                    <p className="text-gray-500">Thu ngân: {user?.Ten || user?.Name}</p>
                </div>
                <Button
                    variant="outline"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Xóa giỏ
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Product Selection */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Barcode Scanner */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Scan className="h-5 w-5 mr-2" />
                                Quét mã vạch
                            </CardTitle>
                            <CardDescription>
                                Quét mã vạch hoặc nhập mã để thêm sản phẩm nhanh
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Input
                                    ref={barcodeInputRef}
                                    placeholder="Quét hoặc nhập mã vạch..."
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleScanBarcode()
                                        }
                                    }}
                                    disabled={scanning}
                                />
                                <Button
                                    onClick={handleScanBarcode}
                                    disabled={scanning || !barcodeInput.trim()}
                                >
                                    <Scan className="h-4 w-4 mr-2" />
                                    Quét
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Product Search */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Search className="h-5 w-5 mr-2" />
                                Tìm kiếm sản phẩm
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Tìm theo tên hoặc mã sản phẩm..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch()
                                        }
                                    }}
                                />
                                <Button onClick={handleSearch} disabled={searching}>
                                    <Search className="h-4 w-4 mr-2" />
                                    Tìm
                                </Button>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mã SP</TableHead>
                                                <TableHead>Tên sản phẩm</TableHead>
                                                <TableHead>Tồn kho</TableHead>
                                                <TableHead>Giá bán</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {searchResults.map((product) => (
                                                <TableRow key={product.MaSP}>
                                                    <TableCell className="font-mono">
                                                        {product.MaSP}
                                                    </TableCell>
                                                    <TableCell>{product.TenSP}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {product.total_stock || 0} {product.DVT}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-semibold">
                                                        {formatCurrency(product.GiaBan)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSelectProduct(product)}
                                                        >
                                                            <Plus className="h-4 w-4 mr-1" />
                                                            Thêm
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
                </div>

                {/* Right: Shopping Cart */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <ShoppingCart className="h-5 w-5 mr-2" />
                                Giỏ hàng ({cart.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>Giỏ hàng trống</p>
                                    <p className="text-sm">Quét mã hoặc tìm kiếm để thêm sản phẩm</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {cart.map((item, index) => (
                                        <div
                                            key={`${item.MaSP}-${item.MaLo}-${index}`}
                                            className="border rounded-lg p-3 space-y-2"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="font-medium">{item.TenSP}</p>
                                                    <p className="text-sm text-gray-500">
                                                        Lô: {item.MaLo} | HSD: {formatDate(item.HSD)}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeFromCart(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateCartQuantity(index, item.SoLuong - 1)}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="font-mono w-12 text-center">
                                                        {item.SoLuong}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateCartQuantity(index, item.SoLuong + 1)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-500">
                                                        {formatCurrency(item.DonGia)} × {item.SoLuong}
                                                    </p>
                                                    <p className="font-semibold">
                                                        {formatCurrency(item.ThanhTien)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Checkout Summary */}
                    {cart.length > 0 && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-lg">
                                        <span>Tổng cộng:</span>
                                        <span className="font-bold text-2xl text-primary">
                                            {formatCurrency(cartTotal)}
                                        </span>
                                    </div>
                                    <Button
                                        className="w-full"
                                        size="lg"
                                        onClick={() => setShowCheckoutDialog(true)}
                                    >
                                        <Receipt className="h-5 w-5 mr-2" />
                                        Thanh toán
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Product Selection Dialog - Continue in next message... */}
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Thêm sản phẩm vào giỏ</DialogTitle>
                        <DialogDescription>
                            {selectedProduct?.TenSP} ({selectedProduct?.MaSP})
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Chọn lô hàng (FEFO - Hết hạn trước, xuất trước)</Label>
                            <div className="border rounded-lg mt-2 max-h-60 overflow-y-auto">
                                {productBatches.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500">
                                        Không có lô hàng nào
                                    </div>
                                ) : (
                                    productBatches.map((batch, index) => (
                                        <div
                                            key={batch.MaLo}
                                            className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selectedBatch?.MaLo === batch.MaLo ? 'bg-blue-50 border-blue-500' : ''
                                                }`}
                                            onClick={() => setSelectedBatch(batch)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">Lô: {batch.MaLo}</span>
                                                        {index === 0 && (
                                                            <Badge variant="default">FEFO - Ưu tiên</Badge>
                                                        )}
                                                        {getExpiryBadge(batch.HSD)}
                                                    </div>
                                                    <div className="text-sm text-gray-600 mt-1">
                                                        NSX: {formatDate(batch.NSX)} | HSD: {formatDate(batch.HSD)}
                                                    </div>
                                                    <div className="text-sm">
                                                        Tồn kho: <span className="font-semibold">{batch.SLTon}</span> {selectedProduct?.DVT}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div>
                            <Label>Số lượng</Label>
                            <div className="flex gap-2 mt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="text-center"
                                    min="1"
                                    max={selectedBatch?.SLTon || 999}
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => setQuantity(Math.min(selectedBatch?.SLTon || 999, quantity + 1))}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            {selectedBatch && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Tồn kho: {selectedBatch.SLTon} {selectedProduct?.DVT}
                                </p>
                            )}
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Đơn giá:</span>
                                <span className="font-semibold">{formatCurrency(selectedProduct?.GiaBan || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-gray-600">Thành tiền:</span>
                                <span className="text-lg font-bold text-primary">
                                    {formatCurrency((selectedProduct?.GiaBan || 0) * quantity)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                            Hủy
                        </Button>
                        <Button
                            onClick={() => addToCart(selectedProduct, quantity, selectedBatch)}
                            disabled={!selectedBatch}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm vào giỏ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Checkout Dialog */}
            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận thanh toán</DialogTitle>
                        <DialogDescription>
                            Kiểm tra thông tin trước khi thanh toán
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="border rounded-lg p-4">
                            <h4 className="font-medium mb-2">Thông tin đơn hàng</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Số lượng sản phẩm:</span>
                                    <span className="font-medium">{cart.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Tổng số lượng:</span>
                                    <span className="font-medium">
                                        {cart.reduce((sum, item) => sum + item.SoLuong, 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg pt-2 border-t">
                                    <span className="font-semibold">Tổng tiền:</span>
                                    <span className="font-bold text-primary">
                                        {formatCurrency(cartTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>
                                Sau khi thanh toán, hệ thống sẽ tự động tạo hóa đơn và phiếu xuất kho.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCheckoutDialog(false)}
                            disabled={processing}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleCheckout}
                            disabled={processing}
                        >
                            {processing ? 'Đang xử lý...' : (
                                <>
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Xác nhận thanh toán
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invoice Dialog */}
            <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Hóa đơn bán hàng</DialogTitle>
                        <DialogDescription>
                            Mã hóa đơn: {currentInvoice?.MaHD}
                        </DialogDescription>
                    </DialogHeader>

                    {currentInvoice && (
                        <div className="space-y-4">
                            <div className="text-center border-b pb-4">
                                <h2 className="text-2xl font-bold">HÓA ĐƠN BÁN HÀNG</h2>
                                <p className="text-gray-600">Mã: {currentInvoice.MaHD}</p>
                                <p className="text-sm text-gray-500">
                                    {new Date(currentInvoice.NgayTao).toLocaleString('vi-VN')}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Thu ngân:</p>
                                    <p className="font-medium">{currentInvoice.TenThuNgan}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Mã phiếu xuất:</p>
                                    <p className="font-medium font-mono">{currentInvoice.MaPhieuXK}</p>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>STT</TableHead>
                                            <TableHead>Sản phẩm</TableHead>
                                            <TableHead className="text-center">SL</TableHead>
                                            <TableHead className="text-right">Đơn giá</TableHead>
                                            <TableHead className="text-right">Thành tiền</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentInvoice.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{item.TenSP}</p>
                                                        <p className="text-sm text-gray-500">
                                                            Lô: {item.MaLo}
                                                        </p>
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

                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center text-xl">
                                    <span className="font-semibold">Tổng cộng:</span>
                                    <span className="font-bold text-primary">
                                        {formatCurrency(currentInvoice.TongTien)}
                                    </span>
                                </div>
                            </div>

                            <div className="text-center text-sm text-gray-500 border-t pt-4">
                                <p>Cảm ơn quý khách! Hẹn gặp lại!</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowInvoiceDialog(false)}
                        >
                            Đóng
                        </Button>
                        <Button onClick={handlePrintInvoice}>
                            <Receipt className="h-4 w-4 mr-2" />
                            In hóa đơn
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

