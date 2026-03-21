"""
Run this once to generate all mock_data JSON files.
    python seed_data.py
"""
import json
import os
import sys
import sqlite3
import random

# Add parent directory to path so we can import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_PATH

MOCK_DIR = os.path.join(os.path.dirname(__file__), "..", "mock_data")
os.makedirs(MOCK_DIR, exist_ok=True)


VENDORS = [
    {
        "vendor_id": "VEN-001",
        "vendor_name": "TechSupply India Pvt Ltd",
        "category_codes": ["IT_HW", "IT_SW"],
        "unit_price": 82000,
        "lead_time_days": 7,
        "quality_rating": 4.6,
        "is_preferred": True,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-002",
        "vendor_name": "GlobalTech Solutions",
        "category_codes": ["IT_HW"],
        "unit_price": 88000,
        "lead_time_days": 5,
        "quality_rating": 4.2,
        "is_preferred": False,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-003",
        "vendor_name": "Apex Office Supplies",
        "category_codes": ["FACILITIES", "OFFICE"],
        "unit_price": 5000,
        "lead_time_days": 3,
        "quality_rating": 4.8,
        "is_preferred": True,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-004",
        "vendor_name": "RawMat Distributors",
        "category_codes": ["RAW_MAT"],
        "unit_price": 12000,
        "lead_time_days": 14,
        "quality_rating": 3.9,
        "is_preferred": False,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-005",
        "vendor_name": "CloudSoft Licenses",
        "category_codes": ["IT_SW", "SERVICES"],
        "unit_price": 45000,
        "lead_time_days": 1,
        "quality_rating": 4.9,
        "is_preferred": True,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-006",
        "vendor_name": "PrintMaster India",
        "category_codes": ["OFFICE", "FACILITIES"],
        "unit_price": 3500,
        "lead_time_days": 2,
        "quality_rating": 4.5,
        "is_preferred": False,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-007",
        "vendor_name": "InfraBuild Corp",
        "category_codes": ["FACILITIES"],
        "unit_price": 250000,
        "lead_time_days": 30,
        "quality_rating": 4.1,
        "is_preferred": False,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-008",
        "vendor_name": "DataPro Analytics",
        "category_codes": ["SERVICES", "IT_SW"],
        "unit_price": 75000,
        "lead_time_days": 7,
        "quality_rating": 4.7,
        "is_preferred": True,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-009",
        "vendor_name": "QuickParts Mfg",
        "category_codes": ["RAW_MAT", "PARTS"],
        "unit_price": 8500,
        "lead_time_days": 10,
        "quality_rating": 4.3,
        "is_preferred": False,
        "is_approved": True
    },
    {
        "vendor_id": "VEN-010",
        "vendor_name": "SecureNet Systems",
        "category_codes": ["IT_HW", "SERVICES"],
        "unit_price": 95000,
        "lead_time_days": 12,
        "quality_rating": 4.0,
        "is_preferred": False,
        "is_approved": True
    },
]


BUDGETS = [
    {
        "department": "Engineering",
        "category_code": "IT_HW",
        "allocated": 2000000,
        "spent": 1200000,
        "fiscal_year": "2024-25"
    },
    {
        "department": "Engineering",
        "category_code": "IT_SW",
        "allocated": 500000,
        "spent": 100000,
        "fiscal_year": "2024-25"
    },
    {
        "department": "HR",
        "category_code": "SERVICES",
        "allocated": 800000,
        "spent": 650000,       # AT_RISK scenario
        "fiscal_year": "2024-25"
    },
    {
        "department": "HR",
        "category_code": "OFFICE",
        "allocated": 200000,
        "spent": 195000,       # BLOCKED scenario
        "fiscal_year": "2024-25"
    },
    {
        "department": "Operations",
        "category_code": "RAW_MAT",
        "allocated": 5000000,
        "spent": 2000000,
        "fiscal_year": "2024-25"
    },
    {
        "department": "Operations",
        "category_code": "FACILITIES",
        "allocated": 3000000,
        "spent": 500000,
        "fiscal_year": "2024-25"
    },
    {
        "department": "Finance",
        "category_code": "IT_SW",
        "allocated": 300000,
        "spent": 50000,
        "fiscal_year": "2024-25"
    },
]


SAMPLE_REQUESTS = [
    {
        "scenario": "clean_run",
        "description": "Normal IT hardware purchase — goes all the way through cleanly",
        "purchase_request": {
            "item_name": "Dell Laptop 15 Pro",
            "quantity": 5,
            "unit_price": 82000,
            "department": "Engineering",
            "requester_id": "EMP-204",
            "category": "IT Hardware",
            "required_by": "2024-04-15"
        },
        "delivery": {
            "delivered_items": ["Dell Laptop 15 Pro"],
            "delivered_quantities": [5],
            "delivery_date": "2024-04-10",
            "delivery_note_ref": "DN-9001"
        },
        "invoice": {
            "invoice_id": "INV-VEN001-201",
            "invoice_amount": 410000,
            "invoice_items": [
                {"item_name": "Dell Laptop 15 Pro", "quantity": 5, "unit_price": 82000}
            ],
            "invoice_date": "2024-04-11",
            "vendor_bank_ref": "HDFC-VEN001-ACC"
        }
    },
    {
        "scenario": "budget_block",
        "description": "Office supplies for HR — budget is nearly exhausted, gets blocked",
        "purchase_request": {
            "item_name": "Ergonomic Office Chair",
            "quantity": 10,
            "unit_price": 8000,
            "department": "HR",
            "requester_id": "EMP-087",
            "category": "Office Supplies",
            "required_by": "2024-04-20"
        }
    },
    {
        "scenario": "invoice_mismatch",
        "description": "Vendor inflates invoice price — 3-way match fails, payment blocked",
        "purchase_request": {
            "item_name": "Network Switch 48-port",
            "quantity": 3,
            "unit_price": 95000,
            "department": "Engineering",
            "requester_id": "EMP-310",
            "category": "IT Hardware",
            "required_by": "2024-04-25"
        },
        "delivery": {
            "delivered_items": ["Network Switch 48-port"],
            "delivered_quantities": [3],
            "delivery_date": "2024-04-20",
            "delivery_note_ref": "DN-9002"
        },
        "invoice": {
            "invoice_id": "INV-VEN010-445",
            "invoice_amount": 315000,
            "invoice_items": [
                {"item_name": "Network Switch 48-port", "quantity": 3, "unit_price": 105000}
            ],
            "invoice_date": "2024-04-21",
            "vendor_bank_ref": "ICICI-VEN010-ACC"
        }
    }
]


def seed_vendors_to_db():
    """Insert vendors from VENDORS list into SQLite vendors table"""
    conn = sqlite3.connect(DB_PATH)
    
    # Insert each vendor into vendors table
    for v in VENDORS:
        conn.execute("""
            INSERT OR REPLACE INTO vendors
            (vendor_id, vendor_name, category_codes, unit_price,
             lead_time_days, quality_rating, is_preferred, is_approved,
             contact_email, contact_phone, gstin, payment_terms)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            v["vendor_id"],
            v["vendor_name"],
            json.dumps(v["category_codes"]),
            v["unit_price"],
            v["lead_time_days"],
            v["quality_rating"],
            1 if v.get("is_preferred", False) else 0,
            1 if v.get("is_approved", True) else 0,
            v.get("contact_email", f"contact@{v['vendor_name'].lower().replace(' ','')}.com"),
            v.get("contact_phone", "+91-9800" + v["vendor_id"][-3:] + "000"),
            v.get("gstin", "27AAPFU0939F1ZV"),
            v.get("payment_terms", "Net-30"),
        ))
    conn.commit()
    conn.close()
    print(f"[Seed] Inserted {len(VENDORS)} vendors into DB")


def seed_vendor_performance():
    """Insert mock vendor performance history into SQLite"""
    conn = sqlite3.connect(DB_PATH)

    # Check if already seeded
    existing = conn.execute("SELECT COUNT(*) FROM vendor_performance").fetchone()[0]
    if existing > 0:
        conn.close()
        print("[Seed] Vendor performance already populated, skipping")
        return

    vendor_ids = ["VEN-001", "VEN-002", "VEN-003", "VEN-004", "VEN-005",
                  "VEN-006", "VEN-007", "VEN-008", "VEN-009", "VEN-010"]

    # Generate 3-8 historical performance records per vendor
    for vendor_id in vendor_ids:
        num_records = random.randint(3, 8)
        for i in range(num_records):
            order_value = random.uniform(50000, 500000)
            on_time = 1 if random.random() > 0.15 else 0
            qty_match = 1 if random.random() > 0.10 else 0
            inv_clean = 1 if random.random() > 0.12 else 0
            conn.execute("""
                INSERT INTO vendor_performance
                (vendor_id, run_id, order_value,
                 delivered_on_time, quantity_match, invoice_clean)
                VALUES (?,?,?,?,?,?)
            """, (vendor_id, f"HIST-{vendor_id}-{i}", order_value,
                  on_time, qty_match, inv_clean))

    conn.commit()
    conn.close()
    print("[Seed] Inserted mock vendor performance history")


def seed():
    """Seed all data: JSON files + database"""
    # JSON files (backward compatibility)

    with open(os.path.join(MOCK_DIR, "vendors.json"), "w") as f:
        json.dump(VENDORS, f, indent=2)
    print(f"[Seed] Written {len(VENDORS)} vendors")

    with open(os.path.join(MOCK_DIR, "budgets.json"), "w") as f:
        json.dump(BUDGETS, f, indent=2)
    print(f"[Seed] Written {len(BUDGETS)} budget records")

    with open(os.path.join(MOCK_DIR, "sample_requests.json"), "w") as f:
        json.dump(SAMPLE_REQUESTS, f, indent=2)
    print(f"[Seed] Written {len(SAMPLE_REQUESTS)} sample scenarios")

    # Database seeding
    seed_vendors_to_db()
    seed_vendor_performance()


if __name__ == "__main__":
    seed()