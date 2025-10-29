sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"fico/zsalespurchaseprice/test/integration/pages/ZC_TFI_1024List",
	"fico/zsalespurchaseprice/test/integration/pages/ZC_TFI_1024ObjectPage"
], function (JourneyRunner, ZC_TFI_1024List, ZC_TFI_1024ObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('fico/zsalespurchaseprice') + '/test/flpSandbox.html#ficozsalespurchaseprice-tile',
        pages: {
			onTheZC_TFI_1024List: ZC_TFI_1024List,
			onTheZC_TFI_1024ObjectPage: ZC_TFI_1024ObjectPage
        },
        async: true
    });

    return runner;
});

