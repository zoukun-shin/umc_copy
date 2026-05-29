sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"sd/customerreport/test/integration/pages/CustomerReportList",
	"sd/customerreport/test/integration/pages/CustomerReportObjectPage"
], function (JourneyRunner, CustomerReportList, CustomerReportObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('sd/customerreport') + '/test/flp.html#app-preview',
        pages: {
			onTheCustomerReportList: CustomerReportList,
			onTheCustomerReportObjectPage: CustomerReportObjectPage
        },
        async: true
    });

    return runner;
});

