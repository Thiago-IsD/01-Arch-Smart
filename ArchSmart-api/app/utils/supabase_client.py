"""
Supabase Storage client using REST API.
Lightweight alternative to the full supabase-py library.
"""
import httpx
import os
from typing import Optional
from dotenv import load_dotenv

# Force load .env
load_dotenv()


class SupabaseStorageClient:
    """Client for Supabase Storage operations using REST API."""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.anon_key = os.getenv("SUPABASE_KEY")
        
        if not self.url:
            raise ValueError("SUPABASE_URL must be set")
            
        if not self.service_role_key and not self.anon_key:
             raise ValueError("Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY must be set")
        
        # Debug: Check which key is being used
        print(f"🔑 Supabase Client Init: Service Key Present? {bool(self.service_role_key)}")
        if self.service_role_key:
             print(f"   Key starts with: {self.service_role_key[:5]}...")
        else:
             print("   Using Anon Key (RLS enforced)")

        # Prefer Service Role Key, fallback to Anon Key
        self.api_key = self.service_role_key or self.anon_key
        self.is_service_role = bool(self.service_role_key)
        
        self.storage_url = f"{self.url}/storage/v1"
        self.headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
        }
    
    async def _create_bucket(self, bucket: str, public: bool = True):
        """Creates a new storage bucket."""
        url = f"{self.storage_url}/bucket"
        payload = {
            "id": bucket,
            "name": bucket,
            "public": public,
            "file_size_limit": None,
            "allowed_mime_types": ["image/*", "application/pdf"]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers=self.headers
            )
            # 409 Conflict means it already exists (safe to ignore if we handled it correctly)
            if response.status_code not in [200, 201, 409]:
                print(f"⚠️ Failed to create bucket '{bucket}': {response.text}")

    async def upload_file(
        self,
        bucket: str,
        path: str,
        file_bytes: bytes,
        content_type: str = "image/png"
    ) -> str:
        """
        Upload a file to Supabase Storage.
        Auto-creates bucket if it doesn't exist.
        """
        upload_url = f"{self.storage_url}/object/{bucket}/{path}"
        
        headers = {
            **self.headers,
            "Content-Type": content_type,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                upload_url,
                content=file_bytes,
                headers=headers,
                timeout=30.0
            )
            
            # If bucket not found (404 typically, or raw error), try to create it
            if response.status_code == 404 or (response.status_code == 400 and "bucket" in response.text.lower()):
                if self.is_service_role:
                    print(f"ℹ️ Bucket '{bucket}' might be missing. Attempting to create...")
                    await self._create_bucket(bucket, public=True)
                    
                    # Retry upload
                    response = await client.post(
                        upload_url,
                        content=file_bytes,
                        headers=headers,
                        timeout=30.0
                    )
                else:
                    print(f"⚠️ Bucket '{bucket}' missing but cannot auto-create (No Service Key).")
            
            if response.status_code not in [200, 201]:
                error_msg = f"Upload failed: {response.status_code} - {response.text}"
                print(f"❌ {error_msg}")
                raise Exception(error_msg)
        
        # Return public URL
        return self.get_public_url(bucket, path)
    
    def get_public_url(self, bucket: str, path: str) -> str:
        """
        Get public URL for a file in Supabase Storage.
        """
        return f"{self.storage_url}/object/public/{bucket}/{path}"

    async def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        """
        Create a temporary signed URL for a private file.
        
        Args:
            bucket: Bucket name
            path: File path within bucket
            expires_in: Expiration in seconds (default 1 hour)
        """
        url = f"{self.storage_url}/object/sign/{bucket}/{path}"
        
        payload = {"expiresIn": expires_in}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers=self.headers,
                timeout=10.0
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to sign URL: {response.text}")
                return ""
            
            # Response format: { "signedURL": "..." }
            # But the stored URL in response usually needs the base URL prepended if it comes back relative?
            # Supabase API usually returns: { "signedURL": "https://.../sign/..." } - full URL.
            data = response.json()
            # Supabase REST API checks: it actually returns specific structure.
            # Let's verify standard Supabase Storage API behavior:
            # POST /object/sign/{bucket}/{path} -> { "signedURL": "..." } containing the full URL with token
            
            # Usually Supabase returns relative path "/object/sign/..." prefixed with nothing?
            # Actually, standard GoTrue/Storage implementation returns:
            # { "signedURL": "http://supabase.../object/sign/bucket/path?token=..." }
            
            # Let's assume it returns a relative path if not full, but usually it's full string relative to API?
            # Let's inspect typical response. 
            # If it returns relative, we prepend self.url. 
            # Most docs say it returns `{ "signedURL": "..." }`
            
            signed_url = data.get("signedURL")
            if signed_url and not signed_url.startswith("http"):
                 return f"{self.url}/storage/v1{signed_url}"
            
            return signed_url
        """
        Delete a file from Supabase Storage.
        
        Args:
            bucket: Bucket name
            path: File path within bucket
        
        Returns:
            True if deleted successfully
        """
        delete_url = f"{self.storage_url}/object/{bucket}/{path}"
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                delete_url,
                headers=self.headers,
                timeout=30.0
            )
            
            return response.status_code in [200, 204]


def get_storage_client() -> SupabaseStorageClient:
    """Get a Supabase Storage client instance."""
    return SupabaseStorageClient()
