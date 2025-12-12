import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function ProductForm() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState({
        MaSP: '',
        TenSP: '',
        LoaiSP: '',
        DVT: '',
        GiaBan: '',
        TrangThai: 'Còn hàng',
        MucCanhBaoDatHang: '10',
    });

    const [errors, setErrors] = useState({});

    // Fetch product for edit mode
    const { data: productResponse, isLoading: isLoadingProduct } = useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            const response = await api.get(`/api/products/${id}`);
            return response.data;
        },
        enabled: isEditMode,
    });

    // Fetch categories
    const { data: categoriesResponse } = useQuery({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const response = await api.get('/api/products/categories');
            return response.data;
        },
    });

    const categories = categoriesResponse?.data?.categories || [];

    // Populate form in edit mode
    useEffect(() => {
        if (productResponse?.data) {
            const product = productResponse.data;
            setFormData({
                MaSP: product.MaSP || '',
                TenSP: product.TenSP || '',
                LoaiSP: product.LoaiSP || '',
                DVT: product.DVT || '',
                GiaBan: product.GiaBan?.toString() || '',
                TrangThai: product.TrangThai || 'Còn hàng',
                MucCanhBaoDatHang: product.MucCanhBaoDatHang?.toString() || '10',
            });
        }
    }, [productResponse]);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.post('/api/products', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['products']);
            toast({
                title: 'Thành công',
                description: 'Đã thêm sản phẩm mới',
            });
            navigate('/products');
        },
        onError: (error) => {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.error || 'Không thể thêm sản phẩm',
                variant: 'destructive',
            });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.put(`/api/products/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['product', id]);
            toast({
                title: 'Thành công',
                description: 'Đã cập nhật sản phẩm',
            });
            navigate('/products');
        },
        onError: (error) => {
            toast({
                title: 'Lỗi',
                description: error.response?.data?.error || 'Không thể cập nhật sản phẩm',
                variant: 'destructive',
            });
        },
    });

    const validateForm = () => {
        const newErrors = {};

        if (!formData.TenSP.trim()) {
            newErrors.TenSP = 'Tên sản phẩm là bắt buộc';
        }

        if (!formData.DVT.trim()) {
            newErrors.DVT = 'Đơn vị tính là bắt buộc';
        }

        const giaBan = parseFloat(formData.GiaBan);
        if (!formData.GiaBan || isNaN(giaBan) || giaBan <= 0) {
            newErrors.GiaBan = 'Giá bán phải là số dương';
        }

        // Validate MaSP format only if provided
        if (formData.MaSP && !/^SP\d{3,}$/.test(formData.MaSP)) {
            newErrors.MaSP = 'Mã sản phẩm phải có dạng SPxxx (SP + ít nhất 3 chữ số)';
        }

        const mucCanhBao = parseInt(formData.MucCanhBaoDatHang);
        if (isNaN(mucCanhBao) || mucCanhBao < 0) {
            newErrors.MucCanhBaoDatHang = 'Mức cảnh báo phải là số không âm';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast({
                title: 'Lỗi xác thực',
                description: 'Vui lòng kiểm tra lại thông tin nhập',
                variant: 'destructive',
            });
            return;
        }

        const submitData = {
            TenSP: formData.TenSP.trim(),
            LoaiSP: formData.LoaiSP || null,
            DVT: formData.DVT.trim(),
            GiaBan: parseFloat(formData.GiaBan),
            TrangThai: formData.TrangThai,
            MucCanhBaoDatHang: parseInt(formData.MucCanhBaoDatHang),
        };

        // Include MaSP only if provided
        if (formData.MaSP.trim()) {
            submitData.MaSP = formData.MaSP.trim();
        }

        if (isEditMode) {
            updateMutation.mutate(submitData);
        } else {
            createMutation.mutate(submitData);
        }
    };

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditMode && isLoadingProduct) {
        return (
            <div className="container mx-auto py-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-2 py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="text-gray-500">Đang tải dữ liệu...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Package className="h-8 w-8 text-indigo-600" />
                        {isEditMode ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isEditMode
                            ? 'Cập nhật thông tin sản phẩm'
                            : 'Nhập thông tin sản phẩm mới (Mã sản phẩm sẽ tự động tạo nếu bỏ trống)'}
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Thông tin sản phẩm</CardTitle>
                        <CardDescription>Điền đầy đủ thông tin bên dưới</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* MaSP - Only editable in create mode */}
                        <div className="space-y-2">
                            <Label htmlFor="MaSP">
                                Mã sản phẩm {!isEditMode && <span className="text-gray-500 text-sm">(Tùy chọn)</span>}
                            </Label>
                            <Input
                                id="MaSP"
                                placeholder="SP001, SP002... (Tự động tạo nếu bỏ trống)"
                                value={formData.MaSP}
                                onChange={(e) => handleChange('MaSP', e.target.value)}
                                disabled={isEditMode}
                                className={errors.MaSP ? 'border-red-500' : ''}
                            />
                            {errors.MaSP && <p className="text-red-500 text-sm">{errors.MaSP}</p>}
                            {isEditMode && <p className="text-gray-500 text-sm">Mã sản phẩm không thể thay đổi</p>}
                        </div>

                        {/* TenSP */}
                        <div className="space-y-2">
                            <Label htmlFor="TenSP">
                                Tên sản phẩm <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="TenSP"
                                placeholder="Nhập tên sản phẩm"
                                value={formData.TenSP}
                                onChange={(e) => handleChange('TenSP', e.target.value)}
                                className={errors.TenSP ? 'border-red-500' : ''}
                            />
                            {errors.TenSP && <p className="text-red-500 text-sm">{errors.TenSP}</p>}
                        </div>

                        {/* LoaiSP and DVT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="LoaiSP">Loại sản phẩm</Label>
                                <Select value={formData.LoaiSP} onValueChange={(value) => handleChange('LoaiSP', value)}>
                                    <SelectTrigger id="LoaiSP">
                                        <SelectValue placeholder="Chọn loại sản phẩm" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="DVT">
                                    Đơn vị tính <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="DVT"
                                    placeholder="Kg, Thùng, Chai..."
                                    value={formData.DVT}
                                    onChange={(e) => handleChange('DVT', e.target.value)}
                                    className={errors.DVT ? 'border-red-500' : ''}
                                />
                                {errors.DVT && <p className="text-red-500 text-sm">{errors.DVT}</p>}
                            </div>
                        </div>

                        {/* GiaBan and MucCanhBaoDatHang */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="GiaBan">
                                    Giá bán (VNĐ) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="GiaBan"
                                    type="number"
                                    placeholder="0"
                                    value={formData.GiaBan}
                                    onChange={(e) => handleChange('GiaBan', e.target.value)}
                                    className={errors.GiaBan ? 'border-red-500' : ''}
                                />
                                {errors.GiaBan && <p className="text-red-500 text-sm">{errors.GiaBan}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="MucCanhBaoDatHang">
                                    Mức cảnh báo đặt hàng <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="MucCanhBaoDatHang"
                                    type="number"
                                    placeholder="10"
                                    value={formData.MucCanhBaoDatHang}
                                    onChange={(e) => handleChange('MucCanhBaoDatHang', e.target.value)}
                                    className={errors.MucCanhBaoDatHang ? 'border-red-500' : ''}
                                />
                                {errors.MucCanhBaoDatHang && (
                                    <p className="text-red-500 text-sm">{errors.MucCanhBaoDatHang}</p>
                                )}
                            </div>
                        </div>

                        {/* TrangThai */}
                        <div className="space-y-2">
                            <Label htmlFor="TrangThai">
                                Trạng thái <span className="text-red-500">*</span>
                            </Label>
                            <Select value={formData.TrangThai} onValueChange={(value) => handleChange('TrangThai', value)}>
                                <SelectTrigger id="TrangThai">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Còn hàng">Còn hàng</SelectItem>
                                    <SelectItem value="Hết hàng">Hết hàng</SelectItem>
                                    <SelectItem value="Ngừng kinh doanh">Ngừng kinh doanh</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/products')}>
                                Hủy
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        {isEditMode ? 'Cập nhật' : 'Thêm sản phẩm'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
