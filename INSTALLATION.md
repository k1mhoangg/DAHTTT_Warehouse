# Hướng dẫn cài đặt chi tiết - Warehouse Management System

## 📋 Yêu cầu hệ thống

- **Python**: 3.10 trở lên
- **Node.js**: 18.x trở lên
- **MySQL**: 8.0 trở lên
- **Git**: Để clone repository

## 🔧 Cài đặt Backend (Flask)

### Bước 1: Cài đặt MySQL và tạo database

```bash
# Đăng nhập MySQL
mysql -u root -p

# Tạo database (hoặc sử dụng init.sql)
source /path/to/db/init.sql

# Kiểm tra database đã được tạo
SHOW DATABASES;
USE QuanLyKho;
SHOW TABLES;
```

### Bước 2: Setup Python environment

```bash
cd backend

# Tạo virtual environment
python3 -m venv venv

# Kích hoạt virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip

# Cài đặt dependencies
pip install -r requirements.txt
```

### Bước 3: Cấu hình environment variables

```bash
# Copy file .env.example thành .env
cp .env.example .env

# Chỉnh sửa .env với thông tin database của bạn
nano .env
```

Nội dung file `.env`:
```env
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=your-very-secret-key-change-this

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=QuanLyKho

JWT_SECRET_KEY=your-jwt-secret-key-change-this
JWT_ACCESS_TOKEN_EXPIRES=86400

CORS_ORIGINS=http://localhost:5173
```

### Bước 4: Chạy migrations

```bash
# Khởi tạo migrations
flask db init

# Tạo migration đầu tiên
flask db migrate -m "Initial migration"

# Apply migrations
flask db upgrade
```

### Bước 5: Tạo user mẫu với password (Optional)

```python
# Chạy Python shell
python

# Import và hash password
import bcrypt
from app import create_app, db
from app.models import NhanVienKho, ThuNgan, RoleNV

app = create_app()
with app.app_context():
    # Hash password
    password = "123456"
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Update existing users
    nv = NhanVienKho.query.get('NVK001')
    if nv:
        nv.MatKhau = hashed.decode('utf-8')
    
    tn = ThuNgan.query.get('TN001')
    if tn:
        tn.MatKhau = hashed.decode('utf-8')
    
    db.session.commit()
    print("Passwords updated!")
```

### Bước 6: Chạy development server

```bash
# Chạy server
python run.py

# Server sẽ chạy tại: http://localhost:5000
```

Test API:
```bash
curl http://localhost:5000/api/auth/login
```

## 🎨 Cài đặt Frontend (React)

### Bước 1: Cài đặt Node.js dependencies

```bash
cd frontend

# Cài đặt packages
npm install

# Hoặc sử dụng yarn
yarn install
```

### Bước 2: Cấu hình environment

```bash
# Copy .env.example
cp .env.example .env

# File .env sẽ có nội dung:
# VITE_API_URL=http://localhost:5000/api
```

### Bước 3: Cài đặt Shadcn/ui components (nếu cần thêm)

```bash
# Init shadcn
npx shadcn-ui@latest init

# Add components khi cần
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add table
# ... các components khác
```

### Bước 4: Chạy development server

```bash
npm run dev

# Hoặc
yarn dev

# Frontend sẽ chạy tại: http://localhost:5173
```

## 🚀 Kiểm tra hệ thống

### 1. Test Backend API

```bash
# Login test
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nva_kho",
    "password": "123456",
    "type": "NhanVienKho"
  }'
```

### 2. Test Frontend

1. Mở browser: http://localhost:5173
2. Đăng nhập với:
   - Username: `nva_kho`
   - Password: `123456`
   - Type: `Nhân viên kho`

### 3. Default credentials

**Nhân viên kho:**
- Username: `nva_kho` (Quản lý)
- Username: `ttb_kho` (Nhân viên)
- Username: `lvc_kho` (Nhân viên)
- Password: `123456` (sau khi set)

**Thu ngân:**
- Username: `ptd_thungan`
- Username: `hve_thungan`
- Password: `123456` (sau khi set)

## 🐛 Troubleshooting

### Lỗi kết nối MySQL

```bash
# Kiểm tra MySQL đang chạy
sudo systemctl status mysql

# Khởi động MySQL
sudo systemctl start mysql

# Kiểm tra port
netstat -tuln | grep 3306
```

### Lỗi import modules Python

```bash
# Đảm bảo đã activate virtual environment
source venv/bin/activate

# Cài lại dependencies
pip install -r requirements.txt --force-reinstall
```

### Lỗi CORS

Kiểm tra file `.env` backend:
```env
CORS_ORIGINS=http://localhost:5173
```

Và trong `app/config.py`:
```python
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
```

### Lỗi JWT Token

```bash
# Xóa localStorage trong browser
# F12 > Console:
localStorage.clear()

# Hoặc logout và login lại
```

### Frontend không build được

```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm cache clean --force
```

## 📦 Production Build

### Backend

```bash
# Cài đặt gunicorn
pip install gunicorn

# Chạy với gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 run:app

# Hoặc với supervisor/systemd
```

### Frontend

```bash
# Build production
npm run build

# Folder dist/ sẽ chứa static files
# Deploy lên Nginx, Apache, hoặc Vercel, Netlify...
```

### Nginx Configuration (Optional)

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    
    root /path/to/frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔒 Bảo mật Production

1. **Đổi SECRET_KEY và JWT_SECRET_KEY**
2. **Sử dụng HTTPS**
3. **Giới hạn CORS_ORIGINS**
4. **Sử dụng password mạnh**
5. **Enable firewall**
6. **Backup database thường xuyên**

## 📚 Tài liệu tham khảo

- Flask: https://flask.palletsprojects.com/
- React: https://react.dev/
- SQLAlchemy: https://www.sqlalchemy.org/
- Tailwind CSS: https://tailwindcss.com/
- Shadcn/ui: https://ui.shadcn.com/

## 💡 Tips

1. Sử dụng `.gitignore` để không commit sensitive files
2. Backup database trước khi chạy migrations
3. Test trên development environment trước
4. Monitor logs khi chạy production
5. Sử dụng environment variables cho mọi config

## 🆘 Support

Nếu gặp vấn đề, kiểm tra:
1. Logs của backend: `tail -f backend/logs/app.log`
2. Browser console (F12)
3. Network tab để xem API responses
4. MySQL logs: `/var/log/mysql/error.log`
