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
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup database (IMPORTANT: Run this first!)
mysql -u root -p < ../db/init.sql

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials:
# - MYSQL_HOST=localhost
# - MYSQL_USER=root
# - MYSQL_PASSWORD=your_password
# - MYSQL_DATABASE=QuanLyKho
# - SECRET_KEY=your-secret-key
# - JWT_SECRET_KEY=your-jwt-secret

# Initialize Flask-Migrate
flask db init

# Create migration for password fields
flask db migrate -m "Add MatKhau fields"

# Apply migration to database
flask db upgrade

# Seed passwords for existing users
python seed_passwords.py
# Default password: 123456 for all users
# Usernames: nva_kho, ttb_kho, lvc_kho, ptd_thungan, hve_thungan

# Start server
python run.py
# Server runs on http://localhost:5000
```

**⚠️ Important Notes:**
- Database `init.sql` MUST be executed first before running migrations
- Migration only adds `MatKhau` columns to `NhanVienKho` and `ThuNgan` tables
- All users have default password: `123456` (hashed with bcrypt)
- Do NOT edit `init.sql` - all schema changes should be via migrations

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

### 👤 Default Accounts

Sau khi chạy `seed_passwords.py`, có thể đăng nhập với các tài khoản:

| Username | Password | Role | Tên | Mô tả |
|----------|----------|------|-----|--------|
| nva_kho | 123456 | QuanLy | Nguyễn Văn An | Quản lý kho - Full access |
| ttb_kho | 123456 | NhanVien | Trần Thị Bình | Nhân viên kho - Warehouse operations |
| lvc_kho | 123456 | NhanVien | Lê Văn Cường | Nhân viên kho - Warehouse operations |
| ptd_thungan | 123456 | ThuNgan | Phạm Thị Dung | Thu ngân - Sales & returns |
| hve_thungan | 123456 | ThuNgan | Hoàng Văn Em | Thu ngân - Sales & returns |

**⚠️ Security Warning:**  
Đổi mật khẩu mặc định trong production environment!

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

## 🔧 Troubleshooting

### Migration Issues

**Problem**: `FileNotFoundError: migrations/alembic.ini doesn't exist`  
**Solution**: 
```bash
cd backend
rm -rf migrations
flask db init
flask db migrate -m "Add MatKhau fields"
flask db upgrade
```

**Problem**: `Cannot drop index 'idx_losp_kho': needed in a foreign key constraint`  
**Solution**: Migration file đã được chỉnh sửa để chỉ thêm cột MatKhau, không drop index.

**Problem**: `Data truncated for column 'Loai' at row 1`  
**Solution**: SQLAlchemy Enum đã được fix với `values_callable=lambda x: [e.value for e in x]` trong models.

### Database Connection

**Problem**: `Can't connect to MySQL server`  
**Solution**: 
- Kiểm tra MySQL service đang chạy: `sudo systemctl status mysql`
- Verify credentials trong `.env`
- Đảm bảo database `QuanLyKho` đã được tạo

### Frontend Issues

**Problem**: `Cannot find module 'tailwindcss-animate'`  
**Solution**: 
```bash
cd frontend
npm install tailwindcss-animate
```

**Problem**: CORS errors  
**Solution**: Backend đã config CORS cho `http://localhost:5173`, kiểm tra port frontend.

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
**Last Updated**: December 12, 2025  
**Database Schema**: init.sql (base) + Flask-Migrate (password fields)
