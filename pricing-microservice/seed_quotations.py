"""
Seed script — generates realistic historical quotation data for model training.
Pulls real stones and users from your DB, creates 40 varied issued/approved
quotations with finalUnitPrice set, then triggers a model retrain.

Run from inside the pricing-microservice directory:
    python seed_quotations.py
"""

import os
import random
import string
from datetime import datetime, timedelta

from pymongo import MongoClient
from bson import ObjectId

# ── Config ────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://admin:mypassword123%21@arkad.bfcgh8n.mongodb.net/arkadDB?retryWrites=true&w=majority&appName=ARKAD"
)
DB_NAME = os.environ.get("DB_NAME", "arkadDB")
NUM_QUOTES = 40  # how many to generate

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
db = client[DB_NAME]

# ── Helpers ───────────────────────────────────────────────────────────
def ref_number():
    ts = random.randint(100000, 999999)
    rnd = random.randint(100, 999)
    return f"QT-SEED-{ts}-{rnd}"

def order_number():
    ts = random.randint(100000, 999999)
    rnd = random.randint(100, 999)
    return f"ORD-SEED-{ts}-{rnd}"

def random_date_in_past(days_back=180):
    delta = random.randint(1, days_back)
    return datetime.utcnow() - timedelta(days=delta)

def price_with_variance(base_price, variance_pct=0.25):
    """Return a realistic final price: base ± variance%"""
    factor = 1 + random.uniform(-variance_pct, variance_pct)
    return round(base_price * factor, 2)

# ── Fetch real data ───────────────────────────────────────────────────
print("Fetching stones from DB...")
stones = list(db["stones"].find(
    {},
    {"_id": 1, "stoneName": 1, "price": 1, "priceUnit": 1,
     "category": 1, "subcategory": 1, "grade": 1,
     "stockQuantity": 1, "stockAvailability": 1}
))
if not stones:
    print("ERROR: No stones found in DB. Add some stones first.")
    exit(1)
print(f"  Found {len(stones)} stones.")

print("Fetching a buyer from DB...")
buyer = db["users"].find_one({"role": "buyer"})
if not buyer:
    buyer = db["users"].find_one()  # fallback to any user
if not buyer:
    print("ERROR: No users found in DB. Need at least one user.")
    exit(1)
print(f"  Using buyer: {buyer.get('email', buyer['_id'])}")

# ── Generate quotations ───────────────────────────────────────────────
print(f"\nGenerating {NUM_QUOTES} seed quotations...")

quotations = []
for i in range(NUM_QUOTES):
    # Pick 1-3 random stones for this quotation
    num_items = random.randint(1, min(3, len(stones)))
    chosen_stones = random.sample(stones, num_items)

    created_at = random_date_in_past(180)
    validity_start = created_at
    validity_end = created_at + timedelta(days=7)

    # Vary quantity by stone category (granite/marble ordered in larger quantities)
    items = []
    for stone in chosen_stones:
        base_qty = random.randint(1, 20)
        base_price = stone.get("price", 1000)

        # Add realistic price variation based on quantity (bulk discount logic)
        qty_factor = 1 - (base_qty * 0.005)  # slight discount for larger orders
        final_price = price_with_variance(base_price * max(qty_factor, 0.85))

        items.append({
            "stone": stone["_id"],
            "stoneName": stone["stoneName"],
            "priceSnapshot": base_price,
            "priceUnit": stone.get("priceUnit", "unit"),
            "requestedQuantity": base_qty,
            "availabilityAtRequest": stone.get("stockAvailability", "In Stock"),
            "finalUnitPrice": final_price,
        })

    # Calculate financials
    tax_pct = random.choice([0, 5, 10, 15])
    shipping = random.choice([0, 500, 1000, 1500, 2000])
    discount = random.choice([0, 0, 0, 200, 500])  # mostly no discount

    subtotal = sum(item["finalUnitPrice"] * item["requestedQuantity"] for item in items)
    tax_amount = round((subtotal * tax_pct) / 100, 2)
    grand_total = round(subtotal + tax_amount + shipping - discount, 2)

    status = random.choice(["issued", "issued", "approved"])  # weighted toward issued

    quotation = {
        "referenceNumber": ref_number(),
        "buyer": buyer["_id"],
        "status": status,
        "notes": random.choice([
            "Please deliver to warehouse.",
            "Urgent order.",
            "",
            "Handle with care.",
            "Bulk order for ongoing project.",
        ]),
        "adminNotes": "Payment due within 30 days.",
        "items": items,
        "totalEstimatedCost": round(sum(
            item["priceSnapshot"] * item["requestedQuantity"] for item in items
        ), 2),
        "financials": {
            "subtotal": round(subtotal, 2),
            "taxPercentage": tax_pct,
            "taxAmount": tax_amount,
            "shippingCost": shipping,
            "discountAmount": discount,
            "grandTotal": grand_total,
        },
        "validity": {
            "start": validity_start,
            "end": validity_end,
        },
        "adjustments": [],
        "buyerDecision": {
            "decision": "approved" if status == "approved" else None,
            "comment": "",
            "decisionDate": validity_end if status == "approved" else None,
        },
        "createdAt": created_at,
        "updatedAt": created_at,
    }

    if status == "approved":
        quotation["orderNumber"] = order_number()

    quotations.append(quotation)

# ── Insert ────────────────────────────────────────────────────────────
print("Inserting into MongoDB...")
result = db["quotations"].insert_many(quotations)
print(f"  Inserted {len(result.inserted_ids)} quotations.")

# ── Trigger retrain ───────────────────────────────────────────────────
print("\nTriggering model retrain via microservice...")
try:
    import urllib.request, json
    req = urllib.request.Request(
        "http://localhost:5001/api/retrain",
        method="POST",
        headers={"Content-Type": "application/json"},
        data=b"{}"
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
        stats = data.get("training_stats", {})
        print(f"  Model retrained!")
        print(f"  Samples : {stats.get('n_samples')}")
        print(f"  R2 Score: {stats.get('r2_score', 0):.3f}")
        print(f"  Mean Err: Rs {stats.get('mean_abs_error', 0):.2f}")
except Exception as e:
    print(f"  Microservice not reachable ({e}).")
    print("  Restart the microservice to retrain on the new data.")

print("\nDone! Seed data added successfully.")
