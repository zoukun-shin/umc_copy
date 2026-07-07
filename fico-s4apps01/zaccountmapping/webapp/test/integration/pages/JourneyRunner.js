sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"fico/zaccountmapping/test/integration/pages/ZC_TFI_1035List.gen",
	"fico/zaccountmapping/test/integration/pages/ZC_TFI_1035ObjectPage.gen"
], function (JourneyRunner, ZC_TFI_1035ListGenerated, ZC_TFI_1035ObjectPageGenerated) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('fico/zaccountmapping') + '/test/flp.html#app-preview',
        pages: {
			onTheZC_TFI_1035ListGenerated: ZC_TFI_1035ListGenerated,
			onTheZC_TFI_1035ObjectPageGenerated: ZC_TFI_1035ObjectPageGenerated
        },
        async: true
    });

    return runner;
});

