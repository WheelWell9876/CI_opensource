import geopandas as gpd


def reproject_to_4326(input_file, target_epsg=4326):
    """
    Reads a GeoJSON file and reprojects its geometries to the target EPSG (default 4326).

    Args:
      input_file (str): Path to the input GeoJSON.
      target_epsg (int): EPSG code to reproject to.

    Returns:
      GeoDataFrame: The reprojected GeoDataFrame.
    """
    gdf = gpd.read_file(input_file)
    gdf = gdf.to_crs(epsg=target_epsg)
    return gdf
