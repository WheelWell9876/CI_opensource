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
    print("DEBUG: Starting analyze_fields; number of features =", len(geojson.get("features", [])))
    qualitative_fields = {}
    quantitative_fields = {}
    features = geojson.get("features", [])
    field_values = {}

    if features:
        # Use "attributes" if available; otherwise, try "properties"
        first_props = features[0].get("attributes", {}) or features[0].get("properties", {})
        if first_props:
            field_names = list(first_props.keys())
            print("DEBUG: Using field names from feature attributes/properties:", field_names)
            field_values = {field: [] for field in field_names}
            for feature in features:
                props = feature.get("attributes", {}) or feature.get("properties", {})
                for field in field_names:
                    field_values[field].append(props.get(field))
        else:
            # Fallback: Use the top-level "fields" key.
            if "fields" in geojson and geojson["fields"]:
                # Extract the field names from each dictionary.
                field_names = [field.get("name") for field in geojson["fields"]]
                print("DEBUG: Using field names from geojson['fields']:", field_names)
                field_values = {field: [] for field in field_names}
                for feature in features:
                    # Check in "attributes" first; if not, check directly in feature.
                    for field in field_names:
                        value = feature.get("attributes", {}).get(field)
                        if value is None:
                            value = feature.get(field)
                        field_values[field].append(value)
            else:
                print("DEBUG: No field names found in attributes/properties or 'fields' key.")
                return {"qualitative_fields": qualitative_fields, "quantitative_fields": quantitative_fields}
    else:
        print("DEBUG: No features found in the GeoJSON.")
        return {"qualitative_fields": qualitative_fields, "quantitative_fields": quantitative_fields}

    print("DEBUG: Collected values for fields:", {k: len(v) for k, v in field_values.items()})
    for field, values in field_values.items():
        predicted, details = predict_field_type(values)
        print(f"DEBUG: Field '{field}' predicted as {predicted} with details: {details}")
        if predicted == "quantitative":
            metrics = calculate_quantitative_metrics(values)
            quantitative_fields[field] = {
                "values": values,
                "metrics": metrics,
                "predicted_type": predicted,
                "details": details
            }
            print(f"DEBUG: Quantitative metrics for {field}:", metrics)
        else:
            counts = count_qualitative_properties(values)
            qualitative_fields[field] = {
                "values": values,
                "counts": counts,
                "predicted_type": predicted,
                "details": details
            }
            print(f"DEBUG: Qualitative counts for {field}:", counts)
    result = {"qualitative_fields": qualitative_fields, "quantitative_fields": quantitative_fields}
    print("DEBUG: Final analysis result:", result)
    return result

