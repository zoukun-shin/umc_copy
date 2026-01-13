/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["fico/zbalancesheet/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
