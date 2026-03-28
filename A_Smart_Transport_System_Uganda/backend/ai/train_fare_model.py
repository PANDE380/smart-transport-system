import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import joblib
import os

def train_model():
    """
    Trains a Machine Learning model to predict transport fares.
    """
    # 1. Load the generated dataset
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, 'fare_dataset.csv')
    
    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        return
        
    df = pd.read_csv(data_path)
    
    # 2. Prepare features and target
    # Features: distance_km, hour, day_of_week, traffic_level, weather, vehicle_type
    # Target: fare
    
    X = df.drop('fare', axis=1)
    y = df['fare']
    
    # 3. Define the preprocessing and model pipeline
    # OneHotEncode the categorical 'vehicle_type'
    
    categorical_features = ['vehicle_type']
    numeric_features = ['distance_km', 'hour', 'day_of_week', 'traffic_level', 'weather']
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ],
        remainder='passthrough'
    )
    
    # Random Forest Regressor is robust for this kind of tabular data
    model = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
    ])
    
    # 4. Split and Train
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training the AI model...")
    model.fit(X_train, y_train)
    
    # 5. Evaluate
    score = model.score(X_test, y_test)
    print(f"Model trained. Accuracy (R^2 Score): {score:.4f}")
    
    # 6. Save the serialized model
    model_path = os.path.join(base_dir, 'fare_model.pkl')
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_model()
