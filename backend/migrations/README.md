# Migration Scripts

Các file migration để thay đổi database schema mà không chỉnh sửa `init.sql`.

## Cách chạy migrations

### 1. Khởi tạo Flask-Migrate

```bash
cd backend
flask db init
```

### 2. Tạo migration mới

```bash
flask db migrate -m "Description of changes"
```

### 3. Apply migrations

```bash
flask db upgrade
```

### 4. Rollback migrations

```bash
flask db downgrade
```

## Danh sách migrations

### 001_add_password_fields.py
- **Mục đích**: Thêm cột `MatKhau` vào bảng `ThuNgan` và `NhanVienKho` để hỗ trợ authentication
- **Thay đổi**:
  - Thêm `MatKhau VARCHAR(255)` vào `ThuNgan`
  - Thêm `MatKhau VARCHAR(255)` vào `NhanVienKho`

## Chú ý quan trọng

1. **KHÔNG BAO GIỜ** chỉnh sửa file `init.sql`
2. Luôn tạo migration mới cho mọi thay đổi database
3. Test migrations trên development environment trước
4. Backup database trước khi chạy migrations trên production
5. Migrations phải có khả năng rollback (downgrade)

## Quy trình làm việc với database

1. Thay đổi models trong `app/models/`
2. Tạo migration: `flask db migrate -m "description"`
3. Review migration file được tạo
4. Apply migration: `flask db upgrade`
5. Test thoroughly
6. Commit migration files vào git

## Troubleshooting

### Migration conflict
```bash
flask db stamp head
flask db migrate -m "fix migration"
```

### Reset migrations (DEVELOPMENT ONLY)
```bash
rm -rf migrations/
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```
