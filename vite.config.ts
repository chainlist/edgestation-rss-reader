import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { widget } from '@edgestation/sdk/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

const APP = 'com.edgestation.dashboard';

/** The data folder of the EdgeStation app. Tauri puts it here on each system. */
function appData(): string {
	const home = homedir();
	if (process.platform === 'win32') return join(process.env.APPDATA ?? home, APP);
	if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', APP);
	return join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), APP);
}

/**
 * Copies each build to the widgets folder of the app on this machine. A reload of the Edge then
 * runs it. It does nothing in CI, or when the app was never started here.
 */
function installLocally(id: string): Plugin {
	let root = process.cwd();
	return {
		name: 'install-locally',
		apply: 'build',
		configResolved(config) {
			root = config.root;
		},
		writeBundle() {
			const data = appData();
			if (process.env.CI || !existsSync(data)) return;
			const dir = join(data, 'widgets', id);
			rmSync(dir, { recursive: true, force: true });
			mkdirSync(dir, { recursive: true });
			for (const file of ['manifest.json', 'icon.svg', 'dist']) {
				cpSync(join(root, file), join(dir, file), { recursive: true });
			}
			console.log(`Installed in ${dir}`);
		}
	};
}

// `emitCss: false` keeps each component's styles in its JavaScript: Svelte adds them to the
// widget's shadow root when it mounts, so there is no CSS file.
export default defineConfig({
	plugins: [svelte({ emitCss: false }), widget(), installLocally('rss-reader')]
});
