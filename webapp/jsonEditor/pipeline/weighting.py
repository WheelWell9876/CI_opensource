import pandas as pd
import geopandas as gpd
import time
from tqdm import tqdm


def dynamic_weighting(input_geojson_path, output_geojson_path, config):
    """
    Applies dynamic weighting to a dataset based on user-specified configuration.

    Args:
      input_geojson_path (str): Path to the cleaned GeoJSON file.
      output_geojson_path (str): Path to save the weighted GeoJSON.
      config (dict): Configuration dictionary with key "weighting_fields" where each key is a field name.
                     Each field's config is a dict with:
                        - "weights": a dict mapping property value to a weight (float)
                        - "importance": a float multiplier

    Example config:
      {
        "weighting_fields": {
           "NAICSCODE": {
              "weights": {"212111": 0.308, "212112": 0.257, ...},
              "importance": 0.120
           },
           "MINE_TYPE": {
              "weights": {"12": 0.321, "11": 0.253, ...},
              "importance": 0.220
           },
           ...
        }
      }
    """

    def ensure_valid_weight(weight):
        if pd.isnull(weight) or weight < 0:
            return 0.0
        return float(round(max(weight, 0.0), 4))

    weighting_fields = config.get("weighting_fields")
    if not weighting_fields:
        raise ValueError("Configuration must include 'weighting_fields' dictionary.")

    print(f"[Weighting] Loading dataset from {input_geojson_path}...")
    gdf = gpd.read_file(input_geojson_path)
    print("[Weighting] Dataset loaded successfully.")

    initial_size = os.path.getsize(input_geojson_path) / (1024 * 1024)
    print(f"[Weighting] Initial file size: {initial_size:.2f} MB")

    def compute_row_weight(row):
        total_weight = 0.0
        for field, field_config in weighting_fields.items():
            weights = field_config.get("weights", {})
            importance = field_config.get("importance", 0.0)
            value = str(row.get(field, '')).strip()
            field_weight = ensure_valid_weight(weights.get(value, 0.0)) * importance
            total_weight += field_weight
        return ensure_valid_weight(total_weight)

    print("[Weighting] Starting weight calculation...")
    start_time = time.time()
    # Use tqdm for a progress bar if desired
    for idx, row in tqdm(gdf.iterrows(), total=len(gdf), desc="Calculating weights", unit="rows"):
        gdf.at[idx, 'Weight'] = compute_row_weight(row)
    elapsed_time = time.time() - start_time
    print(f"[Weighting] Weight calculation completed in {elapsed_time:.2f} seconds.")

    # Optionally, keep only the Weight and geometry fields.
    gdf_stripped = gdf[['Weight', 'geometry']]
    print(f"[Weighting] Saving weighted dataset to {output_geojson_path}...")
    gdf_stripped.to_file(output_geojson_path, driver='GeoJSON')

    final_size = os.path.getsize(output_geojson_path) / (1024 * 1024)
    print(f"[Weighting] Final file size: {final_size:.2f} MB")
    reduction = initial_size - final_size
    reduction_percentage = (reduction / initial_size * 100) if initial_size > 0 else 0
    print(f"[Weighting] File size reduced by: {reduction:.2f} MB ({reduction_percentage:.2f}% reduction)")
