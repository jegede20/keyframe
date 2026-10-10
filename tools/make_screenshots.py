"""Render og-image.png + store screenshots from real HTML using headless Chrome."""
import asyncio, base64, os, sys
from choreographer import Browser
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shot_templates import OG_HTML, DESKTOP_HTML, MOBILE_HTML

ROOT = os.path.join(os.path.dirname(__file__), '..')
PUB = os.path.join(ROOT, 'public')

async def main():
    async with Browser(headless=True) as browser:
        tab = await browser.create_tab('about:blank')
        await tab.send_command('Emulation.setFocusEmulationEnabled', {'enabled': True})

        async def render(html, width, height, out_path, full=False):
            await tab.send_command('Emulation.setDeviceMetricsOverride', {
                'width': width, 'height': height, 'deviceScaleFactor': 2 if width < 500 else 1, 'mobile': width < 500,
            })
            await tab.send_command('Page.navigate', {'url': 'data:text/html;charset=utf-8,' + html.replace('#', '%23')})
            await asyncio.sleep(0.8)
            params = {'format': 'png'}
            if full:
                params['captureBeyondViewport'] = True
            res = await tab.send_command('Page.captureScreenshot', params)
            with open(out_path, 'wb') as fh:
                fh.write(base64.b64decode((res.get('result') or {})['data']))
            print('wrote', out_path, os.path.getsize(out_path), 'bytes')

        await render(OG_HTML, 1200, 630, os.path.join(PUB, 'og-image.png'))
        await render(DESKTOP_HTML, 1280, 720, os.path.join(PUB, 'screenshots', 'desktop-input.png'))
        await render(MOBILE_HTML, 390, 844, os.path.join(PUB, 'screenshots', 'mobile-results.png'))

asyncio.run(main())
