# Hệ Thống Quản Lý Kho - Warehouse Management System

## 🚀 Tech Stack

### Frontend
- **React** (Vite)
- **Shadcn/ui** + **Tailwind CSS**
- **React Router** (routing)
- **Axios** (HTTP client)
- **React Query** (state management)
- **Zustand** (auth state)

### Backend
- **Flask** (Python web framework)
- **SQLAlchemy** (ORM)
- **Flask-Migrate** (database migrations)
- **Flask-JWT-Extended** (authentication)
- **Flask-CORS** (cross-origin)
- **MySQL** (database)

### Architecture
- **RESTful API**
- **MVC Pattern**
- **Role-Based Access Control (RBAC)**

## 📁 Cấu trúc dự án

```
DAHTTT_Warehouse_Refactor/
├── backend/                    # Flask Backend
│   ├── app/
│   │   ├── __init__.py        # App factory
│   │   ├── models/            # SQLAlchemy models
│   │   ├── controllers/       # Business logic
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Service layer
│   │   ├── utils/             # Utilities
│   │   └── config.py          # Configuration
│   ├── migrations/            # Database migrations
│   ├── requirements.txt
│   └── run.py                 # Entry point
│
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   ├── lib/               # Utilities
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API services
│   │   ├── store/             # State management
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── db/
    └── init.sql               # Database initialization

```

## 📋 Chức năng theo Use Case

### 👤 Roles
1. **Quản lý kho** - Quản lý danh mục sản phẩm, báo cáo
2. **Nhân viên kho** - Đặt hàng, nhập/xuất/chuyển kho, kiểm kê, điều chỉnh
3. **Thu ngân** - Bán hàng, trả hàng, báo cáo

### 🔧 Use Cases (11 chức năng)
- **UC01**: Quản lý danh mục sản phẩm
- **UC02**: Đặt hàng từ nhà cung cấp
- **UC03**: Nhập kho
- **UC04**: Xuất kho (FEFO - First Expired First Out)
- **UC05**: Chuyển kho (Kho thường ↔ Kho lỗi)
- **UC06**: Kiểm kho
- **UC07**: Điều chỉnh kho
- **UC08**: Thống kê & Báo cáo
- **UC09**: Hủy hàng
- **UC10**: Trả hàng
- **UC11**: Mua hàng (Bán lẻ)

## 🚀 Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL 8.0+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup database
mysql -u root -p < ../db/init.sql

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Start server
python run.py
# Server runs on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with backend API URL

# Start development server
npm run dev
# App runs on http://localhost:5173
```

## 📊 Database Schema

Xem chi tiết trong `db/init.sql`

### Các bảng chính:
- **NhanVienKho**, **ThuNgan** - Quản lý nhân viên
- **SanPham**, **LoSP** - Sản phẩm và lô hàng
- **KhoHang** - Kho thường và kho lỗi
- **PhieuNhapKho**, **PhieuXuatKho**, **PhieuChuyenKho** - Các phiếu kho
- **PhieuKiemKho**, **BaoCao** - Kiểm kê
- **HoaDon**, **YeuCauTraHang** - Bán hàng và trả hàng
- **NhaCungCap** - Nhà cung cấp

## 🔐 Authentication

JWT-based authentication với 3 roles:
- `QuanLy` - Quản lý kho
- `NhanVien` - Nhân viên kho
- `ThuNgan` - Thu ngân

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/me` - Thông tin user

### Products (UC01)
- `GET /api/products` - Danh sách sản phẩm
- `POST /api/products` - Tạo sản phẩm (Quản lý)
- `PUT /api/products/:id` - Cập nhật sản phẩm
- `DELETE /api/products/:id` - Xóa sản phẩm

### Orders (UC02)
- `GET /api/orders` - Danh sách đơn hàng
- `POST /api/orders` - Tạo đơn đặt hàng
- `PUT /api/orders/:id/approve` - Duyệt đơn

### Warehouse Operations (UC03-UC07, UC09)
- `POST /api/warehouse/import` - Nhập kho
- `POST /api/warehouse/export` - Xuất kho (FEFO)
- `POST /api/warehouse/transfer` - Chuyển kho
- `POST /api/warehouse/inventory` - Kiểm kho
- `POST /api/warehouse/adjustment` - Điều chỉnh
- `POST /api/warehouse/discard` - Hủy hàng

### Reports (UC08)
- `GET /api/reports/inventory` - Báo cáo tồn kho
- `GET /api/reports/sales` - Báo cáo bán hàng
- `GET /api/reports/batch-history` - Lịch sử lô hàng

### Sales & Returns (UC10, UC11)
- `POST /api/sales` - Tạo hóa đơn bán hàng
- `POST /api/returns` - Trả hàng
- `GET /api/invoices/:id` - Chi tiết hóa đơn

## 🔄 Workflow chính

### Luồng nhập kho
1. NV Kho tạo phiếu nhập → Nhập thông tin lô (NSX, HSD) → Quét barcode
2. Quản lý duyệt phiếu → Cập nhật tồn kho → Tạo barcode

### Luồng xuất kho (FEFO)
1. Chọn sản phẩm → Hệ thống gợi ý lô HSD gần nhất
2. Quét barcode xác nhận → Duyệt phiếu → Giảm tồn kho

### Luồng bán hàng
1. Thu ngân quét barcode → Tự động chọn lô FEFO
2. Thanh toán → In hóa đơn → Tự động tạo phiếu xuất kho

## 🛡️ Security Features

- JWT token authentication
- Password hashing (bcrypt)
- Role-based authorization
- CORS configuration
- Input validation
- SQL injection prevention (ORM)

## 📱 UI/UX Features

- Responsive design (mobile-first)
- Dark mode support
- Loading states
- Error handling
- Toast notifications
- Barcode scanning integration
- FEFO batch suggestion
- Real-time inventory updates

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm run test
```

## 📦 Production Build

### Backend
```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

### Frontend
```bash
cd frontend
npm run build
# Deploy dist/ folder to static hosting
```

## 📄 License

MIT License

## 👥 Contributors

Team DAHTTT - Warehouse Management System

---

**Version**: 1.0.0  
**Last Updated**: December 2024
