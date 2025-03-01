# webapp/pipeline/quant_qual_counter.py
import statistics
from collections import Counter

def predict_field_type(values, threshold_unique=0.2):
    """
    Predict if a field is quantitative or qualitative.
    If many of the values can be converted to numbers and the unique-to-total ratio is high,
    return "quantitative"; otherwise "qualitative".
    Returns a tuple (predicted_type, details) where details is a dict with number of unique values.
    """
    total = len(values)
    try:
        numeric_values = [float(v) for v in values if v not in (None, "")]
        # Ratio of unique numeric values to total values
        ratio = len(set(numeric_values)) / total if total > 0 else 0
        if ratio > threshold_unique:
            return "quantitative", {"unique": len(set(numeric_values)), "total": total}
        else:
            return "qualitative", {"unique": len(set(values)), "total": total}
    except Exception:
        return "qualitative", {"unique": len(set(values)), "total": total}

def count_qualitative_properties(values):
    """
    Count occurrences of each unique value.
    Returns a dict: {property_value: count}
    """
    return dict(Counter(values))

def calculate_quantitative_metrics(values):
    """
    Given a list of numeric values (convertible to float), compute metrics.
    Returns a dict with keys: range, mean, median, stddev, max, min.
    """
    if not values:
        return {}
    try:
        numeric_values = [float(v) for v in values if v not in (None, "")]
    except Exception:
        return {}
    if not numeric_values:
        return {}
    return {
        "range": max(numeric_values) - min(numeric_values),
        "mean": statistics.mean(numeric_values),
        "median": statistics.median(numeric_values),
        "stddev": statistics.stdev(numeric_values) if len(numeric_values) > 1 else 0,
        "max": max(numeric_values),
        "min": min(numeric_values)
    }

def analyze_fields(geojson):
    """
    Given a GeoJSON object, return an analysis of its fields.
    Returns a dictionary with two keys:
      qualitative_fields: dict mapping field names to dict with counts and predicted type.
      quantitative_fields: dict mapping field names to dict with computed metrics.
    """
    qualitative_fields = {}
    quantitative_fields = {}
    features = geojson.get("features", [])
    if not features:
        return {"qualitative_fields": qualitative_fields, "quantitative_fields": quantitative_fields}
    # Use the properties of the first feature to get field names.
    field_names = features[0].get("properties", {}).keys()
    field_values = {field: [] for field in field_names}
    for feature in features:
        props = feature.get("properties", {})
        for field in field_names:
            field_values[field].append(props.get(field))
    for field, values in field_values.items():
        predicted, details = predict_field_type(values)
        if predicted == "quantitative":
            metrics = calculate_quantitative_metrics(values)
            quantitative_fields[field] = {
                "values": values,
                "metrics": metrics,
                "predicted_type": predicted,
                "details": details
            }
        else:
            counts = count_qualitative_properties(values)
            qualitative_fields[field] = {
                "values": values,
                "counts": counts,
                "predicted_type": predicted,
                "details": details
            }
    return {"qualitative_fields": qualitative_fields, "quantitative_fields": quantitative_fields}
