from typing import TypeVar, Dict, Any
from jsonschema import validate as json_validate
from jsonschema.exceptions import ValidationError
from type_definitions import ValidationResult, JsonSchema

T = TypeVar('T')

def namespace_to_dict(obj: Any) -> Dict:
    """Convert SimpleNamespace to dict recursively"""
    if isinstance(obj, list):
        return [namespace_to_dict(item) for item in obj]
    elif hasattr(obj, '__dict__'):
        return {k: namespace_to_dict(v) for k, v in obj.__dict__.items()}
    return obj

def create_validation_error(error: ValidationError) -> ValidationResult:
    """Create a user-friendly validation error message"""
    property_name = error.path[-1] if error.path else error.schema_path[-1]
    
    if error.validator == 'required':
        missing_field = error.schema['required'][0]
        error_msg = f"Missing required field: '{missing_field}'"
    elif error.validator == 'type':
        expected_type = error.validator_value
        error_msg = f"Invalid type for '{property_name}'. Expected {expected_type}"
    elif error.validator == 'properties':
        error_msg = f"Invalid property: '{property_name}'"
    elif error.validator == 'items':
        error_msg = f"Invalid item in array: '{property_name}'"
    else:
        error_msg = f"Validation error for '{property_name}': {error.message}"

    details = f"\nReceived: {str(error.instance)}" if hasattr(error, 'instance') else ""
    
    return {
        'success': False,
        'error': error_msg,
        'details': details,
    }

def validate_with_jsonschema(data: T, schema: JsonSchema) -> ValidationResult:
    """Validate data against a JSON schema"""
    try:
        dict_data = namespace_to_dict(data)
        json_validate(instance=dict_data, schema=schema)
        return {
            'success': True,
            'data': dict_data
        }
    except ValidationError as e:
        return create_validation_error(e)
    except Exception as e:
        return {
            'success': False,
            'error': f"Validation Error: {str(e)}"
        }