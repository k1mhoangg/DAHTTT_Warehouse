import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function ProductList() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    // Fetch products
    const { data: productsResponse, isLoading, error } = useQuery({
        queryKey: ['products', searchQuery, filterCategory, filterStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (filterCategory !== 'all') params.append('loai', filterCategory);
            if (filterStatus !== 'all') params.append('trang_thai', filterStatus);

            const response = await api.get(`/products?${params.toString()}`);
            return response.data;
        },
    });

    const products = productsResponse?.data?.items || [];
    const totalProducts = productsResponse?.data?.total || 0;

    // Fetch categories
    const { data: categoriesResponse } = useQuery({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const response = await api.get('/products/categories');
            return response.data;
        },
    });

    const categories = categoriesResponse?.data?.categories || [];

    // Delete product mutation
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const response = await api.delete(`/products/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['products']);
            toast({
                title: 'Thành công',
                description: 'Đã xóa sản phẩm',
            });
        },
        onError: (error) => {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.error || 'Không thể xóa sản phẩm',
                variant: 'destructive',
            });
        },
    });

    const handleDelete = (product) => {
        if (window.confirm(`Xác nhận xóa sản phẩm "${product.TenSP}"?\n\nLưu ý: Chỉ có thể xóa sản phẩm không còn tồn kho.`)) {
            deleteMutation.mutate(product.MaSP);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(value);
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Còn hàng': 'bg-green-100 text-green-800',
            'Hết hàng': 'bg-red-100 text-red-800',
            'Ngừng kinh doanh': 'bg-gray-100 text-gray-800',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Package className="h-8 w-8 text-indigo-600" />
                        Quản lý sản phẩm
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Quản lý danh mục sản phẩm trong kho ({totalProducts} sản phẩm)
                    </p>
                </div>
                <Button onClick={() => navigate('/products/new')} size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    Thêm sản phẩm
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Bộ lọc</CardTitle>
                    <CardDescription>Tìm kiếm và lọc sản phẩm</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Tìm theo tên hoặc mã sản phẩm..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Category Filter */}
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Loại sản phẩm" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả loại</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                        {category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                                <SelectItem value="Còn hàng">Còn hàng</SelectItem>
                                <SelectItem value="Hết hàng">Hết hàng</SelectItem>
                                <SelectItem value="Ngừng kinh doanh">Ngừng kinh doanh</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Error State */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="text-red-800 font-semibold">Lỗi tải dữ liệu</p>
                        <p className="text-red-600 text-sm mt-1">{error.message}</p>
                    </CardContent>
                </Card>
            )}

            {/* Products Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã SP</TableHead>
                                    <TableHead>Tên sản phẩm</TableHead>
                                    <TableHead>Loại</TableHead>
                                    <TableHead>ĐVT</TableHead>
                                    <TableHead className="text-right">Giá bán</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead className="text-right">Mức cảnh báo</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                                <p className="text-gray-500">Đang tải dữ liệu...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500 font-medium">Không tìm thấy sản phẩm nào</p>
                                            <p className="text-gray-400 text-sm mt-1">Thử thay đổi bộ lọc hoặc thêm sản phẩm mới</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
                                        <TableRow key={product.MaSP}>
                                            <TableCell className="font-medium">{product.MaSP}</TableCell>
                                            <TableCell className="font-medium">{product.TenSP}</TableCell>
                                            <TableCell>{product.LoaiSP || '—'}</TableCell>
                                            <TableCell>{product.DVT || '—'}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(product.GiaBan)}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(product.TrangThai)}</TableCell>
                                            <TableCell className="text-right">{product.MucCanhBaoDatHang}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => navigate(`/products/${product.MaSP}/edit`)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(product)}
                                                        disabled={deleteMutation.isPending}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
