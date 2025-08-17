# geometry_filter.py
"""Utility functions for filtering geometries based on user selection."""

from typing import List, Optional
import geopandas as gpd
import pandas as pd
from shapely.geometry.base import BaseGeometry


def filter_by_geometry_types(
        gdf: gpd.GeoDataFrame,
        allowed_types: Optional[List[str]] = None,
        config: Optional[dict] = None
) -> gpd.GeoDataFrame:
    """
    Filter a GeoDataFrame to only include specified geometry types.

    Args:
        gdf: Input GeoDataFrame
        allowed_types: List of allowed geometry type names (e.g., ['Point', 'LineString'])
        config: Config dict that may contain 'geometry_types' key

    Returns:
        Filtered GeoDataFrame
    """
    if gdf.empty:
        return gdf

    # Extract geometry types from config if not provided directly
    if allowed_types is None and config:
        allowed_types = config.get('geometry_types', config.get('geometryTypes', None))

    # If no filter specified or all types allowed, return original
    if not allowed_types:
        return gdf

    # Ensure we're working with a list
    if isinstance(allowed_types, str):
        allowed_types = [allowed_types]

    print(f"🔍 DEBUG: Filtering geometries. Allowed types: {allowed_types}")

    # Get the geometry type for each row
    def get_geom_type(geom):
        if geom is None or (hasattr(geom, 'is_empty') and geom.is_empty):
            return None
        if isinstance(geom, BaseGeometry):
            return geom.geom_type
        # Handle dict/GeoJSON representation
        if isinstance(geom, dict) and 'type' in geom:
            return geom['type']
        return None

    # Create mask for filtering
    geom_types = gdf.geometry.apply(get_geom_type)
    mask = geom_types.isin(allowed_types)

    # Log filtering results
    original_count = len(gdf)
    filtered_gdf = gdf[mask].copy()
    filtered_count = len(filtered_gdf)

    print(f"📊 DEBUG: Geometry filtering: {original_count} → {filtered_count} rows")

    # Log what types were filtered out
    if original_count > filtered_count:
        removed_types = geom_types[~mask].value_counts()
        print(f"🚫 DEBUG: Removed geometry types: {removed_types.to_dict()}")

    return filtered_gdf