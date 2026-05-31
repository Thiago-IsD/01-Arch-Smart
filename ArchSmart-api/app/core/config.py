from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, ValidationInfo

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Critical variables are required and will cause startup failure if missing.
    """
    
    # Database (Required)
    DATABASE_URL: str = Field(..., description="PostgreSQL database connection URL")
    
    # Supabase (Required)
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_KEY: str = Field(..., description="Supabase anon/public key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(..., description="Supabase service role key for admin operations")
    
    # SMTP Settings (Optional - for future email features)
    SMTP_HOST: Optional[str] = Field(None, description="SMTP server host")
    SMTP_PORT: int = Field(587, description="SMTP server port")
    SMTP_USER: Optional[str] = Field(None, description="SMTP username")
    SMTP_PASSWORD: Optional[str] = Field(None, description="SMTP password")
    EMAILS_FROM_EMAIL: Optional[str] = Field(None, description="Default sender email address")
    
    # AI Config
    GEMINI_API_KEY: str = Field(..., description="Google Gemini API Key for data extraction")
    
    # Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production", description="Secret key for JWT and encryption")
    FRONTEND_URL: str = Field(default="http://localhost:3000", description="URL do frontend para redirecionamentos")
    
    @field_validator('SUPABASE_URL', 'DATABASE_URL')
    @classmethod
    def validate_urls(cls, v: str, info: ValidationInfo) -> str:
        """Ensure URLs are properly formatted"""
        if info.field_name == 'DATABASE_URL' and v and v.startswith('postgres://'):
            v = v.replace('postgres://', 'postgresql://', 1)
        if not v or not v.startswith(('http://', 'https://', 'postgresql://')):
            raise ValueError(f'{info.field_name} must be a valid URL')
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = True

settings = Settings()
