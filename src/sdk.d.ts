// SDK 0.9.0 does not declare `api.openUrl`. Delete this file when the widget builds with the
// SDK release that ships it.
import '@edgestation/sdk';

declare module '@edgestation/sdk' {
	interface WidgetApi {
		openUrl(url: string): Promise<void>;
	}
}
