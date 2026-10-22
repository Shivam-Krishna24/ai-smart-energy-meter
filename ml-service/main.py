
from datetime import datetime, timedelta
from collections import defaultdict

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error


app = FastAPI(
    title="Smart Energy Meter ML Service",
    description="Energy consumption forecasting API",
    version="1.0.0",
)


class Reading(BaseModel):
    measuredAt: datetime
    energy: float = Field(ge=0)


class ForecastRequest(BaseModel):
    readings: list[Reading]


@app.get("/")
def home():
    return {
        "message": "Smart Energy Meter ML service is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "energy-forecasting",
    }



def build_daily_consumption(readings):
    """Calculate daily kWh from cumulative readings, excluding long gaps."""

    if len(readings) < 2:
        return pd.DataFrame(columns=["date", "consumption"])

    df = pd.DataFrame([
        {
            "timestamp": reading.measuredAt,
            "energy": reading.energy,
        }
        for reading in readings
    ])

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = (
        df.sort_values("timestamp")
        .drop_duplicates(subset=["timestamp"], keep="last")
        .reset_index(drop=True)
    )

    if len(df) < 2:
        return pd.DataFrame(columns=["date", "consumption"])

    # Calculate the elapsed time and cumulative-energy difference.
    df["time_gap"] = df["timestamp"].diff()
    df["energy_difference"] = df["energy"].diff()

    # A negative difference may indicate a meter reset.
    if (df["energy_difference"].dropna() < 0).any():
        raise ValueError(
            "Cumulative energy decreased. Check for meter resets."
        )

    # Convert timestamps to Indian local time before assigning dates.
    local_timestamps = df["timestamp"].dt.tz_convert("Asia/Kolkata")
    df["date"] = local_timestamps.dt.date

    # Only use intervals with readings no more than 15 minutes apart.
    # Longer gaps are unknown, not zero consumption.
    valid = (
        df["time_gap"].le(pd.Timedelta(minutes=15))
        & df["energy_difference"].notna()
    )

    daily = (
        df.loc[valid]
        .groupby("date", as_index=False)["energy_difference"]
        .sum()
        .rename(columns={"energy_difference": "consumption"})
    )

    return daily

def make_features(daily):
    """Create calendar and lag features for the model."""

    data = daily.copy()
    dates = pd.to_datetime(data["date"])

    data["day_of_week"] = dates.dt.dayofweek
    data["day_of_year"] = dates.dt.dayofyear
    data["lag_1"] = data["consumption"].shift(1)
    data["lag_7"] = data["consumption"].shift(7)
    data["rolling_mean_7"] = (
        data["consumption"].shift(1).rolling(7).mean()
    )

    return data


@app.post("/forecast")
def forecast(request: ForecastRequest):
    if len(request.readings) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least two readings are required.",
        )

    try:
        daily = build_daily_consumption(request.readings)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if daily.empty:
        raise HTTPException(
            status_code=400,
            detail="Not enough distinct timestamps to calculate consumption.",
        )


    # Build a complete calendar while preserving unknown consumption as NaN.
    daily["date"] = pd.to_datetime(daily["date"])

    date_range = pd.date_range(
        start=daily["date"].min(),
        end=daily["date"].max(),
        freq="D",
    )

    daily = (
        daily.set_index("date")
        .reindex(date_range)
        .rename_axis("date")
        .reset_index()
    )

    # Do not silently interpret missing measurements as zero consumption.
    daily["consumption"] = pd.to_numeric(
        daily["consumption"], errors="coerce"
    )

    # Count days with actual observations, not just calendar dates.
    observed_days = int(daily["consumption"].notna().sum())
    missing_days = int(daily["consumption"].isna().sum())



    # Report only dates with actual calculated consumption.
    valid_daily = daily.dropna(subset=["consumption"]).copy()
    observed_days = len(valid_daily)
    missing_days = int(daily["consumption"].isna().sum())

    history = [
        {
            "date": row.date.strftime("%Y-%m-%d"),
            "consumptionKWh": round(float(row.consumption), 5),
        }
        for row in valid_daily.itertuples()
    ]

    # Random Forest needs sufficient history and a complete recent window.
    last_seven = daily.tail(7)
    recent_window_complete = (
        len(last_seven) == 7
        and last_seven["consumption"].notna().all()
    )

    # Use a baseline if history is limited or recent dates have gaps.
    if observed_days < 14 or not recent_window_complete:
        recent_values = valid_daily["consumption"].tail(7)

        if recent_values.empty:
            raise HTTPException(
                status_code=400,
                detail="No valid daily consumption data is available.",
            )

        average = float(recent_values.mean())

        predictions = [
            {
                "date": (
                    pd.Timestamp(daily["date"].max())
                    + pd.Timedelta(days=day)
                ).strftime("%Y-%m-%d"),
                "predictedKWh": round(max(0.0, average), 5),
            }
            for day in range(1, 8)
        ]

        return {
            "model": "7-day average baseline",
            "forecastAvailable": True,
            "mlModelTrained": False,
            "message": (
                "Using a baseline because there are fewer than 14 "
                "valid daily observations or the latest 7 calendar "
                "days contain gaps. Collect more complete history."
            ),
            "historicalDays": observed_days,
            "missingDays": missing_days,
            "history": history,
            "forecast": predictions,
            "predicted7DayKWh": round(
                sum(item["predictedKWh"] for item in predictions), 5
            ),
        }

    # Train only on earlier dates and evaluate on the latest 7 days.

    # Create features and keep rows with complete inputs and targets.
    features = make_features(daily).dropna().reset_index(drop=True)

    feature_columns = [
        "day_of_week",
        "day_of_year",
        "lag_1",
        "lag_7",
        "rolling_mean_7",
    ]

    # Require enough usable rows for both training and testing.
    if len(features) < 14:
        raise HTTPException(
            status_code=400,
            detail=(
                "Not enough usable historical rows after feature "
                "generation. Collect more complete daily readings."
            ),
        )

    # Preserve chronological order: latest 7 usable rows are test data.
    split = len(features) - 7
    train = features.iloc[:split].copy()
    test = features.iloc[split:].copy()

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        min_samples_leaf=2,
    )

    model.fit(train[feature_columns], train["consumption"])

    # Evaluate the Random Forest on unseen, later dates.
    test_predictions = np.maximum(
        model.predict(test[feature_columns]),
        0.0,
    )

    rf_mae = float(
        mean_absolute_error(test["consumption"], test_predictions)
    )
    rf_rmse = float(
        np.sqrt(
            mean_squared_error(test["consumption"], test_predictions)
        )
    )

    # Compare against a simple baseline using training-set mean.
    baseline_value = float(train["consumption"].mean())
    baseline_predictions = np.full(
        len(test),
        max(0.0, baseline_value),
    )

    baseline_mae = float(
        mean_absolute_error(
            test["consumption"], baseline_predictions
        )
    )
    baseline_rmse = float(
        np.sqrt(
            mean_squared_error(
                test["consumption"], baseline_predictions
            )
        )
    )

    # Save the evaluation results before refitting on all history.
    evaluation =  {
        "testDays": len(test),
        "maeKWh": round(rf_mae, 5), 
        "rmseKWh": round(rf_rmse, 5),
        "baselineMAEKWh": round(baseline_mae, 5),
        "baselineRMSEKWh": round(baseline_rmse, 5),
    }

    # Refit using all available historical rows.
    model.fit(features[feature_columns], features["consumption"])

    future_rows = daily.copy()
    predictions = []

    for _ in range(7):
        next_date = pd.Timestamp(future_rows["date"].max()) + pd.Timedelta(days=1)

        temp = pd.concat(
            [
                future_rows,
                pd.DataFrame(
                    [{"date": next_date, "consumption": np.nan}]
                ),
            ],
            ignore_index=True,
        )

        features_for_future = make_features(
            temp.rename(columns={"date": "date"})
        )

        last = features_for_future.iloc[-1]

        if pd.isna(last[feature_columns]).any():
            raise HTTPException(
                status_code=400,
                detail="Insufficient history to generate lag features.",
            )

        predicted = max(
            0.0,
            float(model.predict(
                pd.DataFrame([last[feature_columns].to_dict()])
            )[0]),
        )

        predictions.append(
            {
                "date": next_date.strftime("%Y-%m-%d"),
                "predictedKWh": round(predicted, 5),
            }
        )

        future_rows = pd.concat(
            [
                future_rows,
                pd.DataFrame(
                    [{"date": next_date, "consumption": predicted}]
                ),
            ],
            ignore_index=True,
        )

    return {
        "model": "RandomForestRegressor",
        "forecastAvailable": True,
        "mlModelTrained": True,
        "message": "Forecast generated from historical daily consumption.",
        "historicalDays": len(daily),
        "evaluation": evaluation,
        "history": history,
        "forecast": predictions,
        "predicted7DayKWh": round(
            sum(item["predictedKWh"] for item in predictions), 5
        ),
    }
