# Test Warehouse Import/Export Features

## Hướng dẫn test tính năng Nhập kho và Xuất kho

### 1. Chuẩn bị

```bash
# Terminal 1: Start backend
cd backend
python run.py

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 2. Login
- URL: http://localhost:5174/login
- Tài khoản: `nva_kho` / `123456` (Quản lý)
- Sau khi đăng nhập, vào menu **Kho hàng**

---

## TEST NHẬP KHO (UC03)

### A. Test Case 1: Nhập hàng mới (Auto-generate lô)

**Bước thực hiện:**
1. Vào trang **Nhập kho**
2. Chọn **Kho nhập**: `KHO001`
3. **Mục đích**: "Nhập hàng từ nhà cung cấp ABC"
4. **Mã tham chiếu**: "PO20241212"
5. Thêm sản phẩm:
   - **SP001** (Gạo ST25): Số lượng `100`, NSX: `2024-12-01`, HSD: `2025-12-01`, Mã lô: *(để trống - auto)*
   - **SP003** (Coca Cola): Số lượng `200`, NSX: `2024-12-10`, HSD: `2025-06-10`, Mã lô: *(để trống - auto)*
6. Click **Tạo phiếu nhập**

**Kết quả mong đợi:**
- ✅ Toast thông báo thành công với mã phiếu (VD: PNK000004)
- ✅ Mã lô tự động được tạo (VD: LO000011, LO000012)
- ✅ Mã vạch (barcode) tự động được tạo
- ✅ Tồn kho của sản phẩm tăng

**Test bằng API:**
```bash
# Login trước
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "nva_kho", "password": "123456"}'
# => Lưu access_token

# Test Import
curl -X POST http://localhost:5000/api/warehouse/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "MaKho": "KHO001",
    "MucDich": "Nhập hàng từ nhà cung cấp",
    "MaThamChieu": "PO20241212",
    "items": [
      {
        "MaSP": "SP001",
        "SoLuong": 100,
        "NSX": "2024-12-01",
        "HSD": "2025-12-01"
      },
      {
        "MaSP": "SP003",
        "SoLuong": 200,
        "NSX": "2024-12-10",
        "HSD": "2025-06-10"
      }
    ]
  }'
```

### B. Test Case 2: Nhập hàng với mã lô tự chọn

**Bước thực hiện:**
1. Chọn kho: `KHO001`
2. Thêm sản phẩm với **Mã lô tự chọn**: `CUSTOM001`
3. Tạo phiếu

**Kết quả mong đợi:**
- ✅ Sử dụng mã lô `CUSTOM001` thay vì auto-generate

### C. Test Case 3: Validation errors

**Test các trường hợp lỗi:**
1. ❌ Không chọn kho → Hiện lỗi "Vui lòng chọn kho"
2. ❌ Không thêm sản phẩm → Hiện lỗi "Vui lòng thêm ít nhất một sản phẩm"
3. ❌ Số lượng = 0 hoặc âm → Bị bỏ qua
4. ❌ Sản phẩm không tồn tại → Backend trả lỗi 404

---

## TEST XUẤT KHO (UC04) - FEFO

### A. Test Case 1: Xuất hàng với FEFO tự động

**Bước thực hiện:**
1. Vào trang **Xuất kho**
2. Chọn **Kho xuất**: `KHO001`
3. **Mục đích**: "Xuất bán hàng"
4. **Mã tham chiếu**: "SO20241212"
5. Thêm sản phẩm:
   - **SP005** (Bánh mì): Số lượng `50`, Mã lô: *(để trống)*
6. Click nút **💡** (Lightbulb) để xem gợi ý FEFO
7. Click **Tạo phiếu xuất**

**Kết quả mong đợi:**
- ✅ Hiển thị gợi ý FEFO với lô có HSD sớm nhất
- ✅ Hiển thị "Có đủ hàng, xuất từ X lô"
- ✅ Bảng chi tiết: Lô, HSD, Tồn kho, Xuất
- ✅ Tự động xuất từ lô có HSD sớm nhất
- ✅ Toast thành công với mã phiếu

**Ví dụ FEFO:**
```
Sản phẩm: SP005 - Bánh mì
Cần xuất: 50
Kho có:
  - LO005: HSD 2024-12-05, Tồn 300 → Xuất 50 từ lô này
```

### B. Test Case 2: Xuất nhiều lô (FEFO phức tạp)

**Bước thực hiện:**
1. Thêm sản phẩm: **SP001** (Gạo ST25), Số lượng `600`
2. Click gợi ý FEFO

**Kết quả mong đợi:**
```
LO001: HSD 2025-11-01, Tồn 500 → Xuất 500
LO011: HSD 2025-12-01, Tồn 100 → Xuất 100
Tổng: Đủ 600
```

### C. Test Case 3: Không đủ hàng

**Bước thực hiện:**
1. Thêm sản phẩm: **SP002**, Số lượng `999999`
2. Click gợi ý FEFO

**Kết quả mong đợi:**
- ⚠️ Hiển thị warning màu đỏ
- ⚠️ "Thiếu hàng: XXX đơn vị"
- ❌ Backend trả lỗi 400 khi submit

### D. Test Case 4: Chọn lô cụ thể (Không dùng FEFO)

**Bước thực hiện:**
1. Thêm sản phẩm với **Mã lô cụ thể**: `LO001`
2. Số lượng: `50`
3. Tạo phiếu

**Kết quả mong đợi:**
- ✅ Xuất đúng 50 từ lô LO001
- ✅ Không áp dụng FEFO

---

## TEST API ENDPOINTS

### 1. Get Warehouses
```bash
curl http://localhost:5000/api/warehouse/warehouses \
  -H "Authorization: Bearer YOUR_TOKEN"
# => Danh sách kho: KHO001, KHO002
```

### 2. Get Batches (Lô sản phẩm)
```bash
# Lấy tất cả lô
curl http://localhost:5000/api/warehouse/batches \
  -H "Authorization: Bearer YOUR_TOKEN"

# Lọc theo sản phẩm
curl "http://localhost:5000/api/warehouse/batches?MaSP=SP001" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Lọc theo kho và chỉ lấy còn hàng
curl "http://localhost:5000/api/warehouse/batches?MaKho=KHO001&has_stock=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Suggest FEFO
```bash
curl -X POST http://localhost:5000/api/warehouse/export/suggest-fefo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "MaSP": "SP001",
    "MaKho": "KHO001",
    "SoLuong": 100
  }'
# => Gợi ý lô xuất theo FEFO
```

### 4. Export with FEFO
```bash
curl -X POST http://localhost:5000/api/warehouse/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "MaKho": "KHO001",
    "MucDich": "Xuất bán hàng",
    "MaThamChieu": "SO001",
    "items": [
      {
        "MaSP": "SP001",
        "SoLuong": 100
      }
    ]
  }'
# => Tự động FEFO vì không có MaLo
```

### 5. Import History
```bash
curl "http://localhost:5000/api/warehouse/import-history?page=1&per_page=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Export History
```bash
curl "http://localhost:5000/api/warehouse/export-history?page=1&per_page=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## CHECK DATABASE

```sql
-- Xem tất cả lô sản phẩm
SELECT 
    l.MaSP, 
    s.TenSP, 
    l.MaLo, 
    l.MaVach, 
    l.HSD, 
    l.SLTon, 
    l.MaKho
FROM LoSP l
JOIN SanPham s ON l.MaSP = s.MaSP
ORDER BY l.HSD ASC;

-- Xem phiếu nhập
SELECT * FROM PhieuNhapKho ORDER BY NgayTao DESC;

-- Xem phiếu xuất
SELECT * FROM PhieuXuatKho ORDER BY NgayTao DESC;

-- Kiểm tra tồn kho sau nhập/xuất
SELECT MaSP, MaLo, SLTon, HSD 
FROM LoSP 
WHERE MaSP = 'SP001' 
ORDER BY HSD ASC;
```

---

## EXPECTED BEHAVIORS

### FEFO Logic
1. **First Expire First Out**: Luôn xuất lô có HSD sớm nhất trước
2. **Auto-suggest**: Gợi ý các lô cần xuất khi click 💡
3. **Multi-batch export**: Tự động chia xuất nhiều lô nếu 1 lô không đủ
4. **Shortage warning**: Cảnh báo rõ ràng khi thiếu hàng

### Import Features
1. **Auto-generate**: Tự động tạo MaLo và MaVach nếu không nhập
2. **Batch update**: Nếu lô đã tồn tại → Cộng thêm số lượng
3. **Multi-warehouse**: Hỗ trợ nhiều kho (KHO001, KHO002)
4. **Metadata**: Lưu MucDich, MaThamChieu, người tạo

### UI/UX
1. **Dynamic items**: Thêm/xóa dòng sản phẩm động
2. **Validation real-time**: Hiển thị lỗi ngay khi nhập
3. **Toast notifications**: Thông báo thành công/lỗi rõ ràng
4. **Loading states**: Hiển thị loading khi đang xử lý
5. **Suggested batches**: Hiển thị bảng gợi ý FEFO đẹp mắt

---

## NOTES

1. **Mã vạch (Barcode)**: Được tự động generate, format: 13 số
2. **FEFO Priority**: HSD càng sớm → Priority càng cao
3. **Stock tracking**: Tự động cập nhật SLTon khi nhập/xuất
4. **Audit trail**: Lưu MaNV trong TaoPhieu để biết ai tạo phiếu
5. **Date format**: Backend dùng ISO, frontend hiển thị dd/mm/yyyy

---

## SUCCESS CRITERIA

- ✅ Nhập hàng tạo lô mới thành công
- ✅ Mã lô và mã vạch tự động generate
- ✅ FEFO suggestion hiển thị chính xác
- ✅ Xuất hàng tự động chọn lô HSD sớm nhất
- ✅ Validation hiển thị lỗi đúng
- ✅ Toast notifications hoạt động
- ✅ Tồn kho cập nhật chính xác sau mỗi thao tác
- ✅ Lịch sử nhập/xuất được lưu đầy đủ
