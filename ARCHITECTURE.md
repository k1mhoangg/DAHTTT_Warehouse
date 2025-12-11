# Kiến trúc hệ thống - Architecture Overview

## 🏗️ Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                     │
│                  React + Tailwind + Shadcn               │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/HTTPS
                        │ REST API
┌───────────────────────▼─────────────────────────────────┐
│                    FLASK BACKEND                         │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Routes    │→ │ Controllers │→ │  Services   │    │
│  │  (API)      │  │   (Logic)   │  │  (Business) │    │
│  └─────────────┘  └─────────────┘  └──────┬──────┘    │
│                                            │             │
│                                    ┌───────▼───────┐    │
│                                    │   SQLAlchemy  │    │
│                                    │     (ORM)     │    │
│                                    └───────┬───────┘    │
└────────────────────────────────────────────┼────────────┘
                                             │
┌────────────────────────────────────────────▼────────────┐
│                    MySQL DATABASE                        │
│            (QuanLyKho - init.sql schema)                 │
└──────────────────────────────────────────────────────────┘
```

## 📁 Cấu trúc Backend (Flask - MVC Pattern)

```
backend/
├── app/
│   ├── __init__.py              # App factory, extensions init
│   ├── config.py                # Configuration classes
│   │
│   ├── models/                  # SQLAlchemy Models (M)
│   │   └── __init__.py          # All database models
│   │
│   ├── controllers/             # Business Logic (C)
│   │   ├── product_controller.py
│   │   ├── warehouse_controller.py
│   │   ├── order_controller.py
│   │   └── ...
│   │
│   ├── routes/                  # API Endpoints (V/Router)
│   │   ├── __init__.py
│   │   ├── auth.py              # Authentication
│   │   ├── products.py          # UC01
│   │   ├── orders.py            # UC02
│   │   ├── warehouse.py         # UC03-05, 09
│   │   ├── warehouse_inventory.py # UC06-07
│   │   ├── reports.py           # UC08
│   │   └── sales.py             # UC10-11
│   │
│   ├── services/                # Service Layer
│   │   ├── fefo_service.py      # FEFO algorithm
│   │   ├── barcode_service.py   # Barcode generation
│   │   └── report_service.py    # Report generation
│   │
│   └── utils/                   # Utilities
│       ├── auth.py              # Auth decorators
│       ├── helpers.py           # Helper functions
│       └── error_handlers.py    # Error handling
│
├── migrations/                  # Database migrations
│   ├── 001_add_password_fields.py
│   └── README.md
│
├── requirements.txt             # Python dependencies
├── run.py                       # Entry point
└── .env                         # Environment variables
```

## 📁 Cấu trúc Frontend (React)

```
frontend/
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Root component with routing
│   ├── index.css                # Global styles (Tailwind)
│   │
│   ├── components/              # Reusable components
│   │   ├── layouts/
│   │   │   ├── MainLayout.jsx   # Main app layout
│   │   │   └── AuthLayout.jsx   # Auth pages layout
│   │   ├── ui/                  # Shadcn/ui components
│   │   └── common/              # Shared components
│   │
│   ├── pages/                   # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── products/            # UC01
│   │   │   ├── ProductList.jsx
│   │   │   └── ProductForm.jsx
│   │   ├── orders/              # UC02
│   │   ├── warehouse/           # UC03-07, 09
│   │   ├── reports/             # UC08
│   │   └── sales/               # UC10-11
│   │
│   ├── services/                # API services
│   │   └── api.js               # API calls
│   │
│   ├── store/                   # State management
│   │   └── authStore.js         # Zustand auth store
│   │
│   ├── lib/                     # Libraries
│   │   ├── api.js               # Axios instance
│   │   └── utils.js             # Utility functions
│   │
│   └── hooks/                   # Custom React hooks
│       └── useAuth.js
│
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env
```

## 🔐 Authentication Flow

```
1. User Login
   ├─> Frontend: Submit credentials
   ├─> Backend: POST /api/auth/login
   ├─> Verify username & password (bcrypt)
   ├─> Generate JWT token
   └─> Return: { access_token, user_info }

2. Authenticated Request
   ├─> Frontend: Add token to header
   │   Authorization: Bearer <token>
   ├─> Backend: Verify JWT token
   ├─> Check role/permissions
   └─> Process request

3. Logout
   ├─> Frontend: Remove token from storage
   └─> Backend: (Stateless - no session)
```

## 🔄 Request Flow (Ví dụ: Nhập kho - UC03)

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Frontend │         │  Routes  │         │Controller│         │ Database │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ POST /import       │                    │                    │
     ├───────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │ verify JWT         │                    │
     │                    │ check role         │                    │
     │                    │                    │                    │
     │                    │ validate data      │                    │
     │                    ├───────────────────>│                    │
     │                    │                    │                    │
     │                    │                    │ create PhieuNhapKho│
     │                    │                    ├───────────────────>│
     │                    │                    │                    │
     │                    │                    │ create LoSP batches│
     │                    │                    ├───────────────────>│
     │                    │                    │                    │
     │                    │                    │ generate barcode   │
     │                    │                    ├───────────────────>│
     │                    │                    │                    │
     │                    │<───────────────────┤                    │
     │<───────────────────┤                    │                    │
     │                    │                    │                    │
     │ { success, data }  │                    │                    │
     │                    │                    │                    │
```

## 🗄️ Database Schema Overview

### Core Tables
- **NhanVienKho**: Warehouse staff (Quản lý, Nhân viên)
- **ThuNgan**: Cashiers
- **SanPham**: Products
- **LoSP**: Product batches (with NSX, HSD, barcode)
- **KhoHang**: Warehouses (Kho thường, Kho lỗi)

### Transaction Tables
- **PhieuNhapKho**: Import receipts (UC03)
- **PhieuXuatKho**: Export receipts (UC04, UC09)
- **PhieuChuyenKho**: Transfer receipts (UC05)
- **PhieuKiemKho**: Inventory check (UC06)
- **BaoCao**: Inventory reports (UC06, UC07)

### Sales Tables
- **HoaDon**: Invoices (UC11)
- **HoaDonSP**: Invoice items
- **YeuCauTraHang**: Return requests (UC10)

### Relations
- **TaoPhieu**: Who created which receipt
- **DuyetPhieu**: Who approved which receipt
- **DatHang**: Order from suppliers (UC02)
- **LoThuocNCC**: Batch-Supplier relationship

## 🎯 Use Cases Mapping

| UC | Tên | Role | Routes | Models |
|----|-----|------|--------|--------|
| UC01 | Quản lý sản phẩm | Quản lý | `/products` | SanPham, LoSP |
| UC02 | Đặt hàng NCC | Nhân viên | `/orders` | DatHang, NhaCungCap |
| UC03 | Nhập kho | Nhân viên | `/warehouse/import` | PhieuNhapKho, LoSP |
| UC04 | Xuất kho (FEFO) | Nhân viên | `/warehouse/export` | PhieuXuatKho, LoSP |
| UC05 | Chuyển kho | Nhân viên | `/warehouse/transfer` | PhieuChuyenKho |
| UC06 | Kiểm kho | Nhân viên | `/warehouse/inventory` | PhieuKiemKho, BaoCao |
| UC07 | Điều chỉnh kho | Nhân viên | `/warehouse/adjustment` | PhieuNK, PhieuXK |
| UC08 | Báo cáo | Quản lý | `/reports` | All tables |
| UC09 | Hủy hàng | Nhân viên | `/warehouse/discard` | PhieuXuatKho |
| UC10 | Trả hàng | Thu ngân | `/sales/returns` | YeuCauTraHang |
| UC11 | Bán hàng | Thu ngân | `/sales` | HoaDon, HoaDonSP |

## 🔑 Role-Based Access Control (RBAC)

```python
# Backend decorator
@role_required('Quản lý', 'Nhân viên')
def some_function():
    pass

# Frontend route protection
<ProtectedRoute allowedRoles={['Quản lý']}>
    <ProductList />
</ProtectedRoute>
```

### Permission Matrix

| Feature | Quản lý | Nhân viên | Thu ngân |
|---------|---------|----------|----------|
| Quản lý sản phẩm | ✅ | ❌ | ❌ |
| Đặt hàng | ✅ | ✅ | ❌ |
| Nhập/Xuất/Chuyển kho | ✅ | ✅ | ❌ |
| Kiểm kho & Điều chỉnh | ✅ | ✅ | ❌ |
| Hủy hàng | ✅ | ✅ | ❌ |
| Báo cáo | ✅ | ❌ | ✅ |
| Bán hàng | ❌ | ❌ | ✅ |
| Trả hàng | ❌ | ❌ | ✅ |

## 🚀 Performance Considerations

### Backend
- **Database Indexing**: Indexed on MaKho, HSD, NgayTao
- **Pagination**: Default 20 items per page
- **Query Optimization**: Use joins instead of multiple queries
- **Caching**: Consider Redis for reports

### Frontend
- **Code Splitting**: Routes lazy loaded
- **React Query**: Automatic caching & refetching
- **Debouncing**: Search inputs debounced
- **Virtualization**: Large lists virtualized

## 🔒 Security Features

1. **Password Hashing**: bcrypt
2. **JWT Authentication**: Stateless tokens
3. **CORS**: Restricted origins
4. **Input Validation**: Backend & frontend
5. **SQL Injection**: Protected by ORM
6. **XSS**: React auto-escaping
7. **CSRF**: Token-based auth (no cookies)

## 📊 Data Flow - FEFO Algorithm (UC04)

```python
# FEFO: First Expired First Out
# Xuất hàng có HSD gần nhất trước

1. Query batches: filter(SLTon > 0)
2. Sort by HSD: order_by(HSD.asc())
3. Deduct quantity from earliest batches first
4. If batch runs out, move to next batch
5. Update SLTon for each batch
6. Create PhieuXuatKho
```

## 🔄 Migration Strategy

**QUAN TRỌNG**: Không được chỉnh sửa `init.sql`

```bash
# Mọi thay đổi database phải qua migrations:
flask db migrate -m "Add new column"
flask db upgrade

# Rollback nếu cần:
flask db downgrade
```

## 📦 Deployment Architecture (Production)

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (Reverse   │
                    │   Proxy)    │
                    └──────┬──────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
    ┌───────▼───────┐            ┌────────▼────────┐
    │   Frontend    │            │    Backend      │
    │   (Static)    │            │  Gunicorn +     │
    │   Nginx/CDN   │            │  Flask Workers  │
    └───────────────┘            └────────┬────────┘
                                          │
                                 ┌────────▼────────┐
                                 │   MySQL         │
                                 │   (Database)    │
                                 └─────────────────┘
```

## 🧪 Testing Strategy

### Backend
```bash
pytest tests/
pytest tests/test_auth.py
pytest tests/test_warehouse.py --cov
```

### Frontend
```bash
npm run test
npm run test:coverage
```

## 📈 Future Enhancements

1. **Real-time updates**: WebSockets for live inventory
2. **Barcode scanning**: Camera integration
3. **Mobile app**: React Native version
4. **Advanced reports**: ML-based forecasting
5. **Multi-warehouse**: Support multiple locations
6. **Batch printing**: Label printer integration
7. **Notifications**: Email/SMS alerts
8. **Audit logs**: Complete activity tracking

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Team**: DAHTTT - Warehouse Management System
