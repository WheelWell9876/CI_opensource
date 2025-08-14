def create_convex_hull_display(gdf):
    """
    Computes the convex hull over the top 10% highest weight points.
    Uses the 'original' weight if present, otherwise a generic 'weight' column.
    If no high-weight features are found, falls back to default display.
    """
    logger.debug("Running convex hull display method")
    if "original" in gdf.columns:
        threshold = gdf["original"].quantile(0.9)
        high_weight = gdf[gdf["original"] >= threshold]
    elif "weight" in gdf.columns:
        threshold = gdf["weight"].quantile(0.9)
        high_weight = gdf[gdf["weight"] >= threshold]
    else:
        logger.debug("No weight column found for convex hull; using default display")
        return create_default_display(gdf)

    if high_weight.empty:
        logger.debug("No high-weight features found; using default display")
        return create_default_display(gdf)

    try:
        hull = high_weight.unary_union.convex_hull
        logger.debug("Convex hull computed successfully")
    except Exception as e:
        logger.exception("Error computing convex hull:")
        return create_default_display(gdf)

    # Convert hull to GeoJSON mapping.
    try:
        geojson = hull.__geo_interface__
    except Exception as e:
        logger.exception("Error obtaining __geo_interface__ for hull:")
        return create_default_display(gdf)

    # Use red for convex hull boundary.
    traces = get_traces_from_geojson(geojson, "Convex Hull", "red", "Convex Hull", True, "Convex Hull")

    try:
        coords = list(hull.exterior.coords)
        center_lon = np.mean([pt[0] for pt in coords])
        center_lat = np.mean([pt[1] for pt in coords])
        logger.debug("Convex hull center computed as (%s, %s)", center_lat, center_lon)
    except Exception:
        center_lon, center_lat = -98.5795, 39.8283
        logger.debug("Using default center for convex hull")

    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": center_lat, "lon": center_lon},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Returning convex hull display with %d trace(s)", len(traces))
    return traces, layout
