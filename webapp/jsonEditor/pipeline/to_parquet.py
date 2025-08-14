import geopandas as gpd
import os


def convert_geojson_to_parquet(input_geojson_path, output_parquet_path):
    """
    Reads a GeoJSON file and writes it to a Parquet file.

    Args:
      input_geojson_path (str): Path to the input GeoJSON.
      output_parquet_path (str): Path to save the Parquet file.
    """
    gdf = gpd.read_file(input_geojson_path)
    gdf.to_parquet(output_parquet_path)
    print(f"[ToParquet] Converted {input_geojson_path} to {output_parquet_path}")


def convert_multiple_geojson_to_parquet(dataset_dict, output_dir):
    """
    Converts a dictionary of {Category: [list_of_geojson_paths]} to Parquet files.
    Results are stored in output_dir/category/filename.parquet.
    """
    for category, paths in dataset_dict.items():
        category_dir = os.path.join(output_dir, category)
        os.makedirs(category_dir, exist_ok=True)
        for path in paths:
            try:
                filename = os.path.basename(path).replace(".geojson", ".parquet")
                parquet_path = os.path.join(category_dir, filename)
                convert_geojson_to_parquet(path, parquet_path)
            except Exception as e:
                print(f"[ToParquet] Error processing {path}: {e}")
