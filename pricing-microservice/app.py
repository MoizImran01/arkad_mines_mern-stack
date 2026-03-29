"""
ARKAD Mines — ML-Based Quotation Pricing Suggestion Microservice
"""

import os
from dotenv import load_dotenv
load_dotenv()
import math
import logging
from datetime import datetime

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import cross_val_score

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://placeholder:placeholder@cluster.mongodb.net/arkadDB"
)
DB_NAME = os.environ.get("DB_NAME", "arkadDB")

_client = None

def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return _client[DB_NAME]


def fetch_training_data():
    """
    Pull quotation items from issued/approved quotations where
    a finalUnitPrice was set (i.e. admin actually priced it).
    Also enrich with stone metadata (category, subcategory, grade).
    """
    db = get_db()
    quotations_col = db["quotations"]
    stones_col = db["stones"]

    quotations = list(quotations_col.find(
        {"status": {"$in": ["issued", "approved"]}},
        {"items": 1, "createdAt": 1, "_id": 0}
    ))

    stones = list(stones_col.find(
        {},
        {"_id": 1, "stoneName": 1, "category": 1, "subcategory": 1,
         "grade": 1, "priceUnit": 1, "dimensions": 1}
    ))
    stone_lookup = {str(s["_id"]): s for s in stones}

    training_rows = []
    for q in quotations:
        created_at = q.get("createdAt", datetime.now())
        for item in q.get("items", []):
            final_price = item.get("finalUnitPrice")
            if final_price is None or final_price <= 0:
                continue

            stone_id = str(item.get("stone", ""))
            stone_meta = stone_lookup.get(stone_id, {})

            training_rows.append({
                "stoneName": item.get("stoneName", "Unknown"),
                "category": stone_meta.get("category", "Unknown"),
                "subcategory": stone_meta.get("subcategory", "Unknown"),
                "grade": stone_meta.get("grade", "Standard"),
                "priceUnit": item.get("priceUnit", "unit"),
                "requestedQuantity": item.get("requestedQuantity", 1),
                "priceSnapshot": item.get("priceSnapshot", 0),
                "finalUnitPrice": final_price,
                "month": created_at.month if hasattr(created_at, 'month') else 1,
            })

    return training_rows


#Model training
class PricingModel:
    """
    Trains a Gradient Boosting Regressor on historical quotation data.
    Features: category, subcategory, grade, priceUnit, quantity,
              base price (priceSnapshot), month.
    Target:   finalUnitPrice (what the admin actually charged).
    """

    def __init__(self):
        self.model = None
        self.encoders = {}
        self.is_trained = False
        self.training_stats = {}
        self.last_trained = None

    def _encode_feature(self, name, values):
        if name not in self.encoders:
            self.encoders[name] = LabelEncoder()
            self.encoders[name].fit(values)

        encoded = []
        for v in values:
            if v in self.encoders[name].classes_:
                encoded.append(
                    self.encoders[name].transform([v])[0]
                )
            else:
                encoded.append(-1)
        return np.array(encoded)

    def _encode_single(self, name, value):
        if name not in self.encoders:
            return -1
        if value in self.encoders[name].classes_:
            return self.encoders[name].transform([value])[0]
        return -1

    def train(self, data):
        if len(data) < 3:
            logger.warning(f"Insufficient training data: {len(data)} rows (need >= 3)")
            self.is_trained = False
            return False

        cat_features = ["category", "subcategory", "grade", "priceUnit", "stoneName"]

        for feat in cat_features:
            vals = [row[feat] for row in data]
            self.encoders[feat] = LabelEncoder()
            self.encoders[feat].fit(vals)

        X = np.column_stack([
            self._encode_feature("category", [r["category"] for r in data]),
            self._encode_feature("subcategory", [r["subcategory"] for r in data]),
            self._encode_feature("grade", [r["grade"] for r in data]),
            self._encode_feature("priceUnit", [r["priceUnit"] for r in data]),
            self._encode_feature("stoneName", [r["stoneName"] for r in data]),
            np.array([r["requestedQuantity"] for r in data]),
            np.array([r["priceSnapshot"] for r in data]),
            np.array([r["month"] for r in data]),
        ])

        y = np.array([r["finalUnitPrice"] for r in data])

        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            random_state=42
        )
        self.model.fit(X, y)

        predictions = self.model.predict(X)
        residuals = y - predictions
        self.training_stats = {
            "n_samples": len(data),
            "mean_price": float(np.mean(y)),
            "std_price": float(np.std(y)),
            "mean_abs_error": float(np.mean(np.abs(residuals))),
            "r2_score": float(self.model.score(X, y)),
        }

        if len(data) >= 10:
            cv_folds = min(5, len(data))
            cv_scores = cross_val_score(self.model, X, y, cv=cv_folds, scoring="r2")
            self.training_stats["cv_r2_mean"] = float(np.mean(cv_scores))

        self.is_trained = True
        self.last_trained = datetime.now().isoformat()
        logger.info(f"Model trained on {len(data)} samples. R2={self.training_stats['r2_score']:.3f}")
        return True

    def predict(self, stone_data):
        """
        Predict a price range for the given stone.
        Returns: { suggested_price, price_range_low, price_range_high, confidence }
        """
        if not self.is_trained:
            return None

        X = np.array([[
            self._encode_single("category", stone_data.get("category", "Unknown")),
            self._encode_single("subcategory", stone_data.get("subcategory", "Unknown")),
            self._encode_single("grade", stone_data.get("grade", "Standard")),
            self._encode_single("priceUnit", stone_data.get("priceUnit", "unit")),
            self._encode_single("stoneName", stone_data.get("stoneName", "Unknown")),
            stone_data.get("requestedQuantity", 1),
            stone_data.get("priceSnapshot", 0),
            stone_data.get("month", datetime.now().month),
        ]])

        predicted = float(self.model.predict(X)[0])

        mae = self.training_stats.get("mean_abs_error", predicted * 0.1)
        margin = max(mae * 1.5, predicted * 0.05)  

        return {
            "suggested_price": round(predicted, 2),
            "price_range_low": round(max(0, predicted - margin), 2),
            "price_range_high": round(predicted + margin, 2),
            "confidence": round(min(self.training_stats.get("r2_score", 0) * 100, 95), 1),
            "based_on_samples": self.training_stats.get("n_samples", 0),
        }


pricing_model = PricingModel()


def ensure_model_trained():
    """Retrain model if not yet trained (lazy initialization)."""
    if not pricing_model.is_trained:
        data = fetch_training_data()
        if data:
            pricing_model.train(data)
    return pricing_model.is_trained



@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_trained": pricing_model.is_trained,
        "training_stats": pricing_model.training_stats,
        "last_trained": pricing_model.last_trained,
    })


@app.route("/api/retrain", methods=["POST"])
def retrain():
    """Force retrain the model with latest data."""
    data = fetch_training_data()
    if not data:
        return jsonify({
            "success": False,
            "message": "No training data found. Need issued/approved quotations with finalUnitPrice."
        }), 400

    success = pricing_model.train(data)
    return jsonify({
        "success": success,
        "training_stats": pricing_model.training_stats,
        "last_trained": pricing_model.last_trained,
    })


@app.route("/api/predict-price", methods=["POST"])
def predict_price():
    """
    Predict price for a single stone item.
    Body: { stoneName, category, subcategory, grade, priceUnit, requestedQuantity, priceSnapshot }
    """
    ensure_model_trained()

    if not pricing_model.is_trained:
        return jsonify({
            "success": False,
            "message": "Model not trained yet. Need more issued quotation data."
        }), 503

    body = request.get_json()
    if not body:
        return jsonify({"success": False, "message": "Request body required"}), 400

    result = pricing_model.predict(body)
    return jsonify({"success": True, "prediction": result})


@app.route("/api/predict-prices", methods=["POST"])
def predict_prices():
    """
    Batch prediction for multiple stone items in a quotation.
    Body: { items: [{ stoneName, category, subcategory, grade, priceUnit, requestedQuantity, priceSnapshot }] }
    """
    ensure_model_trained()

    if not pricing_model.is_trained:
        return jsonify({
            "success": False,
            "message": "Model not trained yet. Need more issued quotation data."
        }), 503

    body = request.get_json()
    items = body.get("items", [])
    if not items:
        return jsonify({"success": False, "message": "Items array required"}), 400

    predictions = []
    for item in items:
        pred = pricing_model.predict(item)
        predictions.append({
            "stoneName": item.get("stoneName", "Unknown"),
            **pred
        })

    return jsonify({"success": True, "predictions": predictions})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))

    #Pre-train on startup
    logger.info("Pre-training pricing model...")
    data = fetch_training_data()
    if data:
        pricing_model.train(data)
        logger.info(f"Model ready with {len(data)} training samples.")
    else:
        logger.warning("No training data available. Model will train on first request.")

    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=port, debug=False)
