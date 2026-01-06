/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["fico/vat/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
