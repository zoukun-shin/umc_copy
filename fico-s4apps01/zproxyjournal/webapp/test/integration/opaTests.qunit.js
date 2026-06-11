/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["fico/zproxyjournal/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
