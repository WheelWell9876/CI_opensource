import os
from ..pipeline.reproject import reproject_to_4326
from ..pipeline.data_cleaner import clean_dataset_dynamic
from ..pipeline.quant_qual_counter import dynamic_quant_qual_counter
from ..pipeline.weighting import dynamic_weighting
from ..pipeline.to_parquet import convert_geojson_to_parquet


def run_pipeline(dataset_name, input_geojson_path, options):
    """
    Runs the entire processing pipeline on one dataset using dynamic configuration.

    Args:
      dataset_name (str): Name of the dataset.
      input_geojson_path (str): Path to the raw GeoJSON file.
      options (dict): Configuration for each step. Expected keys include:
         - clean_config: dict with keys such as "fields_to_keep"
         - quant_qual_config: dict with key "qualitative_fields"
         - weighting_config: dict with key "weighting_fields"
         - (Optional) qual_output_dir: where to save qualitative analysis file

    Returns:
      final_output_path (str): Path to the final Parquet file.
    """
    # Step 1: Reproject the raw GeoJSON to EPSG:4326.
    reprojected_path = input_geojson_path.replace("/raw/", "/reprojected/").replace(".geojson", "_4326.geojson")
    gdf_reprojected = reproject_to_4326(input_geojson_path)
    gdf_reprojected.to_file(reprojected_path, driver="GeoJSON")
    print(f"[Pipeline] Reprojected file saved to {reprojected_path}")

    # Step 2: Clean the data dynamically.
    clean_config = options.get("clean_config", {})
    cleaned_path = reprojected_path.replace("/reprojected/", "/cleaned/").replace("_4326.geojson", "_cleaned.geojson")
    clean_dataset_dynamic(reprojected_path, cleaned_path, clean_config)

    # Step 3: Perform quantitative/qualitative analysis.
    quant_qual_config = options.get("quant_qual_config", {})
    qual_output_dir = options.get("qual_output_dir", "./properties/qual/")
    dynamic_quant_qual_counter(cleaned_path, qual_output_dir, quant_qual_config)

    # Step 4: Apply dynamic weighting.
    weighting_config = options.get("weighting_config", {})
    weighted_path = cleaned_path.replace("/cleaned/", "/weighted/").replace("_cleaned.geojson", "_weighted.geojson")
    dynamic_weighting(cleaned_path, weighted_path, weighting_config)

    # Step 5: Convert the weighted GeoJSON to a Parquet file.
    output_parquet_path = weighted_path.replace("/weighted/", "/parquet/").replace(".geojson", ".parquet")
    convert_geojson_to_parquet(weighted_path, output_parquet_path)

    print(f"[Pipeline] Pipeline complete for {input_geojson_path}")
    return output_parquet_path


if __name__ == '__main__':
    # Example usage for testing:
    input_file = "/path/to/your/raw/dataset.geojson"
    options = {
        "clean_config": {
            "fields_to_keep": ["OBJECTID", "LATITUDE", "LONGITUDE", "PLANT_MINE", "COMMODITY", "geometry"]
        },
        "quant_qual_config": {
            "qualitative_fields": ["COMMODITY", "PLANT_MINE"]
        },
        "weighting_config": {
            "weighting_fields": {
                "NAICSCODE": {
                    "weights": {"212111": 0.308, "212112": 0.257},
                    "importance": 0.120
                }
            }
        }
    }
    output_file = run_pipeline("Ferrous Metal Process Plants", input_file, options)
    print("Final output:", output_file)
