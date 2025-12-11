"""
Migration script to add password fields to staff tables
This migration adds MatKhau column for authentication
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '001_add_password_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Add MatKhau column to ThuNgan and NhanVienKho tables"""
    
    # Add MatKhau to ThuNgan
    op.add_column('ThuNgan', 
        sa.Column('MatKhau', sa.String(255), nullable=True)
    )
    
    # Add MatKhau to NhanVienKho  
    op.add_column('NhanVienKho',
        sa.Column('MatKhau', sa.String(255), nullable=True)
    )
    
    # Note: In production, you should set default passwords
    # and force users to change them on first login


def downgrade():
    """Remove MatKhau column from tables"""
    
    op.drop_column('ThuNgan', 'MatKhau')
    op.drop_column('NhanVienKho', 'MatKhau')
