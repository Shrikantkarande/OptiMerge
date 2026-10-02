import re
from collections import defaultdict
from itertools import combinations
from typing import Any, Dict, List, Tuple

import pandas as pd


IDENTIFIER_COLUMN = "Name"
BENDS_COLUMN = "No. of Bends"
DEVELOPMENT_LENGTH_COLUMN = "Development Length"
AXIS_NAMES = ("x", "y", "z")


def normalize_column_name(column: Any) -> str:
    if column is None:
        return ""

    value = str(column).strip().lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return value.strip()


def get_column_map(df: pd.DataFrame) -> Dict[str, str]:
    column_map = {}

    for column in df.columns:
        normalized = normalize_column_name(column)

        if normalized:
            column_map[normalized] = column

    return column_map


def coordinate_label_sort_key(label: str) -> Tuple[int, str]:
    label = label.upper()

    value = 0

    for char in label:
        if "A" <= char <= "Z":
            value = value * 26 + (ord(char) - ord("A") + 1)

    return value, label


def detect_coordinate_groups(
    df: pd.DataFrame
) -> List[Dict[str, Any]]:
    """
    Detect complete coordinate groups such as:

        xA, yA, zA
        xB, yB, zB
        xC, yC, zC
    """
    groups = {}

    for column in df.columns:
        column_name = str(column).strip()

        match = re.fullmatch(
            r"([xyzXYZ])([A-Za-z]+)",
            column_name
        )

        if not match:
            continue

        axis = match.group(1).lower()
        label = match.group(2).upper()

        if label not in groups:
            groups[label] = {}

        groups[label][axis] = column

    complete_groups = []

    for label, axes in groups.items():
        if all(axis in axes for axis in AXIS_NAMES):
            complete_groups.append(
                {
                    "label": label,
                    "columns": {
                        "x": axes["x"],
                        "y": axes["y"],
                        "z": axes["z"],
                    },
                }
            )

    complete_groups.sort(
        key=lambda group: coordinate_label_sort_key(
            group["label"]
        )
    )

    return complete_groups


def validate_required_columns(
    df: pd.DataFrame,
    coordinate_groups: List[Dict[str, Any]]
) -> List[str]:
    errors = []

    column_map = get_column_map(df)

    required_columns = [
        IDENTIFIER_COLUMN,
        BENDS_COLUMN,
        DEVELOPMENT_LENGTH_COLUMN,
    ]

    for required in required_columns:
        normalized_required = normalize_column_name(required)

        if normalized_required not in column_map:
            errors.append(
                f"Missing required column: '{required}'"
            )

    if not coordinate_groups:
        errors.append(
            "No complete XYZ coordinate groups were found. "
            "Expected columns such as xA, yA, zA, xB, yB, zB."
        )

    return errors


def is_empty_value(value: Any) -> bool:
    """
    Check whether a cell is genuinely empty.

    This handles:
        NaN
        None
        empty strings
        whitespace-only strings
    """
    if value is None:
        return True

    if pd.isna(value):
        return True

    if isinstance(value, str) and not value.strip():
        return True

    return False


def is_non_data_row(row: pd.Series) -> bool:
    """
    Determine whether a spreadsheet row is clearly not a part row.

    A row is considered non-data when the identifying fields are empty.

    This prevents blank rows at the bottom of the Excel file from being
    counted as invalid parts.

    A note/instruction row containing text in Name but no bend count is
    also treated as non-data.
    """
    name = row.get(IDENTIFIER_COLUMN)
    bends = row.get(BENDS_COLUMN)
    development_length = row.get(
        DEVELOPMENT_LENGTH_COLUMN
    )

    name_empty = is_empty_value(name)
    bends_empty = is_empty_value(bends)
    length_empty = is_empty_value(
        development_length
    )

    # Completely empty row
    if name_empty and bends_empty and length_empty:
        return True

    # A row with no bend count and no development length
    # is not a valid part row, even if the Name column contains
    # an explanatory note.
    if bends_empty and length_empty:
        return True

    return False


def parse_bend_count(value: Any) -> int:
    if is_empty_value(value):
        raise ValueError(
            "No. of Bends is missing"
        )

    if isinstance(value, bool):
        raise ValueError(
            "No. of Bends must be an integer"
        )

    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        raise ValueError(
            f"Invalid No. of Bends value: {value}"
        )

    if not numeric_value.is_integer():
        raise ValueError(
            f"No. of Bends must be an integer, got: {value}"
        )

    bends = int(numeric_value)

    if bends < 0:
        raise ValueError(
            f"No. of Bends cannot be negative: {bends}"
        )

    return bends


def get_required_coordinate_groups(
    bend_count: int,
    coordinate_groups: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Number of coordinate points = number of bends + 2.
    """
    expected_point_count = bend_count + 2

    if len(coordinate_groups) < expected_point_count:
        raise ValueError(
            f"{bend_count} bends require "
            f"{expected_point_count} coordinate groups, "
            f"but only {len(coordinate_groups)} complete "
            f"coordinate groups were found in the file."
        )

    return coordinate_groups[:expected_point_count]


def normalize_numeric_value(value: Any) -> Any:
    if is_empty_value(value):
        return None

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        numeric_value = float(value)

        if numeric_value.is_integer():
            return int(numeric_value)

        return numeric_value

    text = str(value).strip()

    if not text:
        return None

    try:
        numeric_value = float(text)

        if numeric_value.is_integer():
            return int(numeric_value)

        return numeric_value

    except (TypeError, ValueError):
        return text


def values_are_equal(
    value_a: Any,
    value_b: Any
) -> bool:
    normalized_a = normalize_numeric_value(value_a)
    normalized_b = normalize_numeric_value(value_b)

    return normalized_a == normalized_b


def validate_row(
    row: pd.Series,
    row_index: int,
    coordinate_groups: List[Dict[str, Any]]
) -> Dict[str, Any]:

    errors = []

    name = row.get(IDENTIFIER_COLUMN)

    if is_empty_value(name):
        errors.append(
            f"{IDENTIFIER_COLUMN} is missing"
        )

    try:
        bend_count = parse_bend_count(
            row.get(BENDS_COLUMN)
        )
    except ValueError as exc:
        errors.append(str(exc))
        bend_count = None

    development_length = row.get(
        DEVELOPMENT_LENGTH_COLUMN
    )

    if is_empty_value(development_length):
        errors.append(
            f"{DEVELOPMENT_LENGTH_COLUMN} is missing"
        )
    else:
        normalized_length = normalize_numeric_value(
            development_length
        )

        if normalized_length is None:
            errors.append(
                f"{DEVELOPMENT_LENGTH_COLUMN} is invalid"
            )

    required_groups = []

    if bend_count is not None:
        try:
            required_groups = get_required_coordinate_groups(
                bend_count,
                coordinate_groups
            )
        except ValueError as exc:
            errors.append(str(exc))

    coordinates = {}

    for group in required_groups:
        label = group["label"]

        coordinates[label] = {}

        for axis in AXIS_NAMES:
            column = group["columns"][axis]
            value = row.get(column)

            if is_empty_value(value):
                errors.append(
                    f"Missing {axis.upper()}{label} coordinate"
                )
                continue

            normalized_value = normalize_numeric_value(
                value
            )

            if normalized_value is None:
                errors.append(
                    f"Invalid {axis.upper()}{label} coordinate"
                )
                continue

            coordinates[label][axis] = normalized_value

    return {
        "valid": len(errors) == 0,
        "row_index": row_index,
        "name": (
            None
            if is_empty_value(name)
            else str(name).strip()
        ),
        "bend_count": bend_count,
        "development_length": normalize_numeric_value(
            development_length
        ),
        "required_coordinate_groups": [
            group["label"]
            for group in required_groups
        ],
        "coordinates": coordinates,
        "errors": errors,
    }


def build_part_signature(
    validated_row: Dict[str, Any]
) -> Tuple[Any, ...]:
    """
    Name and bend count are not part of the signature.

    Bend count is handled separately as a grouping key.
    """
    signature = [
        validated_row["development_length"]
    ]

    for label in validated_row[
        "required_coordinate_groups"
    ]:
        coordinate = validated_row[
            "coordinates"
        ][label]

        signature.extend(
            [
                coordinate["x"],
                coordinate["y"],
                coordinate["z"],
            ]
        )

    return tuple(signature)


def find_exact_match_groups(
    valid_parts: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    groups = defaultdict(list)

    for part in valid_parts:
        key = (
            part["bend_count"],
            part["signature"],
        )

        groups[key].append(part)

    exact_groups = []

    for (bend_count, signature), parts in groups.items():

        if len(parts) < 2:
            continue

        exact_groups.append(
            {
                "bend_count": bend_count,
                "signature": signature,
                "part_names": [
                    part["name"]
                    for part in parts
                ],
                "part_indices": [
                    part["row_index"]
                    for part in parts
                ],
                "match_percentage": 100.0,
                "match_count": len(parts),
            }
        )

    exact_groups.sort(
        key=lambda group: (
            group["bend_count"],
            group["part_names"],
        )
    )

    return exact_groups


def generate_exact_match_pairs(
    exact_match_groups: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    pairs = []

    for group in exact_match_groups:
        part_names = group["part_names"]
        bend_count = group["bend_count"]

        for part_a, part_b in combinations(
            part_names,
            2
        ):
            pairs.append(
                {
                    "part_a": part_a,
                    "part_b": part_b,
                    "bend_count": bend_count,
                    "match_percentage": 100.0,
                    "match_type": "exact",
                }
            )

    return pairs


def analyze_bend_data(
    df: pd.DataFrame
) -> Dict[str, Any]:

    if not isinstance(df, pd.DataFrame):
        raise TypeError(
            "analyze_bend_data expects a pandas DataFrame"
        )

    if df.empty:
        return {
            "status": "success",
            "message": (
                "The input file contains no data rows."
            ),
            "total_rows": 0,
            "total_parts": 0,
            "valid_parts": 0,
            "invalid_parts": 0,
            "ignored_rows": 0,
            "coordinate_groups": [],
            "exact_match_groups": [],
            "exact_match_pairs": [],
            "invalid_rows": [],
            "ignored_rows_detail": [],
        }

    coordinate_groups = detect_coordinate_groups(df)

    required_column_errors = validate_required_columns(
        df,
        coordinate_groups
    )

    if required_column_errors:
        raise ValueError(
            "Invalid bend data structure: "
            + "; ".join(required_column_errors)
        )

    validated_parts = []
    invalid_rows = []
    ignored_rows = []

    for row_index, row in df.iterrows():

        # Ignore blank/instruction rows.
        if is_non_data_row(row):
            ignored_rows.append(
                {
                    "row_index": row_index,
                    "name": (
                        None
                        if is_empty_value(
                            row.get(IDENTIFIER_COLUMN)
                        )
                        else str(
                            row.get(
                                IDENTIFIER_COLUMN
                            )
                        ).strip()
                    ),
                    "reason": (
                        "Blank or non-data row"
                    ),
                }
            )
            continue

        validated = validate_row(
            row,
            row_index,
            coordinate_groups
        )

        if not validated["valid"]:
            invalid_rows.append(
                {
                    "row_index": row_index,
                    "name": validated["name"],
                    "bend_count": validated["bend_count"],
                    "errors": validated["errors"],
                }
            )
            continue

        validated["signature"] = build_part_signature(
            validated
        )

        validated_parts.append(validated)

    exact_match_groups = find_exact_match_groups(
        validated_parts
    )

    exact_match_pairs = generate_exact_match_pairs(
        exact_match_groups
    )

    return {
        "status": "success",
        "message": (
            "Bend analysis completed successfully."
        ),

        "total_rows": len(df),

        "total_parts": (
            len(validated_parts)
            + len(invalid_rows)
        ),

        "valid_parts": len(validated_parts),

        "invalid_parts": len(invalid_rows),

        "ignored_rows": len(ignored_rows),

        "coordinate_groups": [
            group["label"]
            for group in coordinate_groups
        ],

        "exact_match_groups": exact_match_groups,

        "exact_match_pairs": exact_match_pairs,

        "invalid_rows": invalid_rows,

        "ignored_rows_detail": ignored_rows,
    }


def analyze_bend_excel(
    file_path: str
) -> Dict[str, Any]:
    df = pd.read_excel(file_path)

    return analyze_bend_data(df)