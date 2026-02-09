from playwright.sync_api import sync_playwright

def verify_map():
    print("Starting map verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        url = "http://localhost:8000/loomivers_final.html"
        print(f"Loading {url}...")
        page.goto(url)
        page.wait_for_timeout(3000) # Boot

        # Go to HUB
        w = page.evaluate("window.innerWidth")
        h = page.evaluate("window.innerHeight")
        page.mouse.click(w/2, 245)
        page.wait_for_timeout(1000)

        # Enter Game
        page.mouse.click(w/2, 145)
        page.wait_for_timeout(1000)
        page.mouse.click(w/2, h/2) # Skip Story

        print("In game, waiting for map load...")
        page.wait_for_timeout(2000)

        # Take screenshot of map
        page.screenshot(path="map_verification.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_map()
