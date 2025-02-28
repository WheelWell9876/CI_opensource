import json
import os
import time


def dynamic_quant_qual_counter(input_geojson_path, qual_output_dir, config):
    """
    Performs qualitative counting on a GeoJSON file using dynamic field selection.

    Args:
      input_geojson_path (str): Path to the cleaned GeoJSON file.
      qual_output_dir (str): Directory to write the qualitative analysis file.
      config (dict): Configuration dictionary with key "qualitative_fields" (list).

    Example config:
      {
         "qualitative_fields": ["COMMODITY", "PLANT_MINE"]
      }
    """
    qualitative_fields = config.get("qualitative_fields")
    if not qualitative_fields:
        raise ValueError("Configuration must include 'qualitative_fields' list.")

    start_time = time.time()
    try:
        with open(input_geojson_path, 'r') as file:
            geojson_data = json.load(file)
        print(f"[QuantQual] Loaded GeoJSON file: {input_geojson_path}")

        qual_counts = {field: {} for field in qualitative_fields}
        for feature in geojson_data.get("features", []):
            properties = feature.get("properties", {})
            for field in qualitative_fields:
                if field in properties and isinstance(properties[field], str):
                    value = properties[field].strip()
                    qual_counts[field][value] = qual_counts[field].get(value, 0) + 1

        # Ensure output directory exists
        os.makedirs(qual_output_dir, exist_ok=True)
        qual_file_path = os.path.join(qual_output_dir, "qualitative_analysis.txt")
        with open(qual_file_path, 'w') as qual_file:
            qual_file.write("Qualitative Properties Analysis\n")
            for field, counts in qual_counts.items():
                sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
                qual_file.write(f"\n{field}:\n")
                for value, count in sorted_counts:
                    qual_file.write(f"{value}: {count}\n")

        qual_file_size = os.path.getsize(qual_file_path)
        elapsed_time = time.time() - start_time
        print(f"[QuantQual] Qualitative results saved to: {qual_file_path} (Size: {qual_file_size} bytes)")
        print(f"[QuantQual] Time taken: {round(elapsed_time, 3)} seconds")
    except Exception as e:
        print(f"[QuantQual] An error occurred: {e}")
