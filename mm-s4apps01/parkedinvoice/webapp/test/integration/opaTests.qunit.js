/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["mm/parkedinvoice/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
