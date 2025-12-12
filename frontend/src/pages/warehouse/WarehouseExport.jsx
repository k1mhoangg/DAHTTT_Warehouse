import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, TrendingDown, AlertCircle, Search, Package, Eye, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { warehouseService, productService } from '@/services/api';

export default function WarehouseExport() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [selectedExport, setSelectedExport] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [mucDich, setMucDich] = useState('');
    const [maThamChieu, setMaThamChieu] = useState('');
    const [exportItems, setExportItems] = useState([]);
    const [fefoSuggestions, setFefoSuggestions] = useState({});
    
    // UC04: New states for barcode validation
    const [previewData, setPreviewData] = useState(null);
    const [barcodeValidation, setBarcodeValidation] = useState({});

    // Fetch warehouses
    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses'],
        queryFn: warehouseService.getWarehouses,
    });

    // Fetch products
    const { data: productsData } = useQuery({
        queryKey: ['products'],
        queryFn: () => productService.getProducts({}),
    });

    // Fetch export history
    const { data: exportsData, isLoading: exportsLoading } = useQuery({
        queryKey: ['warehouse-exports'],
        queryFn: warehouseService.getExports,
    });

    // Fetch inventory for selected warehouse
    const { data: inventoryData } = useQuery({
        queryKey: ['warehouse-inventory', selectedWarehouse],
        queryFn: () => warehouseService.getWarehouseInventory(selectedWarehouse),
        enabled: !!selectedWarehouse,
    });

    const warehouses = warehousesData?.data?.warehouses || [];
    const products = productsData?.data?.items || [];
    const exports = exportsData?.data?.exports || [];
    const inventory = inventoryData?.data?.inventory || [];

    // Export mutation
    const exportMutation = useMutation({
        mutationFn: warehouseService.exportWarehouse,
        onSuccess: () => {
            queryClient.invalidateQueries(['warehouse-exports']);
            queryClient.invalidateQueries(['warehouse-inventory']);
            queryClient.invalidateQueries(['products']);
            toast({
                title: 'Thành công',
                description: 'Đã xuất kho thành công',
            });
            resetForm();
        },
        onError: (error) => {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.error || 'Không thể xuất kho',
                variant: 'destructive',
            });
        },
    });

    // FEFO suggestion mutation
    const fefoMutation = useMutation({
        mutationFn: warehouseService.suggestFEFO,
        onSuccess: (data, variables) => {
            const itemId = variables.itemId;
            setFefoSuggestions((prev) => ({
                ...prev,
                [itemId]: data.data,
            }));
        },
    });

    const resetForm = () => {
        setShowExportDialog(false);
        setSelectedWarehouse('');
        setMucDich('');
        setMaThamChieu('');
        setExportItems([]);
        setFefoSuggestions({});
        // UC04: Reset barcode validation and preview
        setBarcodeValidation({});
        setPreviewData(null);
    };

    const addExportItem = () => {
        setExportItems([
            ...exportItems,
            {
                id: Date.now(),
                MaSP: '',
                SoLuong: 0,
                MaLo: '', // Optional - auto FEFO if empty
                MaVach: '', // UC04: Required barcode
            },
        ]);
    };

    const updateExportItem = (id, field, value) => {
        setExportItems(
            exportItems.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );

        // Clear validation when product or barcode changes (UC04)
        if (field === 'MaSP' || field === 'MaVach') {
            setBarcodeValidation(prev => {
                const newValidation = { ...prev };
                delete newValidation[id];
                return newValidation;
            });
        }

        // Auto-fetch FEFO suggestion when product or quantity changes
        if (field === 'MaSP' || field === 'SoLuong') {
            const item = exportItems.find((i) => i.id === id);
            const updatedItem = { ...item, [field]: value };

            if (updatedItem.MaSP && updatedItem.SoLuong > 0 && selectedWarehouse) {
                fefoMutation.mutate({
                    itemId: id,
                    MaSP: updatedItem.MaSP,
                    MaKho: selectedWarehouse,
                    SoLuong: parseInt(updatedItem.SoLuong),
                });
            }
        }
    };

    const removeExportItem = (id) => {
        setExportItems(exportItems.filter((item) => item.id !== id));
        setFefoSuggestions((prev) => {
            const newSuggestions = { ...prev };
            delete newSuggestions[id];
            return newSuggestions;
        });
        // Also clear barcode validation (UC04)
        setBarcodeValidation(prev => {
            const newValidation = { ...prev };
            delete newValidation[id];
            return newValidation;
        });
    };

    // UC04: Preview export before submitting
    const previewExport = async () => {
        if (!selectedWarehouse || exportItems.length === 0) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng chọn kho và thêm sản phẩm',
                variant: 'destructive'
            });
            return;
        }

        try {
            const validItems = exportItems.filter(item => item.MaSP && item.SoLuong > 0);
            
            const result = await warehouseService.previewExport({
                MaKho: selectedWarehouse,
                items: validItems.map(item => ({
                    MaSP: item.MaSP,
                    SoLuong: item.SoLuong
                }))
            });

            setPreviewData(result.data);
            
            if (!result.data.can_fulfill_all) {
                toast({
                    title: 'Cảnh báo',
                    description: 'Một số sản phẩm không đủ tồn kho',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.message || 'Không thể xem trước xuất kho',
                variant: 'destructive'
            });
        }
    };

    // UC04: Validate barcode when scanned
    const validateBarcode = async (itemId, barcode) => {
        const item = exportItems.find(i => i.id === itemId);
        if (!item.MaSP || !selectedWarehouse) return;

        try {
            const result = await warehouseService.validateBarcode({
                MaVach: barcode,
                MaKho: selectedWarehouse,
                MaSP: item.MaSP
            });

            if (result.data.valid) {
                const batch = result.data.batch;
                setBarcodeValidation(prev => ({
                    ...prev,
                    [itemId]: {
                        valid: true,
                        batch,
                        message: `Batch hợp lệ: ${batch.MaLo} (Tồn kho: ${batch.SLTon})`
                    }
                }));

                // Auto-fill MaLo
                updateExportItem(itemId, 'MaLo', batch.MaLo);

                toast({
                    title: 'Thành công',
                    description: 'Mã vạch hợp lệ',
                    variant: 'default'
                });
            }
        } catch (error) {
            setBarcodeValidation(prev => ({
                ...prev,
                [itemId]: {
                    valid: false,
                    message: error.response?.data?.message || 'Mã vạch không hợp lệ'
                }
            }));
            
            toast({
                title: 'Lỗi',
                description: 'Mã vạch không hợp lệ',
                variant: 'destructive'
            });
        }
    };

    const handleSubmitExport = () => {
        if (!selectedWarehouse) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng chọn kho',
                variant: 'destructive',
            });
            return;
        }

        if (exportItems.length === 0) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng thêm ít nhất một sản phẩm',
                variant: 'destructive',
            });
            return;
        }

        // UC04: Enhanced validation including barcode
        const invalidItems = exportItems.filter(
            (item) => !item.MaSP || !item.SoLuong || item.SoLuong <= 0 || !item.MaVach
        );

        if (invalidItems.length > 0) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng điền đầy đủ thông tin sản phẩm bao gồm mã vạch (UC04)',
                variant: 'destructive',
            });
            return;
        }

        // UC04: Check if all barcodes are validated
        for (const item of exportItems) {
            if (!barcodeValidation[item.id]?.valid) {
                toast({
                    title: 'Lỗi',
                    description: `Vui lòng xác thực mã vạch cho sản phẩm ${item.MaSP}`,
                    variant: 'destructive'
                });
                return;
            }
        }

        // UC04: Format according to backend API requirements
        const payload = {
            MaKho: selectedWarehouse,
            MucDich: mucDich || 'Xuất bán hàng',
            MaThamChieu: maThamChieu,
            items: exportItems.map((item) => ({
                MaSP: item.MaSP,
                MaVach: item.MaVach,
                MaLo: barcodeValidation[item.id]?.batch?.MaLo || item.MaLo,
                SoLuong: parseInt(item.SoLuong)
            })),
        };

        exportMutation.mutate(payload);
    };

    const handleViewDetail = (exportRecord) => {
        setSelectedExport(exportRecord);
        setShowDetailDialog(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('vi-VN');
    };

    const isExpiringSoon = (hsd) => {
        if (!hsd) return false;
        const expiryDate = new Date(hsd);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
    };

    const isExpired = (hsd) => {
        if (!hsd) return false;
        return new Date(hsd) < new Date();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Xuất kho (FEFO)</h1>
                    <p className="text-gray-600">UC04: Xuất kho theo nguyên tắc First Expired, First Out</p>
                </div>
                <Button onClick={() => setShowExportDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tạo phiếu xuất kho
                </Button>
            </div>

            {/* Current Inventory */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Tồn kho hiện tại
                    </CardTitle>
                    <CardDescription>
                        <div className="flex items-center gap-4 mt-2">
                            <Label>Chọn kho:</Label>
                            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Chọn kho" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.MaKho} value={w.MaKho}>
                                            {w.MaKho} - {w.Loai}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedWarehouse ? (
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inventory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-gray-500">
                                            Kho trống
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    inventory
                                        .sort((a, b) => new Date(a.HSD) - new Date(b.HSD))
                                        .map((batch) => (
                                            <TableRow
                                                key={`${batch.MaSP}-${batch.MaLo}`}
                                                className={
                                                    isExpired(batch.HSD)
                                                        ? 'bg-red-50'
                                                        : isExpiringSoon(batch.HSD)
                                                            ? 'bg-yellow-50'
                                                            : ''
                                                }
                                            >
                                                <TableCell>{batch.MaSP}</TableCell>
                                                <TableCell>{batch.product?.TenSP || 'N/A'}</TableCell>
                                                <TableCell>{batch.MaLo}</TableCell>
                                                <TableCell>{formatDate(batch.NSX)}</TableCell>
                                                <TableCell>{formatDate(batch.HSD)}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {batch.SLTon}
                                                </TableCell>
                                                <TableCell>
                                                    {isExpired(batch.HSD) ? (
                                                        <span className="text-red-600 font-semibold flex items-center gap-1">
                                                            <AlertCircle className="h-4 w-4" />
                                                            Hết hạn
                                                        </span>
                                                    ) : isExpiringSoon(batch.HSD) ? (
                                                        <span className="text-yellow-600 font-semibold flex items-center gap-1">
                                                            <AlertCircle className="h-4 w-4" />
                                                            Sắp hết hạn
                                                        </span>
                                                    ) : (
                                                        <span className="text-green-600">Còn hạn</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                )}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-center text-gray-500 py-8">
                            Vui lòng chọn kho để xem tồn kho
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Export History */}
            <Card>
                <CardHeader>
                    <CardTitle>Lịch sử xuất kho</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mã phiếu</TableHead>
                                <TableHead>Ngày tạo</TableHead>
                                <TableHead>Mục đích</TableHead>
                                <TableHead>Mã tham chiếu</TableHead>
                                <TableHead className="text-right">Số lượng mặt hàng</TableHead>
                                <TableHead className="text-center">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {exportsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">
                                        Đang tải...
                                    </TableCell>
                                </TableRow>
                            ) : exports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500">
                                        Chưa có phiếu xuất kho
                                    </TableCell>
                                </TableRow>
                            ) : (
                                exports.map((phieu) => (
                                    <TableRow key={phieu.MaPhieu}>
                                        <TableCell className="font-mono">{phieu.MaPhieu}</TableCell>
                                        <TableCell>{formatDateTime(phieu.NgayTao)}</TableCell>
                                        <TableCell>{phieu.MucDich}</TableCell>
                                        <TableCell>{phieu.MaThamChieu || 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                            {phieu.items?.length || 0}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewDetail(phieu)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Export Dialog */}
            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>UC04: Tạo phiếu xuất kho (FEFO + Barcode Validation)</DialogTitle>
                        <DialogDescription>
                            UC04: Xuất kho theo logic nghiệp vụ - Bắt buộc quét mã vạch và tuân thủ FEFO
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Warehouse Selection */}
                        <div className="space-y-2">
                            <Label>Kho xuất *</Label>
                            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn kho" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.MaKho} value={w.MaKho}>
                                            {w.MaKho} - {w.DiaChi} ({w.Loai})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Purpose */}
                        <div className="space-y-2">
                            <Label>Mục đích</Label>
                            <Input
                                value={mucDich}
                                onChange={(e) => setMucDich(e.target.value)}
                                placeholder="Xuất bán hàng"
                            />
                        </div>

                        {/* Reference */}
                        <div className="space-y-2">
                            <Label>Mã tham chiếu (Hóa đơn, đơn hàng, ...)</Label>
                            <Input
                                value={maThamChieu}
                                onChange={(e) => setMaThamChieu(e.target.value)}
                                placeholder="HD001, ORDER-001, ..."
                            />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Sản phẩm xuất kho *</Label>
                                <Button type="button" size="sm" onClick={addExportItem}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Thêm sản phẩm
                                </Button>
                            </div>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {exportItems.map((item, index) => {
                                    const suggestion = fefoSuggestions[item.id];
                                    const canFulfill = suggestion?.can_fulfill;
                                    const shortage = suggestion?.shortage || 0;

                                    return (
                                        <Card key={item.id}>
                                            <CardContent className="pt-4">
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-12 gap-2">
                                                        <div className="col-span-12 sm:col-span-4">
                                                            <Label className="text-xs">Sản phẩm *</Label>
                                                            <Select
                                                                value={item.MaSP}
                                                                onValueChange={(val) =>
                                                                    updateExportItem(item.id, 'MaSP', val)
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Chọn SP" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {products.map((p) => (
                                                                        <SelectItem key={p.MaSP} value={p.MaSP}>
                                                                            {p.MaSP} - {p.TenSP}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="col-span-4 sm:col-span-2">
                                                            <Label className="text-xs">Số lượng *</Label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={item.SoLuong}
                                                                onChange={(e) =>
                                                                    updateExportItem(item.id, 'SoLuong', e.target.value)
                                                                }
                                                            />
                                                        </div>

                                                        <div className="col-span-8 sm:col-span-3">
                                                            <Label className="text-xs">
                                                                Mã vạch * (UC04)
                                                            </Label>
                                                            <div className="flex gap-1">
                                                                <Input
                                                                    value={item.MaVach}
                                                                    onChange={(e) =>
                                                                        updateExportItem(item.id, 'MaVach', e.target.value)
                                                                    }
                                                                    placeholder="Quét mã vạch"
                                                                    className="flex-1"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant={barcodeValidation[item.id]?.valid ? "default" : "outline"}
                                                                    onClick={() => validateBarcode(item.id, item.MaVach)}
                                                                    disabled={!item.MaVach || !item.MaSP || !selectedWarehouse}
                                                                >
                                                                    <Scan className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                            {barcodeValidation[item.id] && (
                                                                <div className={`text-xs mt-1 ${
                                                                    barcodeValidation[item.id].valid 
                                                                        ? 'text-green-600' 
                                                                        : 'text-red-600'
                                                                }`}>
                                                                    {barcodeValidation[item.id].valid ? '✅' : '❌'} {barcodeValidation[item.id].message}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="col-span-8 sm:col-span-2">
                                                            <Label className="text-xs">
                                                                Mã lô (Auto-fill)
                                                            </Label>
                                                            <Input
                                                                value={item.MaLo}
                                                                onChange={(e) =>
                                                                    updateExportItem(item.id, 'MaLo', e.target.value)
                                                                }
                                                                placeholder="Tự động"
                                                                readOnly
                                                                className="bg-gray-50"
                                                            />
                                                        </div>

                                                        <div className="col-span-4 sm:col-span-1 flex items-end">
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                onClick={() => removeExportItem(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* FEFO Suggestion Display */}
                                                    {suggestion && (
                                                        <div
                                                            className={`p-3 rounded-md text-sm ${canFulfill
                                                                ? 'bg-green-50 border border-green-200'
                                                                : 'bg-red-50 border border-red-200'
                                                                }`}
                                                        >
                                                            {canFulfill ? (
                                                                <div>
                                                                    <p className="font-semibold text-green-800 mb-2">
                                                                        ✓ Đủ hàng - Gợi ý FEFO:
                                                                    </p>
                                                                    {suggestion.suggested_batches?.map((batch, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="text-xs text-green-700 ml-4"
                                                                        >
                                                                            • Lô {batch.MaLo} - HSD: {formatDate(batch.HSD)}
                                                                            - Xuất: {batch.suggested_quantity} (Tồn: {batch.SLTon})
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="font-semibold text-red-800">
                                                                    ✗ Không đủ hàng - Thiếu: {shortage}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}

                                {exportItems.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">
                                        Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* UC04: Preview Section */}
                        {previewData && (
                            <Card className="border-blue-200 bg-blue-50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Eye className="w-5 h-5" />
                                        Xem trước xuất kho
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {previewData.preview.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded">
                                                <span className="font-medium">{item.product.TenSP}</span>
                                                <div className="flex items-center gap-4">
                                                    <span>Yêu cầu: {item.requested_quantity}</span>
                                                    <span>Có sẵn: {item.total_available}</span>
                                                    <Badge variant={item.can_fulfill ? "default" : "destructive"}>
                                                        {item.can_fulfill ? "✅ Đủ hàng" : `❌ Thiếu ${item.shortage}`}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="font-medium text-center pt-2 border-t">
                                            Tổng quan: {previewData.can_fulfill_all ? 
                                                "✅ Có thể xuất tất cả" : 
                                                "❌ Một số sản phẩm không đủ hàng"
                                            }
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>
                            Hủy
                        </Button>
                        <Button
                            variant="outline"
                            onClick={previewExport}
                            disabled={!selectedWarehouse || exportItems.length === 0}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Xem trước
                        </Button>
                        <Button
                            onClick={handleSubmitExport}
                            disabled={exportMutation.isPending}
                        >
                            {exportMutation.isPending ? 'Đang xử lý...' : 'Tạo phiếu xuất'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Chi tiết phiếu xuất kho</DialogTitle>
                        <DialogDescription>
                            {selectedExport && `Mã phiếu: ${selectedExport.MaPhieu}`}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedExport && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="font-semibold">Ngày tạo:</Label>
                                    <p>{formatDateTime(selectedExport.NgayTao)}</p>
                                </div>
                                <div>
                                    <Label className="font-semibold">Mục đích:</Label>
                                    <p>{selectedExport.MucDich}</p>
                                </div>
                                <div>
                                    <Label className="font-semibold">Mã tham chiếu:</Label>
                                    <p>{selectedExport.MaThamChieu || 'N/A'}</p>
                                </div>
                                <div>
                                    <Label className="font-semibold">Tổng số lô:</Label>
                                    <p>{selectedExport.items?.length || 0}</p>
                                </div>
                            </div>

                            <div>
                                <Label className="font-semibold mb-2 block">Chi tiết sản phẩm:</Label>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Mã SP</TableHead>
                                            <TableHead>Tên sản phẩm</TableHead>
                                            <TableHead>Mã lô</TableHead>
                                            <TableHead>NSX</TableHead>
                                            <TableHead>HSD</TableHead>
                                            <TableHead className="text-right">Số lượng xuất</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedExport.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.MaSP}</TableCell>
                                                <TableCell>{item.product?.TenSP || 'N/A'}</TableCell>
                                                <TableCell>{item.MaLo}</TableCell>
                                                <TableCell>{formatDate(item.NSX)}</TableCell>
                                                <TableCell>{formatDate(item.HSD)}</TableCell>
                                                <TableCell className="text-right">{item.exported_quantity || item.SLTon}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setShowDetailDialog(false)}>
                            Đóng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
