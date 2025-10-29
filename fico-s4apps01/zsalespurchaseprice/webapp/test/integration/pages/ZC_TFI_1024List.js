sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'fico.zsalespurchaseprice',
            componentId: 'ZC_TFI_1024List',
            contextPath: '/ZC_TFI_1024'
        },
        CustomPageDefinitions
    );
});