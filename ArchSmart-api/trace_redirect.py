import httpx
import sys

def trace_url(url):
    print(f"Tracing URL: {url}")
    try:
        with httpx.Client(follow_redirects=True) as client:
            resp = client.get(url)
            print(f"Final URL: {resp.url}")
            print("History:")
            for r in resp.history:
                print(f" - {r.status_code} -> {r.headers.get('Location')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Link provided by user
    link = "https://bafggjed.r.af.d.sendibt2.com/tr/cl/RiRCK1Vg8Fzou99YAUfdJhTulmgNz_GoyNX9nz-aQZ6f_zFkLUdQU86V9CFHpn66_jiz-b1fg3FQgT4tS1_PT63GGMJ3G1kPGTZNseRRiVZ6v6CU-kGUgCytfFCsmXZfKit-_aJ0pLYsAkUVmQxaRDQ6Tjy73UVsnfAO3Ro11xH4Qu11DTnAu5GAHC7-7_GHzHrZ9g5GNzE96e_0HNhGK53jY8DTGKPgsE6EB9zqUsi8MmbvvkTt9KN9lufhz3w1qJLC30sFGWnjUaRFeVSYS2TMBrg20oFdZdyPTUiVt_FSkafKHkQ4YvCYkniz6i-E4EdyYfyextJuN6zkuK2cSomlriusynm_GDXcco1kHXV7bXsG3NCcU6WpxOMYJkhvcG05EZ8kmsxOYaW1zjgekyP84FFITqnI4raFHO_f-bN7vEW06yv-YZiYytDcuzvXRH76xXeE4-DRYiRylK2cud2HCH0fEn5-_yKiJt06JQOV7rHq08M"
    trace_url(link)
