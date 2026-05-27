/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["fico/salesbillingposting/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
