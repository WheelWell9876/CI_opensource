import os
import time
import geopandas as gpd


def clean_dataset_dynamic(input_geojson_path, output_geojson_path, config):
    """
    Dynamically cleans a GeoJSON file based on user-specified configuration.

    Args:
      input_geojson_path (str): Path to the input (raw or reprojected) GeoJSON.
      output_geojson_path (str): Path to save the cleaned GeoJSON.
      config (dict): Dictionary with keys:
          - fields_to_keep (list): Fields to retain.
          - fields_to_remove (list): (Optional) Fields explicitly to remove (unused if fields_to_keep is provided).

    Example config:
      {
        "fields_to_keep": ["OBJECTID", "LATITUDE", "LONGITUDE", "PLANT_MINE", "COMMODITY", "geometry"],
        "fields_to_remove": ["COMPANY_NAME", "MINERAL_OPERATIONS_ID", "SITE_NAME", "STATE", "COUNTY"]
      }
    """
    fields_to_keep = config.get("fields_to_keep")
    if not fields_to_keep:
        raise ValueError("Configuration must provide a 'fields_to_keep' list.")

    start_time = time.time()
    initial_size = os.path.getsize(input_geojson_path)
    print(f"[Data Cleaner] Processing file: {os.path.basename(input_geojson_path)}")
    print(f"[Data Cleaner] Initial file size: {initial_size / 1024:.2f} KB")

    gdf = gpd.read_file(input_geojson_path)
    print(f"[Data Cleaner] Number of rows: {len(gdf)}")
    print(f"[Data Cleaner] Retaining fields: {fields_to_keep}")

    # Filter the GeoDataFrame by the user-specified fields.
    gdf = gdf[fields_to_keep]

    # Optionally, you could remove any fields in a provided 'fields_to_remove'
    # (if fields_to_keep is not comprehensive). For now we assume fields_to_keep is complete.

    gdf.to_file(output_geojson_path, driver='GeoJSON')

    final_size = os.path.getsize(output_geojson_path)
    elapsed_time = time.time() - start_time
    size_reduction = initial_size - final_size
    percentage_reduction = (size_reduction / initial_size) * 100
    print(f"[Data Cleaner] Final file size: {final_size / 1024:.2f} KB")
    print(f"[Data Cleaner] Size reduced by: {size_reduction / 1024:.2f} KB ({percentage_reduction:.2f}%)")
    print(f"[Data Cleaner] Time taken: {elapsed_time:.2f} seconds")
    print("-" * 40)
