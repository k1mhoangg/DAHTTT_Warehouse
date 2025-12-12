# Tính năng Nhập Kho và Xuất Kho - Tài liệu Kỹ thuật

## 📋 Tổng quan

Đã hiện thực đầy đủ 2 tính năng:
- **UC03: Nhập kho** - Tạo phiếu nhập kho, quản lý lô sản phẩm, tự động generate mã vạch
- **UC04: Xuất kho** - Xuất hàng với chiến lược FEFO (First Expire First Out)

---

## 🔧 Backend API

### 1. Import Warehouse (`POST /api/warehouse/import`)

**Request:**
```json
{
  "MaKho": "KHO001",
  "MucDich": "Nhập hàng từ nhà cung cấp",
  "MaThamChieu": "PO001",
  "items": [
    {
      "MaSP": "SP001",
      "SoLuong": 100,
      "NSX": "2024-12-01",
      "HSD": "2025-12-01",
      "MaLo": "LO001" // Optional, auto-generate if null
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Import successful",
  "data": {
    "phieu": {
      "MaPhieu": "PNK000004",
      "NgayTao": "2024-12-12T10:30:00",
      "MucDich": "Nhập hàng từ nhà cung cấp",
      "MaThamChieu": "PO001"
    },
    "batches": [
      {
        "MaSP": "SP001",
        "MaLo": "LO000011",
        "MaVach": "8936012345678",
        "NSX": "2024-12-01",
        "HSD": "2025-12-01",
        "SLTon": 100,
        "MaKho": "KHO001"
      }
    ]
  }
}
```

**Business Logic:**
1. Validate kho tồn tại
2. Generate `MaPhieu` (PNK + 6 digits)
3. Với mỗi item:
   - Auto-generate `MaLo` nếu không có
   - Generate unique `MaVach` (13 digits barcode)
   - Nếu lô đã tồn tại → Cộng thêm `SLTon`
   - Nếu lô mới → Tạo record mới trong `LoSP`
4. Lưu record trong `TaoPhieu` (audit trail)
5. Commit transaction

---

### 2. Export Warehouse (`POST /api/warehouse/export`)

**Request:**
```json
{
  "MaKho": "KHO001",
  "MucDich": "Xuất bán hàng",
  "MaThamChieu": "SO001",
  "items": [
    {
      "MaSP": "SP001",
      "SoLuong": 150,
      "MaLo": null // Auto FEFO if null
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Export successful",
  "data": {
    "phieu": {
      "MaPhieu": "PXK000003",
      "NgayTao": "2024-12-12T11:00:00",
      "MucDich": "Xuất bán hàng"
    },
    "batches": [
      {
        "MaSP": "SP001",
        "MaLo": "LO001",
        "HSD": "2025-11-01",
        "SLTon": 400,
        "exported_quantity": 100
      },
      {
        "MaSP": "SP001",
        "MaLo": "LO011",
        "HSD": "2025-12-01",
        "SLTon": 50,
        "exported_quantity": 50
      }
    ]
  }
}
```

**FEFO Algorithm:**
```python
# Nếu có MaLo cụ thể
if ma_lo_yeu_cau:
    batch = find_batch(ma_sp, ma_lo_yeu_cau, ma_kho)
    if batch.SLTon >= so_luong_can_xuat:
        batch.SLTon -= so_luong_can_xuat
    else:
        return error("Insufficient stock")

# Nếu không có MaLo → FEFO
else:
    batches = query.filter(
        MaSP == ma_sp,
        MaKho == ma_kho,
        SLTon > 0
    ).order_by(HSD.asc())  # Sớm nhất trước
    
    remaining = so_luong_can_xuat
    for batch in batches:
        if batch.SLTon >= remaining:
            batch.SLTon -= remaining
            remaining = 0
            break
        else:
            remaining -= batch.SLTon
            batch.SLTon = 0
    
    if remaining > 0:
        return error(f"Insufficient stock. Missing {remaining} units")
```

---

### 3. Suggest FEFO (`POST /api/warehouse/export/suggest-fefo`)

**Request:**
```json
{
  "MaSP": "SP001",
  "MaKho": "KHO001",
  "SoLuong": 150
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggested_batches": [
      {
        "MaLo": "LO001",
        "HSD": "2025-11-01",
        "SLTon": 500,
        "suggested_quantity": 150
      }
    ],
    "can_fulfill": true,
    "shortage": 0
  }
}
```

Hoặc nếu thiếu hàng:
```json
{
  "can_fulfill": false,
  "shortage": 50,
  "suggested_batches": [...]
}
```

---

### 4. Helper APIs

#### Get Warehouses
```
GET /api/warehouse/warehouses
Response: { warehouses: [{ MaKho, DiaChi, Loai, SucChua }] }
```

#### Get Batches
```
GET /api/warehouse/batches?MaSP=SP001&MaKho=KHO001&has_stock=true
Response: { batches: [{ MaSP, MaLo, MaVach, NSX, HSD, SLTon, TenSP, DVT }] }
```

#### Import History
```
GET /api/warehouse/import-history?page=1&per_page=10
Response: { items: [...], total, page, pages }
```

#### Export History
```
GET /api/warehouse/export-history?page=1&per_page=10
Response: { items: [...], total, page, pages }
```

---

## 🎨 Frontend Components

### 1. WarehouseImport.jsx

**Features:**
- ✅ Form nhập thông tin kho và mục đích
- ✅ Dynamic table: Thêm/xóa dòng sản phẩm
- ✅ Select kho từ API `/warehouses`
- ✅ Select sản phẩm từ API `/products`
- ✅ Date pickers cho NSX/HSD
- ✅ Mã lô tự động (để trống) hoặc tự nhập
- ✅ Validation: Kho bắt buộc, ít nhất 1 sản phẩm
- ✅ Toast notification thành công/lỗi
- ✅ Loading state khi đang submit

**UI Structure:**
```
┌─────────────────────────────────────┐
│ 📦 Nhập kho                         │
├─────────────────────────────────────┤
│ ┌─ Thông tin phiếu nhập ──────────┐│
│ │ Kho nhập: [Select]              ││
│ │ Mã tham chiếu: [Input]          ││
│ │ Mục đích: [Input]               ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─ Danh sách sản phẩm ────────────┐│
│ │ [+ Thêm dòng]                   ││
│ │                                 ││
│ │ SP | SL | NSX | HSD | Mã lô |🗑││
│ │ ── ── ─── ──── ────── ───────││
│ │ [Select] [Input] [Date] [...] ││
│ └─────────────────────────────────┘│
│                                     │
│           [Hủy] [Tạo phiếu nhập]   │
└─────────────────────────────────────┘
```

**Key Code:**
```jsx
const importMutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.post('/api/warehouse/import', data);
    return response.data;
  },
  onSuccess: (response) => {
    toast({ title: 'Thành công', description: `Phiếu ${response.data.phieu.MaPhieu}` });
    // Reset form
  }
});
```

---

### 2. WarehouseExport.jsx

**Features:**
- ✅ Form xuất kho với chọn kho
- ✅ Dynamic items với MaSP, SoLuong, MaLo
- ✅ 💡 FEFO Suggestion button cho mỗi item
- ✅ Hiển thị suggested batches với bảng chi tiết
- ✅ Warning ⚠️ khi thiếu hàng
- ✅ Auto FEFO nếu không chọn lô
- ✅ Toast và loading states

**UI Structure:**
```
┌──────────────────────────────────────┐
│ 📤 Xuất kho (FEFO)                   │
├──────────────────────────────────────┤
│ ┌─ Thông tin phiếu xuất ──────────┐ │
│ │ Kho xuất: [Select]              │ │
│ │ Mục đích: [Input]               │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─ Sản phẩm 1 ─────────────────────┐│
│ │ SP: [Select] SL: [Input]         ││
│ │ Mã lô: [Input] [💡 Gợi ý]        ││
│ │                                  ││
│ │ ┌─ 💡 Gợi ý FEFO ───────────────┐││
│ │ │ ✅ Có đủ hàng, xuất từ 2 lô   │││
│ │ │                               │││
│ │ │ Lô | HSD | Tồn | Xuất        │││
│ │ │ LO1 | 2025-01 | 500 | 100    │││
│ │ │ LO2 | 2025-03 | 300 | 50     │││
│ │ └───────────────────────────────┘││
│ └──────────────────────────────────┘│
│                                      │
│ [+ Thêm dòng]                        │
│                                      │
│           [Hủy] [Tạo phiếu xuất]    │
└──────────────────────────────────────┘
```

**FEFO Suggestion Logic:**
```jsx
const handleSuggestFefo = (item) => {
  suggestFefoMutation.mutate({
    MaSP: item.MaSP,
    MaKho: formData.MaKho,
    SoLuong: item.SoLuong,
    itemId: item.id
  });
};

// Display suggested batches
{item.suggestedBatches && (
  <div className="bg-blue-50 p-3">
    {item.suggestedBatches.can_fulfill ? (
      <p>✅ Có đủ hàng, xuất từ {batches.length} lô</p>
    ) : (
      <p>⚠️ Thiếu hàng: {shortage} đơn vị</p>
    )}
    <Table>
      {/* Show suggested batches */}
    </Table>
  </div>
)}
```

---

## 🗄️ Database Schema

### PhieuNhapKho
```sql
CREATE TABLE PhieuNhapKho (
    MaPhieu VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME,
    MucDich VARCHAR(200),
    MaThamChieu VARCHAR(50),
    MaPhieuCK VARCHAR(20)  -- FK to PhieuChuyenKho (optional)
);
```

### PhieuXuatKho
```sql
CREATE TABLE PhieuXuatKho (
    MaPhieu VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME,
    MucDich VARCHAR(200),
    MaThamChieu VARCHAR(50),
    MaPhieuCK VARCHAR(20)
);
```

### LoSP (Lô Sản Phẩm)
```sql
CREATE TABLE LoSP (
    MaSP VARCHAR(20),
    MaLo VARCHAR(20),
    MaVach VARCHAR(50) UNIQUE,  -- Barcode
    NSX DATE,                   -- Ngày sản xuất
    HSD DATE,                   -- Hạn sử dụng
    SLTon INT,                  -- Số lượng tồn
    MaKho VARCHAR(20),
    MaPhieuNK VARCHAR(20),      -- FK to PhieuNhapKho
    MaPhieuXK VARCHAR(20),      -- FK to PhieuXuatKho
    PRIMARY KEY (MaSP, MaLo)
);
```

### TaoPhieu (Audit Trail)
```sql
CREATE TABLE TaoPhieu (
    MaNV VARCHAR(20),
    MaPhieuTao VARCHAR(20),
    PRIMARY KEY (MaNV, MaPhieuTao)
);
```

---

## 📊 Sample Data

```sql
-- Kho
INSERT INTO KhoHang VALUES
('KHO001', '123 Nguyễn Văn Linh', 'Kho thường', 5000),
('KHO002', '456 Lê Văn Việt', 'Kho lỗi', 1000);

-- Sản phẩm
INSERT INTO SanPham VALUES
('SP001', 'Gạo ST25', 'Thực phẩm', 'Còn hàng', 'Kg', 25000, 100),
('SP003', 'Coca Cola', 'Đồ uống', 'Còn hàng', 'Lon', 12000, 200);

-- Lô sản phẩm với HSD khác nhau (để test FEFO)
INSERT INTO LoSP VALUES
('SP001', 'LO001', '8936012345001', '2024-11-01', '2025-11-01', 500, 'KHO001', 'PNK001'),
('SP001', 'LO011', '8936012345011', '2024-12-01', '2025-12-01', 100, 'KHO001', 'PNK002');

-- Khi xuất 150 SP001 → FEFO sẽ lấy:
--   LO001 (HSD 2025-11-01): 100
--   LO011 (HSD 2025-12-01): 50
```

---

## 🧪 Testing Scenarios

### Test 1: Import with Auto-generate
```bash
POST /api/warehouse/import
{
  "MaKho": "KHO001",
  "items": [{ "MaSP": "SP001", "SoLuong": 100 }]
}

Expected:
- MaLo: LO000012 (auto)
- MaVach: 8936XXXXXXXXX (13 digits)
- SLTon: 100
```

### Test 2: FEFO Simple (1 batch)
```bash
# Kho có: LO001 (HSD: 2025-11-01, SLTon: 500)
POST /api/warehouse/export
{ "MaKho": "KHO001", "items": [{ "MaSP": "SP001", "SoLuong": 100 }] }

Expected:
- Xuất 100 từ LO001
- LO001.SLTon = 400
```

### Test 3: FEFO Multi-batch
```bash
# Kho có: 
#   LO001 (HSD: 2025-11-01, SLTon: 500)
#   LO011 (HSD: 2025-12-01, SLTon: 100)

POST /api/warehouse/export
{ "items": [{ "MaSP": "SP001", "SoLuong": 550 }] }

Expected:
- Xuất 500 từ LO001 (HSD sớm hơn)
- Xuất 50 từ LO011
- LO001.SLTon = 0
- LO011.SLTon = 50
```

### Test 4: Insufficient Stock
```bash
POST /api/warehouse/export
{ "items": [{ "MaSP": "SP001", "SoLuong": 9999 }] }

Expected:
- Error 400
- Message: "Insufficient stock. Missing XXX units"
```

---

## 🎯 Success Criteria

- ✅ **Auto-generation**: Mã lô, mã vạch tự động tạo unique
- ✅ **FEFO Logic**: Xuất lô HSD sớm nhất trước
- ✅ **Multi-batch Support**: Tự động chia xuất nhiều lô
- ✅ **Shortage Detection**: Warning rõ ràng khi thiếu hàng
- ✅ **Validation**: Đầy đủ validation frontend + backend
- ✅ **UI/UX**: Giao diện đẹp, responsive, loading states
- ✅ **Audit Trail**: Lưu lại người tạo phiếu
- ✅ **Error Handling**: Toast notification chi tiết
- ✅ **API Integration**: TanStack Query với cache invalidation

---

## 📁 Files Changed

### Backend
- `backend/app/routes/warehouse.py` - Thêm 7 endpoints mới
- `backend/app/models/__init__.py` - Đã có models

### Frontend
- `frontend/src/pages/warehouse/WarehouseImport.jsx` - 350+ lines, full CRUD
- `frontend/src/pages/warehouse/WarehouseExport.jsx` - 450+ lines, FEFO suggestion

### Documentation
- `TEST_WAREHOUSE.md` - Hướng dẫn test chi tiết
- `WAREHOUSE_TECHNICAL.md` - Tài liệu kỹ thuật này

---

## 🚀 Deployment Checklist

- [x] Backend routes registered trong `app/__init__.py`
- [x] Frontend routes configured trong `App.jsx`
- [x] Database có sample data để test
- [x] UI components đầy đủ (Button, Input, Table, Select...)
- [x] API endpoints tested với curl
- [x] FEFO algorithm implemented và tested
- [x] Error handling đầy đủ
- [x] Loading states và toast notifications
- [x] Documentation hoàn chỉnh

---

## 🔜 Next Steps

1. ✅ **Nhập kho** - DONE
2. ✅ **Xuất kho FEFO** - DONE
3. 🚧 **Chuyển kho** - Backend done, cần frontend
4. 🚧 **Kiểm kho** - Cần hiện thực
5. 🚧 **Điều chỉnh kho** - Cần hiện thực
6. 🚧 **Hủy hàng** - Cần hiện thực

---

**Tác giả**: GitHub Copilot  
**Ngày**: 12/12/2024  
**Version**: 1.0.0
