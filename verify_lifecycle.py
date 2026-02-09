from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to 800x600 for consistent coordinates
        context = browser.new_context(viewport={'width': 800, 'height': 600})
        page = context.new_page()

        # Load the game
        print("Loading game...")
        page.goto(f"file://{os.getcwd()}/loomivers_final.html")

        # Wait for loading (simulate 2s delay)
        time.sleep(3)

        # Click PLAY on Title Screen
        # Button: x=300, y=220, w=200, h=50. Center: 400, 245.
        print("Clicking PLAY on Title Screen (400, 245)...")
        page.mouse.click(400, 245)
        time.sleep(2)

        # Now on HUB
        # Button 'ENTER THE GLITCH': x=300, y=120, w=200, h=50. Center: 400, 145.
        print("Clicking ENTER THE GLITCH on HUB (400, 145)...")
        page.mouse.click(400, 145)
        time.sleep(2)

        # Check if we are in STORY or PLAYING
        # Story has click to continue.
        # Let's just click a few times to skip story.
        print("Clicking through STORY...")
        page.mouse.click(400, 300)
        time.sleep(1)
        page.mouse.click(400, 300)
        time.sleep(1)

        # Now on PLAYING
        print("Game should be playing. Calling window.pauseGame()...")
        page.evaluate("window.pauseGame()")
        time.sleep(1)

        # Verify PAUSED text
        page.screenshot(path="pause_verification_fixed.png")
        print("Screenshot saved to pause_verification_fixed.png")

        # Call resumeGame()
        print("Calling window.resumeGame()...")
        page.evaluate("window.resumeGame()")

        # Resume manually via UI button (PAUSED scene)
        # Button 'RESUME': x=canvas.width/2-100, y=canvas.height/2-40.
        # 800/2-100 = 300. 600/2-40 = 260. w=200, h=60.
        # Center: 400, 290.
        print("Clicking RESUME button (400, 290)...")
        page.mouse.click(400, 290)
        time.sleep(1)

        page.screenshot(path="resume_verification_fixed.png")
        print("Screenshot saved to resume_verification_fixed.png")

        browser.close()

if __name__ == "__main__":
    run()
