# White-Label Configuration Guide

parkFLOW can be easily customized for different organizations through the `config/branding.json` file. This allows you to change terminology, units, and branding without modifying the source code.

## Configuration File Location

The configuration file should be located at: `config/branding.json`

## Configuration Structure

### Application Settings
```json
{
  "application": {
    "name": "YourBotName",
    "database_filename": "yourbot.db"
  }
}
```

- `name`: The name of your bot (used in headers and messages)
- `database_filename`: The name of the SQLite database file

### Jurisdiction Settings
```json
{
  "jurisdiction": {
    "name": "Jurisdiction Name",
    "employee_term": "officer",
    "employee_plural": "officers", 
    "department_term": "division",
    "shift_term": "duty",
    "active_term": "on duty"
  }
}
```

- `name`: Your jurisdiction name with appropriate articles (e.g., "the County", "Lander City", "the State Park")
- `employee_term`: Term for individual workers (e.g., "officer", "employee", "member")
- `employee_plural`: Plural form of employee term
- `department_term`: Term for organizational units (e.g., "department", "division", "unit")
- `shift_term`: Term for work periods (e.g., "shift", "duty", "tour")
- `active_term`: Term for being on duty (e.g., "active", "on duty", "deployed")

### Units/Departments
```json
{
  "units": [
    { "name": "Patrol Division", "code": "PATROL" },
    { "name": "Traffic Enforcement", "code": "TRAFFIC" },
    { "name": "Detective Bureau", "code": "DETECT" },
    { "name": "K-9 Unit", "code": "K9" }
  ]
}
```

Each unit should have:
- `name`: Display name for the unit
- `code`: Short code used internally

### UI Text Customization
```json
{
  "ui_text": {
    "active_shifts_header": "🚔 On Duty Personnel",
    "no_active_message": "No {employee_plural} are currently {active_term} in {organization_name}.",
    "active_count_message": "{count} {employee_term}{plural_suffix} currently {active_term} in {organization_name}:"
  }
}
```

UI text supports the following variables:
- `{app_name}` - Application name
- `{jurisdiction_name}` - Jurisdiction name  
- `{employee_term}` - Employee term
- `{employee_plural}` - Employee plural term
- `{department_term}` - Department term
- `{shift_term}` - Shift term
- `{active_term}` - Active term
- `{count}` - Number count
- `{plural_suffix}` - 's' if count != 1, empty otherwise

## Example Configurations

### Police Department
```json
{
  "application": {
    "name": "BlueWatch",
    "database_filename": "bluewatch.db"
  },
  "jurisdiction": {
    "name": "the Police Department",
    "employee_term": "officer",
    "employee_plural": "officers",
    "department_term": "division", 
    "shift_term": "duty",
    "active_term": "on duty"
  },
  "units": [
    { "name": "Patrol Division", "code": "PATROL" },
    { "name": "Traffic Enforcement", "code": "TRAFFIC" },
    { "name": "Detective Bureau", "code": "DETECT" },
    { "name": "K-9 Unit", "code": "K9" },
    { "name": "SWAT Team", "code": "SWAT" }
  ]
}
```

### Fire Department
```json
{
  "application": {
    "name": "FireTracker",
    "database_filename": "firetracker.db"
  },
  "jurisdiction": {
    "name": "the Fire Department",
    "employee_term": "firefighter", 
    "employee_plural": "firefighters",
    "department_term": "station",
    "shift_term": "shift",
    "active_term": "on duty"
  },
  "units": [
    { "name": "Engine Company 1", "code": "ENG1" },
    { "name": "Ladder Company 1", "code": "LAD1" },
    { "name": "Rescue Squad", "code": "RESCUE" },
    { "name": "Hazmat Team", "code": "HAZMAT" },
    { "name": "EMS Division", "code": "EMS" }
  ]
}
```

### Corporate Security
```json
{
  "application": {
    "name": "SecureShift",
    "database_filename": "secureshift.db"
  },
  "jurisdiction": {
    "name": "Acme Corporation",
    "employee_term": "guard",
    "employee_plural": "guards", 
    "department_term": "team",
    "shift_term": "shift",
    "active_term": "active"
  },
  "units": [
    { "name": "Building Alpha", "code": "ALPHA" },
    { "name": "Building Beta", "code": "BETA" },
    { "name": "Perimeter Patrol", "code": "PATROL" },
    { "name": "Control Room", "code": "CONTROL" }
  ]
}
```

## Implementation Notes

- The configuration file is loaded on bot startup
- Changes require a bot restart to take effect
- All text fields support variable substitution using `{variable_name}` syntax
- The bot will exit with an error if the configuration file is missing or invalid
- Database filename changes will create a new database (existing data won't migrate automatically)

## Validation

The configuration system includes basic validation:
- Required fields must be present
- Variable substitution is performed automatically
- Unit codes should be unique and uppercase
- Employee terms should be lowercase

## Support

If you encounter issues with configuration:
1. Verify JSON syntax is valid
2. Ensure all required fields are present
3. Check bot logs for specific error messages
4. Restart the bot after making changes