import os
import re

SCHEMA_DIR = 'app/schemas'

for root, _, files in os.walk(SCHEMA_DIR):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'class Config:' in content:
                # Add ConfigDict to pydantic import
                if 'from pydantic import' in content and 'ConfigDict' not in content:
                    content = content.replace('from pydantic import BaseModel', 'from pydantic import BaseModel, ConfigDict')
                elif 'from pydantic import' not in content:
                    content = 'from pydantic import ConfigDict\n' + content
                    
                # Replace class Config
                content = re.sub(r'[ \t]*class Config:\n[ \t]*from_attributes = True', '    model_config = ConfigDict(from_attributes=True)', content)
                content = re.sub(r'[ \t]*class Config:\n[ \t]*orm_mode = True', '    model_config = ConfigDict(from_attributes=True)', content)
                
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Fixed {path}")

# Also fix app/core/config.py
config_path = 'app/core/config.py'
if os.path.exists(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'class Config:' in content:
        content = content.replace('from pydantic_settings import BaseSettings', 'from pydantic_settings import BaseSettings, SettingsConfigDict')
        content = re.sub(r'[ \t]*class Config:\n[ \t]*env_file = ".env"', '    model_config = SettingsConfigDict(env_file=".env")', content)
        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {config_path}")
