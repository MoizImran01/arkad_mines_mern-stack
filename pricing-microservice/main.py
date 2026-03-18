from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from pymongo import MongoClient
import os

app = FastAPI(title="Arkad Live Demand Forecasting Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. MONGODB CONNECTION SETUP
# ==========================================
MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb://localhost:27017/arkadDB"
)
DB_NAME = os.environ.get("DB_NAME", "arkadDB")

try:
    client = MongoClient(MONGO_URI)
    db = client.get_database(DB_NAME)
    print("✅ Connected to MongoDB Successfully")
except Exception as e:
    print(f"❌ MongoDB Connection Error: {e}")

# ==========================================
# 2. DATA EXTRACTION & TRANSFORMATION LOGIC
# ==========================================
def fetch_and_aggregate_live_data():
    """Extracts raw data from 3 MongoDB collections and transforms it for the AI"""
    
    # A. Fetch all stones to create a mapping dictionary (ObjectId -> Stone Info)
    stones_cursor = db.stones.find()
    stone_map = {}
    for stone in stones_cursor:
        stone_map[str(stone['_id'])] = {
            'stoneName': stone.get('stoneName'),
            'category': stone.get('category'),
            'subcategory': stone.get('subcategory'),
            'SKU': f"{stone.get('stoneName')} - {stone.get('subcategory')}"
        }

    # B. Fetch Procurements to calculate REAL Dynamic Lead Times
    procurements = list(db.procurements.find({"status": "received"}))
    lead_time_dict = {} 
    
    lt_records = []
    for po in procurements:
        order_date = po.get('orderDate')
        actual_delivery = po.get('actualDeliveryDate')
        
        if order_date and actual_delivery:
            days_taken = (actual_delivery - order_date).days
            for item in po.get('stones', []):
                sku = f"{item.get('stoneName')} - {item.get('subcategory')}"
                lt_records.append({'SKU': sku, 'leadTimeDays': max(1, days_taken)})
                
    if lt_records:
        lt_df = pd.DataFrame(lt_records)
        lead_time_dict = lt_df.groupby('SKU')['leadTimeDays'].mean().to_dict()

    # C. Fetch Delivered Orders for Demand Forecasting
    orders = list(db.orders.find({"status": "delivered"}))
    if not orders:
        return None, None
        
    sales_data = []
    for order in orders:
        order_date = order.get('createdAt')
        for item in order.get('items', []):
            stone_id = str(item.get('stone'))
            if stone_id in stone_map:
                info = stone_map[stone_id]
                sales_data.append({
                    'orderDate': order_date,
                    'quantity': item.get('quantity', 0),
                    'SKU': info['SKU'],
                    'category': info['category'],
                    'stoneName': info['stoneName'],
                    'subcategory': info['subcategory']
                })

    df_sales = pd.DataFrame(sales_data)
    df_sales['orderDate'] = pd.to_datetime(df_sales['orderDate'])

    # D. Aggregate into Monthly Buckets
    global_start = df_sales['orderDate'].min()
    global_end = df_sales['orderDate'].max()
    full_date_range = pd.date_range(start=global_start, end=global_end, freq='MS')
    
    monthly_data_frames = []
    
    for sku, group in df_sales.groupby('SKU'):
        group = group.set_index('orderDate')
        monthly_resampled = group.resample('MS').agg({
            'quantity': 'sum',            
            'category': 'first',          
            'stoneName': 'first',         
            'subcategory': 'first'        
        })
        
        monthly_resampled = monthly_resampled.reindex(full_date_range)
        monthly_resampled['SKU'] = sku
        monthly_resampled['quantity'] = monthly_resampled['quantity'].fillna(0)
        
        monthly_resampled['category'] = monthly_resampled['category'].ffill().bfill()
        monthly_resampled['stoneName'] = monthly_resampled['stoneName'].ffill().bfill()
        monthly_resampled['subcategory'] = monthly_resampled['subcategory'].ffill().bfill()
        
        monthly_data_frames.append(monthly_resampled)
        
    final_ml_df = pd.concat(monthly_data_frames).reset_index().rename(columns={'index': 'month_starting'})
    
    return final_ml_df, lead_time_dict

# ==========================================
# 3. THE API ENDPOINT
# ==========================================
@app.get("/api/forecast")
def get_inventory_forecast():
    df, lead_time_dict = fetch_and_aggregate_live_data()
    
    if df is None:
        raise HTTPException(status_code=400, detail="Not enough order data in MongoDB to generate a forecast.")
        
    inventory_forecast_results = []
    Z_SCORE = 1.65 
    
    for sku, group_df in df.groupby('SKU'):
        group_df = group_df.sort_values('month_starting')
        historical_quantities = group_df['quantity'].values
        
        # 1. AI Demand Forecasting (Holt-Winters)
        try:
            model = ExponentialSmoothing(
                historical_quantities,
                seasonal_periods=12,
                trend='add', 
                damped_trend=True,
                seasonal='add',
                initialization_method="estimated"
            )
            fitted_model = model.fit()
            forecast = fitted_model.forecast(3)
            forecast = np.maximum(forecast, 0)
            avg_monthly_demand = forecast.mean()
            

            fitted_series = pd.Series(fitted_model.fittedvalues, index=group_df['month_starting'])
            
        except Exception:
            avg_monthly_demand = group_df['quantity'].tail(6).mean()
            forecast = [avg_monthly_demand] * 3
            fitted_series = pd.Series(dtype=float)
            
        avg_weekly_demand = avg_monthly_demand / 4.33 
        current_lead_time_days = lead_time_dict.get(sku, 14.0)
        lead_time_weeks = current_lead_time_days / 7.0
        demand_std_dev = group_df['quantity'].std() / 4.33 
        
        safety_stock = Z_SCORE * demand_std_dev * np.sqrt(lead_time_weeks)
        reorder_point = (avg_weekly_demand * lead_time_weeks) + safety_stock
        suggested_po_qty = (avg_weekly_demand * 4) + safety_stock

        # --- GRAPH DATA EXTRACTION ---
        recent_history = group_df.tail(12)
        chart_data = []
        

        for idx, row in recent_history.iterrows():
            month_timestamp = row['month_starting']
            
            try:
                ai_historical_guess = fitted_series.loc[month_timestamp]
                if isinstance(ai_historical_guess, pd.Series):
                    ai_historical_guess = ai_historical_guess.iloc[0]
                ai_historical_guess = max(ai_historical_guess, 0) 
            except Exception:
                ai_historical_guess = row['quantity']
                
            chart_data.append({
                "month": month_timestamp.strftime('%b %Y'),
                "actual": round(row['quantity'], 2),
                "forecast": round(ai_historical_guess, 2)
            })
            
        # Add the next 3 months of future AI predictions
        future_dates = pd.date_range(start=recent_history['month_starting'].iloc[-1] + pd.DateOffset(months=1), periods=3, freq='MS')
        for i, val in enumerate(forecast):
            chart_data.append({
                "month": future_dates[i].strftime('%b %Y'),
                "actual": None, 
                "forecast": round(val, 2)
            })
        
        inventory_forecast_results.append({
            "sku": sku,
            "category": group_df['category'].iloc[0],
            "stoneName": group_df['stoneName'].iloc[0],
            "subcategory": group_df['subcategory'].iloc[0],
            "forecast_monthly_mean": round(avg_monthly_demand, 2),
            "forecast_weekly_mean": round(avg_weekly_demand, 2),
            "current_lead_time_days": round(current_lead_time_days, 1),
            "calculated_safety_stock": round(safety_stock, 2),
            "dynamic_reorder_point": round(reorder_point, 2),
            "suggested_po_quantity": round(suggested_po_qty, 2),
            "chart_data": chart_data 
        })

    return {"status": "success", "data": inventory_forecast_results}