import { useState, useEffect } from 'react'
import { reportService } from '@/services/api'
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'
import {
    BarChart3,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Search,
    Download,
    Package,
    DollarSign,
    Calendar,
    Activity,
    ShoppingCart,
    RefreshCw,
    Clock,
} from 'lucide-react'

/**
 * UC08: Báo cáo & Thống kê
 */
export default function Reports() {
    const { toast } = useToast()

    // State
    const [loading, setLoading] = useState(false)
    const [dashboardStats, setDashboardStats] = useState(null)
    const [inventoryReport, setInventoryReport] = useState(null)
    const [expiryReport, setExpiryReport] = useState(null)
    const [salesReport, setSalesReport] = useState(null)
    const [warehouseMovements, setWarehouseMovements] = useState(null)
    const [stockForecast, setStockForecast] = useState(null)
    const [topProducts, setTopProducts] = useState(null)
    const [warehouseActivities, setWarehouseActivities] = useState(null)

    // Filters
    const [inventoryFilters, setInventoryFilters] = useState({
        ma_kho: '',
        ma_sp: ''
    })

    const [expiryFilters, setExpiryFilters] = useState({
        days: 30,
        status: 'all',
        ma_kho: ''
    })

    const [salesFilters, setSalesFilters] = useState({
        from_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        group_by: 'day'
    })

    const [movementsFilters, setMovementsFilters] = useState({
        from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        ma_kho: ''
    })

    const [forecastFilters, setForecastFilters] = useState({
        ma_sp: '',
        days: 30
    })

    const [activitiesFilters, setActivitiesFilters] = useState({
        from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        ma_kho: ''
    })

    // Load dashboard on mount
    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            const response = await reportService.getDashboardStatistics()
            const data = response?.data || response

            setDashboardStats(data)
        } catch (error) {
            console.error('Load dashboard error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể tải thống kê tổng quan',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadInventoryReport = async () => {
        try {
            setLoading(true)
            const response = await reportService.getInventoryReport(inventoryFilters)
            const data = response?.data || response

            setInventoryReport(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải báo cáo tồn kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadExpiryReport = async () => {
        try {
            setLoading(true)
            const response = await reportService.getExpiryReport(expiryFilters)
            const data = response?.data || response

            setExpiryReport(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải báo cáo hạn sử dụng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadSalesReport = async () => {
        try {
            setLoading(true)
            const response = await reportService.getSalesReport(salesFilters)
            const data = response?.data || response

            setSalesReport(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải báo cáo bán hàng',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadWarehouseMovements = async () => {
        try {
            setLoading(true)
            const response = await reportService.getWarehouseMovements(movementsFilters)
            const data = response?.data || response

            setWarehouseMovements(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải báo cáo xuất nhập tồn',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadStockForecast = async () => {
        try {
            setLoading(true)
            const response = await reportService.getStockForecast(forecastFilters)
            const data = response?.data || response

            setStockForecast(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải dự báo tồn kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadTopProducts = async () => {
        try {
            setLoading(true)
            const response = await reportService.getTopProducts({
                from_date: salesFilters.from_date,
                to_date: salesFilters.to_date,
                limit: 10
            })
            const data = response?.data || response

            setTopProducts(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải sản phẩm bán chạy',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadWarehouseActivities = async () => {
        try {
            setLoading(true)
            const response = await reportService.getWarehouseActivities(activitiesFilters)
            const data = response?.data || response

            setWarehouseActivities(data)
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Không thể tải hoạt động kho',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status) => {
        const variants = {
            'critical': 'destructive',
            'warning': 'warning',
            'normal': 'default',
            'expired': 'destructive'
        }
        const labels = {
            'critical': 'Nguy cấp',
            'warning': 'Cảnh báo',
            'normal': 'Bình thường',
            'expired': 'Đã hết hạn'
        }
        return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(value)
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('vi-VN')
    }

    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('vi-VN')
    }

    const handleExportReport = async (reportType, format = 'excel') => {
        try {
            setLoading(true)
            let response
            let filename

            switch (reportType) {
                case 'inventory':
                    response = await reportService.exportInventoryReport({
                        ...inventoryFilters,
                        format
                    })
                    filename = `bao_cao_ton_kho_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`
                    break
                case 'sales':
                    response = await reportService.exportSalesReport({
                        ...salesFilters,
                        format
                    })
                    filename = `bao_cao_ban_hang_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`
                    break
                case 'expiry':
                    response = await reportService.exportExpiryReport({
                        ...expiryFilters,
                        format
                    })
                    filename = `bao_cao_han_su_dung_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`
                    break
                default:
                    throw new Error('Unknown report type')
            }

            // Download file
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', filename)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)

            toast({
                title: 'Thành công',
                description: 'Đã xuất báo cáo',
            })
        } catch (error) {
            console.error('Export error:', error)
            toast({
                title: 'Lỗi',
                description: 'Không thể xuất báo cáo',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-8 w-8" />
                    Báo Cáo & Thống Kê (UC08)
                </h1>
                <p className="text-muted-foreground mt-1">
                    Tổng quan và phân tích dữ liệu kho hàng
                </p>
            </div>

            {/* Dashboard Statistics */}
            {dashboardStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Tổng sản phẩm
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{dashboardStats.total_products}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Tổng tồn kho
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {dashboardStats.total_stock}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Sắp hết hạn
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">
                                {dashboardStats.expiring_soon}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Cần đặt hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {dashboardStats.low_stock}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="dashboard" className="space-y-4">
                <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
                    <TabsTrigger value="dashboard">Tổng quan</TabsTrigger>
                    <TabsTrigger value="inventory">Tồn kho</TabsTrigger>
                    <TabsTrigger value="expiry">HSD</TabsTrigger>
                    <TabsTrigger value="sales">Bán hàng</TabsTrigger>
                    <TabsTrigger value="movements">XNT</TabsTrigger>
                    <TabsTrigger value="forecast">Dự báo</TabsTrigger>
                    <TabsTrigger value="activities">Hoạt động</TabsTrigger>
                    <TabsTrigger value="top">Top SP</TabsTrigger>
                </TabsList>

                {/* Dashboard Tab */}
                <TabsContent value="dashboard" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Thống Kê Tổng Quan</CardTitle>
                            <CardDescription>
                                Cái nhìn tổng quan về tình hình kho hàng
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dashboardStats ? (
                                <div className="space-y-4">
                                    {dashboardStats.alerts?.length > 0 && (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Cảnh báo</AlertTitle>
                                            <AlertDescription>
                                                <ul className="list-disc pl-4">
                                                    {dashboardStats.alerts.map((alert, idx) => (
                                                        <li key={idx}>{alert}</li>
                                                    ))}
                                                </ul>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <p className="text-center text-muted-foreground py-8">
                                        Chọn tab để xem báo cáo chi tiết
                                    </p>
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    Đang tải dữ liệu...
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Inventory Report Tab */}
                <TabsContent value="inventory" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Báo Cáo Tồn Kho</CardTitle>
                                    <CardDescription>
                                        Tồn kho chi tiết theo kho và sản phẩm
                                    </CardDescription>
                                </div>
                                {inventoryReport && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleExportReport('inventory', 'excel')}
                                            disabled={loading}
                                            variant="outline"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Excel
                                        </Button>
                                        <Button
                                            onClick={() => handleExportReport('inventory', 'pdf')}
                                            disabled={loading}
                                            variant="outline"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Mã kho</Label>
                                    <Input
                                        placeholder="Tất cả"
                                        value={inventoryFilters.ma_kho}
                                        onChange={(e) =>
                                            setInventoryFilters({ ...inventoryFilters, ma_kho: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mã sản phẩm</Label>
                                    <Input
                                        placeholder="Tất cả"
                                        value={inventoryFilters.ma_sp}
                                        onChange={(e) =>
                                            setInventoryFilters({ ...inventoryFilters, ma_sp: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button onClick={loadInventoryReport} className="w-full" disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Tạo báo cáo
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {inventoryReport ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng sản phẩm</div>
                                                <div className="text-2xl font-bold">{inventoryReport.summary?.total_products || 0}</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng tồn kho</div>
                                                <div className="text-2xl font-bold">{inventoryReport.summary?.total_stock || 0}</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Số mục</div>
                                                <div className="text-2xl font-bold">{inventoryReport.summary?.total_items || 0}</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Table */}
                                    <div className="border rounded-lg">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Mã kho</TableHead>
                                                    <TableHead>Mã SP</TableHead>
                                                    <TableHead>Tên sản phẩm</TableHead>
                                                    <TableHead>Loại</TableHead>
                                                    <TableHead>ĐVT</TableHead>
                                                    <TableHead className="text-right">Số lô</TableHead>
                                                    <TableHead className="text-right">Tồn kho</TableHead>
                                                    <TableHead>HSD gần nhất</TableHead>
                                                    <TableHead>Trạng thái</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {inventoryReport.inventory?.length > 0 ? (
                                                    inventoryReport.inventory.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{item.MaKho}</TableCell>
                                                            <TableCell>{item.MaSP}</TableCell>
                                                            <TableCell className="font-medium">{item.TenSP}</TableCell>
                                                            <TableCell>{item.LoaiSP}</TableCell>
                                                            <TableCell>{item.DVT}</TableCell>
                                                            <TableCell className="text-right">{item.total_batches}</TableCell>
                                                            <TableCell className="text-right font-medium">{item.total_stock}</TableCell>
                                                            <TableCell>
                                                                {item.earliest_expiry ? formatDate(item.earliest_expiry) : '-'}
                                                                {item.days_to_expiry !== null && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        ({item.days_to_expiry} ngày)
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                                                            Không có dữ liệu
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Nhấn "Tạo báo cáo" để xem dữ liệu</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Expiry Report Tab */}
                <TabsContent value="expiry" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Báo Cáo Hạn Sử Dụng</CardTitle>
                                    <CardDescription>
                                        Sản phẩm sắp hết hạn và đã hết hạn
                                    </CardDescription>
                                </div>
                                {expiryReport && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleExportReport('expiry', 'excel')}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Excel
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleExportReport('expiry', 'pdf')}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Số ngày</Label>
                                    <Input
                                        type="number"
                                        value={expiryFilters.days}
                                        onChange={(e) =>
                                            setExpiryFilters({ ...expiryFilters, days: parseInt(e.target.value) || 30 })
                                        }
                                        min="1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mã kho</Label>
                                    <Input
                                        placeholder="Tất cả"
                                        value={expiryFilters.ma_kho}
                                        onChange={(e) =>
                                            setExpiryFilters({ ...expiryFilters, ma_kho: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Trạng thái</Label>
                                    <Select
                                        value={expiryFilters.status}
                                        onValueChange={(value) =>
                                            setExpiryFilters({ ...expiryFilters, status: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            <SelectItem value="expired">Đã hết hạn</SelectItem>
                                            <SelectItem value="expiring">Sắp hết hạn</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button onClick={loadExpiryReport} className="w-full" disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Tạo báo cáo
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {expiryReport ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Đã hết hạn</div>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {expiryReport.summary?.total_expired || 0}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    SL: {expiryReport.summary?.total_expired_quantity || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Sắp hết hạn</div>
                                                <div className="text-2xl font-bold text-orange-600">
                                                    {expiryReport.summary?.total_expiring || 0}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    SL: {expiryReport.summary?.total_expiring_quantity || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Kỳ kiểm tra</div>
                                                <div className="text-2xl font-bold">
                                                    {expiryReport.summary?.check_period_days || 0}
                                                </div>
                                                <div className="text-xs text-muted-foreground">ngày</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng cộng</div>
                                                <div className="text-2xl font-bold">
                                                    {(expiryReport.summary?.total_expired || 0) + (expiryReport.summary?.total_expiring || 0)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">lô hàng</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Expired items */}
                                    {expiryReport.expired?.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                                Đã hết hạn ({expiryReport.expired.length})
                                            </h3>
                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Mã kho</TableHead>
                                                            <TableHead>Sản phẩm</TableHead>
                                                            <TableHead>Mã lô</TableHead>
                                                            <TableHead>Barcode</TableHead>
                                                            <TableHead>NSX</TableHead>
                                                            <TableHead>HSD</TableHead>
                                                            <TableHead className="text-right">SL tồn</TableHead>
                                                            <TableHead>Quá hạn</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {expiryReport.expired.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell>{item.MaKho}</TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{item.TenSP}</div>
                                                                    <div className="text-xs text-muted-foreground">{item.MaSP}</div>
                                                                </TableCell>
                                                                <TableCell>{item.MaLo}</TableCell>
                                                                <TableCell className="font-mono text-xs">{item.MaVach}</TableCell>
                                                                <TableCell>{item.NSX ? formatDate(item.NSX) : '-'}</TableCell>
                                                                <TableCell className="text-red-600 font-medium">
                                                                    {item.HSD ? formatDate(item.HSD) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">{item.SLTon}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="destructive">
                                                                        {Math.abs(item.days_to_expiry)} ngày
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Expiring soon items */}
                                    {expiryReport.expiring?.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                                <Clock className="h-5 w-5 text-orange-600" />
                                                Sắp hết hạn ({expiryReport.expiring.length})
                                            </h3>
                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Mã kho</TableHead>
                                                            <TableHead>Sản phẩm</TableHead>
                                                            <TableHead>Mã lô</TableHead>
                                                            <TableHead>Barcode</TableHead>
                                                            <TableHead>NSX</TableHead>
                                                            <TableHead>HSD</TableHead>
                                                            <TableHead className="text-right">SL tồn</TableHead>
                                                            <TableHead>Còn lại</TableHead>
                                                            <TableHead>Trạng thái</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {expiryReport.expiring.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell>{item.MaKho}</TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{item.TenSP}</div>
                                                                    <div className="text-xs text-muted-foreground">{item.MaSP}</div>
                                                                </TableCell>
                                                                <TableCell>{item.MaLo}</TableCell>
                                                                <TableCell className="font-mono text-xs">{item.MaVach}</TableCell>
                                                                <TableCell>{item.NSX ? formatDate(item.NSX) : '-'}</TableCell>
                                                                <TableCell className="font-medium">
                                                                    {item.HSD ? formatDate(item.HSD) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">{item.SLTon}</TableCell>
                                                                <TableCell>
                                                                    <span className={item.days_to_expiry <= 7 ? 'text-red-600 font-medium' : ''}>
                                                                        {item.days_to_expiry} ngày
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell>{getStatusBadge(item.status)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}

                                    {expiryReport.expired?.length === 0 && expiryReport.expiring?.length === 0 && (
                                        <div className="text-center py-8">
                                            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                                            <p className="text-muted-foreground">Không có sản phẩm nào hết hạn hoặc sắp hết hạn</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Nhấn "Tạo báo cáo" để xem dữ liệu</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sales Report Tab */}
                <TabsContent value="sales" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Báo Cáo Bán Hàng</CardTitle>
                                    <CardDescription>
                                        Thống kê doanh thu và sản phẩm bán chạy
                                    </CardDescription>
                                </div>
                                {salesReport && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleExportReport('sales', 'excel')}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Excel
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleExportReport('sales', 'pdf')}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Từ ngày *</Label>
                                    <Input
                                        type="date"
                                        value={salesFilters.from_date}
                                        onChange={(e) =>
                                            setSalesFilters({ ...salesFilters, from_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Đến ngày *</Label>
                                    <Input
                                        type="date"
                                        value={salesFilters.to_date}
                                        onChange={(e) =>
                                            setSalesFilters({ ...salesFilters, to_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nhóm theo</Label>
                                    <Select
                                        value={salesFilters.group_by}
                                        onValueChange={(value) =>
                                            setSalesFilters({ ...salesFilters, group_by: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="day">Ngày</SelectItem>
                                            <SelectItem value="week">Tuần</SelectItem>
                                            <SelectItem value="month">Tháng</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button onClick={() => { loadSalesReport(); loadTopProducts(); }} className="w-full" disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Tạo báo cáo
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {salesReport ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng doanh thu</div>
                                                <div className="text-2xl font-bold text-green-600">
                                                    {formatCurrency(salesReport.summary?.total_revenue || 0)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Số lượng bán</div>
                                                <div className="text-2xl font-bold">
                                                    {salesReport.summary?.total_quantity || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Số hóa đơn</div>
                                                <div className="text-2xl font-bold">
                                                    {salesReport.summary?.total_invoices || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">TB/Hóa đơn</div>
                                                <div className="text-2xl font-bold">
                                                    {formatCurrency(salesReport.summary?.average_invoice_value || 0)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Daily sales */}
                                    {salesReport.daily_sales?.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">Doanh thu theo ngày</h3>
                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Ngày</TableHead>
                                                            <TableHead className="text-right">Doanh thu</TableHead>
                                                            <TableHead className="text-right">Số lượng</TableHead>
                                                            <TableHead className="text-right">Số hóa đơn</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {salesReport.daily_sales.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell>{formatDate(item.date)}</TableCell>
                                                                <TableCell className="text-right font-medium text-green-600">
                                                                    {formatCurrency(item.total_revenue)}
                                                                </TableCell>
                                                                <TableCell className="text-right">{item.total_quantity}</TableCell>
                                                                <TableCell className="text-right">{item.total_invoices}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Top products */}
                                    {salesReport.top_products?.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">Top 10 sản phẩm bán chạy</h3>
                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>#</TableHead>
                                                            <TableHead>Mã SP</TableHead>
                                                            <TableHead>Tên sản phẩm</TableHead>
                                                            <TableHead className="text-right">Giá bán</TableHead>
                                                            <TableHead className="text-right">Số lượng</TableHead>
                                                            <TableHead className="text-right">Doanh thu</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {salesReport.top_products.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-medium">{index + 1}</TableCell>
                                                                <TableCell>{item.MaSP}</TableCell>
                                                                <TableCell className="font-medium">{item.TenSP}</TableCell>
                                                                <TableCell className="text-right">{formatCurrency(item.GiaBan)}</TableCell>
                                                                <TableCell className="text-right">{item.total_quantity}</TableCell>
                                                                <TableCell className="text-right font-medium text-green-600">
                                                                    {formatCurrency(item.total_revenue)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Nhấn "Tạo báo cáo" để xem dữ liệu</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Warehouse Movements Tab */}
                <TabsContent value="movements" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Báo Cáo Xuất Nhập Tồn (XNT)</CardTitle>
                            <CardDescription>
                                Chi tiết xuất nhập kho theo thời gian
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Từ ngày *</Label>
                                    <Input
                                        type="date"
                                        value={movementsFilters.from_date}
                                        onChange={(e) =>
                                            setMovementsFilters({ ...movementsFilters, from_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Đến ngày *</Label>
                                    <Input
                                        type="date"
                                        value={movementsFilters.to_date}
                                        onChange={(e) =>
                                            setMovementsFilters({ ...movementsFilters, to_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mã kho</Label>
                                    <Input
                                        placeholder="Tất cả"
                                        value={movementsFilters.ma_kho}
                                        onChange={(e) =>
                                            setMovementsFilters({ ...movementsFilters, ma_kho: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button onClick={loadWarehouseMovements} className="w-full" disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Tạo báo cáo
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {warehouseMovements ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-5 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Phiếu nhập</div>
                                                <div className="text-2xl font-bold text-green-600">
                                                    {warehouseMovements.summary?.total_imports || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Phiếu xuất</div>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {warehouseMovements.summary?.total_exports || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng nhập</div>
                                                <div className="text-2xl font-bold">
                                                    {warehouseMovements.summary?.total_imported_quantity || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng xuất</div>
                                                <div className="text-2xl font-bold">
                                                    {warehouseMovements.summary?.total_exported_quantity || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Chênh lệch</div>
                                                <div className={`text-2xl font-bold ${(warehouseMovements.summary?.net_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {warehouseMovements.summary?.net_change || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Imports */}
                                    {warehouseMovements.movements?.imports?.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2 text-green-600">
                                                Nhập kho ({warehouseMovements.movements.imports.length})
                                            </h3>
                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Mã phiếu</TableHead>
                                                            <TableHead>Ngày tạo</TableHead>
                                                            <TableHead>Mục đích</TableHead>
                                                            <TableHead>Mã kho</TableHead>
                                                            <TableHead>Sản phẩm</TableHead>
                                                            <TableHead className="text-right">Số lượng</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {warehouseMovements.movements.imports.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-mono">{item.MaPhieu}</TableCell>
                                                                <TableCell>{formatDateTime(item.NgayTao)}</TableCell>
                                                                <TableCell>{item.MucDich}</TableCell>
                                                                <TableCell>{item.MaKho}</TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{item.TenSP}</div>
                                                                    <div className="text-xs text-muted-foreground">{item.MaSP}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-green-600">
                                                                    +{item.SoLuong}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Exports */}
                                    {warehouseMovements.movements?.exports?.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2 text-red-600">
                                                Xuất kho ({warehouseMovements.movements.exports.length})
                                            </h3>
                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Mã phiếu</TableHead>
                                                            <TableHead>Ngày tạo</TableHead>
                                                            <TableHead>Mục đích</TableHead>
                                                            <TableHead>Mã kho</TableHead>
                                                            <TableHead>Sản phẩm</TableHead>
                                                            <TableHead className="text-right">Số lượng</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {warehouseMovements.movements.exports.map((item, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-mono">{item.MaPhieu}</TableCell>
                                                                <TableCell>{formatDateTime(item.NgayTao)}</TableCell>
                                                                <TableCell>{item.MucDich}</TableCell>
                                                                <TableCell>{item.MaKho}</TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{item.TenSP}</div>
                                                                    <div className="text-xs text-muted-foreground">{item.MaSP}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-red-600">
                                                                    -{item.SoLuong}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Nhấn "Tạo báo cáo" để xem dữ liệu</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Stock Forecast Tab */}
                <TabsContent value="forecast" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dự Báo Hết Hàng</CardTitle>
                            <CardDescription>
                                Dự báo thời gian hết hàng và gợi ý đặt hàng
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Mã sản phẩm</Label>
                                    <Input
                                        placeholder="Tất cả"
                                        value={forecastFilters.ma_sp}
                                        onChange={(e) =>
                                            setForecastFilters({ ...forecastFilters, ma_sp: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phân tích (ngày)</Label>
                                    <Input
                                        type="number"
                                        value={forecastFilters.days}
                                        onChange={(e) =>
                                            setForecastFilters({ ...forecastFilters, days: parseInt(e.target.value) || 30 })
                                        }
                                        min="7"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button onClick={loadStockForecast} className="w-full" disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Phân tích
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {stockForecast ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng sản phẩm</div>
                                                <div className="text-2xl font-bold">
                                                    {stockForecast.summary?.total_products || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Nguy cấp</div>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {stockForecast.summary?.critical_products || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Cần đặt hàng</div>
                                                <div className="text-2xl font-bold text-orange-600">
                                                    {stockForecast.summary?.needs_reorder || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Forecast table */}
                                    {stockForecast.forecasts?.length > 0 ? (
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Sản phẩm</TableHead>
                                                        <TableHead className="text-right">Tồn kho</TableHead>
                                                        <TableHead className="text-right">TB bán/ngày</TableHead>
                                                        <TableHead className="text-right">Hết sau (ngày)</TableHead>
                                                        <TableHead className="text-right">Mức đặt lại</TableHead>
                                                        <TableHead className="text-right">Nên đặt</TableHead>
                                                        <TableHead>Trạng thái</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {stockForecast.forecasts.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>
                                                                <div className="font-medium">{item.TenSP}</div>
                                                                <div className="text-xs text-muted-foreground">{item.MaSP}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right">{item.current_stock}</TableCell>
                                                            <TableCell className="text-right">{item.daily_average_sales}</TableCell>
                                                            <TableCell className="text-right">
                                                                {item.days_until_out_of_stock !== null ? (
                                                                    <span className={item.urgency === 'critical' ? 'text-red-600 font-bold' : ''}>
                                                                        {item.days_until_out_of_stock}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">{item.reorder_level}</TableCell>
                                                            <TableCell className="text-right font-medium">
                                                                {item.suggested_order_quantity > 0 ? item.suggested_order_quantity : '-'}
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(item.urgency)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                                            <p className="text-muted-foreground">Không có sản phẩm nào cần đặt hàng</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Nhấn "Phân tích" để xem dự báo</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Warehouse Activities Tab */}
                <TabsContent value="activities" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Hoạt Động Kho</CardTitle>
                            <CardDescription>
                                Lịch sử các hoạt động xuất nhập, chuyển kho, kiểm kê
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Từ ngày</Label>
                                    <Input
                                        type="date"
                                        value={activitiesFilters.from_date}
                                        onChange={(e) =>
                                            setActivitiesFilters({ ...activitiesFilters, from_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Đến ngày</Label>
                                    <Input
                                        type="date"
                                        value={activitiesFilters.to_date}
                                        onChange={(e) =>
                                            setActivitiesFilters({ ...activitiesFilters, to_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mã kho</Label>
                                    <Input
                                        placeholder="Tất cả"
                                        value={activitiesFilters.ma_kho}
                                        onChange={(e) =>
                                            setActivitiesFilters({ ...activitiesFilters, ma_kho: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <Button onClick={loadWarehouseActivities} className="w-full" disabled={loading}>
                                        <Search className="h-4 w-4 mr-2" />
                                        Xem hoạt động
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {warehouseActivities ? (
                                <div className="space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-5 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Tổng hoạt động</div>
                                                <div className="text-2xl font-bold">
                                                    {warehouseActivities.summary?.total_activities || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Nhập kho</div>
                                                <div className="text-2xl font-bold text-green-600">
                                                    {warehouseActivities.summary?.total_imports || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Xuất kho</div>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {warehouseActivities.summary?.total_exports || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Chuyển kho</div>
                                                <div className="text-2xl font-bold text-blue-600">
                                                    {warehouseActivities.summary?.total_transfers || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Kiểm kê</div>
                                                <div className="text-2xl font-bold text-purple-600">
                                                    {warehouseActivities.summary?.total_inventory_checks || 0}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Activities table */}
                                    {warehouseActivities.activities?.length > 0 ? (
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Loại</TableHead>
                                                        <TableHead>Mã phiếu</TableHead>
                                                        <TableHead>Ngày tạo</TableHead>
                                                        <TableHead>Mục đích</TableHead>
                                                        <TableHead>Chi tiết</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {warehouseActivities.activities.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>
                                                                {item.type === 'import' && <Badge variant="default" className="bg-green-600">Nhập</Badge>}
                                                                {item.type === 'export' && <Badge variant="default" className="bg-red-600">Xuất</Badge>}
                                                                {item.type === 'transfer' && <Badge variant="default" className="bg-blue-600">Chuyển</Badge>}
                                                                {item.type === 'inventory_check' && <Badge variant="default" className="bg-purple-600">Kiểm</Badge>}
                                                            </TableCell>
                                                            <TableCell className="font-mono">{item.MaPhieu}</TableCell>
                                                            <TableCell>{formatDateTime(item.NgayTao)}</TableCell>
                                                            <TableCell>{item.MucDich || '-'}</TableCell>
                                                            <TableCell>
                                                                {item.type === 'transfer' ? (
                                                                    <span className="text-xs">
                                                                        {item.KhoXuat} → {item.KhoNhap}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs">
                                                                        {item.MaKho}
                                                                        {item.total_quantity && ` (${item.total_quantity} sp)`}
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                            <p className="text-muted-foreground">Không có hoạt động nào</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Nhấn "Xem hoạt động" để tải dữ liệu</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Top Products Tab */}
                <TabsContent value="top" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sản Phẩm Bán Chạy</CardTitle>
                            <CardDescription>
                                Top sản phẩm có doanh thu cao nhất
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Note */}
                            <Alert>
                                <ShoppingCart className="h-4 w-4" />
                                <AlertDescription>
                                    Sử dụng bộ lọc từ tab "Bán hàng" để xem top sản phẩm theo khoảng thời gian
                                </AlertDescription>
                            </Alert>

                            {/* Results */}
                            {topProducts ? (
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">#</TableHead>
                                                <TableHead>Sản phẩm</TableHead>
                                                <TableHead>Loại</TableHead>
                                                <TableHead className="text-right">Giá bán</TableHead>
                                                <TableHead className="text-right">Đã bán</TableHead>
                                                <TableHead className="text-right">Số hóa đơn</TableHead>
                                                <TableHead className="text-right">Doanh thu</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {topProducts.top_products?.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{item.TenSP}</div>
                                                        <div className="text-xs text-muted-foreground">{item.MaSP}</div>
                                                    </TableCell>
                                                    <TableCell>{item.LoaiSP}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.GiaBan)}</TableCell>
                                                    <TableCell className="text-right font-medium">{item.total_quantity} {item.DVT}</TableCell>
                                                    <TableCell className="text-right">{item.total_invoices}</TableCell>
                                                    <TableCell className="text-right font-bold text-green-600">
                                                        {formatCurrency(item.total_revenue)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">Chuyển sang tab "Bán hàng" và tạo báo cáo để xem top sản phẩm</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
