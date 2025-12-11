"""Utility functions for the application"""

from datetime import datetime, date
import random
import string


def generate_id(prefix, length=6):
    """
    Generate a unique ID with prefix
    
    Args:
        prefix: Prefix for the ID (e.g., 'SP', 'PNK', 'HD')
        length: Length of random part
    
    Returns:
        str: Generated ID (e.g., 'SP001234')
    """
    random_part = ''.join(random.choices(string.digits, k=length))
    return f"{prefix}{random_part}"


def generate_barcode():
    """
    Generate a unique barcode (EAN-13 format)
    
    Returns:
        str: 13-digit barcode
    """
    return ''.join(random.choices(string.digits, k=13))


def parse_date(date_str):
    """
    Parse date string to date object
    
    Args:
        date_str: Date string in format 'YYYY-MM-DD'
    
    Returns:
        date: Parsed date object or None
    """
    if not date_str:
        return None
    
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None


def format_date(date_obj):
    """
    Format date object to string
    
    Args:
        date_obj: Date object
    
    Returns:
        str: Formatted date string 'YYYY-MM-DD'
    """
    if not date_obj:
        return None
    
    if isinstance(date_obj, datetime):
        return date_obj.strftime('%Y-%m-%d')
    elif isinstance(date_obj, date):
        return date_obj.isoformat()
    
    return None


def format_datetime(datetime_obj):
    """
    Format datetime object to string
    
    Args:
        datetime_obj: Datetime object
    
    Returns:
        str: Formatted datetime string 'YYYY-MM-DD HH:MM:SS'
    """
    if not datetime_obj:
        return None
    
    if isinstance(datetime_obj, datetime):
        return datetime_obj.strftime('%Y-%m-%d %H:%M:%S')
    
    return None


def is_expired(hsd):
    """
    Check if product batch is expired
    
    Args:
        hsd: Expiry date (date object)
    
    Returns:
        bool: True if expired, False otherwise
    """
    if not hsd:
        return False
    
    today = date.today()
    return hsd < today


def days_until_expiry(hsd):
    """
    Calculate days until expiry
    
    Args:
        hsd: Expiry date (date object)
    
    Returns:
        int: Number of days until expiry (negative if expired)
    """
    if not hsd:
        return None
    
    today = date.today()
    delta = hsd - today
    return delta.days


def paginate(query, page=1, per_page=20):
    """
    Paginate query results
    
    Args:
        query: SQLAlchemy query
        page: Page number (1-indexed)
        per_page: Items per page
    
    Returns:
        dict: Pagination result with items, total, page info
    """
    page = max(1, page)
    per_page = min(max(1, per_page), 100)
    
    pagination = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return {
        'items': [item.to_dict() for item in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'per_page': pagination.per_page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
    }


def success_response(data=None, message="Success", status=200):
    """
    Create a success response
    
    Args:
        data: Response data
        message: Success message
        status: HTTP status code
    
    Returns:
        tuple: (response_dict, status_code)
    """
    response = {
        "success": True,
        "message": message,
    }
    
    if data is not None:
        response["data"] = data
    
    return response, status


def error_response(message="Error", status=400):
    """
    Create an error response
    
    Args:
        message: Error message
        status: HTTP status code
    
    Returns:
        tuple: (response_dict, status_code)
    """
    return {
        "success": False,
        "error": message,
    }, status
