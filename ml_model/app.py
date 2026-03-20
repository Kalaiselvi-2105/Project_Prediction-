from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import joblib
import numpy as np
import pandas as pd
import json
from pathlib import Path
import base64
from io import BytesIO
from db import db
from typing import Dict, Any, List

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}})

# Load trained model - EXACT as original
model_path = Path(__file__).parent / "project_model.pkl"
model = joblib.load(model_path)

# Exact 12 features order from dataset
FEATURE_NAMES = [
    'requirement_clarity', 'team_experience', 'timeline_pressure', 'budget_adequacy',
    'project_complexity', 'client_involvement', 'technology_familiarity',
    'risk_management', 'communication_quality', 'testing_coverage',
    'team_size', 'past_project_success_rate'
]

def form_to_features(data: Dict[str, Any]) -> np.ndarray:
    """Map frontend form to exact 12 features (pad missing with 0.0 medians)"""
    features_dict = {
        'requirement_clarity': data.get('requirementClarity', 3.0),
        'team_experience': data.get('teamExperience', 3.0),
        'timeline_pressure': 0.0,  # Not in form, default median
        'budget_adequacy': data.get('resourceAvailability', 3.0),
        'project_complexity': data.get('complexity', 3.0),
        'client_involvement': data.get('communicationScore', 3.0),
        'technology_familiarity': 0.0,  # Default
        'risk_management': 0.0,  # Default
        'communication_quality': data.get('communicationScore', 3.0),
        'testing_coverage': 0.0,  # Default
        'team_size': 3.0,  # Default
        'past_project_success_rate': 0.8  # Default ~80%
    }
    features = np.array([[features_dict[name] for name in FEATURE_NAMES]])
    return features

def predict_project(features: np.ndarray) -> Dict[str, Any]:
    """EXACT original prediction logic"""
    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0]
    
    success_probability = float(probability[1]) * 100  # class 1 = success
    failure_probability = float(probability[0]) * 100
    
    if success_probability > 70:
        risk_level = "Low Risk"
    elif success_probability > 40:
        risk_level = "Medium Risk"
    else:
        risk_level = "High Risk"
    
    return {
        "successProbability": round(success_probability, 2),
        "failureProbability": round(failure_probability, 2),
        "riskLevel": risk_level,
        "recommendations": []  # Mock for compatibility, originally GPT
    }

@app.route("/")
def home():
    return "AI Project Failure Prediction Backend (Python) Running"

@app.route("/api/projects", methods=["POST"])
def create_project():
    data = request.json
    
    # Get features from form
    features = form_to_features(data)
    
    # EXACT model prediction
    prediction = predict_project(features)
    
    # Mock project data for frontend compatibility
    project_data = {
        **data,
        "id": 1,  # Mock ID
        "successProbability": prediction["successProbability"],
        "failureProbability": prediction["failureProbability"],
        "riskLevel": prediction["riskLevel"],
        "recommendations": prediction["recommendations"],
        "createdAt": "2024-01-01T00:00:00Z"
    }
    
    # Store in sqlite
    db.create_project({
        "name": data["name"],
        "description": data.get("description"),
        "requirementClarity": data["requirementClarity"],
        "teamExperience": data["teamExperience"],
        "resourceAvailability": data["resourceAvailability"],
        "complexity": data["complexity"],
        "communicationScore": data["communicationScore"],
        "delayDays": data.get("delayDays", 0),
        "scopeChanges": data.get("scopeChanges", 0),
        "successProbability": prediction["successProbability"],
        "failureProbability": prediction["failureProbability"],
        "riskLevel": prediction["riskLevel"],
        "recommendations": prediction["recommendations"]
    })
    
    return jsonify(project_data), 201

@app.route("/api/projects/analyzeFile", methods=["POST"])
def analyze_file():
    data = request.json
    file_data = data["fileData"]
    file_name = data["fileName"]
    
    # Decode base64
    file_bytes = base64.b64decode(file_data.split(',')[1])
    
    # Parse file with pandas
    try:
        if file_name.endswith('.csv'):
            df = pd.read_csv(BytesIO(file_bytes))
        else:  # xlsx
            df = pd.read_excel(BytesIO(file_bytes))
    except Exception as e:
        return jsonify({"message": f"Failed to parse file: {str(e)}"}), 400
    
    if df.empty:
        return jsonify({"message": "File contains no data"}), 400
    
    # Take first row, map to 12 features EXACT order
    first_row = df.iloc[0].to_dict()
    
    # Column mapping (case insensitive)
    col_map = {k.lower(): k for k in df.columns}
    features_dict = {}
    for i, fname in enumerate(FEATURE_NAMES):
        mapped_col = col_map.get(fname.lower().replace('_', ''))
        if mapped_col and mapped_col in first_row:
            features_dict[fname] = float(first_row[mapped_col])
        else:
            features_dict[fname] = 0.0  # Default if missing
    
    features = np.array([[features_dict[fname] for fname in FEATURE_NAMES]])
    
    # Predict
    prediction = predict_project(features)
    
    extracted_values = {
        "requirementClarity": features_dict["requirement_clarity"],
        "teamExperience": features_dict["team_experience"],
        "resourceAvailability": features_dict["budget_adequacy"],
        "complexity": features_dict["project_complexity"],
        "communicationScore": features_dict["communication_quality"],
        "delayDays": features_dict.get("delay_days", 0),
        "scopeChanges": features_dict.get("scope_changes", 0),
        "summary": f"Extracted from {file_name}"
    }
    
    return jsonify({
        "extractedValues": extracted_values,
        "prediction": {
            "successProbability": prediction["successProbability"],
            "failureProbability": prediction["failureProbability"],
            "riskLevel": prediction["riskLevel"],
            "recommendations": prediction["recommendations"]
        }
    })

@app.route("/api/projects", methods=["GET"])
def list_projects():
    projects = db.get_projects()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "successProbability": p.success_probability,
        "failureProbability": p.failure_probability,
        "riskLevel": p.risk_level,
        "createdAt": p.created_at
    } for p in projects])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
