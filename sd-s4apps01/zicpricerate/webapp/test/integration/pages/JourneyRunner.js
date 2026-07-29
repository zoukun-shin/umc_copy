sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"sd/zicpricerate/test/integration/pages/ZC_TSD_1023List.gen",
	"sd/zicpricerate/test/integration/pages/ZC_TSD_1023ObjectPage.gen"
], function (JourneyRunner, ZC_TSD_1023ListGenerated, ZC_TSD_1023ObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('sd/zicpricerate') + '/test/flp.html#app-preview',
        pages: {
			onTheZC_TSD_1023ListGenerated: ZC_TSD_1023ListGenerated,
			onTheZC_TSD_1023ObjectPageGenerated: ZC_TSD_1023ObjectPageGenerated
        },
        async: true
    });

    return runner;
});

