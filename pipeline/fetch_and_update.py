import requests
import os
import logging


def fetch_geojson_from_api(dataset_name, api_url, output_path, config=None):
    """
    Fetches a GeoJSON file from a provided API URL and saves it to output_path.
    Optionally uses extra parameters from config (e.g. headers, timeout).

    Args:
      dataset_name (str): Name of the dataset (for logging).
      api_url (str): The API endpoint URL.
      output_path (str): Where to save the downloaded file.
      config (dict): Optional configuration; keys such as "timeout" (default 60).

    Returns:
      output_path (str): The file path where data is saved.
    """
    timeout = config.get("timeout", 60) if config else 60
    headers = config.get("headers", {}) if config else {}

    logging.info(f"[Fetch] Fetching '{dataset_name}' from API: {api_url}")
    try:
        response = requests.get(api_url, timeout=timeout, headers=headers)
        response.raise_for_status()
        with open(output_path, 'wb') as f:
            f.write(response.content)
        logging.info(f"[Fetch] Saved raw dataset to {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"[Fetch] Error fetching dataset '{dataset_name}': {e}")
        raise


def update_dataset_from_api(dataset_name, api_url, raw_output_path, config=None):
    """
    Wrapper to update the dataset from an API.
    """
    return fetch_geojson_from_api(dataset_name, api_url, raw_output_path, config)
