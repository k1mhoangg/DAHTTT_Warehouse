import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Package, Calendar, Barcode, Eye, Download } from 'lucide-react';
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
import { warehouseService, productService } from '@/services/api';

export default function WarehouseImport() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [selectedImport, setSelectedImport] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [mucDich, setMucDich] = useState('');
    const [maThamChieu, setMaThamChieu] = useState('');
    const [importItems, setImportItems] = useState([]);

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

    // Fetch import history
    const { data: importsData, isLoading: importsLoading } = useQuery({
        queryKey: ['warehouse-imports'],
        queryFn: warehouseService.getImports,
    });

    // Fetch inventory for selected warehouse
    const { data: inventoryData } = useQuery({
        queryKey: ['warehouse-inventory', selectedWarehouse],
        queryFn: () => warehouseService.getWarehouseInventory(selectedWarehouse),
        enabled: !!selectedWarehouse,
    });

    const warehouses = warehousesData?.data?.warehouses || [];
    const products = productsData?.data?.items || [];
    const imports = importsData?.data?.imports || [];
    const inventory = inventoryData?.data?.inventory || [];

    // Import mutation
    const importMutation = useMutation({
        mutationFn: warehouseService.importWarehouse,
        onSuccess: () => {
            queryClient.invalidateQueries(['warehouse-imports']);
            queryClient.invalidateQueries(['warehouse-inventory']);
            queryClient.invalidateQueries(['products']);
            toast({
                title: 'Thành công',
                description: 'Đã nhập kho thành công',
            });
            resetForm();
        },
        onError: (error) => {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.error || 'Không thể nhập kho',
                variant: 'destructive',
            });
        },
    });

    // Delete import mutation
    const deleteImportMutation = useMutation({
        mutationFn: warehouseService.deleteImport,
        onSuccess: () => {
            queryClient.invalidateQueries(['warehouse-imports']);
            queryClient.invalidateQueries(['warehouse-inventory']);
            toast({
                title: 'Thành công',
                description: 'Đã xóa phiếu nhập kho thành công',
            });
        },
        onError: (error) => {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.error || 'Không thể xóa phiếu nhập kho',
                variant: 'destructive',
            });
        },
    });

    const resetForm = () => {
        setShowImportDialog(false);
        setSelectedWarehouse('');
        setMucDich('');
        setMaThamChieu('');
        setImportItems([]);
    };

    const addImportItem = () => {
        setImportItems([
            ...importItems,
            {
                id: Date.now(),
                MaSP: '',
                SoLuong: 0,
                NSX: '',
                HSD: '',
                MaLo: '',
            },
        ]);
    };

    const updateImportItem = (id, field, value) => {
        setImportItems(
            importItems.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    const removeImportItem = (id) => {
        setImportItems(importItems.filter((item) => item.id !== id));
    };

    const handleSubmitImport = () => {
        if (!selectedWarehouse) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng chọn kho',
                variant: 'destructive',
            });
            return;
        }

        if (importItems.length === 0) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng thêm ít nhất một sản phẩm',
                variant: 'destructive',
            });
            return;
        }

        const invalidItems = importItems.filter(
            (item) => !item.MaSP || !item.SoLuong || item.SoLuong <= 0
        );

        if (invalidItems.length > 0) {
            toast({
                title: 'Lỗi',
                description: 'Vui lòng điền đầy đủ thông tin sản phẩm',
                variant: 'destructive',
            });
            return;
        }

        const payload = {
            MaKho: selectedWarehouse,
            MucDich: mucDich || 'Nhập hàng từ nhà cung cấp',
            MaThamChieu: maThamChieu,
            items: importItems.map((item) => ({
                MaSP: item.MaSP,
                SoLuong: parseInt(item.SoLuong),
                NSX: item.NSX || null,
                HSD: item.HSD || null,
                MaLo: item.MaLo || null,
            })),
        };

        importMutation.mutate(payload);
    };

    const handleViewDetail = (importRecord) => {
        setSelectedImport(importRecord);
        setShowDetailDialog(true);
    };

    const handleDeleteImport = (importRecord) => {
        if (window.confirm(`Xác nhận xóa phiếu nhập kho "${importRecord.MaPhieu}"?\n\nLưu ý: Chỉ Quản lý mới có thể xóa phiếu nhập kho.`)) {
            deleteImportMutation.mutate(importRecord.MaPhieu);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('vi-VN');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Nhập kho</h1>
                    <p className="text-gray-600">UC03: Quản lý nhập kho - Tạo lô, barcode</p>
                </div>
                <Button onClick={() => setShowImportDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tạo phiếu nhập kho
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
                                    <TableHead>Barcode</TableHead>
                                    <TableHead>NSX</TableHead>
                                    <TableHead>HSD</TableHead>
                                    <TableHead className="text-right">Tồn kho</TableHead>
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
                                    inventory.map((batch) => (
                                        <TableRow key={`${batch.MaSP}-${batch.MaLo}`}>
                                            <TableCell>{batch.MaSP}</TableCell>
                                            <TableCell>{batch.product?.TenSP || 'N/A'}</TableCell>
                                            <TableCell>{batch.MaLo}</TableCell>
                                            <TableCell className="font-mono text-sm">{batch.MaVach}</TableCell>
                                            <TableCell>{formatDate(batch.NSX)}</TableCell>
                                            <TableCell>{formatDate(batch.HSD)}</TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {batch.SLTon}
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

            {/* Import History */}
            <Card>
                <CardHeader>
                    <CardTitle>Lịch sử nhập kho</CardTitle>
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
                            {importsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">
                                        Đang tải...
                                    </TableCell>
                                </TableRow>
                            ) : imports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500">
                                        Chưa có phiếu nhập kho
                                    </TableCell>
                                </TableRow>
                            ) : (
                                imports.map((phieu) => (
                                    <TableRow key={phieu.MaPhieu}>
                                        <TableCell className="font-mono">{phieu.MaPhieu}</TableCell>
                                        <TableCell>{formatDateTime(phieu.NgayTao)}</TableCell>
                                        <TableCell>{phieu.MucDich}</TableCell>
                                        <TableCell>{phieu.MaThamChieu || 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                            {phieu.items?.length || 0}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center gap-2 justify-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewDetail(phieu)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDeleteImport(phieu)}
                                                    disabled={deleteImportMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
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

            {/* Import Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Tạo phiếu nhập kho</DialogTitle>
                        <DialogDescription>
                            Nhập thông tin sản phẩm để tạo phiếu nhập kho
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Warehouse Selection */}
                        <div className="space-y-2">
                            <Label>Kho nhập *</Label>
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
                                placeholder="Nhập hàng từ nhà cung cấp"
                            />
                        </div>

                        {/* Reference */}
                        <div className="space-y-2">
                            <Label>Mã tham chiếu (Đơn hàng, PO, ...)</Label>
                            <Input
                                value={maThamChieu}
                                onChange={(e) => setMaThamChieu(e.target.value)}
                                placeholder="DH001, PO-2024-001, ..."
                            />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Sản phẩm nhập kho *</Label>
                                <Button type="button" size="sm" onClick={addImportItem}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Thêm sản phẩm
                                </Button>
                            </div>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {importItems.map((item, index) => (
                                    <Card key={item.id}>
                                        <CardContent className="pt-4">
                                            <div className="grid grid-cols-12 gap-2">
                                                <div className="col-span-12 sm:col-span-3">
                                                    <Label className="text-xs">Sản phẩm *</Label>
                                                    <Select
                                                        value={item.MaSP}
                                                        onValueChange={(val) =>
                                                            updateImportItem(item.id, 'MaSP', val)
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

                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">Số lượng *</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={item.SoLuong}
                                                        onChange={(e) =>
                                                            updateImportItem(item.id, 'SoLuong', e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">Mã lô</Label>
                                                    <Input
                                                        value={item.MaLo}
                                                        onChange={(e) =>
                                                            updateImportItem(item.id, 'MaLo', e.target.value)
                                                        }
                                                        placeholder="Tự động"
                                                    />
                                                </div>

                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">NSX</Label>
                                                    <Input
                                                        type="date"
                                                        value={item.NSX}
                                                        onChange={(e) =>
                                                            updateImportItem(item.id, 'NSX', e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">HSD</Label>
                                                    <Input
                                                        type="date"
                                                        value={item.HSD}
                                                        onChange={(e) =>
                                                            updateImportItem(item.id, 'HSD', e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="col-span-12 sm:col-span-1 flex items-end">
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        onClick={() => removeImportItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {importItems.length === 0 && (
                                    <p className="text-center text-gray-500 py-8">
                                        Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>
                            Hủy
                        </Button>
                        <Button
                            onClick={handleSubmitImport}
                            disabled={importMutation.isPending}
                        >
                            {importMutation.isPending ? 'Đang xử lý...' : 'Tạo phiếu nhập'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Chi tiết phiếu nhập kho</DialogTitle>
                        <DialogDescription>
                            {selectedImport && `Mã phiếu: ${selectedImport.MaPhieu}`}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedImport && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="font-semibold">Ngày tạo:</Label>
                                    <p>{formatDateTime(selectedImport.NgayTao)}</p>
                                </div>
                                <div>
                                    <Label className="font-semibold">Mục đích:</Label>
                                    <p>{selectedImport.MucDich}</p>
                                </div>
                                <div>
                                    <Label className="font-semibold">Mã tham chiếu:</Label>
                                    <p>{selectedImport.MaThamChieu || 'N/A'}</p>
                                </div>
                                <div>
                                    <Label className="font-semibold">Tổng số lô:</Label>
                                    <p>{selectedImport.items?.length || 0}</p>
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
                                            <TableHead className="text-right">Số lượng</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedImport.items?.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.MaSP}</TableCell>
                                                <TableCell>{item.product?.TenSP || 'N/A'}</TableCell>
                                                <TableCell>{item.MaLo}</TableCell>
                                                <TableCell>{formatDate(item.NSX)}</TableCell>
                                                <TableCell>{formatDate(item.HSD)}</TableCell>
                                                <TableCell className="text-right">{item.SLTon}</TableCell>
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
